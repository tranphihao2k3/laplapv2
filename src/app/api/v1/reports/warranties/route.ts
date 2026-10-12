/**
 * Báo cáo bảo hành — danh sách bảo hành + trạng thái còn/hết hạn + serial.
 * GET /api/v1/reports/warranties
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Warranty = {
  id: string;
  serial_number_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  warranty_type: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  note: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  sold: "Bán máy",
  repair: "Sửa chữa",
  extension: "Gia hạn",
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("warranties")
      .select("id, serial_number_id, customer_id, order_id, warranty_type, start_date, end_date, status, note");
    if (filters.from) q = q.gte("start_date", filters.from);
    if (filters.to) q = q.lte("start_date", filters.to);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.shop_id) q = q.eq("shop_id", filters.shop_id);
    const { data, error } = await q.limit(50_000);
    if (error) throw error;
    const warranties = (data ?? []) as Warranty[];

    const customerIds = Array.from(new Set(warranties.map((w) => w.customer_id).filter((x): x is string => !!x)));
    const serialIds = Array.from(new Set(warranties.map((w) => w.serial_number_id).filter((x): x is string => !!x)));

    const [customersRes, serialsRes, repairsCountRes] = await Promise.all([
      customerIds.length > 0
        ? supabase.from("customers").select("id, full_name, phone").in("id", customerIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null; phone: string | null }[] }),
      serialIds.length > 0
        ? supabase
            .from("serial_numbers")
            .select("id, serial, imei, product_variant:product_variants!inner(id, sku, name, product:products!inner(id, name))")
            .in("id", serialIds)
        : Promise.resolve({ data: [] as Array<{ id: string; serial: string | null; imei: string | null; product_variant?: unknown }> }),
      // Count repairs per serial
      serialIds.length > 0
        ? supabase.from("repair_tickets").select("serial_number_id").in("serial_number_id", serialIds)
        : Promise.resolve({ data: [] as Array<{ serial_number_id: string | null }> }),
    ]);

    const customerMap = new Map(((customersRes.data ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map((c) => [c.id, c]));
    type SerialJoined = {
      id: string;
      serial: string | null;
      imei: string | null;
      product_variant?: {
        id: string;
        sku: string | null;
        name: string | null;
        product?: { id: string; name: string | null } | null;
      } | null;
    };
    const serialMap = new Map<string, SerialJoined>(((serialsRes.data ?? []) as unknown as SerialJoined[]).map((s) => [s.id, s]));
    const repairCountMap = new Map<string, number>();
    for (const r of (repairsCountRes.data ?? []) as Array<{ serial_number_id: string | null }>) {
      if (!r.serial_number_id) continue;
      repairCountMap.set(r.serial_number_id, (repairCountMap.get(r.serial_number_id) ?? 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = warranties.map((w) => {
      const c = w.customer_id ? customerMap.get(w.customer_id) : null;
      const serial = w.serial_number_id ? serialMap.get(w.serial_number_id) : null;
      const daysRemaining = w.end_date
        ? Math.round((new Date(w.end_date).getTime() - today.getTime()) / 86400000)
        : null;
      return {
        id: w.id,
        warranty_code: w.id.slice(0, 8).toUpperCase(),
        warranty_type: TYPE_LABEL[w.warranty_type ?? ""] ?? w.warranty_type ?? "—",
        warranty_type_code: w.warranty_type,
        customer_name: c?.full_name ?? "Khách lẻ",
        customer_phone: c?.phone,
        product_name: serial?.product_variant?.product?.name ?? "—",
        sku: serial?.product_variant?.sku ?? "—",
        serial_number: serial?.serial ?? serial?.imei ?? "—",
        purchase_date: w.start_date,
        expiry_date: w.end_date,
        days_remaining: daysRemaining,
        status: w.status === "voided" ? "Đã hủy"
          : w.status === "claimed" ? "Đang yêu cầu BH"
          : daysRemaining === null ? (w.status ?? "—")
          : daysRemaining < 0 ? "Hết hạn"
          : daysRemaining <= 30 ? "Sắp hết hạn" : "Còn hiệu lực",
        status_code: w.status,
        repair_count: w.serial_number_id ? (repairCountMap.get(w.serial_number_id) ?? 0) : 0,
        note: w.note,
      };
    });

    const active = rows.filter((r) => r.status_code !== "voided" && (r.days_remaining === null || r.days_remaining >= 0));
    const expiringSoon = rows.filter((r) => r.days_remaining !== null && r.days_remaining >= 0 && r.days_remaining <= 30);
    const expired = rows.filter((r) => r.days_remaining !== null && r.days_remaining < 0);
    const summary = {
      total: rows.length,
      active: active.length,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
      totalRepairs: rows.reduce((s, r) => s + r.repair_count, 0),
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
