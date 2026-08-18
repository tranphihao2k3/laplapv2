import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ramSize, storageSize } from "@/lib/normalize-ram";
import { keepValidNeedTags, priceBucketOf } from "@/lib/product-collections";
import { mergeVariants, type VariantForMerge } from "@/lib/products/merge-variant-specs";

type VariantRow = VariantForMerge;

type StockRow = {
  product_variant_id: string | null;
  available_qty: number | null;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string | null;
  thumbnail_url: string | null;
  status: string | null;
  created_at: string | null;
  brand_id: string | null;
  category_id: string | null;
  tags: string[] | null;
  rating_avg: number | null;
  review_count: number | null;
  sold_count: number | null;
  is_new: boolean | null;
  is_hot: boolean | null;
};

export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  image?: string;
  price: number;
  createdAt: string | null;
  brandId: string | null;
  categoryId: string | null;
  tags: string[];
  specs: Record<string, string>;
  inStock: boolean;
  /** Rating trung bình 0–5, optional — undefined khi DB chưa có column. */
  rating?: number;
  /** Số lượng đánh giá. */
  reviewCount?: number;
  /** Số lượng đã bán. */
  soldCount?: number;
  /** Badge "Mới về". */
  isNew?: boolean;
  /** Badge "Hot". */
  isHot?: boolean;
};

const SORTS = ["newest", "price_asc", "price_desc", "name_asc"] as const;
type Sort = (typeof SORTS)[number];

function normalizeSpec(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const brand = sp.get("brand") ?? "";
  const category = sp.get("category") ?? "";
  const minPrice = Number(sp.get("minPrice") ?? "") || 0;
  const maxPrice = Number(sp.get("maxPrice") ?? "") || 0;
  const ram = (sp.get("ram") ?? "").toLowerCase();
  const cpu = (sp.get("cpu") ?? "").toLowerCase();
  const storage = (sp.get("storage") ?? "").toLowerCase();
  const tag = (sp.get("tag") ?? "").trim();
  const priceBucket = (sp.get("priceBucket") ?? "").trim();
  const sort: Sort = SORTS.includes(sp.get("sort") as Sort) ? (sp.get("sort") as Sort) : "newest";
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const limit = Math.min(48, Math.max(1, Number(sp.get("limit") ?? 12) || 12));

  try {
    const supabase = createAdminClient();

    let pq = supabase
      .from("products")
      .select("id,name,slug,thumbnail_url,status,created_at,brand_id,category_id,tags")
      .eq("status", "active");

    if (brand) pq = pq.eq("brand_id", brand);
    if (category) pq = pq.eq("category_id", category);
    if (tag) pq = pq.contains("tags", [tag]);
    if (q) pq = pq.ilike("name", `%${q}%`);

    const { data: rawProducts, error } = await pq;
    if (error) throw error;

    const products = (rawProducts ?? []) as ProductRow[];
    if (products.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, limit, totalPages: 0 });
    }

    const ids = products.map((p) => p.id);
    const { data: rawVariants } = await supabase
      .from("product_variants")
      .select("id,product_id,selling_price,specs,is_active")
      .in("product_id", ids);

    const variants = (rawVariants ?? []) as VariantRow[];

    // Tồn kho theo variant (cộng dồn tất cả kho) → suy ra product còn hàng hay không.
    const activeVariantIds = variants
      .filter((v) => v.is_active !== false)
      .map((v) => v.id);
    const stockByVariant = new Map<string, number>();
    if (activeVariantIds.length > 0) {
      const { data: rawStocks } = await supabase
        .from("stock_levels")
        .select("product_variant_id,available_qty")
        .in("product_variant_id", activeVariantIds);
      for (const s of (rawStocks ?? []) as StockRow[]) {
        if (!s.product_variant_id) continue;
        stockByVariant.set(
          s.product_variant_id,
          (stockByVariant.get(s.product_variant_id) ?? 0) + (s.available_qty ?? 0),
        );
      }
    }

    // Giá thấp nhất + specs đã merge (dùng chung với trang /so-sanh).
    const { minPrice: minPrice_, specs: specsByProduct } = mergeVariants(variants);

    const stockByProduct = new Map<string, number>();
    for (const v of variants) {
      if (!v.product_id || v.is_active === false) continue;
      stockByProduct.set(
        v.product_id,
        (stockByProduct.get(v.product_id) ?? 0) + (stockByVariant.get(v.id) ?? 0),
      );
    }

    // Engagement (rating/sold_count/is_new/is_hot) — query riêng và best-effort.
    // Nếu DB chưa có column (chưa apply 026) thì trả về map rỗng → V2 vẫn
    // render OK với các field optional bị ẩn.
    type EngagementRow = {
      id: string;
      rating_avg: number | null;
      review_count: number | null;
      sold_count: number | null;
      is_new: boolean | null;
      is_hot: boolean | null;
    };
    const engagementByProduct = new Map<string, EngagementRow>();
    try {
      const { data: rawEngagement, error: engagementError } = await supabase
        .from("products")
        .select("id,rating_avg,review_count,sold_count,is_new,is_hot")
        .in("id", ids);
      if (!engagementError && rawEngagement) {
        for (const row of rawEngagement as EngagementRow[]) {
          engagementByProduct.set(row.id, row);
        }
      }
    } catch {
      // Column chưa tồn tại → bỏ qua, V2 sẽ ẩn phần rating/sold.
    }

    let items: PublicProduct[] = products.map((p) => {
      const eng = engagementByProduct.get(p.id);
      const item: PublicProduct = {
        id: p.id,
        name: p.name,
        slug: p.slug ?? p.id,
        image: p.thumbnail_url ?? undefined,
        price: minPrice_.get(p.id) ?? 0,
        createdAt: p.created_at,
        brandId: p.brand_id,
        categoryId: p.category_id,
        tags: keepValidNeedTags(p.tags),
        specs: specsByProduct.get(p.id) ?? {},
        inStock: (stockByProduct.get(p.id) ?? 0) > 0,
      };
      if (eng) {
        if (typeof eng.rating_avg === "number") item.rating = eng.rating_avg;
        if (typeof eng.review_count === "number") item.reviewCount = eng.review_count;
        if (typeof eng.sold_count === "number") item.soldCount = eng.sold_count;
        if (eng.is_new) item.isNew = true;
        if (eng.is_hot) item.isHot = true;
      }
      return item;
    });

    if (minPrice > 0) items = items.filter((i) => i.price >= minPrice);
    if (maxPrice > 0) items = items.filter((i) => i.price <= maxPrice);
    if (priceBucket) items = items.filter((i) => priceBucketOf(i.price) === priceBucket);

    // RAM: khớp theo dung lượng (filter value từ /filters cũng là dung lượng, vd "16gb").
    if (ram) items = items.filter((i) => ramSize(i.specs.ram).toLowerCase() === ram);
    if (cpu) items = items.filter((i) => normalizeSpec(i.specs.cpu).includes(cpu));
    // Ổ cứng: khớp theo dung lượng, đọc key "ssd" (fallback "storage").
    if (storage) items = items.filter((i) => storageSize(i.specs.ssd ?? i.specs.storage).toLowerCase() === storage);

    items.sort((a, b) => {
      // Ưu tiên hàng CÒN tồn kho lên trước, hết hàng xuống cuối (áp cho mọi kiểu sắp xếp).
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      switch (sort) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "name_asc":
          return a.name.localeCompare(b.name, "vi");
        case "newest":
        default:
          return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      }
    });

    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    return NextResponse.json({ items: paged, total, page, limit, totalPages });
  } catch {
    return NextResponse.json({ items: [], total: 0, page, limit, totalPages: 0 });
  }
}
