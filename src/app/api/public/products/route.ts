import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ramSize, storageSize } from "@/lib/normalize-ram";
import { keepValidNeedTags, priceBucketOf } from "@/lib/product-collections";

type VariantRow = {
  id: string;
  product_id: string | null;
  selling_price: number | null;
  specs: Record<string, unknown> | null;
  is_active: boolean | null;
};

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

    const minPrice_ = new Map<string, number>();
    const specsByProduct = new Map<string, Record<string, string>>();
    const stockByProduct = new Map<string, number>();
    for (const v of variants) {
      if (!v.product_id || v.is_active === false) continue;
      if (v.selling_price != null) {
        const cur = minPrice_.get(v.product_id);
        if (cur == null || v.selling_price < cur) minPrice_.set(v.product_id, v.selling_price);
      }
      stockByProduct.set(
        v.product_id,
        (stockByProduct.get(v.product_id) ?? 0) + (stockByVariant.get(v.id) ?? 0),
      );
      if (v.specs && typeof v.specs === "object") {
        const merged = specsByProduct.get(v.product_id) ?? {};
        for (const [k, val] of Object.entries(v.specs)) {
          if (typeof val === "string" && val.trim() && !merged[k]) merged[k] = val.trim();
        }
        specsByProduct.set(v.product_id, merged);
      }
    }

    let items: PublicProduct[] = products.map((p) => ({
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
    }));

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
