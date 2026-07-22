import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

type VariantRow = {
  id: string;
  product_id: string | null;
  sku: string | null;
  barcode: string | null;
  name: string | null;
  selling_price: number | null;
  is_active: boolean | null;
};

type ProductRow = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  status: string | null;
};

type StockRow = {
  product_variant_id: string | null;
  available_qty: number | null;
};

type PosHit = {
  variant_id: string;
  product_id: string | null;
  display_name: string;
  product_name: string | null;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  thumbnail_url: string | null;
  selling_price: number;
  stock: number;
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    const term = (sp.get("search") ?? "").trim().replace(/[%_]/g, "");
    const shopId = (sp.get("shop_id") ?? "").trim();
    const limit = Math.min(50, Math.max(1, Number(sp.get("limit") ?? 12)));

    // Kho thuộc cửa hàng đang chọn → tồn POS chỉ tính trong các kho này
    let shopWarehouseIds: string[] | null = null;
    if (shopId) {
      const { data: warehouses, error: wErr } = await supabase
        .from("warehouses")
        .select("id")
        .eq("shop_id", shopId)
        .eq("is_active", true);
      if (wErr) throw wErr;
      const warehouseRows = (warehouses ?? []) as Array<{ id: string }>;
      shopWarehouseIds = warehouseRows.map((w) => w.id);
    }

    // 1) Tìm products khớp search → lấy product_ids
    let productIds: string[] = [];
    let productMap = new Map<string, ProductRow>();
    if (term) {
      const { data: products, error } = await supabase
        .from("products")
        .select("id,name,thumbnail_url,status")
        .or(`name.ilike.%${term}%,slug.ilike.%${term}%`)
        .limit(limit);
      if (error) throw error;
      const rows = (products ?? []) as ProductRow[];
      productIds = rows.map((p) => p.id);
      productMap = new Map(rows.map((p) => [p.id, p]));
    }

    // 2) Query variants — vừa khớp trực tiếp (sku/barcode/name) vừa nằm trong productIds
    let q = supabase
      .from("product_variants")
      .select("id,product_id,sku,barcode,name,selling_price,is_active")
      .eq("is_active", true)
      .limit(limit);

    if (term) {
      const orParts: string[] = [
        `sku.ilike.%${term}%`,
        `barcode.ilike.%${term}%`,
        `name.ilike.%${term}%`,
      ];
      if (productIds.length > 0) {
        orParts.push(`product_id.in.(${productIds.join(",")})`);
      }
      q = q.or(orParts.join(","));
    }

    const { data: variants, error: vErr } = await q;
    if (vErr) throw vErr;
    const variantRows = (variants ?? []) as VariantRow[];

    // 3) Lấy thông tin product cho các variant chưa có trong productMap
    const missingProductIds = [
      ...new Set(
        variantRows
          .map((v) => v.product_id)
          .filter((id): id is string => Boolean(id) && !productMap.has(id!)),
      ),
    ];
    if (missingProductIds.length > 0) {
      const { data: extraProducts, error: pErr } = await supabase
        .from("products")
        .select("id,name,thumbnail_url,status")
        .in("id", missingProductIds);
      if (pErr) throw pErr;
      for (const p of (extraProducts ?? []) as ProductRow[]) productMap.set(p.id, p);
    }

    // 4) Lấy tồn kho cho các variant — chỉ trong kho của cửa hàng đang chọn (nếu có shop_id)
    const variantIds = variantRows.map((v) => v.id);
    const stockByVariant = new Map<string, number>();
    // Nếu đã chọn cửa hàng nhưng cửa hàng đó không có kho nào → tồn = 0 cho tất cả
    const skipStockQuery = shopWarehouseIds !== null && shopWarehouseIds.length === 0;
    if (variantIds.length > 0 && !skipStockQuery) {
      let stockQuery = supabase
        .from("stock_levels")
        .select("product_variant_id,available_qty")
        .in("product_variant_id", variantIds);
      if (shopWarehouseIds !== null) {
        stockQuery = stockQuery.in("warehouse_id", shopWarehouseIds);
      }
      const { data: stocks, error: sErr } = await stockQuery;
      if (sErr) throw sErr;
      for (const s of (stocks ?? []) as StockRow[]) {
        if (!s.product_variant_id) continue;
        stockByVariant.set(
          s.product_variant_id,
          (stockByVariant.get(s.product_variant_id) ?? 0) + (s.available_qty ?? 0),
        );
      }
    }

    const items: PosHit[] = variantRows.map((v) => {
      const product = v.product_id ? productMap.get(v.product_id) ?? null : null;
      const productName = product?.name ?? null;
      const variantName = v.name;
      const displayName = [productName, variantName].filter(Boolean).join(" — ") || v.sku || "Sản phẩm";
      return {
        variant_id: v.id,
        product_id: v.product_id,
        display_name: displayName,
        product_name: productName,
        variant_name: variantName,
        sku: v.sku,
        barcode: v.barcode,
        thumbnail_url: product?.thumbnail_url ?? null,
        selling_price: Number(v.selling_price ?? 0),
        stock: stockByVariant.get(v.id) ?? 0,
      };
    });

    // Ưu tiên sản phẩm CÒN tồn kho lên đầu, hết hàng (tồn = 0) xuống cuối.
    // Trong cùng nhóm giữ thứ tự theo tên cho dễ nhìn.
    items.sort((a, b) => {
      const aOut = a.stock <= 0 ? 1 : 0;
      const bOut = b.stock <= 0 ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return a.display_name.localeCompare(b.display_name, "vi");
    });

    return ok({ items, total: items.length });
  } catch (e) {
    return handleError(e);
  }
}
