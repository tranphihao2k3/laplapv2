/**
 * Báo cáo kho — tồn kho theo sản phẩm + warehouse, kèm giá trị tồn và sold_in_period.
 * GET /api/v1/reports/inventory
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type StockRow = {
  product_id: string | null;
  product_variant_id: string | null;
  warehouse_id: string | null;
  quantity: number | null;
  updated_at: string | null;
};

type Variant = {
  id: string;
  sku: string | null;
  name: string | null;
  cost_price: number | null;
  product: {
    id: string;
    name: string | null;
    status: string | null;
  } | null;
};

type Warehouse = { id: string; name: string };

const LOW_STOCK_THRESHOLD = 10;

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
    const supabase = await createClient();

    const { data: stockData, error } = await supabase
      .from("stock_levels")
      .select("product_id, product_variant_id, warehouse_id, quantity, updated_at")
      .limit(100_000);
    if (error) throw error;
    const stockRows = (stockData ?? []) as StockRow[];

    const variantIds = Array.from(new Set(stockRows.map((r) => r.product_variant_id).filter((x): x is string => !!x)));
    const warehouseIds = Array.from(new Set(stockRows.map((r) => r.warehouse_id).filter((x): x is string => !!x)));

    const [variantsRes, warehousesRes, soldRes] = await Promise.all([
      variantIds.length > 0
        ? supabase.from("product_variants").select("id, sku, name, cost_price, product:products!inner(id, name, status)").in("id", variantIds)
        : Promise.resolve({ data: [] as Variant[] }),
      warehouseIds.length > 0
        ? supabase.from("warehouses").select("id, name").in("id", warehouseIds)
        : Promise.resolve({ data: [] as Warehouse[] }),
      // Sold in period (from order_items)
      filters.from || filters.to
        ? (() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let q: any = supabase
              .from("order_items")
              .select("product_variant_id, quantity, order:orders!inner(created_at, status)")
              .in("order.status", ["completed", "fulfilled"]);
            if (filters.from) q = q.gte("order.created_at", filters.from);
            if (filters.to) q = q.lte("order.created_at", filters.to);
            if (filters.shop_id) q = q.eq("order.shop_id", filters.shop_id);
            return q.limit(100_000);
          })()
        : Promise.resolve({ data: [] as Array<{ product_variant_id: string; quantity: number }> }),
    ]);

    const variantMap = new Map<string, Variant>(((variantsRes.data ?? []) as unknown as Variant[]).map((v) => [v.id, v]));
    const warehouseMap = new Map<string, Warehouse>(((warehousesRes.data ?? []) as Warehouse[]).map((w) => [w.id, w]));

    type SoldAgg = { product_variant_id: string; quantity: number };
    const soldRows = (soldRes.data ?? []) as Array<{ product_variant_id: string; quantity: number }>;
    const soldMap = new Map<string, number>();
    for (const s of soldRows) {
      soldMap.set(s.product_variant_id, (soldMap.get(s.product_variant_id) ?? 0) + Number(s.quantity ?? 0));
    }

    const rows = stockRows
      .map((s) => {
        const v = s.product_variant_id ? variantMap.get(s.product_variant_id) : null;
        const w = s.warehouse_id ? warehouseMap.get(s.warehouse_id) : null;
        const qty = Number(s.quantity ?? 0);
        const cost = Number(v?.cost_price ?? 0);
        return {
          product_id: v?.product?.id ?? s.product_id ?? "",
          product_name: v?.product?.name ?? "(Không tên)",
          product_status: v?.product?.status ?? null,
          sku: v?.sku ?? "—",
          variant_name: v?.name ?? null,
          warehouse_name: w?.name ?? "—",
          warehouse_id: s.warehouse_id,
          stock_qty: qty,
          stock_value: qty * cost,
          cost_price: cost,
          sold_in_period: soldMap.get(s.product_variant_id ?? "") ?? 0,
          status: qty === 0 ? "out" : qty < LOW_STOCK_THRESHOLD ? "low" : "in_stock",
          updated_at: s.updated_at,
        };
      })
      .filter((r) => r.product_id)
      .sort((a, b) => b.stock_value - a.stock_value);

    const totalValue = rows.reduce((s, r) => s + r.stock_value, 0);
    const totalQty = rows.reduce((s, r) => s + r.stock_qty, 0);
    const lowCount = rows.filter((r) => r.status === "low").length;
    const outCount = rows.filter((r) => r.status === "out").length;
    const summary = {
      totalSkus: rows.length,
      totalQty,
      totalValue,
      lowStock: lowCount,
      outOfStock: outCount,
    };

    // Distribution by warehouse
    const whMap = new Map<string, number>();
    for (const r of rows) {
      whMap.set(r.warehouse_name, (whMap.get(r.warehouse_name) ?? 0) + r.stock_value);
    }
    const distribution = Array.from(whMap.entries())
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);

    // Top 20 by value
    const series = rows.slice(0, 20).map((r) => ({
      bucket: r.product_name.length > 18 ? r.product_name.slice(0, 18) + "…" : r.product_name,
      value: r.stock_value,
      count: r.stock_qty,
    }));

    return ok({
      filters,
      generatedAt: new Date().toISOString(),
      summary,
      charts: { series, distribution },
      rows: rows.slice(0, 200),
      total: rows.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
