/**
 * Admin Alerts — tổng hợp các thứ cần admin xử lý.
 *
 * Trả về các "alert" ở 3 mức severity:
 *  - critical: phải xử lý trong ngày (đơn pending quá lâu, phiếu sửa quá hạn)
 *  - warning : nên xử lý trong tuần (tồn kho thấp, BH sắp hết hạn, yêu cầu thu cũ pending)
 *  - info    : theo dõi (đơn hôm nay, KH mới hôm nay)
 *
 * Mỗi alert có:
 *  - id, severity, type, title, description, count, href (link tới trang filter sẵn)
 *  - severity: 'critical' | 'warning' | 'info'
 *
 * Cache 30s ở client qua React Query.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

export type AlertSeverity = "critical" | "warning" | "info";

export type AdminAlert = {
  id: string;
  severity: AlertSeverity;
  type:
    | "orders_pending"
    | "repair_overdue"
    | "low_stock"
    | "warranty_expiring"
    | "tradein_pending"
    | "orders_today"
    | "customers_today"
    | "po_pending";
  title: string;
  description: string;
  count: number;
  href: string;
  meta?: Record<string, unknown>;
};

export type AdminAlertsResponse = {
  generatedAt: string;
  totals: { critical: number; warning: number; info: number };
  alerts: AdminAlert[];
};

export async function GET(_req: NextRequest) {
  try {
    await requireUser();
    const supabase = await createClient();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const in2d = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 ngày trước: đơn pending quá 2 ngày

    // Run 8 truy vấn song song — mỗi cái chỉ count/select tối thiểu
    const [
      ordersPendingRes,
      ordersPendingOverdueRes,
      ordersTodayRes,
      repairOpenRes,
      repairOverdueRes,
      lowStockRes,
      warrantyExpiringRes,
      tradeInPendingRes,
      customersTodayRes,
      poPendingRes,
    ] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "confirmed"]),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .in("status", ["pending", "confirmed"]).lt("created_at", in2d),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      supabase.from("repair_tickets").select("id", { count: "exact", head: true })
        .not("status", "in", "(done,delivered,cancelled,completed)"),
      supabase.from("repair_tickets").select("id", { count: "exact", head: true })
        .not("status", "in", "(done,delivered,cancelled,completed)")
        .lt("created_at", in2d),
      supabase.from("stock_levels").select("id", { count: "exact", head: true })
        .lte("available_qty", 5).gt("available_qty", -1),
      supabase.from("warranties").select("id", { count: "exact", head: true })
        .eq("status", "active").lte("end_date", in30d).gte("end_date", todayStart),
      supabase.from("trade_in_requests").select("id", { count: "exact", head: true })
        .in("status", ["pending", "evaluating"]),
      // Khách hàng mới hôm nay: dùng customers.created_at
      supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
      supabase.from("purchase_orders").select("id", { count: "exact", head: true })
        .in("status", ["sent", "partial", "approved"]),
    ]);

    const count = (r: { count: number | null } | null | undefined) => r?.count ?? 0;

    const alerts: AdminAlert[] = [];

    // 1. Đơn pending quá hạn > 2 ngày (critical)
    const overdueOrders = count(ordersPendingOverdueRes);
    if (overdueOrders > 0) {
      alerts.push({
        id: "orders_overdue",
        severity: "critical",
        type: "orders_pending",
        title: "Đơn chờ xử lý quá 2 ngày",
        description: `${overdueOrders} đơn đang pending/confirmed > 48h. Cần xác nhận hoặc liên hệ khách.`,
        count: overdueOrders,
        href: "/quanly/orders?status=pending&overdue=1",
        meta: { overdue: true },
      });
    }

    // 2. Phiếu sửa quá hạn > 2 ngày (critical)
    const overdueRepairs = count(repairOverdueRes);
    if (overdueRepairs > 0) {
      alerts.push({
        id: "repairs_overdue",
        severity: "critical",
        type: "repair_overdue",
        title: "Phiếu sửa quá hạn",
        description: `${overdueRepairs} phiếu sửa đang mở > 2 ngày. Cần cập nhật tiến độ hoặc báo khách.`,
        count: overdueRepairs,
        href: "/quanly/repair-tickets?status=open&overdue=1",
        meta: { overdue: true },
      });
    }

    // 3. Đơn pending tổng (warning)
    const pendingOrders = count(ordersPendingRes);
    if (pendingOrders > 0 && overdueOrders < pendingOrders) {
      const newOnes = pendingOrders - overdueOrders;
      alerts.push({
        id: "orders_pending",
        severity: "warning",
        type: "orders_pending",
        title: "Đơn đang chờ xử lý",
        description: `${pendingOrders} đơn đang ở trạng thái pending/confirmed (${newOnes} trong 48h).`,
        count: pendingOrders,
        href: "/quanly/orders?status=pending",
      });
    }

    // 4. Tồn kho thấp (warning)
    const lowStock = count(lowStockRes);
    if (lowStock > 0) {
      alerts.push({
        id: "low_stock",
        severity: "warning",
        type: "low_stock",
        title: "Sản phẩm sắp hết hàng",
        description: `${lowStock} dòng tồn kho ≤ 5. Cần nhập hàng hoặc điều chỉnh.`,
        count: lowStock,
        href: "/quanly/stock-levels?filter=low_stock",
      });
    }

    // 5. Bảo hành sắp hết hạn (warning)
    const warrantyExpiring = count(warrantyExpiringRes);
    if (warrantyExpiring > 0) {
      alerts.push({
        id: "warranty_expiring",
        severity: "warning",
        type: "warranty_expiring",
        title: "Bảo hành sắp hết hạn",
        description: `${warrantyExpiring} phiếu BH hết hạn trong 30 ngày. Có thể upsell gia hạn.`,
        count: warrantyExpiring,
        href: "/quanly/warranties?filter=expiring_30d",
      });
    }

    // 6. Phiếu nhập đang chờ (warning)
    const poPending = count(poPendingRes);
    if (poPending > 0) {
      alerts.push({
        id: "po_pending",
        severity: "warning",
        type: "po_pending",
        title: "Phiếu nhập đang chờ",
        description: `${poPending} PO chưa nhận hàng hoặc nhận một phần.`,
        count: poPending,
        href: "/quanly/purchase-orders?status=sent",
      });
    }

    // 7. Yêu cầu thu cũ pending (warning)
    const tradeInPending = count(tradeInPendingRes);
    if (tradeInPending > 0) {
      alerts.push({
        id: "tradein_pending",
        severity: "warning",
        type: "tradein_pending",
        title: "Yêu cầu thu cũ chờ xử lý",
        description: `${tradeInPending} yêu cầu chưa được đánh giá.`,
        count: tradeInPending,
        href: "/quanly/trade-in-requests?status=pending",
      });
    }

    // 8. Đơn hôm nay (info)
    const ordersToday = count(ordersTodayRes);
    if (ordersToday > 0) {
      alerts.push({
        id: "orders_today",
        severity: "info",
        type: "orders_today",
        title: "Đơn hàng hôm nay",
        description: `${ordersToday} đơn đã tạo trong ngày.`,
        count: ordersToday,
        href: "/quanly/orders?date_from=" + todayStart.slice(0, 10),
      });
    }

    // 9. Phiếu sửa đang mở (info, tổng)
    const openRepairs = count(repairOpenRes);
    if (openRepairs > 0 && overdueRepairs < openRepairs) {
      alerts.push({
        id: "repairs_open",
        severity: "info",
        type: "repair_overdue",
        title: "Phiếu sửa đang mở",
        description: `${openRepairs} phiếu đang xử lý.`,
        count: openRepairs,
        href: "/quanly/repair-tickets?status=open",
      });
    }

    // 10. KH mới hôm nay (info)
    const customersToday = count(customersTodayRes);
    if (customersToday > 0) {
      alerts.push({
        id: "customers_today",
        severity: "info",
        type: "customers_today",
        title: "Khách hàng mới hôm nay",
        description: `${customersToday} khách đăng ký mới trong ngày.`,
        count: customersToday,
        href: "/quanly/customers?date_from=" + todayStart.slice(0, 10),
      });
    }

    // Sort: critical → warning → info, sau đó theo count giảm dần
    const sevOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || b.count - a.count);

    const totals = {
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
    };

    const payload: AdminAlertsResponse = {
      generatedAt: new Date().toISOString(),
      totals,
      alerts,
    };

    return ok(payload);
  } catch (e) {
    return handleError(e);
  }
}
