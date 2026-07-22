"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";

type StatsResponse = {
  sales: {
    orders: number;
    customers: number;
    payments: number;
    revenueCompleted: number;
    cancelledOrders: number;
    orderStatus: Record<string, number>;
    paymentStatus: Record<string, number>;
    recentOrders: Array<{
      order_number: string;
      status: string | null;
      payment_status: string | null;
      total_amount: number | null;
      created_at: string | null;
    }>;
  };
  catalog: { products: number; productVariants: number; serialNumbers: number; productStatus: Record<string, number> };
  inventory: { stockLevels: number; warehouses: number; shops: number; suppliers: number; lowStockCount: number };
  operation: { posSessionOpen: number };
  afterSale: { warranties: number; repairTickets: number; tradeInRequests: number };
  security: { organizations: number; userProfiles: number; roles: number; permissions: number; shopStaff: number; auditLogs: number };
};

function fNum(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function fMoney(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

export function DashboardStatsPanel() {
  const q = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => httpGet<StatsResponse>("/v1/dashboard/stats"),
  });

  const s = q.data;
  if (q.isLoading) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Đang tải thống kê hệ thống...</CardContent></Card>;
  }
  if (!s) {
    return <Card><CardContent className="py-6 text-sm text-muted-foreground">Không lấy được dữ liệu thống kê.</CardContent></Card>;
  }

  const groups: Array<{ title: string; rows: Array<[string, string]> }> = [
    {
      title: "Bán hàng",
      rows: [
        ["Tổng đơn hàng", fNum(s.sales.orders)],
        ["Tổng khách hàng", fNum(s.sales.customers)],
        ["Tổng thanh toán", fNum(s.sales.payments)],
        ["Doanh thu hoàn tất", fMoney(s.sales.revenueCompleted)],
        ["Đơn đã hủy", fNum(s.sales.cancelledOrders)],
      ],
    },
    {
      title: "Sản phẩm & Kho",
      rows: [
        ["Sản phẩm", fNum(s.catalog.products)],
        ["Biến thể", fNum(s.catalog.productVariants)],
        ["Serial/IMEI", fNum(s.catalog.serialNumbers)],
        ["Dòng tồn kho", fNum(s.inventory.stockLevels)],
        ["Sắp hết hàng (<=5)", fNum(s.inventory.lowStockCount)],
        ["Kho hàng", fNum(s.inventory.warehouses)],
        ["Cửa hàng", fNum(s.inventory.shops)],
        ["Nhà cung cấp", fNum(s.inventory.suppliers)],
      ],
    },
    {
      title: "Vận hành",
      rows: [
        ["Ca POS đang mở", fNum(s.operation.posSessionOpen)],
      ],
    },
    {
      title: "Hậu mãi",
      rows: [
        ["Bảo hành", fNum(s.afterSale.warranties)],
        ["Phiếu sửa chữa", fNum(s.afterSale.repairTickets)],
        ["Yêu cầu thu cũ", fNum(s.afterSale.tradeInRequests)],
      ],
    },
    {
      title: "Phân quyền & Hệ thống",
      rows: [
        ["Tổ chức", fNum(s.security.organizations)],
        ["Người dùng", fNum(s.security.userProfiles)],
        ["Vai trò", fNum(s.security.roles)],
        ["Danh mục quyền", fNum(s.security.permissions)],
        ["Phân công nhân sự", fNum(s.security.shopStaff)],
        ["Nhật ký hệ thống", fNum(s.security.auditLogs)],
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.title}>
            <CardHeader>
              <CardTitle className="text-lg">{g.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {g.rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b pb-2 text-sm last:border-none last:pb-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trạng thái đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(s.sales.orderStatus).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b pb-2 last:border-none last:pb-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold">{fNum(v)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trạng thái thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(s.sales.paymentStatus).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b pb-2 last:border-none last:pb-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold">{fNum(v)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trạng thái sản phẩm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(s.catalog.productStatus).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b pb-2 last:border-none last:pb-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold">{fNum(v)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Đơn hàng gần nhất</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {s.sales.recentOrders.map((o) => (
            <div key={o.order_number} className="grid grid-cols-[1fr_auto] items-center gap-2 border-b pb-2 last:border-none last:pb-0">
              <div>
                <div className="font-medium">{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{o.created_at ? new Date(o.created_at).toLocaleString("vi-VN") : "-"} · {o.status ?? "-"} · {o.payment_status ?? "-"}</div>
              </div>
              <div className="font-semibold">{fMoney(Number(o.total_amount ?? 0))}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
