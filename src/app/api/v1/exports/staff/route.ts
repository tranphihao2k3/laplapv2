/**
 * Excel export cho báo cáo nhân viên.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { excelResponse, buildWorkbook, type ExcelColumn } from "@/lib/excel/server";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

const COLUMNS: ExcelColumn<{
  rank: number; full_name: string; email: string; total_orders: number; completed_orders: number;
  cancelled_orders: number; pos_sessions: number; revenue: number; avg_order_value: number; completion_rate: number;
}>[] = [
  { header: "Hạng", key: "rank", width: 8, format: "number" },
  { header: "Tên nhân viên", key: "full_name", width: 28 },
  { header: "Email", key: "email", width: 30 },
  { header: "Tổng đơn", key: "total_orders", width: 10, format: "number" },
  { header: "Hoàn tất", key: "completed_orders", width: 10, format: "number" },
  { header: "Huỷ", key: "cancelled_orders", width: 8, format: "number" },
  { header: "Ca POS", key: "pos_sessions", width: 10, format: "number" },
  { header: "Doanh thu (VNĐ)", key: "revenue", width: 18, format: "money" },
  { header: "AOV (VNĐ)", key: "avg_order_value", width: 16, format: "money" },
  { header: "Tỉ lệ HT (%)", key: "completion_rate", width: 14, format: "number" },
];

export async function GET(req: NextRequest) {
  await requireUser();
  const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let oq: any = supabase.from("orders").select("id, created_by, status, total_amount, created_at");
  if (filters.from) oq = oq.gte("created_at", filters.from);
  if (filters.to) oq = oq.lte("created_at", filters.to);
  if (filters.shop_id) oq = oq.eq("shop_id", filters.shop_id);
  const { data: ordersData } = await oq.limit(100_000);
  type Order = { id: string; created_by: string | null; status: string | null; total_amount: number | null };
  const orders = (ordersData ?? []) as Order[];

  const agg = new Map<string, { total: number; completed: number; cancelled: number; revenue: number }>();
  for (const o of orders) {
    if (!o.created_by) continue;
    const e = agg.get(o.created_by) ?? { total: 0, completed: 0, cancelled: 0, revenue: 0 };
    e.total += 1;
    if (o.status === "completed" || o.status === "fulfilled") {
      e.completed += 1; e.revenue += Number(o.total_amount ?? 0);
    } else if (o.status === "cancelled") e.cancelled += 1;
    agg.set(o.created_by, e);
  }

  const userIds = Array.from(agg.keys());
  const { data: usersData } = userIds.length > 0
    ? await supabase.from("user_profiles").select("id, full_name, email, is_active").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null; is_active: boolean | null }[] };

  const detailRows = Array.from(agg.entries())
    .map(([uid, e]) => {
      const u = ((usersData ?? []) as { id: string; full_name: string | null; email: string | null }[]).find((x) => x.id === uid);
      return {
        rank: 0,
        full_name: u?.full_name ?? "Không rõ",
        email: u?.email ?? "",
        total_orders: e.total,
        completed_orders: e.completed,
        cancelled_orders: e.cancelled,
        pos_sessions: 0,
        revenue: e.revenue,
        avg_order_value: e.completed > 0 ? Math.round(e.revenue / e.completed) : 0,
        completion_rate: e.total > 0 ? (e.completed / e.total) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const totalRevenue = detailRows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = detailRows.reduce((s, r) => s + r.total_orders, 0);
  const totalCompleted = detailRows.reduce((s, r) => s + r.completed_orders, 0);

  const buf = await buildWorkbook({
    fileName: "bao-cao-nhan-vien",
    summarySheet: {
      title: "Tổng quan",
      rows: [
        ["Tổng nhân viên", detailRows.length],
        ["Tổng đơn", totalOrders],
        ["Tổng đơn hoàn tất", totalCompleted],
        ["Tổng doanh thu (VNĐ)", totalRevenue],
        ["Tỉ lệ hoàn tất (%)", totalOrders > 0 ? (totalCompleted / totalOrders) * 100 : 0],
      ],
    },
    detailSheet: { title: "Bảng xếp hạng nhân viên", columns: COLUMNS, rows: detailRows },
  });
  const today = new Date().toISOString().slice(0, 10);
  return excelResponse(buf, `bao-cao-nhan-vien-${today}.xlsx`);
}
