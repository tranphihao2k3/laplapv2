/**
 * Báo cáo nhân viên — thống kê đơn hàng, doanh thu, hoàn tất theo created_by.
 * GET /api/v1/reports/staff
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { parseFilters, type ReportFilters } from "@/lib/reports/query";

type Order = {
  id: string;
  created_by: string | null;
  status: string | null;
  total_amount: number | null;
  created_at: string | null;
};

type User = { id: string; full_name: string | null; email: string | null; is_active: boolean | null };

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let oq: any = supabase.from("orders").select("id, created_by, status, total_amount, created_at");
    if (filters.from) oq = oq.gte("created_at", filters.from);
    if (filters.to) oq = oq.lte("created_at", filters.to);
    if (filters.shop_id) oq = oq.eq("shop_id", filters.shop_id);
    const { data: ordersData } = await oq.limit(100_000);
    const orders = (ordersData ?? []) as Order[];

    // Nhóm theo user
    const userMap = new Map<string, { total: number; completed: number; cancelled: number; revenue: number }>();
    for (const o of orders) {
      const uid = o.created_by;
      if (!uid) continue;
      const entry = userMap.get(uid) ?? { total: 0, completed: 0, cancelled: 0, revenue: 0 };
      entry.total += 1;
      if (o.status === "completed" || o.status === "fulfilled") {
        entry.completed += 1;
        entry.revenue += Number(o.total_amount ?? 0);
      } else if (o.status === "cancelled") {
        entry.cancelled += 1;
      }
      userMap.set(uid, entry);
    }

    // POS sessions count
    const { data: sessionsData } = await supabase
      .from("pos_sessions")
      .select("opened_by, opened_at, closed_at")
      .limit(50_000);
    const sessions = (sessionsData ?? []) as Array<{ opened_by: string | null; opened_at: string | null; closed_at: string | null }>;
    const sessionCountMap = new Map<string, number>();
    for (const s of sessions) {
      if (!s.opened_by) continue;
      if (filters.from && s.opened_at && s.opened_at < filters.from) continue;
      if (filters.to && s.opened_at && s.opened_at > filters.to + "T23:59:59Z") continue;
      sessionCountMap.set(s.opened_by, (sessionCountMap.get(s.opened_by) ?? 0) + 1);
    }

    // User profiles
    const userIds = Array.from(userMap.keys());
    const { data: usersData } = userIds.length > 0
      ? await supabase.from("user_profiles").select("id, full_name, email, is_active").in("id", userIds)
      : { data: [] as User[] };
    const profileMap = new Map<string, User>(((usersData ?? []) as User[]).map((u) => [u.id, u]));

    const rows = Array.from(userMap.entries()).map(([uid, agg], _i) => {
      const u = profileMap.get(uid);
      return {
        user_id: uid,
        full_name: u?.full_name ?? "Không rõ",
        email: u?.email,
        is_active: u?.is_active !== false,
        total_orders: agg.total,
        completed_orders: agg.completed,
        cancelled_orders: agg.cancelled,
        pos_sessions: sessionCountMap.get(uid) ?? 0,
        revenue: agg.revenue,
        avg_order_value: agg.completed > 0 ? Math.round(agg.revenue / agg.completed) : 0,
        completion_rate: agg.total > 0 ? (agg.completed / agg.total) * 100 : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalOrders = rows.reduce((s, r) => s + r.total_orders, 0);
    const totalCompleted = rows.reduce((s, r) => s + r.completed_orders, 0);
    const summary = {
      staffCount: rows.length,
      activeStaff: rows.filter((r) => r.is_active).length,
      totalOrders,
      totalCompleted,
      totalRevenue,
      avgRevenue: rows.length > 0 ? Math.round(totalRevenue / rows.length) : 0,
      overallCompletionRate: totalOrders > 0 ? (totalCompleted / totalOrders) * 100 : 0,
    };

    // Top 10 chart
    const series = rows.slice(0, 10).map((r) => ({
      bucket: r.full_name.length > 18 ? r.full_name.slice(0, 18) + "…" : r.full_name,
      value: r.revenue,
      count: r.total_orders,
    }));

    return ok({
      filters,
      generatedAt: new Date().toISOString(),
      summary,
      charts: { series, distribution: [] },
      rows: rows.slice(0, 200),
      total: rows.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
