"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import { ReportPage } from "@/components/reports/report-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Banknote, ShoppingCart, TrendingUp, Percent, XCircle } from "lucide-react";
import type { RevenueRow } from "@/app/api/v1/reports/revenue/route";

type RevenueResponse = {
  filters: Record<string, unknown>;
  generatedAt: string;
  summary: {
    totalRevenue: number;
    completedOrders: number;
    cancelledOrders: number;
    totalOrders: number;
    averageOrderValue: number;
    cancellationRate: number;
  };
  charts: {
    series: Array<{ bucket: string; revenue: number; orders: number; cancelled: number }>;
    distribution: Array<{ key: string; value: number }>;
  };
  rows: RevenueRow[];
  total: number;
};

const today = new Date();
const monthAgo = new Date(today.getTime() - 30 * 86400000);

function vnd(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}
function num(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}
function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#f43f5e", "#06b6d4"];

const CHANNEL_LABEL: Record<string, string> = {
  pos: "POS",
  online: "Online",
  phone: "Điện thoại",
  in_store: "Tại quầy",
};

export default function DoanhThuPage() {
  const [filter, setFilter] = useState({
    from: monthAgo.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
    shop_id: "",
    channel: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["report-revenue", filter],
    queryFn: () => httpGet<RevenueResponse>("/v1/reports/revenue", filter),
  });

  const resetValues = useMemo(
    () => ({
      from: monthAgo.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
      shop_id: "",
      channel: "",
    }),
    [],
  );

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const series = data?.charts.series ?? [];
  const channelDist = data?.charts.distribution ?? [];

  return (
    <ReportPage<RevenueRow>
      title="Báo cáo doanh thu"
      description="Thống kê đơn hàng & doanh thu theo thời gian, cửa hàng, kênh bán"
      exportEndpoint="/api/v1/exports/revenue"
      filterFields={[
        { kind: "date", key: "from", label: "Từ ngày" },
        { kind: "date", key: "to", label: "Đến ngày" },
        {
          kind: "select",
          key: "channel",
          label: "Kênh bán",
          allowAll: true,
          options: Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label })),
        },
        {
          kind: "text",
          key: "shop_id",
          label: "Mã cửa hàng (UUID)",
        },
      ]}
      filterValues={filter}
      onFilterChange={(next) => setFilter({ ...filter, ...next })}
      filterResetValues={resetValues}
      exportFilename={`bao-cao-doanh-thu-${today.toISOString().slice(0, 10)}.xlsx`}
      loading={isLoading}
      summary={[
        { label: "Tổng doanh thu", value: vnd(summary?.totalRevenue ?? 0), icon: Banknote, tone: "success" },
        { label: "Đơn hoàn tất", value: num(summary?.completedOrders ?? 0), icon: ShoppingCart, tone: "info" },
        { label: "AOV", value: vnd(summary?.averageOrderValue ?? 0), icon: TrendingUp },
        { label: "Tỉ lệ huỷ", value: pct(summary?.cancellationRate ?? 0), icon: XCircle, tone: (summary?.cancellationRate ?? 0) > 10 ? "danger" : "warning" },
      ]}
      charts={
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Doanh thu & đơn hàng theo ngày</CardTitle>
            </CardHeader>
            <CardContent>
              {series.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu trong khoảng đã chọn</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={series} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v) => v.toLocaleString("vi-VN")} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(v: number, n: string) =>
                        n === "revenue" ? vnd(v) : `${v} đơn`
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area yAxisId="left" type="monotone" name="revenue" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} />
                    <Bar yAxisId="right" name="orders" dataKey="orders" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={20} />
                    <Bar yAxisId="right" name="cancelled" dataKey="cancelled" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={20} fillOpacity={0.6} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Phân bổ theo kênh bán</CardTitle>
            </CardHeader>
            <CardContent>
              {channelDist.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu</div>
              ) : (
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <div className="h-[200px] w-full max-w-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={channelDist.map((d) => ({ ...d, name: CHANNEL_LABEL[d.key] ?? d.key }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={80}
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {channelDist.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v} đơn`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1 text-xs">
                    {channelDist.map((d, i) => {
                      const total = channelDist.reduce((s, x) => s + x.value, 0);
                      const pctVal = total > 0 ? (d.value / total) * 100 : 0;
                      return (
                        <div key={d.key} className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="capitalize truncate">{CHANNEL_LABEL[d.key] ?? d.key}</span>
                          <span className="ml-auto font-medium tabular-nums">{d.value}</span>
                          <span className="w-10 text-right text-muted-foreground tabular-nums">{pctVal.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      }
      table={{
        columns: [
          { key: "order_number", header: "Mã đơn", width: "140px" },
          {
            key: "created_at",
            header: "Ngày tạo",
            width: "150px",
            render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString("vi-VN") : "—"),
          },
          { key: "customer_name", header: "Khách hàng", render: (r) => r.customer_name ?? "Khách lẻ" },
          { key: "customer_phone", header: "SĐT", width: "110px" },
          { key: "shop_name", header: "Cửa hàng", render: (r) => r.shop_name ?? "—" },
          { key: "channel", header: "Kênh", width: "90px", render: (r) => CHANNEL_LABEL[r.channel ?? ""] ?? r.channel ?? "—" },
          { key: "payment_status", header: "PTTT", width: "110px" },
          { key: "status", header: "Trạng thái", width: "120px" },
          {
            key: "total_amount",
            header: "Tổng tiền",
            align: "right",
            width: "130px",
            render: (r) => <span className="font-semibold tabular-nums">{vnd(r.total_amount)}</span>,
          },
        ],
        rows,
        total: data?.total ?? 0,
        rowKey: (r) => r.id,
      }}
    />
  );
}
