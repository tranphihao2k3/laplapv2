import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

async function countTable(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase.from(table as any) as any).select("*", { count: "exact", head: true });
  return count ?? 0;
}

function fNum(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
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
      .select("method, amount, status")
      .limit(10000);
    const payments = (allPayments ?? []) as Array<{ method: string | null; amount: number | null; status: string | null }>;

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
      .select("tier, loyalty_points, created_at")
      .limit(10000);
    const custs = (customerRows ?? []) as Array<{
      tier: string | null; loyalty_points: number | null; created_at: string | null;
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
      .select("type, points")
      .limit(10000);
    const ltxs = (loyaltyTx ?? []) as Array<{ type: string | null; points: number }>;
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
      .select("status, assigned_to, created_at")
      .limit(5000);
    const repairs = (repairRows ?? []) as Array<{
      status: string | null; assigned_to: string | null; created_at: string | null;
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
      .select("opened_by, opening_cash, closing_cash, expected_cash, difference_cash, shop_id, opened_at, closed_at")
      .limit(5000);
    const sessions = (posSessions ?? []) as Array<{
      opened_by: string | null; opening_cash: number | null; closing_cash: number | null;
      expected_cash: number | null; difference_cash: number | null;
      shop_id: string | null; opened_at: string | null; closed_at: string | null;
    }>;
    const openSessions = sessions.filter(s => !s.closed_at).length;

    // Revenue by staff (from orders created_by)
    const staffRevenue = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      if (!o.created_by) continue;
      if (o.status !== "completed" && o.status !== "fulfilled") continue;
      const e = staffRevenue.get(o.created_by) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += Number(o.total_amount ?? 0);
      staffRevenue.set(o.created_by, e);
    }
    const topStaff = [...staffRevenue.entries()]
      .map(([id, v]) => ({ id, ...v }))
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
      },
      // Group 6 — Khách hàng
      customer: {
        tierDist,
        totalCustomers,
        returningCustomers,
        totalPoints,
        earnedPoints,
        redeemedPoints,
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
      },
      // Group 8 — Ca bán hàng
      pos: {
        openSessions,
        totalSessions: sessions.length,
        topStaff,
        diffCashSessions: diffCashSessions.length,
        totalDiffCash,
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
