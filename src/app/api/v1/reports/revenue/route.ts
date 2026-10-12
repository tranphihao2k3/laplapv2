/**
 * Báo cáo doanh thu — trả về summary + chart series + rows đã join customer/shop.
 * Query params: from, to, shop_id, channel, status, payment_status
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import {
  parseFilters,
  fetchAll,
  bucketDate,
  type ReportFilters,
} from "@/lib/reports/query";

type OrderRow = {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  channel: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  created_at: string | null;
  shop_id: string | null;
  customer_id: string | null;
};

type CustomerLite = { id: string; full_name: string | null; phone: string | null };
type ShopLite = { id: string; name: string | null; code: string | null };

export type RevenueRow = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  shop_name: string | null;
  shop_code: string | null;
  channel: string | null;
  payment_status: string | null;
  status: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
};

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const filters: ReportFilters = parseFilters(req.nextUrl.searchParams);
    const supabase = await createClient();

    // 1. Lấy orders theo filter (giới hạn 50k)
    const orders = await fetchAll<OrderRow>(
      "orders",
      "id, order_number, status, payment_status, channel, subtotal, discount_amount, total_amount, created_at, shop_id, customer_id",
      filters,
    );

    if (orders.length === 0) {
      return ok({
        filters,
        generatedAt: new Date().toISOString(),
        summary: {
          totalRevenue: 0,
          completedOrders: 0,
          cancelledOrders: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          cancellationRate: 0,
        },
        charts: { series: [], distribution: [] },
        rows: [],
        total: 0,
      });
    }

    // 2. Join customers + shops (1 lần)
    const customerIds = Array.from(new Set(orders.map((o) => o.customer_id).filter((x): x is string => !!x)));
    const shopIds = Array.from(new Set(orders.map((o) => o.shop_id).filter((x): x is string => !!x)));

    const [customersRes, shopsRes] = await Promise.all([
      customerIds.length > 0
        ? supabase.from("customers").select("id, full_name, phone").in("id", customerIds)
        : Promise.resolve({ data: [] as CustomerLite[] }),
      shopIds.length > 0
        ? supabase.from("shops").select("id, name, code").in("id", shopIds)
        : Promise.resolve({ data: [] as ShopLite[] }),
    ]);

    const customerMap = new Map<string, CustomerLite>(
      ((customersRes.data ?? []) as CustomerLite[]).map((c) => [c.id, c]),
    );
    const shopMap = new Map<string, ShopLite>(
      ((shopsRes.data ?? []) as ShopLite[]).map((s) => [s.id, s]),
    );

    // 3. Build rows
    const rows: RevenueRow[] = orders.map((o) => {
      const c = o.customer_id ? customerMap.get(o.customer_id) : null;
      const s = o.shop_id ? shopMap.get(o.shop_id) : null;
      return {
        id: o.id,
        order_number: o.order_number,
        created_at: o.created_at ?? "",
        customer_name: c?.full_name ?? null,
        customer_phone: c?.phone ?? null,
        shop_name: s?.name ?? null,
        shop_code: s?.code ?? null,
        channel: o.channel,
        payment_status: o.payment_status,
        status: o.status,
        subtotal: Number(o.subtotal ?? 0),
        discount_amount: Number(o.discount_amount ?? 0),
        total_amount: Number(o.total_amount ?? 0),
      };
    });

    // 4. Summary
    const completed = rows.filter((r) => r.status === "completed" || r.status === "fulfilled");
    const cancelled = rows.filter((r) => r.status === "cancelled");
    const totalRevenue = completed.reduce((s, r) => s + r.total_amount, 0);
    const summary = {
      totalRevenue,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
      totalOrders: rows.length,
      averageOrderValue: completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0,
      cancellationRate: rows.length > 0 ? (cancelled.length / rows.length) * 100 : 0,
    };

    // 5. Charts: series theo ngày + distribution theo channel
    const seriesMap = new Map<string, { bucket: string; revenue: number; orders: number; cancelled: number }>();
    for (const r of rows) {
      if (!r.created_at) continue;
      const key = bucketDate(r.created_at, "day");
      const entry = seriesMap.get(key) ?? { bucket: key, revenue: 0, orders: 0, cancelled: 0 };
      if (r.status === "completed" || r.status === "fulfilled") {
        entry.revenue += r.total_amount;
        entry.orders += 1;
      } else if (r.status === "cancelled") {
        entry.cancelled += 1;
      }
      seriesMap.set(key, entry);
    }
    const series = Array.from(seriesMap.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));

    const channelMap = new Map<string, number>();
    for (const r of rows) {
      const k = r.channel ?? "unknown";
      channelMap.set(k, (channelMap.get(k) ?? 0) + 1);
    }
    const distribution = Array.from(channelMap.entries())
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);

    return ok({
      filters,
      generatedAt: new Date().toISOString(),
      summary,
      charts: { series, distribution },
      rows: rows.slice(0, 200), // cap UI rows
      total: rows.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
