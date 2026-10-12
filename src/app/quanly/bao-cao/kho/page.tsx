"use client";

import { useState } from "react";
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
import { Package, AlertTriangle, XCircle, TrendingUp, Boxes } from "lucide-react";

type InventoryResponse = {
  summary: { totalSkus: number; totalQty: number; totalValue: number; lowStock: number; outOfStock: number };
  charts: {
    series: Array<{ bucket: string; value: number; count: number }>;
    distribution: Array<{ key: string; value: number }>;
  };
  rows: Array<{
    product_id: string; product_name: string; product_status: string | null;
    sku: string; variant_name: string | null; warehouse_name: string;
    stock_qty: number; stock_value: number; cost_price: number;
    sold_in_period: number; status: string; updated_at: string | null;
  }>;
  total: number;
};

function vnd(n: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n); }
function num(n: number) { return new Intl.NumberFormat("vi-VN").format(n); }
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#f43f5e"];

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  in_stock: { label: "Còn hàng", tone: "text-emerald-600" },
  low: { label: "Sắp hết", tone: "text-amber-600" },
  out: { label: "Hết hàng", tone: "text-rose-600" },
};

export default function KhoPage() {
  const [filter, setFilter] = useState<Record<string, string | number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["report-inventory", filter],
    queryFn: () => httpGet<InventoryResponse>("/v1/reports/inventory", filter),
  });

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const series = data?.charts.series ?? [];
  const whDist = data?.charts.distribution ?? [];

  return (
    <ReportPage
      title="Báo cáo kho"
      description="Tồn kho theo sản phẩm + kho, giá trị tồn, SP sắp hết/hết hàng"
      exportEndpoint="/api/v1/exports/inventory"
      filterFields={[]}
      filterValues={filter}
      onFilterChange={(next) => setFilter({ ...filter, ...next })}
      exportFilename={`bao-cao-kho-${new Date().toISOString().slice(0, 10)}.xlsx`}
      loading={isLoading}
      summary={[
        { label: "Tổng dòng tồn", value: num(summary?.totalSkus ?? 0), icon: Boxes },
        { label: "Tổng SL tồn", value: num(summary?.totalQty ?? 0), icon: Package, tone: "info" },
        { label: "Giá trị tồn", value: vnd(summary?.totalValue ?? 0), icon: TrendingUp, tone: "success" },
        { label: "Sắp hết", value: num(summary?.lowStock ?? 0), icon: AlertTriangle, tone: "warning" },
        { label: "Hết hàng", value: num(summary?.outOfStock ?? 0), icon: XCircle, tone: "danger" },
      ]}
      charts={
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Top 20 SP giá trị tồn cao nhất</CardTitle></CardHeader>
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
                    <Bar name="Giá trị tồn" dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Giá trị tồn theo kho</CardTitle></CardHeader>
            <CardContent>
              {whDist.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu</div>
              ) : (
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <div className="h-[200px] w-full max-w-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={whDist} cx="50%" cy="50%" innerRadius={48} outerRadius={80} dataKey="value" paddingAngle={2}>
                          {whDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => vnd(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1 text-xs">
                    {whDist.map((d, i) => {
                      const total = whDist.reduce((s, x) => s + x.value, 0);
                      const pctVal = total > 0 ? (d.value / total) * 100 : 0;
                      return (
                        <div key={d.key} className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{d.key}</span>
                          <span className="ml-auto font-medium tabular-nums">{vnd(d.value)}</span>
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
          { key: "sku", header: "SKU", width: "120px" },
          {
            key: "product_name", header: "Sản phẩm",
            render: (r) => (
              <div>
                <div className="font-medium">{r.product_name}</div>
                {r.variant_name && <div className="text-xs text-muted-foreground">{r.variant_name}</div>}
              </div>
            ),
          },
          { key: "warehouse_name", header: "Kho" },
          { key: "stock_qty", header: "Tồn", align: "right", width: "70px", render: (r) => <span className="tabular-nums">{num(r.stock_qty)}</span> },
          { key: "cost_price", header: "Giá vốn", align: "right", width: "120px", render: (r) => vnd(r.cost_price) },
          { key: "stock_value", header: "Giá trị tồn", align: "right", width: "140px", render: (r) => <span className="font-semibold tabular-nums">{vnd(r.stock_value)}</span> },
          { key: "sold_in_period", header: "Đã bán", align: "right", width: "70px", render: (r) => num(r.sold_in_period) },
          { key: "status", header: "TT", width: "100px", render: (r) => {
            const meta = STATUS_LABEL[r.status] ?? { label: r.status, tone: "" };
            return <span className={meta.tone}>{meta.label}</span>;
          } },
        ],
        rows,
        total: data?.total ?? 0,
        rowKey: (r) => `${r.product_id}-${r.warehouse_name}`,
      }}
    />
  );
}
