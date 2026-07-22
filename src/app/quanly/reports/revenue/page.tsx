"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrudList } from "@/lib/api/admin-crud";
import { httpGet } from "@/lib/api/http";

type Shop = { id: string; name: string };
type RevenueReport = {
  summary: { totalRevenue: number; completedOrders: number; cancelledOrders: number; totalOrders: number; averageOrderValue: number };
  series: Array<{ bucket: string; revenue: number; orders: number; cancelled: number }>;
  statusBreakdown: Record<string, number>;
};

function vnd(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

export default function RevenueReportPage() {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 86400000);
  const [from, setFrom] = useState(monthAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [shopId, setShopId] = useState("");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  const shopsQ = useCrudList<Shop>("shops", { pageSize: 100 });
  const shops = shopsQ.data?.items ?? [];

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["revenue-report", from, to, shopId, groupBy],
    queryFn: () =>
      httpGet<RevenueReport>("/v1/reports/revenue", {
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        shop_id: shopId || undefined,
        group_by: groupBy,
      }),
  });

  const maxRevenue = useMemo(() => {
    if (!data?.series.length) return 0;
    return Math.max(...data.series.map((s) => s.revenue));
  }, [data]);

  const summary = data?.summary;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Báo cáo doanh thu</CardTitle>
          <CardDescription>Thống kê đơn hàng & doanh thu theo thời gian, cửa hàng</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Từ ngày</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Đến ngày</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cửa hàng</Label>
              <Select value={shopId || "__all__"} onValueChange={(v) => setShopId(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả cửa hàng</SelectItem>
                  {shops.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nhóm theo</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "day" | "week" | "month")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Ngày</SelectItem>
                  <SelectItem value="week">Tuần</SelectItem>
                  <SelectItem value="month">Tháng</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex items-end">
              <Button className="h-9 w-full" onClick={() => refetch()}>Áp dụng</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Doanh thu</div><div className="text-lg sm:text-xl font-bold text-green-700 break-words">{vnd(summary.totalRevenue)}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Đơn hoàn tất</div><div className="text-lg sm:text-xl font-bold">{summary.completedOrders}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Tổng đơn</div><div className="text-lg sm:text-xl font-bold">{summary.totalOrders}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Đơn huỷ</div><div className="text-lg sm:text-xl font-bold text-red-600">{summary.cancelledOrders}</div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">AOV</div><div className="text-lg sm:text-xl font-bold break-words">{vnd(summary.averageOrderValue)}</div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Doanh thu theo {groupBy === "day" ? "ngày" : groupBy === "week" ? "tuần" : "tháng"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Đang tải...</div>
          ) : !data?.series.length ? (
            <div className="text-muted-foreground text-sm">Không có dữ liệu trong khoảng đã chọn</div>
          ) : (
            <>
              {/* Bar chart đơn giản bằng div */}
              <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
                {data.series.map((s) => (
                  <div key={s.bucket} className="flex items-center gap-2 text-xs">
                    <div className="w-24 text-muted-foreground">{s.bucket}</div>
                    <div className="flex-1 bg-muted rounded overflow-hidden h-5 relative">
                      <div
                        className="bg-primary h-full"
                        style={{ width: maxRevenue > 0 ? `${(s.revenue / maxRevenue) * 100}%` : "0%" }}
                      />
                      <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-semibold">
                        {vnd(s.revenue)}
                      </span>
                    </div>
                    <div className="w-16 text-right text-muted-foreground">{s.orders} đơn</div>
                  </div>
                ))}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bucket</TableHead>
                    <TableHead className="text-right">Doanh thu</TableHead>
                    <TableHead className="text-right">Đơn hoàn tất</TableHead>
                    <TableHead className="text-right">Đơn huỷ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.series.map((s) => (
                    <TableRow key={s.bucket}>
                      <TableCell className="font-mono text-xs">{s.bucket}</TableCell>
                      <TableCell className="text-right font-semibold">{vnd(s.revenue)}</TableCell>
                      <TableCell className="text-right">{s.orders}</TableCell>
                      <TableCell className="text-right text-red-600">{s.cancelled}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
