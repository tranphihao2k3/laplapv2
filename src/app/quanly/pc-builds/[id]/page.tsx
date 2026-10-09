/**
 * Trang chi tiết 1 PC Build cho admin.
 *
 * Server component: fetch build + items (join products + categories cho thumbnail
 * và tên danh mục) + user lookup → truyền xuốn client component.
 * Client component xử lý in ấn (window.print) + xoá build.
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PcBuildDetail } from "@/components/admin/pc-builder/pc-build-detail";
import type { PcBuildRow, PcBuildItemRow } from "@/components/admin/pc-builder/helpers";

export const dynamic = "force-dynamic";

type ItemView = PcBuildItemRow & {
  product: { id: string; name: string; slug: string | null; thumbnail_url: string | null } | null;
  category: { id: string; name: string; slug: string } | null;
};

export default async function PcBuildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    redirect("/auth/login");
  }

  // Fetch build
  const { data: buildRow, error: buildErr } = await supabase
    .from("pc_builds")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (buildErr) {
    return (
      <div className="p-6 text-destructive">
        Lỗi khi tải cấu hình: {buildErr.message}
      </div>
    );
  }
  if (!buildRow) {
    notFound();
  }
  const build = buildRow as PcBuildRow;

  // Fetch items + join product (thumbnail). category_slug đã có sẵn trong row nên
  // không cần join categories — display label đã có trong helper CATEGORY_LABELS.
  const { data: itemRows, error: itemsErr } = await supabase
    .from("pc_build_items")
    .select(
      "id, build_id, product_id, category_slug, qty, unit_price, created_at, product:products(id, name, slug, thumbnail_url)",
    )
    .eq("build_id", id)
    .order("created_at", { ascending: true });

  if (itemsErr) {
    return (
      <div className="p-6 text-destructive">
        Lỗi khi tải linh kiện: {itemsErr.message}
      </div>
    );
  }

  // Supabase trả về product có thể là 1 object hoặc mảng tuỳ FK → chuẩn hoá.
  // category thì tra từ bảng categories dựa vào category_slug (1 query gộp).
  const uniqueSlugs = Array.from(
    new Set(((itemRows ?? []) as unknown as Array<{ category_slug: string }>).map((r) => r.category_slug)),
  );
  const categoryMap = new Map<string, { id: string; name: string; slug: string }>();
  if (uniqueSlugs.length > 0) {
    const { data: catRows } = await supabase
      .from("categories")
      .select("id, name, slug")
      .in("slug", uniqueSlugs);
    for (const c of (catRows ?? []) as Array<{ id: string; name: string; slug: string }>) {
      categoryMap.set(c.slug, c);
    }
  }

  const items: ItemView[] = ((itemRows ?? []) as unknown as Array<
    PcBuildItemRow & {
      product: { id: string; name: string; slug: string | null; thumbnail_url: string | null } | { id: string; name: string; slug: string | null; thumbnail_url: string | null }[] | null;
    }
  >).map((r) => ({
    ...r,
    product: Array.isArray(r.product) ? (r.product[0] ?? null) : r.product ?? null,
    category: categoryMap.get(r.category_slug) ?? null,
  }));

  // Fetch user (nếu build có user_id)
  let user: { id: string; full_name: string | null } | null = null;
  if (build.user_id) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id, full_name")
      .eq("id", build.user_id)
      .maybeSingle();
    user = (profile as { id: string; full_name: string | null } | null) ?? null;
  }

  return <PcBuildDetail initialBuild={{ build, items, user }} />;
}