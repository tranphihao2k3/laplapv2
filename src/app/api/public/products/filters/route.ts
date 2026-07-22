import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ramSize, storageSize } from "@/lib/normalize-ram";
import {
  NEED_TAGS,
  PRICE_BUCKETS,
  keepValidNeedTags,
  priceBucketOf,
} from "@/lib/product-collections";

export type FilterOption = { value: string; label: string; count: number };

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

export async function GET() {
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

    const products = (rawProducts ?? []) as ProductRow[];
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

    const [{ data: rawVariants }, { data: rawBrands }, { data: rawCategories }] = await Promise.all([
      supabase.from("product_variants").select("product_id,selling_price,specs,is_active").in("product_id", ids),
      brandCounts.size ? supabase.from("brands").select("id,name").in("id", [...brandCounts.keys()]) : Promise.resolve({ data: [] }),
      categoryCounts.size
        ? supabase.from("categories").select("id,name").in("id", [...categoryCounts.keys()])
        : Promise.resolve({ data: [] }),
    ]);

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
    const categoryLabels = new Map((rawCategories as NamedRow[] ?? []).map((c) => [c.id, c.name]));

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

    const result: ProductFilters = {
      brands: toOptions(brandCounts, brandLabels),
      categories: toOptions(categoryCounts, categoryLabels),
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
