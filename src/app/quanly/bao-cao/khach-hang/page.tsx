"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import { ReportPage } from "@/components/reports/report-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Users, UserCheck, Coins, TrendingUp, Trophy } from "lucide-react";

type CustomersResponse = {
  summary: { totalCustomers: number; activeCustomers: number; totalRevenue: number; totalLoyalty: number; avgSpent: number };
  charts: {
    series: Array<{ bucket: string; value: number; count: number }>;
    distribution: Array<{ key: string; value: number }>;
  };
  rows: Array<{
    id: string; full_name: string; phone: string | null; email: string | null;
    tier: string; tier_code: string | null; loyalty_points: number;
    total_orders: number; total_spent: number; last_order_at: string | null;
    created_at: string | null; is_active: boolean;
  }>;
  total: number;
};

function vnd(n: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n); }
function num(n: number) { return new Intl.NumberFormat("vi-VN").format(n); }
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#f43f5e", "#06b6d4"];

export default function KhachHangPage() {
  const [filter, setFilter] = useState({ tier: "all" });

  const { data, isLoading } = useQuery({
    queryKey: ["report-customers", filter],
    queryFn: () => httpGet<CustomersResponse>("/v1/reports/customers", filter.tier && filter.tier !== "all" ? { tier: filter.tier } : {}),
  });

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const series = data?.charts.series ?? [];
  const tierDist = data?.charts.distribution ?? [];

  return (
    <ReportPage
      title="Báo cáo khách hàng"
      description="Thống kê khách hàng theo hạng, doanh thu, điểm tích lũy"
      exportEndpoint="/api/v1/exports/customers"
      filterFields={[
        {
          kind: "select", key: "tier", label: "Hạng khách hàng",
          allowAll: true, allLabel: "Tất cả hạng",
          options: [
            { value: "bronze", label: "Đồng" },
            { value: "silver", label: "Bạc" },
            { value: "gold", label: "Vàng" },
            { value: "platinum", label: "Bạch kim" },
            { value: "diamond", label: "Kim cương" },
          ],
        },
      ]}
      filterValues={filter}
      onFilterChange={(next) => setFilter({ ...filter, ...next })}
      filterResetValues={{ tier: "all" }}
      exportFilename={`bao-cao-khach-hang-${new Date().toISOString().slice(0, 10)}.xlsx`}
      loading={isLoading}
      summary={[
        { label: "Tổng KH", value: num(summary?.totalCustomers ?? 0), icon: Users },
        { label: "Đang hoạt động", value: num(summary?.activeCustomers ?? 0), icon: UserCheck, tone: "success" },
        { label: "Tổng doanh thu", value: vnd(summary?.totalRevenue ?? 0), icon: Coins, tone: "info" },
        { label: "Chi TB/KH", value: vnd(summary?.avgSpent ?? 0), icon: TrendingUp },
        { label: "Tổng điểm", value: num(summary?.totalLoyalty ?? 0), icon: Trophy, tone: "warning" },
      ]}
      charts={
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Top 20 khách hàng (doanh thu)</CardTitle></CardHeader>
            <CardContent>
              {series.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(280, series.length * 22)}>
                  <BarChart data={series} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v.toLocaleString("vi-VN")} />
                    <YAxis type="category" dataKey="bucket" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip formatter={(v: number) => vnd(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar name="Doanh thu" dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Phân bổ theo hạng</CardTitle></CardHeader>
            <CardContent>
              {tierDist.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu</div>
              ) : (
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <div className="h-[200px] w-full max-w-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={tierDist} cx="50%" cy="50%" innerRadius={48} outerRadius={80} dataKey="value" paddingAngle={2}>
                          {tierDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v} KH`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1 text-xs">
                    {tierDist.map((d, i) => {
                      const total = tierDist.reduce((s, x) => s + x.value, 0);
                      const pctVal = total > 0 ? (d.value / total) * 100 : 0;
                      return (
                        <div key={d.key} className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{d.key}</span>
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
          { key: "full_name", header: "Họ tên" },
          { key: "phone", header: "SĐT", width: "110px" },
          { key: "email", header: "Email" },
          { key: "tier", header: "Hạng", width: "100px" },
          { key: "loyalty_points", header: "Điểm", align: "right", width: "70px", render: (r) => num(r.loyalty_points) },
          { key: "total_orders", header: "Số đơn", align: "right", width: "70px", render: (r) => num(r.total_orders) },
          { key: "total_spent", header: "Tổng chi", align: "right", width: "140px", render: (r) => <span className="font-semibold tabular-nums">{vnd(r.total_spent)}</span> },
          { key: "last_order_at", header: "Đơn cuối", width: "120px", render: (r) => r.last_order_at ? new Date(r.last_order_at).toLocaleDateString("vi-VN") : "—" },
          { key: "is_active", header: "TT", width: "80px", render: (r) => r.is_active ? <span className="text-emerald-600">Hoạt động</span> : <span className="text-muted-foreground">Ngừng</span> },
        ],
        rows,
        total: data?.total ?? 0,
        rowKey: (r) => r.id,
      }}
    />
  );
}
