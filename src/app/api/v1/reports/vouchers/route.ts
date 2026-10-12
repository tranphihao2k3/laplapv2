/**
 * Báo cáo voucher — tỉ lệ sử dụng + doanh thu từ voucher.
 * GET /api/v1/reports/vouchers
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Voucher = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_value: number | null;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  total_issued: number | null;
  total_used: number | null;
  usage_limit: number | null;
  status: string | null;
  is_active: boolean | null;
};

const TYPE_LABEL: Record<string, string> = {
  percent: "Giảm %",
  fixed: "Giảm tiền",
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("vouchers")
      .select("id, code, name, description, discount_type, discount_value, min_order_value, max_discount, starts_at, ends_at, total_issued, total_used, usage_limit, status, is_active")
      .limit(10_000);
    if (filters.status) q = q.eq("status", filters.status);
    const { data, error } = await q;
    if (error) throw error;
    const vouchers = (data ?? []) as Voucher[];

    // Lấy orders trong kỳ để tính doanh thu từ voucher (nếu có filter ngày)
    const orderVoucherMap = new Map<string, { count: number; revenue: number; discount: number }>();
    if (vouchers.length > 0 && (filters.from || filters.to)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let oq: any = supabase.from("orders").select("id, voucher_id, voucher_discount, total_amount, created_at");
      if (filters.from) oq = oq.gte("created_at", filters.from);
      if (filters.to) oq = oq.lte("created_at", filters.to);
      if (filters.shop_id) oq = oq.eq("shop_id", filters.shop_id);
      oq = oq.not("voucher_id", "is", null);
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

    const rows = vouchers.map((v) => {
      const usage = orderVoucherMap.get(v.id);
      const totalUsed = usage?.count ?? Number(v.total_used ?? 0);
      const totalIssued = Number(v.total_issued ?? 0);
      const usageRate = totalIssued > 0 ? (totalUsed / totalIssued) * 100 : 0;
      return {
        id: v.id,
        code: v.code,
        name: v.name,
        description: v.description,
        discount_type: TYPE_LABEL[v.discount_type] ?? v.discount_type,
        discount_value: Number(v.discount_value),
        min_order_value: v.min_order_value,
        max_discount: v.max_discount,
        starts_at: v.starts_at,
        ends_at: v.ends_at,
        total_issued: totalIssued,
        total_used: totalUsed,
        usage_rate_pct: usageRate,
        revenue_generated: usage?.revenue ?? 0,
        total_discount: usage?.discount ?? 0,
        status: v.status ?? (v.is_active ? "active" : "inactive"),
      };
    }).sort((a, b) => b.revenue_generated - a.revenue_generated);

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
