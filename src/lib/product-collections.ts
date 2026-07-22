/**
 * Bộ "nhóm nhu cầu" (need-tags) và "khoảng giá" (price buckets) — nguồn sự thật DUY NHẤT.
 *
 * - NEED_TAGS: do AI gán (chọn trong danh sách slug cố định, 1 sản phẩm được nhiều tag).
 *   Lưu vào cột products.tags dưới dạng slug (vd "gaming", "mong-nhe").
 * - PRICE_BUCKETS: KHÔNG cần AI — suy ra tự động từ giá bán khi hiển thị/lọc.
 *
 * Vì sao 1 máy nằm nhiều nhóm? "gaming/văn phòng/mỏng nhẹ/đồ hoạ" là NHU CẦU (nhiều-nhiều),
 * khác với category (chủng loại, 1 máy 1 category). Một máy có thể vừa gaming vừa mỏng nhẹ.
 */

export type NeedTag = {
  slug: string;
  label: string;
  /** Mô tả để AI biết khi nào nên gán tag này. */
  aiHint: string;
};

export const NEED_TAGS: NeedTag[] = [
  {
    slug: "gaming",
    label: "Gaming",
    aiHint: "Máy có GPU rời (NVIDIA GTX/RTX, AMD Radeon RX) đủ sức chơi game 3D/AAA, hoặc dòng máy gaming (Nitro, TUF, Legion, ROG, Predator, Katana...).",
  },
  {
    slug: "van-phong",
    label: "Văn phòng / học tập",
    aiHint: "Máy phục vụ tác vụ văn phòng, học tập cơ bản: soạn thảo, web, học online. Hầu hết laptop phổ thông đều thuộc nhóm này.",
  },
  {
    slug: "do-hoa",
    label: "Đồ hoạ / dựng phim",
    aiHint: "Máy mạnh cho sáng tạo nội dung: CPU nhiều nhân + RAM ≥16GB + GPU tốt hoặc màn màu chuẩn (MacBook Pro, dòng Creator, workstation, XPS cao cấp...).",
  },
  {
    slug: "mong-nhe",
    label: "Mỏng nhẹ / di động",
    aiHint: "Máy nhẹ (≈dưới 1.5kg), mỏng, pin tốt, dễ mang đi (ultrabook, MacBook Air, LG Gram, XPS 13, dòng Air/Slim...).",
  },
];

export const NEED_TAG_SLUGS = NEED_TAGS.map((t) => t.slug);
const NEED_TAG_LABEL = new Map(NEED_TAGS.map((t) => [t.slug, t.label]));

export function needTagLabel(slug: string): string {
  return NEED_TAG_LABEL.get(slug) ?? slug;
}

/** Lọc một mảng tag bất kỳ, chỉ giữ các slug hợp lệ thuộc bộ nhu cầu chuẩn. */
export function keepValidNeedTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const set = new Set(NEED_TAG_SLUGS);
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t === "string" && set.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

// ---------------- Khoảng giá (tự động theo giá bán, VND) ----------------

export type PriceBucket = {
  slug: string;
  label: string;
  /** [min, max) — max = null nghĩa là không giới hạn trên. */
  min: number;
  max: number | null;
};

const TR = 1_000_000;

export const PRICE_BUCKETS: PriceBucket[] = [
  { slug: "duoi-10tr", label: "Dưới 10 triệu", min: 0, max: 10 * TR },
  { slug: "10-15tr", label: "10 – 15 triệu", min: 10 * TR, max: 15 * TR },
  { slug: "15-20tr", label: "15 – 20 triệu", min: 15 * TR, max: 20 * TR },
  { slug: "tren-20tr", label: "Trên 20 triệu", min: 20 * TR, max: null },
];

const PRICE_BUCKET_LABEL = new Map(PRICE_BUCKETS.map((b) => [b.slug, b.label]));

export function priceBucketLabel(slug: string): string {
  return PRICE_BUCKET_LABEL.get(slug) ?? slug;
}

/** Trả slug khoảng giá cho một mức giá; null nếu giá <= 0 (chưa có giá). */
export function priceBucketOf(price: number): string | null {
  if (!price || price <= 0) return null;
  for (const b of PRICE_BUCKETS) {
    if (price >= b.min && (b.max == null || price < b.max)) return b.slug;
  }
  return null;
}
