/**
 * Phân loại "kind" cho sản phẩm (laptop vs linh kiện PC) dựa trên cấu trúc category.
 *
 * Quy ước phân loại (xem supabase/migrations/030_pc_builder.sql):
 *  - "Linh kiện PC" có slug `pc-parts` ở root (parent_id = null).
 *    Mọi category con (slug: cpu, mainboard, ram, gpu, ssd, hdd, psu, case, cooler, ...)
 *    đều là linh kiện PC.
 *  - Tất cả category còn lại (root + con) mặc định là laptop.
 *    Header hiện đang dùng logic `parentSlug !== "pc-parts"` nên top-level category
 *    có parent_id = null cũng tính là laptop — hàm dưới match đúng convention đó.
 *
 * Hàm pure, không phụ thuộc DB — chỉ cần 2 thông tin đầu vào:
 *  - `parentSlug`: slug của parent (null nếu category ở root).
 *  - `categorySlug`: slug của category (dùng cho một số edge case).
 */

export type ProductKind = "laptop" | "pc_component";

export const PRODUCT_KINDS: ProductKind[] = ["laptop", "pc_component"];

/** Slug đại diện cho nhóm "Linh kiện PC" ở cấp root. */
export const PC_PARTS_PARENT_SLUG = "pc-parts";

/**
 * Quyết định `kind` của một category dựa trên slug parent.
 *
 * @param parentSlug slug của category cha (null nếu category ở root)
 * @param _categorySlug slug của category hiện tại (giữ để mở rộng tương lai)
 */
export function kindForCategory(parentSlug: string | null | undefined, _categorySlug?: string | null): ProductKind {
  if (parentSlug === PC_PARTS_PARENT_SLUG) return "pc_component";
  return "laptop";
}

/**
 * Quyết định `kind` cho một PRODUCT dựa trên thông tin category của nó.
 *
 * Lưu ý: nếu product không có category_id (categoryId = null) → mặc định coi như
 * `laptop` để không che giấu sản phẩm khỏi catalog (an toàn hơn ẩn luôn).
 */
export function kindForProduct(category: {
  parentSlug: string | null | undefined;
  slug?: string | null;
} | null | undefined): ProductKind {
  if (!category) return "laptop";
  return kindForCategory(category.parentSlug, category.slug);
}

/** Nhãn tiếng Việt cho từng kind — dùng ở UI filter / breadcrumb / title. */
export const KIND_LABEL: Record<ProductKind, string> = {
  laptop: "Laptop",
  pc_component: "Linh kiện PC",
};

/** Label ngắn gọn để dùng trong heading (vd tiêu đề trang /products). */
export const KIND_LABEL_SHORT: Record<ProductKind, string> = {
  laptop: "Laptop",
  pc_component: "Linh kiện",
};

/** Mô tả SEO mặc định cho trang listing theo kind. */
export const KIND_DESCRIPTION: Record<ProductKind, string> = {
  laptop: "Danh sách laptop chính hãng tại LapLap Cần Thơ — lọc theo cấu hình, giá và thương hiệu.",
  pc_component: "Danh sách linh kiện PC chính hãng tại LapLap Cần Thơ — CPU, RAM, VGA, SSD, nguồn, case và phụ kiện.",
};

/** Parse + validate `kind` từ query param. Trả về `null` nếu không hợp lệ / rỗng. */
export function parseProductKind(raw: string | null | undefined): ProductKind | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === "laptop" || v === "pc_component") return v;
  return null;
}
