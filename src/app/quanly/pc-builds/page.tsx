/**
 * Trang danh sách PC Builds cho admin.
 *
 * Server component: fetch initial list (20 dòng đầu) + user lookup map → truyền
 * xuốn client component `PcBuildListTable` để hiển thị + filter/refetch thêm.
 *
 * Middleware (đã có sẵn cho /quanly/*) check role admin, không cần check lại trong
 * page này.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PcBuildListTable } from "@/components/admin/pc-builder/pc-build-list-table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function PcBuildsPage() {
  const supabase = await createClient();

  // Auth check: middleware đã cover, nhưng defense-in-depth — nếu không có session
  // thì đẩy về trang login.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  // Lấy 20 build đầu + tổng count (cho pagination).
  const { data: buildRows, count } = await supabase
    .from("pc_builds")
    .select("*, user_profiles:user_id(id, full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const buildsRaw = (buildRows ?? []) as unknown as Array<
    import("@/components/admin/pc-builder/pc-build-list-table").InitialPayload["builds"][number] & {
      user_profiles: { id: string; full_name: string | null } | null;
    }
  >;

  // Map user_id → thông tin user. Lấy luôn cả user_profiles của tất cả user có build
  // để dropdown filter hiển thị tên (giới hạn 200 user cho nhẹ).
  const userIds = Array.from(
    new Set(buildsRaw.map((b) => b.user_id).filter((v): v is string => Boolean(v))),
  );
  const userMap = new Map<string, { id: string; full_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
      userMap.set(p.id, p);
    }
  }

  // Đếm items cho từng build hiển thị ban đầu (1 query gộp)
  const buildIds = buildsRaw.map((b) => b.id);
  const countsMap = new Map<string, number>();
  if (buildIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("pc_build_items")
      .select("build_id, qty")
      .in("build_id", buildIds);
    for (const row of (itemRows ?? []) as Array<{ build_id: string; qty: number | null }>) {
      countsMap.set(row.build_id, (countsMap.get(row.build_id) ?? 0) + (row.qty ?? 0));
    }
  }

  const builds = buildsRaw.map((b) => ({
    ...b,
    user: b.user_profiles ?? userMap.get(b.user_id ?? "") ?? null,
    items_count: countsMap.get(b.id) ?? 0,
  }));

  const users = Array.from(userMap.values());

  return (
    <PcBuildListTable
      initialData={{
        builds,
        users,
        total: count ?? builds.length,
      }}
    />
  );
}