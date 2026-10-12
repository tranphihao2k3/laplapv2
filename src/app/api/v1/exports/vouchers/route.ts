/**
 * Excel export cho báo cáo voucher.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { excelResponse, buildWorkbook, type ExcelColumn } from "@/lib/excel/server";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Voucher = {
  id: string; code: string; name: string; description: string | null;
  discount_type: string; discount_value: number; min_order_value: number | null;
  starts_at: string | null; ends_at: string | null;
  total_issued: number | null; usage_limit: number | null;
  status: string | null; is_active: boolean | null;
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

const TYPE_LABEL: Record<string, string> = { percent: "Giảm %", fixed: "Giảm tiền" };

export async function GET(req: NextRequest) {
  await requireUser();
  const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("vouchers")
    .select("id, code, name, description, discount_type, discount_value, min_order_value, starts_at, ends_at, total_issued, usage_limit, status, is_active")
    .limit(10_000);
  if (filters.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw error;
  const vouchers = (data ?? []) as Voucher[];

  const detailRows = vouchers.map((v) => {
    const totalIssued = Number(v.total_issued ?? 0);
    const totalUsed = Number((v as { total_used?: number }).total_used ?? 0);
    const usageRate = totalIssued > 0 ? (totalUsed / totalIssued) * 100 : 0;
    return {
      code: v.code,
      name: v.name,
      discount_type: TYPE_LABEL[v.discount_type] ?? v.discount_type,
      discount_value: Number(v.discount_value),
      min_order_value: Number(v.min_order_value ?? 0),
      starts_at: v.starts_at ?? "",
      ends_at: v.ends_at ?? "",
      total_issued: totalIssued,
      total_used: totalUsed,
      usage_rate_pct: usageRate,
      revenue_generated: 0,
      total_discount: 0,
      status: v.status ?? (v.is_active ? "active" : "inactive"),
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
