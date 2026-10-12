"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import { ReportPage } from "@/components/reports/report-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { ShieldCheck, AlertTriangle, XCircle, ShieldAlert, Wrench } from "lucide-react";

type WarrantiesResponse = {
  summary: { total: number; active: number; expiringSoon: number; expired: number; totalRepairs: number };
  charts: { distribution: Array<{ key: string; value: number }> };
  rows: Array<{
    id: string; warranty_code: string; warranty_type: string; warranty_type_code: string | null;
    customer_name: string; customer_phone: string | null;
    product_name: string; sku: string; serial_number: string;
    purchase_date: string | null; expiry_date: string | null; days_remaining: number;
    status: string; status_code: string | null; repair_count: number;
  }>;
  total: number;
};

function num(n: number) { return new Intl.NumberFormat("vi-VN").format(n); }
const PIE_COLORS = ["#10b981", "#f59e0b", "#f43f5e", "#6b7280"];

export default function BaoHanhPage() {
  const today = new Date();
  const yearAgo = new Date(today.getTime() - 365 * 86400000);
  const [filter, setFilter] = useState({
    from: yearAgo.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["report-warranties", filter],
    queryFn: () => httpGet<WarrantiesResponse>("/v1/reports/warranties", filter),
  });

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const dist = data?.charts.distribution ?? [];

  return (
    <ReportPage
      title="Báo cáo bảo hành"
      description="Danh sách bảo hành, trạng thái còn hiệu lực, sắp hết hạn, hết hạn"
      exportEndpoint="/api/v1/exports/warranties"
      filterFields={[
        { kind: "date", key: "from", label: "Từ ngày mua" },
        { kind: "date", key: "to", label: "Đến ngày" },
      ]}
      filterValues={filter}
      onFilterChange={(next) => setFilter({ ...filter, ...next })}
      filterResetValues={{ from: yearAgo.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) }}
      exportFilename={`bao-cao-bao-hanh-${today.toISOString().slice(0, 10)}.xlsx`}
      loading={isLoading}
      summary={[
        { label: "Tổng BH", value: num(summary?.total ?? 0), icon: ShieldCheck },
        { label: "Còn hiệu lực", value: num(summary?.active ?? 0), icon: ShieldCheck, tone: "success" },
        { label: "Sắp hết hạn", value: num(summary?.expiringSoon ?? 0), icon: AlertTriangle, tone: "warning" },
        { label: "Hết hạn", value: num(summary?.expired ?? 0), icon: XCircle, tone: "danger" },
        { label: "Lượt sửa BH", value: num(summary?.totalRepairs ?? 0), icon: Wrench, tone: "info" },
      ]}
      charts={
        <Card>
          <CardHeader><CardTitle className="text-base">Phân bổ trạng thái bảo hành</CardTitle></CardHeader>
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
                      <Tooltip formatter={(v: number) => `${v} BH`} />
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
          { key: "warranty_code", header: "Mã BH", width: "100px" },
          { key: "warranty_type", header: "Loại", width: "100px" },
          { key: "customer_name", header: "Khách hàng", render: (r) => (
            <div>
              <div className="font-medium">{r.customer_name}</div>
              <div className="text-xs text-muted-foreground">{r.customer_phone ?? "—"}</div>
            </div>
          ) },
          { key: "product_name", header: "Sản phẩm", render: (r) => (
            <div>
              <div className="text-sm">{r.product_name}</div>
              <div className="text-xs text-muted-foreground font-mono">{r.sku}</div>
            </div>
          ) },
          { key: "serial_number", header: "Serial", width: "120px", render: (r) => <span className="font-mono text-xs">{r.serial_number}</span> },
          { key: "expiry_date", header: "Hết hạn", width: "110px", render: (r) => r.expiry_date ? new Date(r.expiry_date).toLocaleDateString("vi-VN") : "—" },
          { key: "days_remaining", header: "Còn (ngày)", align: "right", width: "100px", render: (r) => (
            <span className={r.days_remaining < 0 ? "text-rose-600" : r.days_remaining <= 30 ? "text-amber-600" : "text-emerald-600"}>
              {r.days_remaining}
            </span>
          ) },
          { key: "status", header: "Trạng thái", width: "120px" },
          { key: "repair_count", header: "Sửa", align: "right", width: "60px", render: (r) => r.repair_count },
        ],
        rows,
        total: data?.total ?? 0,
        rowKey: (r) => r.id,
      }}
    />
  );
}
