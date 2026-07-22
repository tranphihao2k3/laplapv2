"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCrudList } from "@/lib/api/admin-crud";
import { httpGet } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";

type DonHang = {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  total_amount: number | null;
  customer_id: string | null;
  shop_id: string | null;
  created_at: string | null;
  note: string | null;
};

type KhachHang = { id: string; full_name: string | null; phone: string | null };
type ChiNhanh = { id: string; name: string; code: string | null };

const ORDER_STATUSES = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "draft", label: "Nháp" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "processing", label: "Đang xử lý" },
  { value: "shipping", label: "Đang giao" },
  { value: "fulfilled", label: "Đã giao" },
  { value: "completed", label: "Hoàn tất" },
  { value: "cancelled", label: "Đã huỷ" },
];

const PAYMENT_STATUSES = [
  { value: "", label: "Tất cả thanh toán" },
  { value: "unpaid", label: "Chưa thanh toán" },
  { value: "partial", label: "Trả một phần" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "refunded", label: "Đã hoàn tiền" },
];

const PAGE_SIZE = 25;

function dinhDangTien(value: number | null) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value ?? 0);
}

function statusBadge(status: string | null) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Nháp", cls: "bg-gray-100 text-gray-700" },
    pending: { label: "Chờ", cls: "bg-yellow-100 text-yellow-800" },
    confirmed: { label: "Đã xác nhận", cls: "bg-blue-100 text-blue-800" },
    processing: { label: "Đang xử lý", cls: "bg-indigo-100 text-indigo-800" },
    shipping: { label: "Đang giao", cls: "bg-violet-100 text-violet-800" },
    fulfilled: { label: "Đã giao", cls: "bg-emerald-100 text-emerald-800" },
    completed: { label: "Hoàn tất", cls: "bg-green-100 text-green-800" },
    cancelled: { label: "Đã huỷ", cls: "bg-red-100 text-red-800" },
  };
  const m = map[status ?? ""] ?? { label: status ?? "-", cls: "bg-muted text-muted-foreground" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

function paymentBadge(status: string | null) {
  const map: Record<string, { label: string; cls: string }> = {
    unpaid: { label: "Chưa TT", cls: "bg-red-50 text-red-700" },
    partial: { label: "Một phần", cls: "bg-orange-50 text-orange-700" },
    paid: { label: "Đã TT", cls: "bg-green-50 text-green-700" },
    refunded: { label: "Hoàn tiền", cls: "bg-blue-50 text-blue-700" },
  };
  const m = map[status ?? ""] ?? { label: status ?? "-", cls: "bg-muted text-muted-foreground" };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${m.cls}`}>{m.label}</span>;
}

export default function OrdersAdminPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [dangXuLyId, setDangXuLyId] = useState<string | null>(null);

  // Filter trên client kết hợp với search backend (factory chưa support tất cả filter)
  const donHangQuery = useQuery({
    queryKey: ["orders-list", search, page, statusFilter, paymentFilter, shopFilter, fromDate, toDate],
    queryFn: () =>
      httpGet<Paginated<DonHang>>("/v1/orders", {
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
        shop_id: shopFilter || undefined,
      }),
    placeholderData: (prev) => prev,
  });
  const khachHangQuery = useCrudList<KhachHang>("customers", { page: 1, pageSize: 500 });
  const chiNhanhQuery = useCrudList<ChiNhanh>("shops", { page: 1, pageSize: 200 });

  const allDonHangs = donHangQuery.data?.items ?? [];
  // Lọc thêm date range trên client (factory chưa expose range filter)
  const donHangs = useMemo(() => {
    return allDonHangs.filter((o) => {
      if (fromDate && o.created_at && new Date(o.created_at) < new Date(fromDate)) return false;
      if (toDate && o.created_at && new Date(o.created_at) > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [allDonHangs, fromDate, toDate]);

  const tongTrang = donHangQuery.data?.totalPages ?? 1;
  const tongDon = donHangQuery.data?.total ?? 0;

  const khachHangMap = useMemo(() => new Map((khachHangQuery.data?.items ?? []).map((c) => [c.id, c])), [khachHangQuery.data]);
  const chiNhanhMap = useMemo(() => new Map((chiNhanhQuery.data?.items ?? []).map((s) => [s.id, s])), [chiNhanhQuery.data]);
  const chiNhanhs = chiNhanhQuery.data?.items ?? [];

  const huyDon = async (id: string) => {
    try {
      setDangXuLyId(id);
      const res = await fetch(`/api/v1/orders/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Huỷ đơn thất bại");
      toast.success("Đã huỷ đơn hàng");
      donHangQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Huỷ đơn thất bại");
    } finally {
      setDangXuLyId(null);
    }
  };

  const hoanTatDon = async (id: string) => {
    try {
      setDangXuLyId(id);
      const res = await fetch(`/api/v1/orders/${id}/change-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_status: "completed",
          to_payment_status: "paid",
          to_fulfillment_status: "fulfilled",
          note: "Đánh dấu hoàn tất nhanh từ danh sách",
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Cập nhật đơn thất bại");
      toast.success("Đã đánh dấu hoàn tất");
      donHangQuery.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cập nhật đơn thất bại");
    } finally {
      setDangXuLyId(null);
    }
  };

  const resetFilter = () => {
    setSearch("");
    setStatusFilter("");
    setPaymentFilter("");
    setShopFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Quản lý đơn hàng</CardTitle>
              <CardDescription>
                {tongDon > 0 ? `${tongDon} đơn` : "Bảng đơn hàng"} — lọc theo trạng thái, thanh toán, cửa hàng, thời gian
              </CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
                <Link href="/quanly/return-orders">Đơn trả hàng</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-initial">
                <Link href="/quanly/reports/revenue">Báo cáo doanh thu</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 pt-2">
            <div className="sm:col-span-2 md:col-span-2 space-y-1">
              <Label className="text-xs">Tìm kiếm</Label>
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Mã đơn hoặc ghi chú..."
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Trạng thái</Label>
              <Select value={statusFilter || "__all__"} onValueChange={(v) => { setStatusFilter(v === "__all__" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s.value || "__all__"} value={s.value || "__all__"}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Thanh toán</Label>
              <Select value={paymentFilter || "__all__"} onValueChange={(v) => { setPaymentFilter(v === "__all__" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value || "__all__"} value={s.value || "__all__"}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cửa hàng</Label>
              <Select value={shopFilter || "__all__"} onValueChange={(v) => { setShopFilter(v === "__all__" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả</SelectItem>
                  {chiNhanhs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Thao tác</Label>
              <Button variant="outline" className="h-9 w-full" onClick={resetFilter}>
                <RotateCcw className="h-3 w-3 mr-1" /> Đặt lại
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Từ ngày</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Đến ngày</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">STT</TableHead>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Cửa hàng</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thanh toán</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {donHangs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {donHangQuery.isLoading ? "Đang tải..." : "Không có đơn nào khớp bộ lọc"}
                  </TableCell>
                </TableRow>
              ) : (
                donHangs.map((o, index) => {
                  const khach = o.customer_id ? khachHangMap.get(o.customer_id) : null;
                  const shop = o.shop_id ? chiNhanhMap.get(o.shop_id) : null;
                  const dangXuLy = dangXuLyId === o.id;
                  const stt = (page - 1) * PAGE_SIZE + index + 1;
                  const daHoanTat = o.status === "completed";
                  const daHuy = o.status === "cancelled";
                  return (
                    <TableRow key={o.id}>
                      <TableCell>{stt}</TableCell>
                      <TableCell>
                        <Link href={`/quanly/orders/${o.id}`} className="font-medium hover:underline text-primary">
                          {o.order_number}
                        </Link>
                        {o.note && (
                          <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-[180px]">{o.note}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{o.created_at ? new Date(o.created_at).toLocaleString("vi-VN") : "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{shop?.name ?? "-"}</div>
                        <div className="text-[10px] text-muted-foreground">{shop?.code ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{khach?.full_name ?? "Khách lẻ"}</div>
                        <div className="text-[10px] text-muted-foreground">{khach?.phone ?? ""}</div>
                      </TableCell>
                      <TableCell>{statusBadge(o.status)}</TableCell>
                      <TableCell>{paymentBadge(o.payment_status)}</TableCell>
                      <TableCell className="text-right font-semibold">{dinhDangTien(o.total_amount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="ghost" title="Xem chi tiết">
                            <Link href={`/quanly/orders/${o.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={dangXuLy || daHoanTat || daHuy}
                            onClick={() => hoanTatDon(o.id)}
                            title="Đánh dấu hoàn tất"
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={dangXuLy || daHuy || daHoanTat}
                            onClick={() => huyDon(o.id)}
                            title="Huỷ đơn"
                            className="text-destructive"
                          >
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Huỷ</Badge>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {tongTrang > 1 && (
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-muted-foreground">
                Trang {page}/{tongTrang} · {tongDon} đơn
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ← Trước
                </Button>
                <Button size="sm" variant="outline" disabled={page >= tongTrang} onClick={() => setPage((p) => p + 1)}>
                  Sau →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
