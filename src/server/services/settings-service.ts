import { revalidateTag } from "next/cache";
import { createCrud, type ListQuery } from "./_crud-factory";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/api/guard";
import { Errors, paginated, type Paginated } from "@/lib/api/response";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type DB = SupabaseClient<Database>;
type SettingRow = Database["public"]["Tables"]["settings"]["Row"];

/**
 * Nhóm settings mà khi thay đổi phải invalidate cache hiển thị phía client.
 * Bất kỳ setting nào trong các nhóm này sẽ trigger `revalidateTag` cho
 * store-info, store-legal, store-contact, footer-settings.
 */
const PUBLIC_CACHE_GROUPS = new Set([
  "store",
  "legal",
  "contact",
  "footer",
]);

/**
 * Cache tags tương ứng với từng nhóm. Mỗi nhóm có thể map ra nhiều tag.
 */
const GROUP_TAGS: Record<string, string[]> = {
  store: ["store-info", "store-legal", "store-contact", "footer-settings"],
  legal: ["store-info", "store-legal", "store-contact"],
  contact: ["store-info", "store-contact", "footer-settings"],
  footer: ["footer-settings", "store-info"],
};

/**
 * Invalidate toàn bộ cache liên quan tới store-info/footer khi setting
 * thuộc một trong các nhóm public. Bỏ qua các nhóm nội bộ (vd: "homepage",
 * "warranty", "loyalty"...).
 *
 * Lưu ý: gọi `revalidateTag` SAU khi write xong. Nếu DB write fail thì
 * không gọi (giữ cache nguyên, an toàn).
 */
function revalidateIfPublic(groupName: string | null) {
  if (!groupName) return;
  if (!PUBLIC_CACHE_GROUPS.has(groupName)) return;
  const tags = GROUP_TAGS[groupName] ?? [];
  for (const t of tags) revalidateTag(t);
}

/**
 * Settings service — wrap `createCrud` cho bảng `settings`, BỔ SUNG:
 *   1. Auto-stamp `organization_id` cho row mới.
 *   2. Invalidate Next.js cache tags (store-info, footer, ...) khi row thuộc
 *      nhóm `store` / `legal` / `contact` / `footer`.
 *
 * Lý do: nếu chỉ gọi `invalidateBrandCache()` (client event) thì server
 * cache (`unstable_cache` của `/api/public/store-info`) vẫn cũ trong tối đa
 * 1 giờ. Phải `revalidateTag` server-side để lần gọi API tiếp theo lấy data mới.
 */
export const settingsService = {
  table: "settings" as const,

  async list(db: DB, query: ListQuery = {}): Promise<Paginated<SettingRow>> {
    return baseService.list(db, query);
  },

  async getById(db: DB, id: string): Promise<SettingRow> {
    return baseService.getById(db, id);
  },

  async create(db: DB, input: Partial<SettingRow>): Promise<SettingRow> {
    // Auto-stamp organization_id nếu bảng multi-tenant.
    const payload: Record<string, unknown> = { ...input };
    const { orgId } = await requireOrg();
    if (payload.organization_id == null) payload.organization_id = orgId;

    const { data, error } = await db
      .from("settings")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    // Invalidate cache nếu setting thuộc nhóm public.
    const groupName =
      (data as { group_name?: string | null } | null)?.group_name ?? null;
    revalidateIfPublic(groupName);

    return data as SettingRow;
  },

  async update(db: DB, id: string, input: Partial<SettingRow>): Promise<SettingRow> {
    // Lấy group_name cũ TRƯỚC khi update để biết có cần invalidate không
    // (trường hợp admin chuyển setting từ nhóm này sang nhóm khác).
    let oldGroup: string | null = null;
    try {
      const { data: before } = await db
        .from("settings")
        .select("group_name")
        .eq("id", id)
        .maybeSingle();
      oldGroup = (before?.group_name as string | null | undefined) ?? null;
    } catch {
      // ignore — vẫn cho update chạy
    }

    const { data, error } = await db
      .from("settings")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    // Invalidate cho CẢ nhóm cũ lẫn nhóm mới (phòng trường hợp admin
    // chuyển nhóm). Thông thường group_name không đổi, chỉ 1 lần revalidate.
    const newGroup =
      (data as { group_name?: string | null } | null)?.group_name ?? null;
    revalidateIfPublic(oldGroup);
    revalidateIfPublic(newGroup);

    return data as SettingRow;
  },

  async remove(db: DB, id: string): Promise<{ id: string }> {
    // Lấy group_name TRƯỚC khi xoá để invalidate đúng nhóm.
    let oldGroup: string | null = null;
    try {
      const { data: before } = await db
        .from("settings")
        .select("group_name")
        .eq("id", id)
        .maybeSingle();
      oldGroup = (before?.group_name as string | null | undefined) ?? null;
    } catch {
      // ignore
    }

    const { error } = await db.from("settings").delete().eq("id", id);
    if (error) throw error;

    revalidateIfPublic(oldGroup);
    return { id };
  },

  /**
   * Bulk delete — kế thừa từ factory, bổ sung invalidate sau khi xoá
   * theo từng id (giống flow của `remove`).
   */
  async bulkRemove(
    db: DB,
    ids: string[],
  ): Promise<{ deleted: string[]; missing: string[] }> {
    if (!Array.isArray(ids) || ids.length === 0) return { deleted: [], missing: [] };
    const validIds = [...new Set(ids.filter((x) => typeof x === "string" && x.trim().length > 0))];
    if (validIds.length === 0) return { deleted: [], missing: [] };

    // Lấy group_name của tất cả ids trước khi xoá để gom nhóm revalidate.
    const { data: rows } = await db
      .from("settings")
      .select("id, group_name")
      .in("id", validIds);
    const groupById = new Map<string, string | null>();
    for (const r of rows ?? []) {
      groupById.set(r.id as string, (r.group_name as string | null | undefined) ?? null);
    }
    const groupsToInvalidate = new Set<string>();
    for (const id of validIds) {
      const g = groupById.get(id);
      if (g && PUBLIC_CACHE_GROUPS.has(g)) groupsToInvalidate.add(g);
    }

    // Xoá tuần tự từng id (giống pattern của factory).
    const deleted: string[] = [];
    const missing: string[] = [];
    for (const id of validIds) {
      const { error } = await db.from("settings").delete().eq("id", id).select("id");
      if (error) {
        const code = (error as { code?: string }).code;
        const message = (error as { message?: string }).message ?? "";
        if (code === "23503") missing.push(id);
        else if (/No rows found|0 rows/i.test(message)) missing.push(id);
        else throw error;
      } else {
        deleted.push(id);
      }
    }

    for (const g of groupsToInvalidate) revalidateIfPublic(g);

    return { deleted, missing };
  },
};

// Cấu hình dùng cho factory CRUD — chỉ dùng cho list/getById.
const baseService = createCrud({
  table: "settings",
  searchColumns: ["key", "group_name"],
  allowedSortColumns: ["key"],
  defaultOrder: { column: "key", ascending: true },
  autoStampOrg: true,
});
