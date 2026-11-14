/**
 * Báo cáo voucher — tỉ lệ sử dụng + doanh thu từ voucher.
 * GET /api/v1/reports/vouchers
 */
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, handleError } from "@/lib/api/response";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type VoucherRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: "percent" | "fixed_amount" | "free_shipping";
  value: number;
  min_order_amount: number | null;
  max_discount_amount: number | null;
  start_date: string | null;
  end_date: string | null;
  quantity_total: number | null;
  quantity_used: number | null;
  is_active: boolean | null;
};

const TYPE_LABEL: Record<string, string> = {
  percent: "Giảm %",
  fixed_amount: "Giảm tiền",
  free_shipping: "Miễn phí ship",
};

function derivedStatus(v: VoucherRow, now = new Date()) {
  if (!v.is_active) return "inactive";
  if (v.start_date && new Date(v.start_date) > now) return "upcoming";
  if (v.end_date && new Date(v.end_date) < now) return "expired";
  if (
    v.quantity_total != null &&
    (v.quantity_used ?? 0) >= v.quantity_total
  ) {
    return "depleted";
  }
  return "active";
}

export async function GET(req: NextRequest) {
  try {
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
    const vouchers = (data ?? []) as VoucherRow[];

    // Lấy orders trong kỳ để tính doanh thu từ voucher (nếu có filter ngày)
    const orderVoucherMap = new Map<string, { count: number; revenue: number; discount: number }>();
    if (vouchers.length > 0 && (filters.from || filters.to)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let oq: any = db
        .from("orders")
        .select("id, voucher_id, voucher_discount, total_amount, created_at")
        .not("voucher_id", "is", null);
      if (filters.from) oq = oq.gte("created_at", filters.from);
      if (filters.to) oq = oq.lte("created_at", filters.to);
      if (filters.shop_id) oq = oq.eq("shop_id", filters.shop_id);
      const { data: oData } = await oq.limit(100_000);
      const orders = (oData ?? []) as Array<{ voucher_id: string | null; total_amount: number; voucher_discount: number | null }>;
      for (const o of orders) {
        if (!o.voucher_id) continue;
        const entry = orderVoucherMap.get(o.voucher_id) ?? { count: 0, revenue: 0, discount: 0 };
        entry.count += 1;
        entry.revenue += Number(o.total_amount ?? 0);
        entry.discount += Number(o.voucher_discount ?? 0);
        orderVoucherMap.set(o.voucher_id, entry);
      }
    }

    let rows = vouchers.map((v) => {
      const usage = orderVoucherMap.get(v.id);
      const totalUsed = Number(v.quantity_used ?? 0);
      const totalIssued = Number(v.quantity_total ?? 0);
      const usageRate = totalIssued > 0 ? (totalUsed / totalIssued) * 100 : 0;
      return {
        id: v.id,
        code: v.code,
        name: v.name,
        description: v.description,
        discount_type: TYPE_LABEL[v.type] ?? v.type,
        discount_value: Number(v.value),
        min_order_value: v.min_order_amount,
        max_discount: v.max_discount_amount,
        starts_at: v.start_date,
        ends_at: v.end_date,
        total_issued: totalIssued,
        total_used: totalUsed,
        usage_rate_pct: usageRate,
        revenue_generated: usage?.revenue ?? 0,
        total_discount: usage?.discount ?? 0,
        status: derivedStatus(v),
      };
    });

    if (filters.status) {
      rows = rows.filter((r) => r.status === filters.status);
    }

    rows.sort((a, b) => b.revenue_generated - a.revenue_generated);

    const totalIssued = rows.reduce((s, r) => s + r.total_issued, 0);
    const totalUsed = rows.reduce((s, r) => s + r.total_used, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue_generated, 0);
    const totalDiscount = rows.reduce((s, r) => s + r.total_discount, 0);
    const activeCount = rows.filter((r) => r.status === "active").length;
    const summary = {
      totalVouchers: rows.length,
      activeVouchers: activeCount,
      totalIssued,
      totalUsed,
      totalRevenue,
      totalDiscount,
      usageRate: totalIssued > 0 ? (totalUsed / totalIssued) * 100 : 0,
    };

    // Top 10 by usage
    const series = rows.slice(0, 10).map((r) => ({
      bucket: r.code,
      value: r.total_used,
      count: r.revenue_generated,
    }));

    // Distribution by type
    const typeMap = new Map<string, number>();
    for (const r of rows) {
      typeMap.set(r.discount_type, (typeMap.get(r.discount_type) ?? 0) + 1);
    }
    const distribution = Array.from(typeMap.entries())
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
