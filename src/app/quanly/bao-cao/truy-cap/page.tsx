"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import { ReportKpiRow } from "@/components/reports/report-kpi-row";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Eye, CalendarDays, CalendarRange, BarChart3 } from "lucide-react";

type TrafficResponse = {
  filters: { from: string; to: string };
  generatedAt: string;
  summary: {
    today: number;
    last7: number;
    last30: number;
    rangeTotal: number;
  };
  charts: { series: Array<{ day: string; views: number }> };
  topPages: Array<{ path: string; views: number }>;
};

const today = new Date();
const monthAgo = new Date(today.getTime() - 29 * 86400000);

function num(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export default function TrafficReportPage() {
  const [filter, setFilter] = useState({
    from: monthAgo.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["report-traffic", filter],
    queryFn: () => httpGet<TrafficResponse>("/v1/reports/traffic", filter),
  });

  const resetValues = useMemo(
    () => ({
      from: monthAgo.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    }),
    [],
  );

  const summary = data?.summary;
  const series = data?.charts.series ?? [];
  const topPages = data?.topPages ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Lượt truy cập
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Thống kê lượt xem trang trên website (không gồm khu vực quản lý)
        </p>
      </div>

      <ReportFilterBar
        fields={[
          { kind: "date", key: "from", label: "Từ ngày" },
          { kind: "date", key: "to", label: "Đến ngày" },
        ]}
        values={filter}
        onChange={(next) => setFilter({ ...filter, ...next })}
        resetValues={resetValues}
      />

      <ReportKpiRow
        items={[
          {
            label: "Hôm nay",
            value: isLoading ? "…" : num(summary?.today ?? 0),
            icon: Eye,
            tone: "info",
          },
          {
            label: "7 ngày",
            value: isLoading ? "…" : num(summary?.last7 ?? 0),
            icon: CalendarDays,
            tone: "success",
          },
          {
            label: "30 ngày",
            value: isLoading ? "…" : num(summary?.last30 ?? 0),
            icon: CalendarRange,
          },
          {
            label: "Trong khoảng lọc",
            value: isLoading ? "…" : num(summary?.rangeTotal ?? 0),
            icon: BarChart3,
            tone: "warning",
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lượt xem theo ngày</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Đang tải...
            </div>
          ) : series.every((s) => s.views === 0) ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Chưa có dữ liệu trong khoảng đã chọn. Mở trang chủ website để bắt
              đầu ghi nhận.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={series} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => String(v).slice(5)}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [`${num(v)} lượt`, "Views"]}
                  labelFormatter={(l) => `Ngày ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#3b82f6"
                  fill="url(#trafficGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top trang xem nhiều</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Đường dẫn</TableHead>
                <TableHead className="text-right">Lượt xem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : topPages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Chưa có dữ liệu
                  </TableCell>
                </TableRow>
              ) : (
                topPages.map((row, i) => (
                  <TableRow key={row.path}>
                    <TableCell className="text-center text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-mono text-xs sm:text-sm">
                      {row.path}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {num(row.views)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
