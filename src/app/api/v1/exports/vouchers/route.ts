/**
 * Excel export cho báo cáo voucher.
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { excelResponse, buildWorkbook, type ExcelColumn } from "@/lib/excel/server";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Voucher = {
  id: string; code: string; name: string; description: string | null;
  type: string; value: number; min_order_amount: number | null;
  max_discount_amount: number | null;
  start_date: string | null; end_date: string | null;
  quantity_total: number | null; quantity_used: number | null;
  is_active: boolean | null;
};

const COLUMNS: ExcelColumn<{
  code: string; name: string; discount_type: string; discount_value: number;
  min_order_value: number; starts_at: string; ends_at: string;
  total_issued: number; total_used: number; usage_rate_pct: number;
  revenue_generated: number; total_discount: number; status: string;
}>[] = [
  { header: "Mã voucher", key: "code", width: 16 },
  { header: "Tên", key: "name", width: 24 },
  { header: "Loại", key: "discount_type", width: 12 },
  { header: "Giá trị", key: "discount_value", width: 12, format: "number" },
  { header: "Đơn tối thiểu (VNĐ)", key: "min_order_value", width: 18, format: "money" },
  { header: "Từ ngày", key: "starts_at", width: 14, format: "date" },
  { header: "Đến ngày", key: "ends_at", width: 14, format: "date" },
  { header: "Phát hành", key: "total_issued", width: 12, format: "number" },
  { header: "Đã dùng", key: "total_used", width: 12, format: "number" },
  { header: "Tỉ lệ SD (%)", key: "usage_rate_pct", width: 14, format: "number" },
  { header: "DT từ VC (VNĐ)", key: "revenue_generated", width: 18, format: "money" },
  { header: "Tổng giảm (VNĐ)", key: "total_discount", width: 16, format: "money" },
  { header: "Trạng thái", key: "status", width: 14 },
];

const TYPE_LABEL: Record<string, string> = {
  percent: "Giảm %",
  fixed_amount: "Giảm tiền",
  free_shipping: "Miễn phí ship",
};

function derivedStatus(v: Voucher, now = new Date()) {
  if (!v.is_active) return "inactive";
  if (v.start_date && new Date(v.start_date) > now) return "upcoming";
  if (v.end_date && new Date(v.end_date) < now) return "expired";
  if (v.quantity_total != null && (v.quantity_used ?? 0) >= v.quantity_total) {
    return "depleted";
  }
  return "active";
}

export async function GET(req: NextRequest) {
  await requireUser();
  const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const { data, error } = await db
    .from("vouchers")
    .select(
      "id, code, name, description, type, value, min_order_amount, max_discount_amount, start_date, end_date, quantity_total, quantity_used, is_active",
    )
    .limit(10_000);
  if (error) throw error;
  let vouchers = (data ?? []) as Voucher[];
  if (filters.status) {
    vouchers = vouchers.filter((v) => derivedStatus(v) === filters.status);
  }

  const detailRows = vouchers.map((v) => {
    const totalIssued = Number(v.quantity_total ?? 0);
    const totalUsed = Number(v.quantity_used ?? 0);
    const usageRate = totalIssued > 0 ? (totalUsed / totalIssued) * 100 : 0;
    return {
      code: v.code,
      name: v.name,
      discount_type: TYPE_LABEL[v.type] ?? v.type,
      discount_value: Number(v.value),
      min_order_value: Number(v.min_order_amount ?? 0),
      starts_at: v.start_date ?? "",
      ends_at: v.end_date ?? "",
      total_issued: totalIssued,
      total_used: totalUsed,
      usage_rate_pct: usageRate,
      revenue_generated: 0,
      total_discount: 0,
      status: derivedStatus(v),
    };
  }).sort((a, b) => b.total_used - a.total_used);

  const totalIssued = detailRows.reduce((s, r) => s + r.total_issued, 0);
  const totalUsed = detailRows.reduce((s, r) => s + r.total_used, 0);
  const totalRevenue = detailRows.reduce((s, r) => s + r.revenue_generated, 0);

  const buf = await buildWorkbook({
    fileName: "bao-cao-voucher",
    summarySheet: {
      title: "Tổng quan",
      rows: [
        ["Tổng voucher", detailRows.length],
        ["Tổng phát hành", totalIssued],
        ["Tổng đã dùng", totalUsed],
        ["Tỉ lệ sử dụng (%)", totalIssued > 0 ? (totalUsed / totalIssued) * 100 : 0],
        ["Doanh thu từ VC (VNĐ)", totalRevenue],
      ],
    },
    detailSheet: { title: "Chi tiết voucher", columns: COLUMNS, rows: detailRows },
  });
  const today = new Date().toISOString().slice(0, 10);
  return excelResponse(buf, `bao-cao-voucher-${today}.xlsx`);
}
