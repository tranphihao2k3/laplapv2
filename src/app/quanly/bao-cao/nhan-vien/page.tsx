"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import { ReportPage } from "@/components/reports/report-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Users, ShoppingCart, CheckCircle, DollarSign, Percent, Trophy } from "lucide-react";

type StaffResponse = {
  summary: { staffCount: number; activeStaff: number; totalOrders: number; totalCompleted: number; totalRevenue: number; avgRevenue: number; overallCompletionRate: number };
  charts: { series: Array<{ bucket: string; value: number; count: number }> };
  rows: Array<{
    user_id: string; full_name: string; email: string | null; is_active: boolean;
    total_orders: number; completed_orders: number; cancelled_orders: number;
    pos_sessions: number; revenue: number; avg_order_value: number;
    completion_rate: number; rank: number;
  }>;
  total: number;
};

function vnd(n: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n); }
function num(n: number) { return new Intl.NumberFormat("vi-VN").format(n); }
function pct(n: number) { return `${n.toFixed(1)}%`; }

export default function NhanVienPage() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [filter, setFilter] = useState({
    from: monthAgo.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["report-staff", filter],
    queryFn: () => httpGet<StaffResponse>("/v1/reports/staff", filter),
  });

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const series = data?.charts.series ?? [];

  return (
    <ReportPage
      title="Báo cáo nhân viên"
      description="Bảng xếp hạng nhân viên theo doanh thu, số đơn, tỉ lệ hoàn tất"
      exportEndpoint="/api/v1/exports/staff"
      filterFields={[
        { kind: "date", key: "from", label: "Từ ngày" },
        { kind: "date", key: "to", label: "Đến ngày" },
      ]}
      filterValues={filter}
      onFilterChange={(next) => setFilter({ ...filter, ...next })}
      filterResetValues={{ from: monthAgo.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) }}
      exportFilename={`bao-cao-nhan-vien-${today.toISOString().slice(0, 10)}.xlsx`}
      loading={isLoading}
      summary={[
        { label: "Tổng NV", value: num(summary?.staffCount ?? 0), icon: Users },
        { label: "Đang hoạt động", value: num(summary?.activeStaff ?? 0), icon: CheckCircle, tone: "success" },
        { label: "Tổng đơn", value: num(summary?.totalOrders ?? 0), icon: ShoppingCart },
        { label: "Tổng doanh thu", value: vnd(summary?.totalRevenue ?? 0), icon: DollarSign, tone: "info" },
        { label: "Tỉ lệ HT", value: pct(summary?.overallCompletionRate ?? 0), icon: Percent, tone: (summary?.overallCompletionRate ?? 0) >= 80 ? "success" : "warning" },
      ]}
      charts={
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 nhân viên (doanh thu)</CardTitle></CardHeader>
          <CardContent>
            {series.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, series.length * 30)}>
                <BarChart data={series} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v.toLocaleString("vi-VN")} />
                  <YAxis type="category" dataKey="bucket" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip formatter={(v: number) => vnd(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar name="Doanh thu" dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      }
      table={{
        columns: [
          { key: "rank", header: "Hạng", align: "right", width: "60px",
            render: (r) => r.rank <= 3 ? <Trophy className="h-3.5 w-3.5 text-amber-500 inline" /> : <span className="tabular-nums">#{r.rank}</span> },
          { key: "full_name", header: "Nhân viên",
            render: (r) => (
              <div>
                <div className="font-medium">{r.full_name}</div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
              </div>
            ),
          },
          { key: "total_orders", header: "Tổng đơn", align: "right", width: "80px", render: (r) => num(r.total_orders) },
          { key: "completed_orders", header: "HT", align: "right", width: "60px", render: (r) => <span className="text-emerald-600 tabular-nums">{r.completed_orders}</span> },
          { key: "cancelled_orders", header: "Huỷ", align: "right", width: "60px", render: (r) => <span className="text-rose-600 tabular-nums">{r.cancelled_orders}</span> },
          { key: "pos_sessions", header: "Ca POS", align: "right", width: "70px", render: (r) => num(r.pos_sessions) },
          { key: "revenue", header: "Doanh thu", align: "right", width: "140px", render: (r) => <span className="font-semibold tabular-nums">{vnd(r.revenue)}</span> },
          { key: "avg_order_value", header: "AOV", align: "right", width: "120px", render: (r) => vnd(r.avg_order_value) },
          { key: "completion_rate", header: "Tỉ lệ HT", align: "right", width: "80px", render: (r) => <span className={r.completion_rate >= 80 ? "text-emerald-600" : "text-amber-600"}>{pct(r.completion_rate)}</span> },
        ],
        rows,
        total: data?.total ?? 0,
        rowKey: (r) => r.user_id,
      }}
    />
  );
}
