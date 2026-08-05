/**
 * Đọc dữ liệu sản phẩm cho trang so sánh — SERVER ONLY.
 *
 * Dùng createAdminClient() vì RLS chặn anon (cùng lý do trang chi tiết sản phẩm
 * phải dùng admin client, xem src/app/(client)/products/[slug]/page.tsx).
 * KHÔNG import file này vào client component.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { keepValidNeedTags } from "@/lib/product-collections";
import { mergeVariants, type VariantForMerge } from "@/lib/products/merge-variant-specs";
import type { ProductForCompare } from "./types";

/** Tối đa 4 máy — giới hạn của cả UI và prompt AI. */
export const MAX_COMPARE = 4;

type ProductRow = {
  id: string;
  name: string;
  slug: string | null;
  thumbnail_url: string | null;
  status: string | null;
  tags: string[] | null;
  brand_id: string | null;
};

/** Chỉ nhận UUID để không đưa rác vào query. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tách chuỗi "id1,id2,id3" từ query string thành mảng id hợp lệ, đã khử trùng,
 * giới hạn MAX_COMPARE.
 */
export function parseCompareIds(input: string | null | undefined): string[] {
  if (!input) return [];
  const out: string[] = [];
  for (const part of input.split(",")) {
    const id = part.trim().toLowerCase();
    if (UUID_RE.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_COMPARE) break;
  }
  return out;
}

/**
 * Lấy dữ liệu các máy để so sánh.
 *
 * Chịu được: id không tồn tại, sản phẩm không active, sản phẩm KHÔNG có variant
 * (→ specs rỗng, price 0). Kết quả giữ ĐÚNG THỨ TỰ `ids` truyền vào để cột trong
 * bảng khớp thứ tự người dùng đã chọn.
 */
export async function getCompareProducts(ids: string[]): Promise<ProductForCompare[]> {
  if (ids.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { data: rawProducts, error } = await supabase
    .from("products")
    .select("id,name,slug,thumbnail_url,status,tags,brand_id")
    .in("id", ids)
    .eq("status", "active");
  if (error) throw error;

  const products = (rawProducts ?? []) as ProductRow[];
  if (products.length === 0) return [];

  const foundIds = products.map((p) => p.id);

  const [variantsRes, brandsRes] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id,product_id,selling_price,specs,weight,is_active")
      .in("product_id", foundIds),
    (async () => {
      const brandIds = [...new Set(products.map((p) => p.brand_id).filter((b): b is string => !!b))];
      if (brandIds.length === 0) return { data: [] };
      return supabase.from("brands").select("id,name").in("id", brandIds);
    })(),
  ]);

  const variants = (variantsRes.data ?? []) as VariantForMerge[];
  const merged = mergeVariants(variants);

  const brandName = new Map(
    ((brandsRes.data ?? []) as { id: string; name: string }[]).map((b) => [b.id, b.name]),
  );

  // Tồn kho theo variant active → suy ra product còn hàng hay không.
  const activeVariantIds = variants.filter((v) => v.is_active !== false).map((v) => v.id);
  const stockByProduct = new Map<string, number>();
  if (activeVariantIds.length > 0) {
    const { data: rawStocks } = await supabase
      .from("stock_levels")
      .select("product_variant_id,available_qty")
      .in("product_variant_id", activeVariantIds);
    const productOfVariant = new Map(variants.map((v) => [v.id, v.product_id]));
    for (const s of (rawStocks ?? []) as {
      product_variant_id: string | null;
      available_qty: number | null;
    }[]) {
      if (!s.product_variant_id) continue;
      const pid = productOfVariant.get(s.product_variant_id);
      if (!pid) continue;
      stockByProduct.set(pid, (stockByProduct.get(pid) ?? 0) + (s.available_qty ?? 0));
    }
  }

  const byId = new Map(products.map((p) => [p.id, p]));

  // Giữ đúng thứ tự ids đầu vào; id không tìm thấy bị bỏ qua (FE tự dọn khỏi URL/store).
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is ProductRow => !!p)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug ?? p.id,
      image: p.thumbnail_url,
      price: merged.minPrice.get(p.id) ?? 0,
      brandName: p.brand_id ? brandName.get(p.brand_id) ?? null : null,
      tags: keepValidNeedTags(p.tags),
      specs: merged.specs.get(p.id) ?? {},
      variantWeightKg: merged.weight.get(p.id) ?? null,
      inStock: (stockByProduct.get(p.id) ?? 0) > 0,
    }));
}
