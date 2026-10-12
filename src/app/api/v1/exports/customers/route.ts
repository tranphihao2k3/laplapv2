/**
 * Excel export cho báo cáo khách hàng.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { excelResponse, buildWorkbook, type ExcelColumn } from "@/lib/excel/server";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Customer = {
  id: string; full_name: string | null; phone: string | null; email: string | null;
  tier: string | null; loyalty_points: number | null; total_spent: number | null;
  total_orders: number | null; last_order_at: string | null; created_at: string | null; is_active: boolean | null;
};

const TIER_LABEL: Record<string, string> = {
  bronze: "Đồng", silver: "Bạc", gold: "Vàng", platinum: "Bạch kim", diamond: "Kim cương",
};

const COLUMNS: ExcelColumn<{
  full_name: string; phone: string; email: string; tier: string; loyalty_points: number;
  total_orders: number; total_spent: number; last_order_at: string; created_at: string;
  status: string;
}>[] = [
  { header: "Họ tên", key: "full_name", width: 28 },
  { header: "SĐT", key: "phone", width: 14 },
  { header: "Email", key: "email", width: 30 },
  { header: "Hạng", key: "tier", width: 12 },
  { header: "Điểm tích lũy", key: "loyalty_points", width: 14, format: "number" },
  { header: "Số đơn", key: "total_orders", width: 10, format: "number" },
  { header: "Tổng chi (VNĐ)", key: "total_spent", width: 18, format: "money" },
  { header: "Đơn cuối", key: "last_order_at", width: 18, format: "datetime" },
  { header: "Ngày tham gia", key: "created_at", width: 18, format: "date" },
  { header: "Trạng thái", key: "status", width: 14 },
];

export async function GET(req: NextRequest) {
  await requireUser();
  const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("customers")
    .select("id, full_name, phone, email, tier, loyalty_points, total_spent, total_orders, last_order_at, created_at, is_active")
    .limit(50_000);
  if (filters.tier) q = q.eq("tier", filters.tier);
  const { data, error } = await q;
  if (error) throw error;
  const customers = (data ?? []) as Customer[];

  const detailRows = customers
    .map((c) => ({
      full_name: c.full_name ?? "Khách lẻ",
      phone: c.phone ?? "",
      email: c.email ?? "",
      tier: TIER_LABEL[c.tier ?? ""] ?? c.tier ?? "—",
      loyalty_points: Number(c.loyalty_points ?? 0),
      total_orders: Number(c.total_orders ?? 0),
      total_spent: Number(c.total_spent ?? 0),
      last_order_at: c.last_order_at ?? "",
      created_at: c.created_at?.slice(0, 10) ?? "",
      status: c.is_active === false ? "Ngừng hoạt động" : "Hoạt động",
    }))
    .sort((a, b) => b.total_spent - a.total_spent);

  const totalRevenue = detailRows.reduce((s, r) => s + r.total_spent, 0);
  const totalOrders = detailRows.reduce((s, r) => s + r.total_orders, 0);
  const totalLoyalty = detailRows.reduce((s, r) => s + r.loyalty_points, 0);

  const buf = await buildWorkbook({
    fileName: "bao-cao-khach-hang",
    summarySheet: {
      title: "Tổng quan",
      rows: [
        ["Tổng khách hàng", detailRows.length],
        ["Tổng đơn hàng", totalOrders],
        ["Tổng doanh thu (VNĐ)", totalRevenue],
        ["AOV (VNĐ)", totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0],
        ["Tổng điểm tích lũy", totalLoyalty],
      ],
    },
    detailSheet: { title: "Chi tiết khách hàng", columns: COLUMNS, rows: detailRows },
  });
  const today = new Date().toISOString().slice(0, 10);
  return excelResponse(buf, `bao-cao-khach-hang-${today}.xlsx`);
}
