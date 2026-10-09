import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ramSize, storageSize } from "@/lib/normalize-ram";
import { keepValidNeedTags, priceBucketOf } from "@/lib/product-collections";
import { mergeVariants, type VariantForMerge } from "@/lib/products/merge-variant-specs";
import { kindForProduct, parseProductKind, type ProductKind } from "@/lib/product-kind";

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
  /** Số tồn kho của variant đầu tiên — dùng để giới hạn add-to-cart. */
  stockQty?: number;
  /** ID của biến thể đầu tiên còn hàng — dùng để add-to-cart trực tiếp từ card. */
  variantId?: string;
  /**
   * Phân loại sản phẩm: "laptop" (mặc định) hoặc "pc_component".
   * Suy ra từ cấu trúc category — xem `lib/product-kind.ts`.
   * Giúp client lọc đúng nhóm ở UI (header, mega-menu, listing) mà không cần join thêm.
   */
  kind: ProductKind;
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
  // kind mặc định là "laptop" vì đa số traffic là khách xem laptop; trang /pc-builder &
  // bất kỳ chỗ nào cần linh kiện sẽ chủ động truyền kind=pc_component.
  const kind: ProductKind = parseProductKind(sp.get("kind")) ?? "laptop";
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
    if (tag) pq = pq.contains("tags", [tag]);
    if (q) pq = pq.ilike("name", `%${q}%`);

    // Category filter chấp nhận cả UUID (id) lẫn slug (vd "cpu", "ram") — resolve slug
    // sang id trước khi query để link header `/products?category=cpu` hoạt động.
    //
    // Mở rộng cha → con: nếu category truyền vào là node CÓ children (vd "laptop"
    // — cha của 5 mục con), API sẽ tự gộp toàn bộ hậu duệ. Khi muốn lấy 1 mục
    // con cụ thể, truyền slug/id của mục con đó (nó sẽ là lá → không mở rộng).
    let resolvedCategoryIds: string[] | null = null;
    let categoryExpanded = false;
    if (category) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);
      let rootId: string | null = null;
      if (isUuid) {
        rootId = category;
      } else {
        const { data: catRow } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", category)
          .maybeSingle();
        if (catRow?.id) rootId = catRow.id;
      }
      if (!rootId) {
        return NextResponse.json({
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          kind,
        });
      }

      // Lấy toàn bộ categories (bảng rất nhỏ, < 200 rows) để dựng cây cha-con.
      const { data: allCats } = await supabase
        .from("categories")
        .select("id,parent_id");
      const childrenOf = new Map<string, string[]>();
      for (const c of (allCats ?? []) as Array<{ id: string; parent_id: string | null }>) {
        if (!c.parent_id) continue;
        const arr = childrenOf.get(c.parent_id) ?? [];
        arr.push(c.id);
        childrenOf.set(c.parent_id, arr);
      }
      // DFS thu thập self + toàn bộ descendant
      const idSet = new Set<string>([rootId]);
      const stack: string[] = [rootId];
      while (stack.length) {
        const cur = stack.pop()!;
        const kids = childrenOf.get(cur);
        if (!kids) continue;
        for (const k of kids) {
          if (!idSet.has(k)) {
            idSet.add(k);
            stack.push(k);
          }
        }
      }
      resolvedCategoryIds = Array.from(idSet);
      categoryExpanded = resolvedCategoryIds.length > 1;
    }

    if (resolvedCategoryIds && resolvedCategoryIds.length > 0) {
      if (resolvedCategoryIds.length === 1) {
        pq = pq.eq("category_id", resolvedCategoryIds[0]);
      } else {
        pq = pq.in("category_id", resolvedCategoryIds);
      }
    }

    const { data: rawProducts, error } = await pq;
    if (error) throw error;

    const products = (rawProducts ?? []) as ProductRow[];
    if (products.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, limit, totalPages: 0, kind });
    }

    // ---- Lọc theo kind dựa trên category parent ----
    // Tải toàn bộ category liên quan (chỉ vài chục record) để xác định parent_slug
    // cho từng product. Cách này ổn định & khớp với convention của header.
    const categoryIds = Array.from(
      new Set(products.map((p) => p.category_id).filter((x): x is string => !!x)),
    );
    const categoryById = new Map<string, { id: string; slug: string; parent_id: string | null }>();
    if (categoryIds.length > 0) {
      const { data: rawCategories } = await supabase
        .from("categories")
        .select("id,slug,parent_id")
        .in("id", categoryIds);
      for (const c of (rawCategories ?? []) as Array<{ id: string; slug: string; parent_id: string | null }>) {
        categoryById.set(c.id, c);
      }
    }
    // Map parent_id -> slug (cần cho kind resolver).
    const parentIds = Array.from(
      new Set([...categoryById.values()].map((c) => c.parent_id).filter((x): x is string => !!x)),
    );
    const parentSlugById = new Map<string, string>();
    if (parentIds.length > 0) {
      const { data: rawParents } = await supabase
        .from("categories")
        .select("id,slug")
        .in("id", parentIds);
      for (const p of (rawParents ?? []) as Array<{ id: string; slug: string }>) {
        parentSlugById.set(p.id, p.slug);
      }
    }
    const kindByCategory = new Map<string, ProductKind>();
    for (const cat of categoryById.values()) {
      const parentSlug = cat.parent_id ? parentSlugById.get(cat.parent_id) ?? null : null;
      kindByCategory.set(cat.id, kindForProduct({ parentSlug, slug: cat.slug }));
    }

    const productsByKind = products.filter((p) => {
      if (!p.category_id) return kind === "laptop"; // mặc định: không có category → laptop
      return kindByCategory.get(p.category_id) === kind;
    });
    if (productsByKind.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, limit, totalPages: 0, kind });
    }

    const ids = productsByKind.map((p) => p.id);
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
    const { minPrice: minPrice_, specs: specsByProduct, firstActiveVariantId } = mergeVariants(variants);

    const stockByProduct = new Map<string, number>();
    for (const v of variants) {
      if (!v.product_id || v.is_active === false) continue;
      stockByProduct.set(
        v.product_id,
        (stockByProduct.get(v.product_id) ?? 0) + (stockByVariant.get(v.id) ?? 0),
      );
    }

    // Liệt kê product có ít nhất 1 variant active — KHÔNG filter theo stock_levels.
    // PC components thường chưa có dòng stock_levels (build-on-demand), laptop cũng có thể
    // chưa seed stock; việc ẩn sản phẩm vì thiếu stock sẽ khiến khách không thấy catalog.
    // Tồn kho thực được kiểm tra ở product detail / add-to-cart — UI listing chỉ cần biết
    // sản phẩm có còn bán hay không (inStock = còn ít nhất 1 variant active).
    const activeProductIds = new Set(
      variants.filter((v) => v.is_active !== false).map((v) => v.product_id!).filter(Boolean),
    );
    const inStockProducts = productsByKind.filter((p) => activeProductIds.has(p.id));
    if (inStockProducts.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, limit, totalPages: 0, kind });
    }

    const inStockIds = inStockProducts.map((p) => p.id);

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
        .in("id", inStockIds);
      if (!engagementError && rawEngagement) {
        for (const row of rawEngagement as EngagementRow[]) {
          engagementByProduct.set(row.id, row);
        }
      }
    } catch {
      // Column chưa tồn tại → bỏ qua, V2 sẽ ẩn phần rating/sold.
    }

    let items: PublicProduct[] = inStockProducts.map((p) => {
      const eng = engagementByProduct.get(p.id);
      const firstVariantId = firstActiveVariantId.get(p.id);
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
        // inStock = có variant active. PC components không có stock_levels vẫn là "in stock"
        // vì catalog browseable; add-to-cart sẽ báo lỗi nếu variant thực sự hết.
        inStock: activeProductIds.has(p.id),
        // stockQty chỉ mang ý nghĩa tham khảo: 0 = chưa track / hết hàng.
        stockQty: firstVariantId ? (stockByVariant.get(firstVariantId) ?? 0) : 0,
        variantId: firstVariantId,
        kind: p.category_id ? kindByCategory.get(p.category_id) ?? "laptop" : "laptop",
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

    return NextResponse.json({
      items: paged,
      total,
      page,
      limit,
      totalPages,
      kind,
      categoryExpanded,
      categoryMatched: resolvedCategoryIds?.length ?? 0,
    });
  } catch {
    return NextResponse.json({
      items: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      kind,
      categoryExpanded: false,
      categoryMatched: 0,
    });
  }
}
