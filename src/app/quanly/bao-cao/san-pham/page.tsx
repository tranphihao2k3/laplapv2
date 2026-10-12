"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import { ReportPage } from "@/components/reports/report-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Package, TrendingUp, DollarSign, Percent, Tag } from "lucide-react";
import type { ProductReportRow } from "@/app/api/v1/reports/products/route";

type ProductsResponse = {
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    totalQty: number;
    productCount: number;
    avgMargin: number;
  };
  charts: {
    series: Array<{ bucket: string; value: number; count: number }>;
    distribution: Array<{ key: string; value: number }>;
  };
  rows: ProductReportRow[];
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

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#f43f5e", "#06b6d4", "#ec4899", "#f97316"];

const STATUS_LABEL: Record<string, string> = {
  active: "Đang bán",
  draft: "Nháp",
  archived: "Ngừng bán",
};

export default function SanPhamPage() {
  const [filter, setFilter] = useState({
    from: monthAgo.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
    category_id: "",
    brand_id: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["report-products", filter],
    queryFn: () => httpGet<ProductsResponse>("/v1/reports/products", filter),
  });

  const resetValues = useMemo(
    () => ({
      from: monthAgo.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
      category_id: "",
      brand_id: "",
    }),
    [],
  );

  const summary = data?.summary;
  const rows = data?.rows ?? [];
  const series = data?.charts.series ?? [];
  const catDist = data?.charts.distribution ?? [];

  return (
    <ReportPage<ProductReportRow>
      title="Báo cáo sản phẩm"
      description="Thống kê sản phẩm bán chạy, doanh thu, lợi nhuận theo kỳ"
      exportEndpoint="/api/v1/exports/products"
      filterFields={[
        { kind: "date", key: "from", label: "Từ ngày" },
        { kind: "date", key: "to", label: "Đến ngày" },
        { kind: "text", key: "category_id", label: "Mã danh mục (UUID)" },
        { kind: "text", key: "brand_id", label: "Mã thương hiệu (UUID)" },
      ]}
      filterValues={filter}
      onFilterChange={(next) => setFilter({ ...filter, ...next })}
      filterResetValues={resetValues}
      exportFilename={`bao-cao-san-pham-${today.toISOString().slice(0, 10)}.xlsx`}
      loading={isLoading}
      summary={[
        { label: "Tổng doanh thu", value: vnd(summary?.totalRevenue ?? 0), icon: DollarSign, tone: "success" },
        { label: "Lợi nhuận", value: vnd(summary?.totalProfit ?? 0), icon: TrendingUp, tone: "info" },
        { label: "Margin TB", value: pct(summary?.avgMargin ?? 0), icon: Percent, tone: (summary?.avgMargin ?? 0) > 20 ? "success" : "warning" },
        { label: "SP có bán", value: num(summary?.productCount ?? 0), icon: Package },
        { label: "Tổng SL bán", value: num(summary?.totalQty ?? 0), icon: Tag },
      ]}
      charts={
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 20 sản phẩm bán chạy</CardTitle>
            </CardHeader>
            <CardContent>
              {series.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu trong khoảng đã chọn</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(280, series.length * 22)}>
                  <ComposedChart
                    data={series}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v.toLocaleString("vi-VN")} />
                    <YAxis type="category" dataKey="bucket" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip formatter={(v: number, n: string) => n === "value" ? vnd(v) : `${v} SP`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar name="value" dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={18} />
                    <Line name="count" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 2.5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Phân bổ doanh thu theo danh mục</CardTitle>
            </CardHeader>
            <CardContent>
              {catDist.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu</div>
              ) : (
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <div className="h-[200px] w-full max-w-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={catDist}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={80}
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {catDist.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => vnd(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1 text-xs">
                    {catDist.map((d, i) => {
                      const total = catDist.reduce((s, x) => s + x.value, 0);
                      const pctVal = total > 0 ? (d.value / total) * 100 : 0;
                      return (
                        <div key={d.key} className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
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
          {
            key: "product_name",
            header: "Sản phẩm",
            render: (r) => (
              <div>
                <div className="font-medium">{r.product_name}</div>
                <div className="text-xs text-muted-foreground">{r.sku ?? "—"}</div>
              </div>
            ),
          },
          { key: "category_name", header: "Danh mục", width: "140px" },
          { key: "brand_name", header: "Thương hiệu", width: "130px" },
          {
            key: "product_status",
            header: "TT",
            width: "90px",
            render: (r) => STATUS_LABEL[r.product_status ?? ""] ?? r.product_status ?? "—",
          },
          {
            key: "qty_sold",
            header: "SL bán",
            align: "right",
            width: "80px",
            render: (r) => <span className="tabular-nums">{num(r.qty_sold)}</span>,
          },
          {
            key: "revenue",
            header: "Doanh thu",
            align: "right",
            width: "130px",
            render: (r) => <span className="font-semibold tabular-nums">{vnd(r.revenue)}</span>,
          },
          {
            key: "profit",
            header: "Lợi nhuận",
            align: "right",
            width: "130px",
            render: (r) => (
              <span className={`tabular-nums ${r.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {vnd(r.profit)}
              </span>
            ),
          },
          {
            key: "margin_pct",
            header: "Margin",
            align: "right",
            width: "80px",
            render: (r) => (
              <span
                className={`tabular-nums ${r.margin_pct >= 20 ? "text-emerald-600" : r.margin_pct >= 0 ? "text-amber-600" : "text-rose-600"}`}
              >
                {pct(r.margin_pct)}
              </span>
            ),
          },
        ],
        rows,
        total: data?.total ?? 0,
        rowKey: (r) => r.product_id,
      }}
    />
  );
}
