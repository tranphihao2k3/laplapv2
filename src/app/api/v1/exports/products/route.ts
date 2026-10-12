/**
 * Excel export cho báo cáo sản phẩm.
 * GET /api/v1/exports/products?from=...&to=...&category_id=...&brand_id=...
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { excelResponse, buildWorkbook, type ExcelColumn } from "@/lib/excel/server";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type ProductRow = {
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

const COLUMNS: ExcelColumn<ProductRow>[] = [
  { header: "SKU", key: "sku", width: 16 },
  { header: "Tên sản phẩm", key: "product_name", width: 36 },
  { header: "Danh mục", key: "category_name", width: 18 },
  { header: "Thương hiệu", key: "brand_name", width: 16 },
  { header: "Trạng thái", key: "product_status", width: 12 },
  { header: "SL bán", key: "qty_sold", width: 10, format: "number" },
  { header: "Doanh thu (VNĐ)", key: "revenue", width: 18, format: "money" },
  { header: "Giá vốn (VNĐ)", key: "cost_total", width: 18, format: "money" },
  { header: "Lợi nhuận (VNĐ)", key: "profit", width: 18, format: "money" },
  { header: "Margin (%)", key: "margin_pct", width: 12, format: "number" },
];

export async function GET(req: NextRequest) {
  await requireUser();
  const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
  const supabase = await createClient();

  // Tương tự logic API JSON — lấy orders trong kỳ, aggregate theo product
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderIdsQ: any = supabase.from("orders").select("id, status, created_at");
  if (filters.from) orderIdsQ = orderIdsQ.gte("created_at", filters.from);
  if (filters.to) orderIdsQ = orderIdsQ.lte("created_at", filters.to);
  if (filters.shop_id) orderIdsQ = orderIdsQ.eq("shop_id", filters.shop_id);
  const { data: ordersData } = await orderIdsQ.limit(50_000);
  const orders = (ordersData ?? []) as Array<{ id: string; status: string | null }>;
  const orderIds = orders.map((o) => o.id);
  const orderStatusMap = new Map(orders.map((o) => [o.id, o.status]));

  if (orderIds.length === 0) {
    const buf = await buildWorkbook({
      fileName: "bao-cao-san-pham",
      summarySheet: { title: "Tổng quan", rows: [["Tổng SP bán", 0]] },
      detailSheet: { title: "Chi tiết sản phẩm", columns: COLUMNS, rows: [] },
    });
    const today = new Date().toISOString().slice(0, 10);
    return excelResponse(buf, `bao-cao-san-pham-${today}.xlsx`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemsQ: any = supabase
    .from("order_items")
    .select(
      "id, product_variant_id, quantity, total_price, product_variant:product_variants!inner(id, sku, name, cost_price, product_id, product:products!inner(id, name, slug, status, category_id, brand_id, category:categories(id, name), brand:brands(id, name))",
    )
    .in("order_id", orderIds);
  if (filters.category_id) itemsQ = itemsQ.eq("product_variant.product.category_id", filters.category_id);
  if (filters.brand_id) itemsQ = itemsQ.eq("product_variant.product.brand_id", filters.brand_id);
  const { data: itemsData } = await itemsQ.limit(100_000);

  type ItemRaw = {
    quantity: number;
    total_price: number;
    order_id: string;
    product_variant: {
      id: string;
      sku: string | null;
      name: string | null;
      cost_price: number | null;
      product_id: string;
      product: {
        id: string;
        name: string;
        slug: string | null;
        status: string | null;
        category_id: string | null;
        brand_id: string | null;
        category: { id: string; name: string } | null;
        brand: { id: string; name: string } | null;
      };
    };
  };
  const items = (itemsData ?? []) as unknown as ItemRaw[];

  const productMap = new Map<string, ProductRow>();
  for (const it of items) {
    if (orderStatusMap.get(it.order_id) === "cancelled") continue;
    const v = it.product_variant;
    const p = v?.product;
    if (!v || !p) continue;
    const qty = Number(it.quantity) || 0;
    const revenue = Number(it.total_price) || 0;
    const cost = Number(v.cost_price ?? 0) * qty;
    const profit = revenue - cost;
    const key = p.id;
    const existing = productMap.get(key);
    if (existing) {
      existing.qty_sold += qty;
      existing.revenue += revenue;
      existing.cost_total += cost;
      existing.profit = existing.revenue - existing.cost_total;
      existing.margin_pct = existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : 0;
      if (!existing.sku && v.sku) existing.sku = v.sku;
    } else {
      productMap.set(key, {
        product_id: p.id,
        product_name: p.name,
        product_slug: p.slug,
        product_status: p.status,
        category_name: p.category?.name ?? null,
        brand_name: p.brand?.name ?? null,
        sku: v.sku,
        qty_sold: qty,
        revenue,
        cost_total: cost,
        profit,
        margin_pct: revenue > 0 ? (profit / revenue) * 100 : 0,
      });
    }
  }

  const rows = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);

  const buf = await buildWorkbook({
    fileName: "bao-cao-san-pham",
    summarySheet: {
      title: "Tổng quan",
      rows: [
        ["Tổng SP có bán", rows.length],
        ["Tổng SL bán", rows.reduce((s, r) => s + r.qty_sold, 0)],
        ["Tổng doanh thu (VNĐ)", totalRevenue],
        ["Tổng lợi nhuận (VNĐ)", totalProfit],
        ["Margin TB (%)", totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0],
      ],
    },
    detailSheet: { title: "Chi tiết sản phẩm", columns: COLUMNS, rows },
  });
  const today = new Date().toISOString().slice(0, 10);
  return excelResponse(buf, `bao-cao-san-pham-${today}.xlsx`);
}
