"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import { ReportPage } from "@/components/reports/report-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { Ticket, Users, Percent, Coins, Banknote } from "lucide-react";

type VouchersResponse = {
  summary: { totalVouchers: number; activeVouchers: number; totalIssued: number; totalUsed: number; totalRevenue: number; totalDiscount: number; usageRate: number };
  charts: { series: Array<{ bucket: string; value: number; count: number }>; distribution: Array<{ key: string; value: number }> };
  rows: Array<{
    id: string; code: string; name: string; description: string | null;
    discount_type: string; discount_value: number; min_order_value: number | null;
    max_discount: number | null; starts_at: string | null; ends_at: string | null;
    total_issued: number; total_used: number; usage_rate_pct: number;
    revenue_generated: number; total_discount: number; status: string;
  }>;
  total: number;
};

function vnd(n: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n); }
function num(n: number) { return new Intl.NumberFormat("vi-VN").format(n); }
function pct(n: number) { return `${n.toFixed(1)}%`; }
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

export default function VoucherPage() {
  const [filter, setFilter] = useState<Record<string, string | number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["report-vouchers", filter],
    queryFn: () => httpGet<VouchersResponse>("/v1/reports/vouchers", filter),
  });

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const series = data?.charts.series ?? [];
  const dist = data?.charts.distribution ?? [];

  return (
    <ReportPage
      title="Báo cáo voucher"
      description="Thống kê voucher theo tỉ lệ sử dụng, doanh thu từ voucher"
      exportEndpoint="/api/v1/exports/vouchers"
      filterFields={[]}
      filterValues={filter}
      onFilterChange={(next) => setFilter({ ...filter, ...next })}
      exportFilename={`bao-cao-voucher-${new Date().toISOString().slice(0, 10)}.xlsx`}
      loading={isLoading}
      summary={[
        { label: "Tổng voucher", value: num(summary?.totalVouchers ?? 0), icon: Ticket },
        { label: "Đang hoạt động", value: num(summary?.activeVouchers ?? 0), icon: Users, tone: "success" },
        { label: "Phát hành", value: num(summary?.totalIssued ?? 0), icon: Ticket },
        { label: "Đã dùng", value: num(summary?.totalUsed ?? 0), icon: Percent },
        { label: "Tỉ lệ SD", value: pct(summary?.usageRate ?? 0), icon: Percent, tone: (summary?.usageRate ?? 0) >= 50 ? "success" : "warning" },
        { label: "DT từ VC", value: vnd(summary?.totalRevenue ?? 0), icon: Banknote, tone: "info" },
      ]}
      charts={
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Top 10 voucher (lượt dùng)</CardTitle></CardHeader>
            <CardContent>
              {series.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar name="Lượt dùng" dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Phân bổ theo loại</CardTitle></CardHeader>
            <CardContent>
              {dist.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu</div>
              ) : (
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <div className="h-[200px] w-full max-w-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dist} cx="50%" cy="50%" innerRadius={48} outerRadius={80} dataKey="value" paddingAngle={2}>
                          {dist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v} voucher`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1 text-xs">
                    {dist.map((d, i) => {
                      const total = dist.reduce((s, x) => s + x.value, 0);
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
          { key: "code", header: "Mã", width: "120px", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
          { key: "name", header: "Tên voucher", render: (r) => (
            <div>
              <div className="font-medium">{r.name}</div>
              {r.description && <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>}
            </div>
          ) },
          { key: "discount_type", header: "Loại", width: "100px" },
          { key: "discount_value", header: "Giá trị", align: "right", width: "80px", render: (r) => r.discount_type.includes("%") ? `${r.discount_value}%` : vnd(r.discount_value) },
          { key: "total_issued", header: "Phát hành", align: "right", width: "80px", render: (r) => num(r.total_issued) },
          { key: "total_used", header: "Đã dùng", align: "right", width: "80px", render: (r) => num(r.total_used) },
          { key: "usage_rate_pct", header: "Tỉ lệ SD", align: "right", width: "80px", render: (r) => (
            <span className={r.usage_rate_pct >= 50 ? "text-emerald-600" : r.usage_rate_pct >= 20 ? "text-amber-600" : "text-muted-foreground"}>
              {pct(r.usage_rate_pct)}
            </span>
          ) },
          { key: "revenue_generated", header: "DT từ VC", align: "right", width: "140px", render: (r) => <span className="font-semibold tabular-nums">{vnd(r.revenue_generated)}</span> },
          { key: "status", header: "TT", width: "90px" },
        ],
        rows,
        total: data?.total ?? 0,
        rowKey: (r) => r.id,
      }}
    />
  );
}
