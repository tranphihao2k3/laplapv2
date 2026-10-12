/**
 * Excel export cho báo cáo sửa chữa.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { excelResponse, buildWorkbook, type ExcelColumn } from "@/lib/excel/server";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Ticket = {
  id: string; ticket_number: string | null; customer_id: string | null; technician_id: string | null;
  device_info: string | null; problem: string | null; status: string | null;
  received_at: string | null; completed_at: string | null; service_fee: number | null;
};

const COLUMNS: ExcelColumn<{
  ticket_number: string; customer_name: string; customer_phone: string; device_info: string;
  problem: string; technician_name: string; received_at: string; completed_at: string;
  repair_hours: number; service_fee: number; status: string;
}>[] = [
  { header: "Mã phiếu", key: "ticket_number", width: 16 },
  { header: "Khách hàng", key: "customer_name", width: 24 },
  { header: "SĐT", key: "customer_phone", width: 14 },
  { header: "Thiết bị", key: "device_info", width: 30 },
  { header: "Vấn đề", key: "problem", width: 30 },
  { header: "KTV", key: "technician_name", width: 20 },
  { header: "Ngày nhận", key: "received_at", width: 18, format: "datetime" },
  { header: "Ngày trả", key: "completed_at", width: 18, format: "datetime" },
  { header: "Giờ sửa", key: "repair_hours", width: 10, format: "number" },
  { header: "Phí (VNĐ)", key: "service_fee", width: 14, format: "money" },
  { header: "Trạng thái", key: "status", width: 14 },
];

export async function GET(req: NextRequest) {
  await requireUser();
  const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("repair_tickets")
    .select("id, ticket_number, customer_id, technician_id, device_info, problem, status, received_at, completed_at, service_fee")
    .limit(50_000);
  if (filters.from) q = q.gte("received_at", filters.from);
  if (filters.to) q = q.lte("received_at", filters.to);
  if (filters.status) q = q.eq("status", filters.status);
  const { data, error } = await q;
  if (error) throw error;
  const tickets = (data ?? []) as Ticket[];

  const customerIds = Array.from(new Set(tickets.map((t) => t.customer_id).filter((x): x is string => !!x)));
  const techIds = Array.from(new Set(tickets.map((t) => t.technician_id).filter((x): x is string => !!x)));
  const [customersRes, techsRes] = await Promise.all([
    customerIds.length > 0 ? supabase.from("customers").select("id, full_name, phone").in("id", customerIds) : Promise.resolve({ data: [] }),
    techIds.length > 0 ? supabase.from("user_profiles").select("id, full_name").in("id", techIds) : Promise.resolve({ data: [] }),
  ]);
  const customerMap = new Map(((customersRes.data ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map((c) => [c.id, c]));
  const techMap = new Map(((techsRes.data ?? []) as { id: string; full_name: string | null }[]).map((u) => [u.id, u]));

  const detailRows = tickets
    .map((t) => {
      const c = t.customer_id ? customerMap.get(t.customer_id) : null;
      const tech = t.technician_id ? techMap.get(t.technician_id) : null;
      const hours = t.completed_at && t.received_at
        ? Math.round(((new Date(t.completed_at).getTime() - new Date(t.received_at).getTime()) / 3600000) * 10) / 10
        : 0;
      return {
        ticket_number: t.ticket_number ?? "—",
        customer_name: c?.full_name ?? "Khách lẻ",
        customer_phone: c?.phone ?? "",
        device_info: t.device_info ?? "",
        problem: t.problem ?? "",
        technician_name: tech?.full_name ?? "",
        received_at: t.received_at ?? "",
        completed_at: t.completed_at ?? "",
        repair_hours: hours,
        service_fee: Number(t.service_fee ?? 0),
        status: t.status ?? "—",
      };
    })
    .sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? ""));

  const totalFee = detailRows.reduce((s, r) => s + r.service_fee, 0);

  const buf = await buildWorkbook({
    fileName: "bao-cao-sua-chua",
    summarySheet: {
      title: "Tổng quan",
      rows: [
        ["Tổng phiếu sửa", detailRows.length],
        ["Tổng phí dịch vụ (VNĐ)", totalFee],
        ["Phiếu hoàn tất", detailRows.filter((r) => r.status === "completed" || r.status === "delivered").length],
        ["Phiếu hủy", detailRows.filter((r) => r.status === "cancelled").length],
      ],
    },
    detailSheet: { title: "Chi tiết phiếu sửa", columns: COLUMNS, rows: detailRows },
  });
  const today = new Date().toISOString().slice(0, 10);
  return excelResponse(buf, `bao-cao-sua-chua-${today}.xlsx`);
}
