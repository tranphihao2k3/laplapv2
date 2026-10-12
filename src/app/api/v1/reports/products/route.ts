/**
 * Báo cáo sản phẩm — aggregate order_items theo product, join product + category + brand.
 * Query params: from, to, category_id, brand_id
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type OrderItem = {
  id: string;
  product_variant_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  order_id: string | null;
  // joined fields
  product_variant?: {
    id: string;
    sku: string | null;
    name: string | null;
    cost_price: number | null;
    product_id: string | null;
    product?: {
      id: string;
      name: string | null;
      slug: string | null;
      status: string | null;
      category_id: string | null;
      brand_id: string | null;
      category?: { id: string; name: string } | null;
      brand?: { id: string; name: string } | null;
    } | null;
  } | null;
  // For status filter we need the order status
  order?: { status: string | null; payment_status: string | null; created_at: string | null } | null;
};

export type ProductReportRow = {
  product_id: string;
  product_name: string;
  product_slug: string | null;
  product_status: string | null;
  category_name: string | null;
  brand_name: string | null;
  sku: string | null;
  qty_sold: number;
  revenue: number;
  cost_total: number;
  profit: number;
  margin_pct: number;
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
    const supabase = await createClient();

    // Build order_items query with embed: variant.product.category, variant.product.brand
    // Filter orders by date range
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderIdsQ: any = supabase.from("orders").select("id, status, payment_status, created_at");
    if (filters.from) orderIdsQ = orderIdsQ.gte("created_at", filters.from);
    if (filters.to) orderIdsQ = orderIdsQ.lte("created_at", filters.to);
    if (filters.shop_id) orderIdsQ = orderIdsQ.eq("shop_id", filters.shop_id);
    const { data: ordersData, error: ordersErr } = await orderIdsQ.limit(50_000);
    if (ordersErr) throw ordersErr;
    const orders = (ordersData ?? []) as Array<{ id: string; status: string | null; payment_status: string | null; created_at: string | null }>;
    const orderIdSet = new Set(orders.map((o) => o.id));
    const orderStatusMap = new Map(orders.map((o) => [o.id, o]));

    // Lấy order_items với join
    if (orderIdSet.size === 0) {
      return ok({
        filters,
        generatedAt: new Date().toISOString(),
        summary: {
          totalRevenue: 0, totalCost: 0, totalProfit: 0, totalQty: 0,
          productCount: 0, avgMargin: 0,
        },
        charts: { series: [], distribution: [] },
        rows: [],
        total: 0,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let itemsQ: any = supabase
      .from("order_items")
      .select(
        "id, product_variant_id, quantity, unit_price, total_price, order_id, product_variant:product_variants!inner(id, sku, name, cost_price, product_id, product:products!inner(id, name, slug, status, category_id, brand_id, category:categories(id, name), brand:brands(id, name))",
      )
      .in("order_id", Array.from(orderIdSet));
    if (filters.category_id) {
      itemsQ = itemsQ.eq("product_variant.product.category_id", filters.category_id);
    }
    if (filters.brand_id) {
      itemsQ = itemsQ.eq("product_variant.product.brand_id", filters.brand_id);
    }
    const { data: itemsData, error: itemsErr } = await itemsQ.limit(100_000);
    if (itemsErr) throw itemsErr;
    const items = (itemsData ?? []) as unknown as OrderItem[];

    // Lọc bỏ các order cancelled (chỉ tính doanh thu từ order completed/fulfilled)
    const validItems = items.filter((it) => {
      const order = it.order_id ? orderStatusMap.get(it.order_id) : null;
      return order && order.status !== "cancelled";
    });

    // Aggregate theo product_id
    const productMap = new Map<string, ProductReportRow>();
    for (const it of validItems) {
      const v = it.product_variant;
      const p = v?.product;
      if (!v || !p || !p.id) continue;
      const key = p.id;
      const qty = Number(it.quantity) || 0;
      const revenue = Number(it.total_price) || 0;
      const cost = Number(v.cost_price ?? 0) * qty;
      const profit = revenue - cost;
      const existing = productMap.get(key);
      if (existing) {
        existing.qty_sold += qty;
        existing.revenue += revenue;
        existing.cost_total += cost;
        existing.profit = existing.revenue - existing.cost_total;
        existing.margin_pct = existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : 0;
        // Cộng dồn SKU (nếu nhiều variant) — lấy SKU đầu tiên
        if (!existing.sku && v.sku) existing.sku = v.sku;
      } else {
        productMap.set(key, {
          product_id: p.id,
          product_name: p.name ?? "(Không tên)",
          product_slug: p.slug ?? null,
          product_status: p.status ?? null,
          category_name: p.category?.name ?? null,
          brand_name: p.brand?.name ?? null,
          sku: v.sku ?? null,
          qty_sold: qty,
          revenue,
          cost_total: cost,
          profit,
          margin_pct: revenue > 0 ? (profit / revenue) * 100 : 0,
        });
      }
    }

    // Sort theo doanh thu giảm dần
    const rows = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost_total, 0);
    const totalQty = rows.reduce((s, r) => s + r.qty_sold, 0);
    const totalProfit = totalRevenue - totalCost;
    const summary = {
      totalRevenue,
      totalCost,
      totalProfit,
      totalQty,
      productCount: rows.length,
      avgMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    };

    // Chart: top 20
    const series = rows.slice(0, 20).map((r) => ({
      bucket: r.product_name.length > 20 ? r.product_name.slice(0, 20) + "…" : r.product_name,
      value: r.revenue,
      count: r.qty_sold,
    }));

    // Distribution theo category
    const catMap = new Map<string, number>();
    for (const r of rows) {
      const k = r.category_name ?? "Chưa phân loại";
      catMap.set(k, (catMap.get(k) ?? 0) + r.revenue);
    }
    const distribution = Array.from(catMap.entries())
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);

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
