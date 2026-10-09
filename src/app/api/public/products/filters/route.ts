import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ramSize, storageSize } from "@/lib/normalize-ram";
import {
  NEED_TAGS,
  PRICE_BUCKETS,
  keepValidNeedTags,
  priceBucketOf,
} from "@/lib/product-collections";
import { kindForProduct, parseProductKind, type ProductKind } from "@/lib/product-kind";

export type FilterOption = {
  value: string;
  label: string;
  count: number;
  // Mở rộng — chỉ trên `categories`: slug + parentId + parentSlug để header có thể
  // group riêng mục "Laptop" và "Linh kiện PC" chỉ từ 1 lần fetch.
  slug?: string | null;
  parentId?: string | null;
  parentSlug?: string | null;
  kind?: ProductKind;
  // Cho client biết node này còn danh mục con để hiển thị "Tất cả X mục" và
  // để page /products?category=laptop tự gộp tất cả hậu duệ thay vì rỗng.
  isParent?: boolean;
  descendantCount?: number;
};

export type ProductFilters = {
  brands: FilterOption[];
  categories: FilterOption[];
  needTags: FilterOption[];
  priceBuckets: FilterOption[];
  ram: FilterOption[];
  cpu: FilterOption[];
  storage: FilterOption[];
  priceRange: { min: number; max: number };
};

type ProductRow = { id: string; brand_id: string | null; category_id: string | null; tags: string[] | null };
type VariantRow = {
  product_id: string | null;
  selling_price: number | null;
  specs: Record<string, unknown> | null;
  is_active: boolean | null;
};
type NamedRow = { id: string; name: string };
// Category row kèm slug + parent để header có thể group "Linh kiện PC" riêng.
type CategoryRow = { id: string; name: string; slug: string; parent_id: string | null };

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toOptions(
  counts: Map<string, number>,
  labels?: Map<string, string>,
): FilterOption[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: labels?.get(value) ?? value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"));
}

export async function GET(req: NextRequest) {
  // kind= → trả filter rỗng cho kind đó. kind không truyền → trả đầy đủ
  // (giữ backward-compat cho callers cũ như mega-menu header cần cả 2 nhóm).
  const kind = parseProductKind(req.nextUrl.searchParams.get("kind"));

  const empty: ProductFilters = {
    brands: [],
    categories: [],
    needTags: [],
    priceBuckets: [],
    ram: [],
    cpu: [],
    storage: [],
    priceRange: { min: 0, max: 0 },
  };

  try {
    const supabase = createAdminClient();

    const { data: rawProducts } = await supabase
      .from("products")
      .select("id,brand_id,category_id,tags")
      .eq("status", "active");

    const allProducts = (rawProducts ?? []) as ProductRow[];
    if (allProducts.length === 0) return NextResponse.json(empty);

    // Lấy toàn bộ category (chỉ vài chục record) để suy ra kind cho từng product.
    const { data: rawAllCategories } = await supabase
      .from("categories")
      .select("id,name,slug,parent_id");
    const allCategories = (rawAllCategories ?? []) as CategoryRow[];
    const parentIds = Array.from(
      new Set(allCategories.map((c) => c.parent_id).filter((x): x is string => !!x)),
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
    for (const c of allCategories) {
      const parentSlug = c.parent_id ? parentSlugById.get(c.parent_id) ?? null : null;
      kindByCategory.set(c.id, kindForProduct({ parentSlug, slug: c.slug }));
    }

    // Lọc products theo kind (nếu có) trước khi đếm filter — tránh đếm nhầm
    // CPU/RAM vào nhóm "Laptop" khi user đang ở trang linh kiện và ngược lại.
    const products: ProductRow[] =
      kind == null
        ? allProducts
        : allProducts.filter((p) =>
            !p.category_id
              ? kind === "laptop"
              : kindByCategory.get(p.category_id) === kind,
          );

    if (products.length === 0) return NextResponse.json(empty);

    const ids = products.map((p) => p.id);

    const brandCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const needTagCounts = new Map<string, number>();
    for (const p of products) {
      if (p.brand_id) bump(brandCounts, p.brand_id);
      if (p.category_id) bump(categoryCounts, p.category_id);
      for (const slug of keepValidNeedTags(p.tags)) bump(needTagCounts, slug);
    }

    const [{ data: rawVariants }, { data: rawBrands }] = await Promise.all([
      supabase.from("product_variants").select("product_id,selling_price,specs,is_active").in("product_id", ids),
      brandCounts.size ? supabase.from("brands").select("id,name").in("id", [...brandCounts.keys()]) : Promise.resolve({ data: [] }),
    ]);

    // categories cần lọc theo kind nếu được truyền, ngược lại trả tất cả để mega-menu
    // header vẫn group được "Laptop" / "Linh kiện PC".
    const categoriesToLoad = kind == null
      ? allCategories
      : (() => {
          const allowed = new Set<string>();
          for (const p of products) if (p.category_id) allowed.add(p.category_id);
          return allCategories.filter((c) => allowed.has(c.id));
        })();
    const rawCategories = kind == null
      ? allCategories
      : categoriesToLoad;

    const variants = (rawVariants ?? []) as VariantRow[];

    // Đếm cấu hình theo product (mỗi product tính 1 lần / giá trị spec).
    const ramByProduct = new Map<string, Set<string>>();
    const cpuByProduct = new Map<string, Set<string>>();
    const storageByProduct = new Map<string, Set<string>>();
    const minPriceByProduct = new Map<string, number>();
    let priceMin = Infinity;
    let priceMax = 0;

    const addSpec = (m: Map<string, Set<string>>, pid: string, val: unknown) => {
      if (typeof val !== "string" || !val.trim()) return;
      if (!m.has(pid)) m.set(pid, new Set());
      m.get(pid)!.add(val.trim());
    };

    for (const v of variants) {
      if (!v.product_id || v.is_active === false) continue;
      if (v.selling_price != null && v.selling_price > 0) {
        if (v.selling_price < priceMin) priceMin = v.selling_price;
        if (v.selling_price > priceMax) priceMax = v.selling_price;
        const cur = minPriceByProduct.get(v.product_id);
        if (cur == null || v.selling_price < cur) minPriceByProduct.set(v.product_id, v.selling_price);
      }
      if (v.specs && typeof v.specs === "object") {
        // RAM: gom nhóm bộ lọc CHỈ theo dung lượng (8GB / 16GB / 32GB) cho gọn,
        // vì đa số dữ liệu không ghi DDR — tách theo DDR sẽ làm 16GB bị chia nhiều dòng.
        addSpec(ramByProduct, v.product_id, ramSize(v.specs.ram));
        addSpec(cpuByProduct, v.product_id, v.specs.cpu);
        // Ổ cứng: DB lưu key "ssd" (fallback "storage"), gom theo dung lượng (512GB/1TB) cho gọn.
        addSpec(storageByProduct, v.product_id, storageSize(v.specs.ssd ?? v.specs.storage));
      }
    }

    const tally = (m: Map<string, Set<string>>) => {
      const counts = new Map<string, number>();
      for (const set of m.values()) for (const val of set) bump(counts, val);
      return counts;
    };

    const brandLabels = new Map((rawBrands as NamedRow[] ?? []).map((b) => [b.id, b.name]));

    const categoryLabels = new Map((rawCategories as CategoryRow[] ?? []).map((c) => [c.id, c.name]));
    const categorySlugs = new Map((rawCategories as CategoryRow[] ?? []).map((c) => [c.id, c.slug]));
    const categoryParents = new Map((rawCategories as CategoryRow[] ?? []).map((c) => [c.id, c.parent_id]));

    // === Cây cha-con dùng cho isParent + descendantCount ===
    // 1) childrenOf[id] = danh sách id con trực tiếp.
    // 2) Với mỗi category, đệ quy cộng categoryCounts của self + toàn bộ hậu duệ
    //    → descendantCount để client hiển thị "Tất cả X sản phẩm" cho cả node cha.
    const childrenOf = new Map<string, string[]>();
    for (const c of rawCategories as CategoryRow[]) {
      if (!c.parent_id) continue;
      const arr = childrenOf.get(c.parent_id) ?? [];
      arr.push(c.id);
      childrenOf.set(c.parent_id, arr);
    }

    const aggregateCounts = (rootId: string): number => {
      let total = categoryCounts.get(rootId) ?? 0;
      const stack: string[] = [rootId];
      const visited = new Set<string>([rootId]);
      while (stack.length) {
        const cur = stack.pop()!;
        const kids = childrenOf.get(cur);
        if (!kids) continue;
        for (const k of kids) {
          if (visited.has(k)) continue;
          visited.add(k);
          total += categoryCounts.get(k) ?? 0;
          stack.push(k);
        }
      }
      return total;
    };

    // Đếm khoảng giá theo giá min mỗi product.
    const priceBucketCounts = new Map<string, number>();
    for (const price of minPriceByProduct.values()) {
      const slug = priceBucketOf(price);
      if (slug) bump(priceBucketCounts, slug);
    }

    // need-tags & price-buckets giữ THỨ TỰ CỐ ĐỊNH theo định nghĩa, chỉ hiện mục có count > 0.
    const needTags: FilterOption[] = NEED_TAGS
      .map((t) => ({ value: t.slug, label: t.label, count: needTagCounts.get(t.slug) ?? 0 }))
      .filter((o) => o.count > 0);
    const priceBuckets: FilterOption[] = PRICE_BUCKETS
      .map((b) => ({ value: b.slug, label: b.label, count: priceBucketCounts.get(b.slug) ?? 0 }))
      .filter((o) => o.count > 0);

    const categories: FilterOption[] = [...categoryCounts.entries()]
      .map(([value, count]) => {
        const parentId = categoryParents.get(value) ?? null;
        const parentSlug = parentId ? parentSlugById.get(parentId) ?? null : null;
        const k = kindByCategory.get(value) ?? "laptop";
        const isParent = (childrenOf.get(value)?.length ?? 0) > 0;
        return {
          value,
          label: categoryLabels.get(value) ?? value,
          count,
          slug: categorySlugs.get(value) ?? null,
          parentId,
          parentSlug,
          kind: k,
          isParent,
          descendantCount: isParent ? aggregateCounts(value) : count,
        };
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "vi"));

    const result: ProductFilters = {
      brands: toOptions(brandCounts, brandLabels),
      categories,
      needTags,
      priceBuckets,
      ram: toOptions(tally(ramByProduct)),
      cpu: toOptions(tally(cpuByProduct)),
      storage: toOptions(tally(storageByProduct)),
      priceRange: { min: priceMin === Infinity ? 0 : priceMin, max: priceMax },
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(empty);
  }
}
