"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import { ReportPage } from "@/components/reports/report-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Wrench, CheckCircle, XCircle, Clock, DollarSign, Percent } from "lucide-react";

type RepairsResponse = {
  summary: { totalTickets: number; completedTickets: number; cancelledTickets: number; totalServiceFee: number; avgRepairHours: number; completionRate: number };
  charts: { distribution: Array<{ key: string; value: number }> };
  rows: Array<{
    id: string; ticket_number: string; customer_name: string; customer_phone: string | null;
    technician_name: string | null; device_info: string | null; problem: string | null;
    status: string; status_code: string | null; received_at: string | null;
    completed_at: string | null; repair_hours: number | null; service_fee: number;
  }>;
  total: number;
};

function vnd(n: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n); }
function num(n: number) { return new Intl.NumberFormat("vi-VN").format(n); }
function pct(n: number) { return `${n.toFixed(1)}%`; }
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#f43f5e", "#06b6d4", "#ec4899"];

export default function SuaChuaPage() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [filter, setFilter] = useState({
    from: monthAgo.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["report-repairs", filter],
    queryFn: () => httpGet<RepairsResponse>("/v1/reports/repairs", filter),
  });

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const dist = data?.charts.distribution ?? [];

  return (
    <ReportPage
      title="Báo cáo sửa chữa"
      description="Thống kê phiếu sửa theo thời gian, KTV, trạng thái"
      exportEndpoint="/api/v1/exports/repairs"
      filterFields={[
        { kind: "date", key: "from", label: "Từ ngày" },
        { kind: "date", key: "to", label: "Đến ngày" },
      ]}
      filterValues={filter}
      onFilterChange={(next) => setFilter({ ...filter, ...next })}
      filterResetValues={{ from: monthAgo.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) }}
      exportFilename={`bao-cao-sua-chua-${today.toISOString().slice(0, 10)}.xlsx`}
      loading={isLoading}
      summary={[
        { label: "Tổng phiếu", value: num(summary?.totalTickets ?? 0), icon: Wrench },
        { label: "Hoàn tất", value: num(summary?.completedTickets ?? 0), icon: CheckCircle, tone: "success" },
        { label: "Tỉ lệ HT", value: pct(summary?.completionRate ?? 0), icon: Percent, tone: (summary?.completionRate ?? 0) >= 70 ? "success" : "warning" },
        { label: "Đã hủy", value: num(summary?.cancelledTickets ?? 0), icon: XCircle, tone: "danger" },
        { label: "Phí DV", value: vnd(summary?.totalServiceFee ?? 0), icon: DollarSign, tone: "info" },
        { label: "TB giờ sửa", value: summary?.avgRepairHours ? `${summary.avgRepairHours}h` : "—", icon: Clock },
      ]}
      charts={
        <Card>
          <CardHeader><CardTitle className="text-base">Phân bổ theo trạng thái</CardTitle></CardHeader>
          <CardContent>
            {dist.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu</div>
            ) : (
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <div className="h-[220px] w-full max-w-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dist} cx="50%" cy="50%" innerRadius={48} outerRadius={90} dataKey="value" paddingAngle={2}>
                        {dist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v} phiếu`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
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
      }
      table={{
        columns: [
          { key: "ticket_number", header: "Mã phiếu", width: "110px" },
          { key: "customer_name", header: "Khách hàng", render: (r) => (
            <div>
              <div className="font-medium">{r.customer_name}</div>
              <div className="text-xs text-muted-foreground">{r.customer_phone ?? "—"}</div>
            </div>
          ) },
          { key: "device_info", header: "Thiết bị", render: (r) => (
            <div>
              <div>{r.device_info ?? "—"}</div>
              {r.problem && <div className="text-xs text-muted-foreground line-clamp-1">{r.problem}</div>}
            </div>
          ) },
          { key: "technician_name", header: "KTV", width: "140px" },
          { key: "received_at", header: "Ngày nhận", width: "130px", render: (r) => r.received_at ? new Date(r.received_at).toLocaleDateString("vi-VN") : "—" },
          { key: "repair_hours", header: "Giờ sửa", align: "right", width: "80px", render: (r) => r.repair_hours ? `${r.repair_hours}h` : "—" },
          { key: "service_fee", header: "Phí", align: "right", width: "120px", render: (r) => vnd(r.service_fee) },
          { key: "status", header: "Trạng thái", width: "130px" },
        ],
        rows,
        total: data?.total ?? 0,
        rowKey: (r) => r.id,
      }}
    />
  );
}
