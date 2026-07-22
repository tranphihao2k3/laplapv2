/**
 * Báo cáo doanh thu — tính từ bảng orders.
 * Query params: from, to, shop_id, group_by (day/week/month)
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

type OrderRow = {
  id: string;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  created_at: string | null;
  shop_id: string | null;
};

function bucket(dateStr: string, groupBy: "day" | "week" | "month") {
  const d = new Date(dateStr);
  if (groupBy === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (groupBy === "week") {
    // ISO-like: Mon as start of week, key = YYYY-Www
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("reports.read").catch(() => {});
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;

    const from = sp.get("from");
    const to = sp.get("to");
    const shopId = sp.get("shop_id");
    const groupBy = (sp.get("group_by") as "day" | "week" | "month") ?? "day";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (supabase as any)
      .from("orders")
      .select("id, status, payment_status, total_amount, created_at, shop_id")
      .limit(10000);

    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    if (shopId) q = q.eq("shop_id", shopId);

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data ?? []) as OrderRow[];
    const completedRows = rows.filter((r) => r.status === "completed" || r.status === "fulfilled");
    const cancelledRows = rows.filter((r) => r.status === "cancelled");

    const totalRevenue = completedRows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    const completedOrders = completedRows.length;
    const cancelledOrders = cancelledRows.length;
    const totalOrders = rows.length;
    const aov = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Breakdown theo bucket
    const buckets = new Map<string, { revenue: number; orders: number; cancelled: number }>();
    for (const r of rows) {
      if (!r.created_at) continue;
      const key = bucket(r.created_at, groupBy);
      const entry = buckets.get(key) ?? { revenue: 0, orders: 0, cancelled: 0 };
      if (r.status === "completed" || r.status === "fulfilled") {
        entry.revenue += Number(r.total_amount ?? 0);
        entry.orders += 1;
      } else if (r.status === "cancelled") {
        entry.cancelled += 1;
      }
      buckets.set(key, entry);
    }

    const series = [...buckets.entries()]
      .map(([key, v]) => ({ bucket: key, ...v }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const r of rows) {
      const k = r.status ?? "unknown";
      statusBreakdown[k] = (statusBreakdown[k] ?? 0) + 1;
    }

    return ok({
      filters: { from, to, shop_id: shopId, group_by: groupBy },
      summary: {
        totalRevenue,
        completedOrders,
        cancelledOrders,
        totalOrders,
        averageOrderValue: aov,
      },
      series,
      statusBreakdown,
    });
  } catch (e) {
    return handleError(e);
  }
}
