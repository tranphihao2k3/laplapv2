import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

async function countTable(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase.from(table as any) as any).select("*", { count: "exact", head: true });
  return count ?? 0;
}

/** Build danh sách 14 ngày gần nhất (key YYYY-MM-DD) theo thứ tự cũ → mới. */
function lastNDays(n: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Lấy tuần hiện tại + tuần trước để so sánh. */
function weekBounds(now: Date): { thisStart: string; prevStart: string; prevEnd: string } {
  const dow = now.getDay();
  const thisStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
    .toISOString()
    .slice(0, 10);
  const prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - 7)
    .toISOString()
    .slice(0, 10);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - 1)
    .toISOString()
    .slice(0, 10);
  return { thisStart, prevStart, prevEnd };
}

export async function GET() {
  try {
    await requireUser();
    const supabase = await createClient();

    // ---------GROUP 1: KPI tổng quan ----------
    const [
      totalProducts, totalVariants, totalOrders, totalCustomers, totalPayments,
      totalStockLevels, totalSerials, totalShops, totalWarehouses, totalSuppliers,
      totalWarranties, totalRepairTickets, totalTradeIns, totalRoles,
      totalPermissions, totalStaff, totalUsers, totalOrgs, totalAuditLogs,
    ] = await Promise.all([
      countTable(supabase, "products"),
      countTable(supabase, "product_variants"),
      countTable(supabase, "orders"),
      countTable(supabase, "customers"),
      countTable(supabase, "payments"),
      countTable(supabase, "stock_levels"),
      countTable(supabase, "serial_numbers"),
      countTable(supabase, "shops"),
      countTable(supabase, "warehouses"),
      countTable(supabase, "suppliers"),
      countTable(supabase, "warranties"),
      countTable(supabase, "repair_tickets"),
      countTable(supabase, "trade_in_requests"),
      countTable(supabase, "roles"),
      countTable(supabase, "permissions"),
      countTable(supabase, "shop_staff"),
      countTable(supabase, "user_profiles"),
      countTable(supabase, "organizations"),
      countTable(supabase, "audit_logs"),
    ]);

    // ---------- Orders data (used by many groups) ----------
    const { data: allOrders } = await supabase
      .from("orders")
      .select("id, status, payment_status, total_amount, channel, created_by, shop_id, created_at, order_number, customer_id")
      .limit(10000);
    const orders = (allOrders ?? []) as Array<{
      id: string; status: string | null; payment_status: string | null;
      total_amount: number | null; channel: string | null;
      created_by: string | null; shop_id: string | null;
      created_at: string | null; order_number: string;
      customer_id: string | null;
    }>;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const ordersToday = orders.filter(o => o.created_at && o.created_at >= todayStart);
    const ordersThisWeek = orders.filter(o => o.created_at && o.created_at >= weekStart);
    const ordersThisMonth = orders.filter(o => o.created_at && o.created_at >= monthStart);

    const completedOrders = orders.filter(o => o.status === "completed" || o.status === "fulfilled");
    const cancelledOrders = orders.filter(o => o.status === "cancelled");

    const revenueTotal = completedOrders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    const revenueToday = ordersToday.filter(o => o.status === "completed" || o.status === "fulfilled")
      .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    const revenueThisWeek = ordersThisWeek.filter(o => o.status === "completed" || o.status === "fulfilled")
      .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    const revenueThisMonth = ordersThisMonth.filter(o => o.status === "completed" || o.status === "fulfilled")
      .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

    const newCustomersToday = ordersToday.filter((o): o is typeof o & { customer_id: string } => !!o.customer_id)
      .reduce((acc, o) => acc.add(o.customer_id), new Set<string>()).size;
    const newCustomersThisWeek = ordersThisWeek.filter((o): o is typeof o & { customer_id: string } => !!o.customer_id)
      .reduce((acc, o) => acc.add(o.customer_id), new Set<string>()).size;
    const newCustomersThisMonth = ordersThisMonth.filter((o): o is typeof o & { customer_id: string } => !!o.customer_id)
      .reduce((acc, o) => acc.add(o.customer_id), new Set<string>()).size;

    const aov = completedOrders.length > 0 ? revenueTotal / completedOrders.length : 0;
    const cancellationRate = orders.length > 0 ? (cancelledOrders.length / orders.length) * 100 : 0;

    // ---------- Group 2: Doanh thu & đơn hàng (daily series) ----------
    const dailyBuckets = new Map<string, { revenue: number; orders: number; cancelled: number }>();
    for (const o of orders) {
      if (!o.created_at) continue;
      const key = o.created_at.slice(0, 10);
      const e = dailyBuckets.get(key) ?? { revenue: 0, orders: 0, cancelled: 0 };
      if (o.status === "completed" || o.status === "fulfilled") {
        e.revenue += Number(o.total_amount ?? 0);
        e.orders += 1;
      } else if (o.status === "cancelled") {
        e.cancelled += 1;
      }
      dailyBuckets.set(key, e);
    }
    const dailyRevenue = [...dailyBuckets.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const orderStatusDist: Record<string, number> = {};
    const channelDist: Record<string, number> = {};
    for (const o of orders) {
      const s = o.status ?? "unknown";
      orderStatusDist[s] = (orderStatusDist[s] ?? 0) + 1;
      if (o.channel) channelDist[o.channel] = (channelDist[o.channel] ?? 0) + 1;
    }

    // ---------- Group 3: Thanh toán & kênh ----------
    const { data: allPayments } = await supabase
      .from("payments")
      .select("method, amount, status, created_at")
      .limit(10000);
    const payments = (allPayments ?? []) as Array<{
      method: string | null; amount: number | null; status: string | null; created_at: string | null;
    }>;

    const paymentMethodDist: Record<string, { count: number; amount: number }> = {};
    for (const p of payments) {
      const m = p.method ?? "unknown";
      const e = paymentMethodDist[m] ?? { count: 0, amount: 0 };
      e.count += 1;
      e.amount += Number(p.amount ?? 0);
      paymentMethodDist[m] = e;
    }

    const posRevenue = orders.filter(o => o.channel === "pos" && (o.status === "completed" || o.status === "fulfilled"))
      .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    const onlineRevenue = orders.filter(o => o.channel !== "pos" && (o.status === "completed" || o.status === "fulfilled"))
      .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

    // ---------- Group 4: Sản phẩm ----------
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_variant_id, quantity, total_price, product_snapshot")
      .limit(10000);
    const items = (orderItems ?? []) as Array<{
      product_variant_id: string | null; quantity: number;
      total_price: number; product_snapshot: unknown;
    }>;

    const productSales = new Map<string, { qty: number; revenue: number; name: string }>();
    for (const i of items) {
      const pid = i.product_variant_id ?? "unknown";
      const e = productSales.get(pid) ?? { qty: 0, revenue: 0, name: pid };
      e.qty += i.quantity;
      e.revenue += i.total_price;
      productSales.set(pid, e);
    }
    const topSelling = [...productSales.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const { count: lowStockCount } = await supabase
      .from("stock_levels")
      .select("*", { count: "exact", head: true })
      .lte("available_qty", 5);

    const { data: stockRows } = await supabase
      .from("stock_levels")
      .select("warehouse_id, available_qty, product_variant_id")
      .limit(10000);
    const stockByWarehouse = new Map<string, number>();
    for (const s of (stockRows ?? []) as Array<{ warehouse_id: string; available_qty: number | null; product_variant_id: string }>) {
      const wid = s.warehouse_id ?? "unknown";
      stockByWarehouse.set(wid, (stockByWarehouse.get(wid) ?? 0) + (s.available_qty ?? 0));
    }

    // ---------- Group 5: Kho & nhập hàng ----------
    const { data: inventoryTx } = await supabase
      .from("inventory_transactions")
      .select("type, quantity, created_at, unit_cost")
      .limit(10000);
    const invTxs = (inventoryTx ?? []) as Array<{
      type: string; quantity: number; created_at: string | null; unit_cost: number | null;
    }>;

    let importToday = 0, exportToday = 0, transferToday = 0;
    const todayStr = now.toISOString().slice(0, 10);
    let monthlyImportValue = 0;
    for (const tx of invTxs) {
      const d = tx.created_at?.slice(0, 10) ?? "";
      if (d === todayStr) {
        if (tx.type === "purchase" || tx.type === "transfer_in") importToday += tx.quantity;
        if (tx.type === "sale" || tx.type === "transfer_out") exportToday += tx.quantity;
        if (tx.type === "transfer_in" || tx.type === "transfer_out") transferToday += tx.quantity;
      }
      if (d >= monthStart.slice(0, 10) && (tx.type === "purchase")) {
        monthlyImportValue += (tx.unit_cost ?? 0) * tx.quantity;
      }
    }

    const { data: pendingPOs } = await supabase
      .from("purchase_orders")
      .select("po_number, status, total_amount, created_at")
      .limit(5000);
    const poRows = (pendingPOs ?? []) as Array<{
      po_number: string; status: string | null; total_amount: number | null; created_at: string | null;
    }>;
    const pendingPOCount = poRows.filter(p => p.status === "sent" || p.status === "partial").length;
    const monthlyPurchaseValue = poRows
      .filter(p => p.created_at && p.created_at >= monthStart)
      .reduce((s, p) => s + Number(p.total_amount ?? 0), 0);

    // ---------- Group 6: Khách hàng ----------
    const { data: customerRows } = await supabase
      .from("customers")
      .select("id, tier, loyalty_points, total_spent, created_at")
      .limit(10000);
    const custs = (customerRows ?? []) as Array<{
      id: string; tier: string | null; loyalty_points: number | null;
      total_spent: number | null; created_at: string | null;
    }>;
    const tierDist: Record<string, number> = {};
    let totalPoints = 0;
    for (const c of custs) {
      const t = c.tier ?? "bronze";
      tierDist[t] = (tierDist[t] ?? 0) + 1;
      totalPoints += c.loyalty_points ?? 0;
    }

    const { data: loyaltyTx } = await supabase
      .from("loyalty_transactions")
      .select("type, points, created_at")
      .limit(10000);
    const ltxs = (loyaltyTx ?? []) as Array<{ type: string | null; points: number; created_at: string | null }>;
    let earnedPoints = 0, redeemedPoints = 0;
    for (const l of ltxs) {
      if (l.type === "earn") earnedPoints += l.points;
      if (l.type === "redeem") redeemedPoints += l.points;
    }

    // returning customers: customers who have >1 order
    const customerOrderCount = new Map<string, number>();
    for (const o of orders) {
      if (!o.customer_id) continue;
      customerOrderCount.set(o.customer_id, (customerOrderCount.get(o.customer_id) ?? 0) + 1);
    }
    const returningCustomers = [...customerOrderCount.values()].filter(c => c > 1).length;

    // ---------- Group 7: Dịch vụ sau bán ----------
    const { data: warrantyRows } = await supabase
      .from("warranties")
      .select("status, end_date, serial_number_id")
      .limit(5000);
    const warrs = (warrantyRows ?? []) as Array<{
      status: string | null; end_date: string | null; serial_number_id: string | null;
    }>;
    const warrantyStatusDist: Record<string, number> = {};
    const expiringSoon = warrs.filter(w => {
      if (w.status !== "active" || !w.end_date) return false;
      const end = new Date(w.end_date);
      const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    }).length;

    for (const w of warrs) {
      const s = w.status ?? "unknown";
      warrantyStatusDist[s] = (warrantyStatusDist[s] ?? 0) + 1;
    }

    const { data: repairRows } = await supabase
      .from("repair_tickets")
      .select("status, assigned_to, created_at, completed_at")
      .limit(5000);
    const repairs = (repairRows ?? []) as Array<{
      status: string | null; assigned_to: string | null; created_at: string | null; completed_at: string | null;
    }>;
    const openRepairs = repairs.filter(r =>
      r.status !== "done" && r.status !== "delivered" && r.status !== "cancelled"
    ).length;
    const repairStatusDist: Record<string, number> = {};
    for (const r of repairs) {
      const s = r.status ?? "unknown";
      repairStatusDist[s] = (repairStatusDist[s] ?? 0) + 1;
    }

    const { data: tradeInRows } = await supabase
      .from("trade_in_requests")
      .select("status, created_at")
      .limit(5000);
    const trades = (tradeInRows ?? []) as Array<{ status: string | null; created_at: string | null }>;
    const pendingTradeIns = trades.filter(t => t.status === "pending" || t.status === "evaluating").length;
    const tradeInStatusDist: Record<string, number> = {};
    for (const t of trades) {
      const s = t.status ?? "unknown";
      tradeInStatusDist[s] = (tradeInStatusDist[s] ?? 0) + 1;
    }

    // ---------- Group 8: Ca bán hàng ----------
    const { data: posSessions } = await supabase
      .from("pos_sessions")
      .select("id, opened_by, opening_cash, closing_cash, expected_cash, difference_cash, shop_id, opened_at, closed_at")
      .limit(5000);
    const sessions = (posSessions ?? []) as Array<{
      id: string; opened_by: string | null; opening_cash: number | null; closing_cash: number | null;
      expected_cash: number | null; difference_cash: number | null;
      shop_id: string | null; opened_at: string | null; closed_at: string | null;
    }>;
    const openSessions = sessions.filter(s => !s.closed_at).length;

    // Lấy tên nhân viên qua profile
    const staffIds = [...new Set(
      [...orders.map(o => o.created_by), ...sessions.map(s => s.opened_by)]
        .filter((id): id is string => !!id),
    )];
    const staffMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (staffIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", staffIds.slice(0, 200));
      for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
        staffMap.set(p.id, { full_name: p.full_name, email: p.email });
      }
    }

    const staffRevenue = new Map<string, { orders: number; revenue: number; name: string }>();
    for (const o of orders) {
      if (!o.created_by) continue;
      if (o.status !== "completed" && o.status !== "fulfilled") continue;
      const e = staffRevenue.get(o.created_by) ?? { orders: 0, revenue: 0, name: o.created_by };
      e.orders += 1;
      e.revenue += Number(o.total_amount ?? 0);
      staffRevenue.set(o.created_by, e);
    }
    // Gán tên thật cho topStaff
    const topStaff = [...staffRevenue.entries()]
      .map(([id, v]) => {
        const profile = staffMap.get(id);
        return {
          id,
          name: profile?.full_name ?? profile?.email ?? v.name.slice(0, 8),
          orders: v.orders,
          revenue: v.revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const diffCashSessions = sessions.filter(s => s.difference_cash !== null && s.difference_cash !== 0);
    const totalDiffCash = diffCashSessions.reduce((s, x) => s + Math.abs(x.difference_cash ?? 0), 0);

    // ---------- Order/payment/product status dist (legacy) ----------
    const paymentStatusDist: Record<string, number> = {};
    for (const o of orders) {
      const p = o.payment_status ?? "unknown";
      paymentStatusDist[p] = (paymentStatusDist[p] ?? 0) + 1;
    }

    const { data: prodStatusRows } = await supabase
      .from("products")
      .select("status")
      .limit(5000);
    const productStatusMap: Record<string, number> = {};
    for (const row of (prodStatusRows ?? []) as Array<{ status: string | null }>) {
      const s = row.status ?? "unknown";
      productStatusMap[s] = (productStatusMap[s] ?? 0) + 1;
    }

    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 10)
      .map(o => ({
        order_number: o.order_number,
        status: o.status,
        payment_status: o.payment_status,
        total_amount: o.total_amount,
        created_at: o.created_at,
        channel: o.channel,
      }));

    // ============================================================
    //  SERIES PHỤC VỤ CHART NÂNG CAO (sparkline, heatmap, small-multiples)
    // ============================================================

    // 14-day daily series với đầy đủ 14 ngày (kể cả ngày không có data)
    const last14 = lastNDays(14, now);
    const last30 = lastNDays(30, now);
    const last7 = lastNDays(7, now);
    const last14Daily: { date: string; revenue: number; orders: number; cancelled: number }[] = last14.map(d => {
      const e = dailyBuckets.get(d);
      return { date: d, revenue: e?.revenue ?? 0, orders: e?.orders ?? 0, cancelled: e?.cancelled ?? 0 };
    });
    const last30Daily: { date: string; revenue: number; orders: number; cancelled: number }[] = last30.map(d => {
      const e = dailyBuckets.get(d);
      return { date: d, revenue: e?.revenue ?? 0, orders: e?.orders ?? 0, cancelled: e?.cancelled ?? 0 };
    });

    // 7-day sparkline theo từng metric (revenue, orders, customers, aov)
    const custByDay = new Map<string, Set<string>>();
    for (const o of orders) {
      if (!o.created_at || !o.customer_id) continue;
      const d = o.created_at.slice(0, 10);
      const s = custByDay.get(d) ?? new Set();
      s.add(o.customer_id);
      custByDay.set(d, s);
    }
    const last7Revenue = last7.map(d => dailyBuckets.get(d)?.revenue ?? 0);
    const last7Orders = last7.map(d => dailyBuckets.get(d)?.orders ?? 0);
    const last7Customers = last7.map(d => custByDay.get(d)?.size ?? 0);
    // AOV mỗi ngày
    const last7Aov = last7.map(d => {
      const b = dailyBuckets.get(d);
      if (!b || b.orders === 0) return 0;
      return Math.round(b.revenue / b.orders);
    });

    // Calendar heatmap: revenue mỗi ngày trong 30 ngày (cho GroupKPI section nếu cần)
    const heatmap30 = last30Daily.map(d => ({
      date: d.date,
      revenue: d.revenue,
      orders: d.orders,
    }));

    // Weekly compare (tuần này vs tuần trước) cho revenue + orders
    const { thisStart, prevStart, prevEnd } = weekBounds(now);
    const thisWeekRevenue = completedOrders
      .filter(o => o.created_at && o.created_at.slice(0, 10) >= thisStart)
      .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    const prevWeekRevenue = completedOrders
      .filter(o => {
        if (!o.created_at) return false;
        const d = o.created_at.slice(0, 10);
        return d >= prevStart && d <= prevEnd;
      })
      .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
    const thisWeekOrders = orders.filter(o => o.created_at && o.created_at.slice(0, 10) >= thisStart).length;
    const prevWeekOrders = orders.filter(o => {
      if (!o.created_at) return false;
      const d = o.created_at.slice(0, 10);
      return d >= prevStart && d <= prevEnd;
    }).length;

    // POS vs Online theo ngày (7 ngày gần nhất) cho small-multiples
    const channelDaily = last7.map(d => {
      const dayOrders = orders.filter(o => o.created_at && o.created_at.slice(0, 10) === d);
      const posRev = dayOrders.filter(o => o.channel === "pos" && (o.status === "completed" || o.status === "fulfilled"))
        .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
      const onlRev = dayOrders.filter(o => o.channel !== "pos" && (o.status === "completed" || o.status === "fulfilled"))
        .reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
      return { date: d, pos: posRev, online: onlRev };
    });

    // Payment method 7-day series
    const methodDaily = last7.map(d => {
      const dayPays = payments.filter(p => p.created_at && p.created_at.slice(0, 10) === d);
      const map: Record<string, number> = {};
      for (const p of dayPays) {
        const m = p.method ?? "unknown";
        map[m] = (map[m] ?? 0) + Number(p.amount ?? 0);
      }
      return { date: d, cash: map.cash ?? 0, transfer: map.transfer ?? 0, card: map.card ?? 0, ewallet: map.ewallet ?? 0 };
    });

    // Funnel data: orders lifecycle
    const funnel = {
      placed: orders.length,
      confirmed: orders.filter(o => o.status !== "pending").length,
      paid: orders.filter(o => o.payment_status === "paid" || o.payment_status === "partial").length,
      fulfilled: orders.filter(o => o.status === "fulfilled").length,
      completed: orders.filter(o => o.status === "completed").length,
    };

    // Top customers (chi tiêu cao nhất)
    const customerSpend = new Map<string, { total: number; orders: number; name: string; tier: string | null }>();
    for (const o of orders) {
      if (!o.customer_id || (o.status !== "completed" && o.status !== "fulfilled")) continue;
      const e = customerSpend.get(o.customer_id) ?? {
        total: 0,
        orders: 0,
        name: o.customer_id,
        tier: null,
      };
      e.total += Number(o.total_amount ?? 0);
      e.orders += 1;
      customerSpend.set(o.customer_id, e);
    }
    // Bổ sung tên + tier từ bảng customers
    const topCustomersRaw = [...customerSpend.entries()]
      .map(([id, v]) => {
        const c = custs.find(x => x.id === id);
        const profile = staffMap.get(id); // fallback id-keyed, có thể trùng nhưng ok
        return {
          id,
          name: c ? c.id.slice(0, 8) : (profile?.full_name ?? v.name),
          tier: c?.tier ?? "bronze",
          orders: v.orders,
          total: v.total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Inventory flow last 14 days (in/out/transfer)
    const inventoryFlow = last14.map(d => {
      let inbound = 0, outbound = 0, transfer = 0;
      for (const tx of invTxs) {
        if (tx.created_at?.slice(0, 10) !== d) continue;
        if (tx.type === "purchase" || tx.type === "transfer_in") inbound += tx.quantity;
        if (tx.type === "sale" || tx.type === "transfer_out") outbound += tx.quantity;
        if (tx.type === "transfer_in" || tx.type === "transfer_out") transfer += tx.quantity;
      }
      return { date: d, inbound, outbound, transfer };
    });

    // Average time to repair (giờ) theo tháng (6 tháng gần nhất)
    const months: { key: string; label: string; repairCount: number; avgHours: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = `T${d.getMonth() + 1}`;
      let count = 0;
      let totalHours = 0;
      for (const r of repairs) {
        if (!r.created_at) continue;
        const t = new Date(r.created_at);
        if (t < d || t >= nextMonth) continue;
        if (!r.completed_at) continue;
        count += 1;
        totalHours += (new Date(r.completed_at).getTime() - t.getTime()) / (1000 * 60 * 60);
      }
      months.push({
        key: monthKey,
        label: monthLabel,
        repairCount: count,
        avgHours: count > 0 ? Math.round((totalHours / count) * 10) / 10 : 0,
      });
    }

    // Order status timeline (7-day): mỗi ngày breakdown theo status
    const statusByDay = last7.map(d => {
      const dayOrders = orders.filter(o => o.created_at && o.created_at.slice(0, 10) === d);
      const out: Record<string, number> = { pending: 0, confirmed: 0, processing: 0, completed: 0, cancelled: 0 };
      for (const o of dayOrders) {
        const s = o.status ?? "pending";
        if (s in out) out[s] += 1;
        else out[s] = 1;
      }
      return { date: d, ...out };
    });

    const payload = {
      // Group 1 — KPI tổng quan
      kpi: {
        revenueTotal,
        revenueToday,
        revenueThisWeek,
        revenueThisMonth,
        totalOrders,
        ordersToday: ordersToday.length,
        ordersThisWeek: ordersThisWeek.length,
        ordersThisMonth: ordersThisMonth.length,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        aov,
        cancellationRate,
        totalCustomers,
        newCustomersToday,
        newCustomersThisWeek,
        newCustomersThisMonth,
      },
      // Group 2 — Doanh thu & đơn hàng
      revenue: {
        dailyRevenue,
        last14Daily,
        last30Daily,
        orderStatusDist,
        paymentStatusDist,
        cancellationRate,
        aov,
      },
      // Group 3 — Thanh toán & kênh
      payment: {
        paymentMethodDist: Object.fromEntries(
          Object.entries(paymentMethodDist).map(([k, v]) => [k, { count: v.count, amount: v.amount }])
        ),
        channelDist,
        posRevenue,
        onlineRevenue,
        methodDaily,
        channelDaily,
      },
      // Group 4 — Sản phẩm
      product: {
        topSelling,
        lowStockCount: lowStockCount ?? 0,
        totalProducts,
        totalVariants,
        productStatus: productStatusMap,
      },
      // Group 5 — Kho & nhập hàng
      inventory: {
        importToday,
        exportToday,
        transferToday,
        pendingPOCount,
        monthlyImportValue,
        monthlyPurchaseValue,
        totalWarehouses,
        totalSuppliers,
        totalStockLevels,
        totalSerials,
        inventoryFlow,
      },
      // Group 6 — Khách hàng
      customer: {
        tierDist,
        totalCustomers,
        returningCustomers,
        totalPoints,
        earnedPoints,
        redeemedPoints,
        topCustomers: topCustomersRaw,
      },
      // Group 7 — Dịch vụ sau bán
      afterSale: {
        openRepairs,
        repairStatusDist,
        totalRepairTickets,
        expiringWarranties: expiringSoon,
        warrantyStatusDist,
        totalWarranties,
        pendingTradeIns,
        tradeInStatusDist,
        totalTradeIns,
        repairMonths: months,
      },
      // Group 8 — Ca bán hàng
      pos: {
        openSessions,
        totalSessions: sessions.length,
        topStaff,
        diffCashSessions: diffCashSessions.length,
        totalDiffCash,
      },
      // ====== NEW: series phục vụ chart nâng cao ======
      advanced: {
        last7Revenue,
        last7Orders,
        last7Customers,
        last7Aov,
        heatmap30,
        weeklyCompare: {
          thisWeek: { revenue: thisWeekRevenue, orders: thisWeekOrders },
          prevWeek: { revenue: prevWeekRevenue, orders: prevWeekOrders },
        },
        funnel,
        statusByDay,
      },
      // Legacy (cho components cũ)
      legacy: {
        products: totalProducts,
        productVariants: totalVariants,
        orders: totalOrders,
        customers: totalCustomers,
        payments: totalPayments,
        stockLevels: totalStockLevels,
        serialNumbers: totalSerials,
        shops: totalShops,
        warehouses: totalWarehouses,
        suppliers: totalSuppliers,
        roles: totalRoles,
        permissions: totalPermissions,
        shopStaff: totalStaff,
        userProfiles: totalUsers,
        organizations: totalOrgs,
        auditLogs: totalAuditLogs,
        posSessionOpen: openSessions,
        lowStockCount: lowStockCount ?? 0,
        recentOrders,
      },
    };

    return ok(payload);
  } catch (e) {
    return handleError(e);
  }
}