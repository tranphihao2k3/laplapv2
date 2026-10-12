/**
 * Báo cáo sửa chữa — phiếu sửa theo kỳ, gồm KTV + khách + phí + giờ sửa.
 * GET /api/v1/reports/repairs
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Ticket = {
  id: string;
  ticket_number: string | null;
  customer_id: string | null;
  technician_id: string | null;
  device_info: string | null;
  problem: string | null;
  status: string | null;
  received_at: string | null;
  completed_at: string | null;
  service_fee: number | null;
  estimated_completion: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ tiếp nhận",
  received: "Đã tiếp nhận",
  diagnosing: "Đang chẩn đoán",
  waiting_parts: "Chờ linh kiện",
  in_progress: "Đang sửa",
  ready: "Sẵn sàng giao",
  completed: "Hoàn tất",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("repair_tickets")
      .select("id, ticket_number, customer_id, technician_id, device_info, problem, status, received_at, completed_at, service_fee, estimated_completion");
    if (filters.from) q = q.gte("received_at", filters.from);
    if (filters.to) q = q.lte("received_at", filters.to);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.shop_id) q = q.eq("shop_id", filters.shop_id);
    const { data, error } = await q.limit(50_000);
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

    const rows = tickets.map((t) => {
      const c = t.customer_id ? customerMap.get(t.customer_id) : null;
      const tech = t.technician_id ? techMap.get(t.technician_id) : null;
      const hours = t.completed_at && t.received_at
        ? Math.round(((new Date(t.completed_at).getTime() - new Date(t.received_at).getTime()) / 3600000) * 10) / 10
        : null;
      return {
        id: t.id,
        ticket_number: t.ticket_number ?? "—",
        customer_name: c?.full_name ?? "Khách lẻ",
        customer_phone: c?.phone,
        technician_name: tech?.full_name,
        device_info: t.device_info,
        problem: t.problem,
        status: STATUS_LABEL[t.status ?? ""] ?? t.status ?? "—",
        status_code: t.status,
        received_at: t.received_at,
        completed_at: t.completed_at,
        repair_hours: hours,
        service_fee: Number(t.service_fee ?? 0),
      };
    }).sort((a, b) => (b.received_at ?? "").localeCompare(a.received_at ?? ""));

    const totalServiceFee = rows.reduce((s, r) => s + r.service_fee, 0);
    const completed = rows.filter((r) => r.status_code === "completed" || r.status_code === "delivered");
    const cancelled = rows.filter((r) => r.status_code === "cancelled");
    const avgHours = completed.length > 0
      ? completed.reduce((s, r) => s + (r.repair_hours ?? 0), 0) / completed.length
      : 0;
    const summary = {
      totalTickets: rows.length,
      completedTickets: completed.length,
      cancelledTickets: cancelled.length,
      totalServiceFee,
      avgRepairHours: Math.round(avgHours * 10) / 10,
      completionRate: rows.length > 0 ? (completed.length / rows.length) * 100 : 0,
    };

    // Distribution by status
    const statusMap = new Map<string, number>();
    for (const r of rows) {
      statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
    }
    const distribution = Array.from(statusMap.entries())
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);

    return ok({
      filters,
      generatedAt: new Date().toISOString(),
      summary,
      charts: { series: [], distribution },
      rows: rows.slice(0, 200),
      total: rows.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
