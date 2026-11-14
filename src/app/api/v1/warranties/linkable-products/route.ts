/**
 * GET /v1/warranties/linkable-products
 *
 * Danh sách biến thể còn hàng để gắn vào phiếu bảo hành nhanh.
 * Chỉ trả về sản phẩm:
 *   - status = active, chưa archive;
 *   - variant đang active và còn tồn (available_qty > 0) trong kho của shop;
 *   - không phải quà tặng / combo (tag "qua-tang", "combo").
 *
 * Tồn kho cộng dồn tất cả kho active của tổ chức — khớp cách POS tính tồn.
 * Sản phẩm đã bán hết (tồn = 0) tự động biến mất khỏi danh sách.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { extractQuickSpecs, mergeSpecSources, type QuickSpec } from "@/lib/products/quick-specs";

export type LinkableProductVariant = {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  thumbnail_url: string | null;
  selling_price: number;
  stock: number;
  specs: QuickSpec[];
};

type VariantRow = {
  id: string;
  product_id: string | null;
  sku: string | null;
  barcode: string | null;
  name: string | null;
  selling_price: number | null;
  specs: Record<string, unknown> | null;
  attributes: Record<string, unknown> | null;
};

type ProductRow = {
  id: string;
  name: string;
  status: string | null;
  tags: string[] | null;
  thumbnail_url: string | null;
};

const GIFT_TAGS = new Set(["qua-tang", "combo"]);

export async function GET(req: NextRequest) {
  try {
    const { supabase, orgId } = await requirePermission("warranties.create");
    const limit = Math.min(300, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 200)));

    const { data: shops, error: shopErr } = await supabase
      .from("shops")
      .select("id")
      .eq("organization_id", orgId);
    if (shopErr) throw shopErr;
    const shopIds = ((shops ?? []) as Array<{ id: string }>).map((s) => s.id);
    if (shopIds.length === 0) return ok({ items: [] as LinkableProductVariant[], total: 0 });

    const { data: warehouses, error: whErr } = await supabase
      .from("warehouses")
      .select("id")
      .in("shop_id", shopIds)
      .eq("is_active", true);
    if (whErr) throw whErr;
    const warehouseIds = ((warehouses ?? []) as Array<{ id: string }>).map((w) => w.id);
    if (warehouseIds.length === 0) return ok({ items: [] as LinkableProductVariant[], total: 0 });

    // Chỉ lấy dòng còn tồn → sản phẩm hết hàng / đã bán không tốn query tiếp theo.
    const { data: stocks, error: stockErr } = await supabase
      .from("stock_levels")
      .select("product_variant_id, available_qty")
      .in("warehouse_id", warehouseIds)
      .gt("available_qty", 0)
      .limit(2000);
    if (stockErr) throw stockErr;

    const stockByVariant = new Map<string, number>();
    for (const s of (stocks ?? []) as Array<{ product_variant_id: string | null; available_qty: number | null }>) {
      if (!s.product_variant_id) continue;
      stockByVariant.set(
        s.product_variant_id,
        (stockByVariant.get(s.product_variant_id) ?? 0) + Number(s.available_qty ?? 0),
      );
    }
    if (stockByVariant.size === 0) return ok({ items: [] as LinkableProductVariant[], total: 0 });

    const variantIds = [...stockByVariant.keys()];
    const { data: variants, error: variantErr } = await supabase
      .from("product_variants")
      .select("id, product_id, sku, barcode, name, selling_price, specs, attributes")
      .in("id", variantIds)
      .eq("is_active", true);
    if (variantErr) throw variantErr;

    const variantRows = (variants ?? []) as VariantRow[];
    const productIds = [
      ...new Set(variantRows.map((v) => v.product_id).filter((id): id is string => Boolean(id))),
    ];
    if (productIds.length === 0) return ok({ items: [] as LinkableProductVariant[], total: 0 });

    const { data: products, error: productErr } = await supabase
      .from("products")
      .select("id, name, status, tags, thumbnail_url")
      .in("id", productIds)
      .eq("organization_id", orgId)
      .eq("status", "active");
    if (productErr) throw productErr;

    const productById = new Map<string, ProductRow>();
    for (const p of (products ?? []) as ProductRow[]) {
      const tags = p.tags ?? [];
      if (tags.some((t) => GIFT_TAGS.has(t))) continue;
      productById.set(p.id, p);
    }

    const items: LinkableProductVariant[] = [];
    for (const v of variantRows) {
      if (!v.product_id) continue;
      const product = productById.get(v.product_id);
      if (!product) continue;
      const stock = stockByVariant.get(v.id) ?? 0;
      if (stock <= 0) continue;
      items.push({
        variant_id: v.id,
        product_id: v.product_id,
        product_name: product.name,
        variant_name: v.name && v.name !== "Mặc định" ? v.name : null,
        sku: v.sku,
        barcode: v.barcode,
        thumbnail_url: product.thumbnail_url,
        selling_price: Number(v.selling_price ?? 0),
        stock,
        specs: extractQuickSpecs(mergeSpecSources(v.specs, v.attributes)),
      });
    }

    items.sort((a, b) => {
      const byProduct = a.product_name.localeCompare(b.product_name, "vi");
      if (byProduct !== 0) return byProduct;
      return (a.variant_name ?? "").localeCompare(b.variant_name ?? "", "vi");
    });

    return ok({ items: items.slice(0, limit), total: items.length });
  } catch (e) {
    return handleError(e);
  }
}
