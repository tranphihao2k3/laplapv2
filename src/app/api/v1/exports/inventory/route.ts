/**
 * Excel export cho báo cáo kho.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { excelResponse, buildWorkbook, type ExcelColumn } from "@/lib/excel/server";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type StockRow = {
  product_variant_id: string | null;
  warehouse_id: string | null;
  quantity: number | null;
};

const COLUMNS: ExcelColumn<{
  sku: string; product_name: string; warehouse_name: string; stock_qty: number;
  cost_price: number; stock_value: number; sold_in_period: number; status: string;
}>[] = [
  { header: "SKU", key: "sku", width: 16 },
  { header: "Tên sản phẩm", key: "product_name", width: 36 },
  { header: "Kho", key: "warehouse_name", width: 22 },
  { header: "Tồn hiện tại", key: "stock_qty", width: 12, format: "number" },
  { header: "Giá vốn (VNĐ)", key: "cost_price", width: 16, format: "money" },
  { header: "Giá trị tồn (VNĐ)", key: "stock_value", width: 18, format: "money" },
  { header: "Đã bán trong kỳ", key: "sold_in_period", width: 14, format: "number" },
  { header: "Trạng thái", key: "status", width: 14 },
];

const STATUS_LABEL: Record<string, string> = { in_stock: "Còn hàng", low: "Sắp hết", out: "Hết hàng" };

export async function GET(req: NextRequest) {
  await requireUser();
  const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
  const supabase = await createClient();
  const { data: stockData } = await supabase
    .from("stock_levels")
    .select("product_variant_id, warehouse_id, quantity")
    .limit(100_000);
  const stockRows = (stockData ?? []) as StockRow[];

  const variantIds = Array.from(new Set(stockRows.map((r) => r.product_variant_id).filter((x): x is string => !!x)));
  const warehouseIds = Array.from(new Set(stockRows.map((r) => r.warehouse_id).filter((x): x is string => !!x)));

  const [variantsRes, warehousesRes] = await Promise.all([
    variantIds.length > 0
      ? supabase.from("product_variants").select("id, sku, name, cost_price, product:products!inner(name)").in("id", variantIds)
      : Promise.resolve({ data: [] }),
    warehouseIds.length > 0
      ? supabase.from("warehouses").select("id, name").in("id", warehouseIds)
      : Promise.resolve({ data: [] }),
  ]);

  type V = { id: string; sku: string | null; name: string | null; cost_price: number | null; product: { name: string | null } | null };
  const variantMap = new Map<string, V>(((variantsRes.data ?? []) as unknown as V[]).map((v) => [v.id, v]));
  const warehouseMap = new Map<string, { id: string; name: string }>(((warehousesRes.data ?? []) as { id: string; name: string }[]).map((w) => [w.id, w]));

  const detailRows = stockRows
    .map((s) => {
      const v = s.product_variant_id ? variantMap.get(s.product_variant_id) : null;
      const w = s.warehouse_id ? warehouseMap.get(s.warehouse_id) : null;
      const qty = Number(s.quantity ?? 0);
      const cost = Number(v?.cost_price ?? 0);
      const status = qty === 0 ? "out" : qty < 10 ? "low" : "in_stock";
      return {
        sku: v?.sku ?? "—",
        product_name: v?.product?.name ?? v?.name ?? "(Không tên)",
        warehouse_name: w?.name ?? "—",
        stock_qty: qty,
        cost_price: cost,
        stock_value: qty * cost,
        sold_in_period: 0,
        status: STATUS_LABEL[status],
      };
    })
    .filter((r) => r.product_name !== "(Không tên)")
    .sort((a, b) => b.stock_value - a.stock_value);

  const totalValue = detailRows.reduce((s, r) => s + r.stock_value, 0);
  const totalQty = detailRows.reduce((s, r) => s + r.stock_qty, 0);
  const lowCount = detailRows.filter((r) => r.status === "Sắp hết").length;
  const outCount = detailRows.filter((r) => r.status === "Hết hàng").length;

  const buf = await buildWorkbook({
    fileName: "bao-cao-kho",
    summarySheet: {
      title: "Tổng quan",
      rows: [
        ["Tổng dòng tồn kho", detailRows.length],
        ["Tổng SL tồn", totalQty],
        ["Tổng giá trị tồn (VNĐ)", totalValue],
        ["SP sắp hết", lowCount],
        ["SP hết hàng", outCount],
      ],
    },
    detailSheet: { title: "Chi tiết tồn kho", columns: COLUMNS, rows: detailRows },
  });
  const today = new Date().toISOString().slice(0, 10);
  return excelResponse(buf, `bao-cao-kho-${today}.xlsx`);
}
