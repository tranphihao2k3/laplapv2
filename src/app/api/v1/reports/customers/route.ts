/**
 * Báo cáo khách hàng — top khách hàng theo doanh thu.
 * GET /api/v1/reports/customers?tier=...
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  tier: string | null;
  loyalty_points: number | null;
  created_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  bronze: "Đồng",
  silver: "Bạc",
  gold: "Vàng",
  platinum: "Bạch kim",
  diamond: "Kim cương",
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
    const supabase = await createClient();

    // Chỉ select các cột tồn tại trong DB (total_spent/total_orders/last_order_at/is_active KHÔNG có → query lỗi).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("customers")
      .select("id, full_name, phone, email, tier, loyalty_points, created_at")
      .limit(50_000);
    if (filters.tier) q = q.eq("tier", filters.tier);
    const { data, error } = await q;
    if (error) throw error;
    const customers = (data ?? []) as Customer[];

    // Luôn tính số đơn/tổng chi từ orders (đơn hoàn tất)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let oq: any = supabase.from("orders").select("customer_id, total_amount, created_at").in(
      "status",
      ["completed", "fulfilled"],
    );
    if (filters.from) oq = oq.gte("created_at", filters.from);
    if (filters.to) oq = oq.lte("created_at", filters.to);
    if (filters.shop_id) oq = oq.eq("shop_id", filters.shop_id);
    const { data: od } = await oq.limit(100_000);
    const ordersInPeriod = (od ?? []) as Array<{ customer_id: string; total_amount: number; created_at: string }>;
    const orderMap = new Map<string, { count: number; total: number; lastAt: string | null }>();
    for (const o of ordersInPeriod) {
      if (!o.customer_id) continue;
      const entry = orderMap.get(o.customer_id) ?? { count: 0, total: 0, lastAt: null };
      entry.count += 1;
      entry.total += Number(o.total_amount ?? 0);
      if (!entry.lastAt || (o.created_at && o.created_at > entry.lastAt)) entry.lastAt = o.created_at;
      orderMap.set(o.customer_id, entry);
    }

    const rows = customers.map((c) => {
      const o = orderMap.get(c.id);
      return {
        id: c.id,
        full_name: c.full_name ?? "Khách lẻ",
        phone: c.phone,
        email: c.email,
        tier: STATUS_LABEL[c.tier ?? ""] ?? c.tier ?? "—",
        tier_code: c.tier,
        loyalty_points: Number(c.loyalty_points ?? 0),
        total_orders: o?.count ?? 0,
        total_spent: o?.total ?? 0,
        last_order_at: o?.lastAt ?? null,
        created_at: c.created_at,
        // Không có cột is_active → coi khách có đơn trong 90 ngày là "đang hoạt động"
        is_active: o?.lastAt ? (Date.now() - new Date(o.lastAt).getTime()) <= 90 * 86400000 : false,
      };
    }).sort((a, b) => b.total_spent - a.total_spent);

    const totalRevenue = rows.reduce((s, r) => s + r.total_spent, 0);
    const totalCustomers = rows.length;
    const activeCustomers = rows.filter((r) => r.is_active).length;
    const totalLoyalty = rows.reduce((s, r) => s + r.loyalty_points, 0);
    const summary = {
      totalCustomers,
      activeCustomers,
      totalRevenue,
      totalLoyalty,
      avgSpent: totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0,
    };

    // Charts
    const tierMap = new Map<string, number>();
    for (const r of rows) {
      tierMap.set(r.tier, (tierMap.get(r.tier) ?? 0) + 1);
    }
    const tierDist = Array.from(tierMap.entries())
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);

    // Top 20 chart
    const series = rows.slice(0, 20).map((r) => ({
      bucket: r.full_name.length > 18 ? r.full_name.slice(0, 18) + "…" : r.full_name,
      value: r.total_spent,
      count: r.total_orders,
    }));

    return ok({
      filters,
      generatedAt: new Date().toISOString(),
      summary,
      charts: { series, distribution: tierDist },
      rows: rows.slice(0, 200),
      total: rows.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
