"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Eye,
  RotateCcw,
  CheckCircle2,
  Search,
  ShoppingCart,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  Store,
  User as UserIcon,
  Calendar,
  Tag,
  TrendingUp,
  Wallet,
  Receipt,
  RotateCw,
  X,
} from "lucide-react";
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
import { useCrudList } from "@/lib/api/admin-crud";
import { httpGet } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";

type DonHang = {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  fulfillment_status: string | null;
  channel: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  customer_id: string | null;
  shop_id: string | null;
  pos_session_id: string | null;
  created_by: string | null;
  created_at: string | null;
  note: string | null;
};

type KhachHang = { id: string; full_name: string | null; phone: string | null };
type ChiNhanh = { id: string; name: string; code: string | null };
type NguoiDung = { id: string; full_name: string | null; email: string | null };

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

const CHANNELS: Record<string, { label: string; icon: string; cls: string }> = {
  pos: { label: "POS", icon: "🏪", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  online: { label: "Online", icon: "🌐", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  phone: { label: "Điện thoại", icon: "📞", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  in_store: { label: "Tại quầy", icon: "🏬", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const PAGE_SIZE = 25;

function dinhDangTien(value: number | null) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value ?? 0);
}

function thoiGianTuongDoi(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return "vừa xong";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

function statusBadge(status: string | null) {
  const map: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
    draft: { label: "Nháp", cls: "bg-gray-100 text-gray-700", icon: Clock },
    pending: { label: "Chờ", cls: "bg-yellow-100 text-yellow-800", icon: Clock },
    confirmed: { label: "Đã xác nhận", cls: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
    processing: { label: "Đang xử lý", cls: "bg-indigo-100 text-indigo-800", icon: RotateCw },
    shipping: { label: "Đang giao", cls: "bg-violet-100 text-violet-800", icon: Truck },
    fulfilled: { label: "Đã giao", cls: "bg-emerald-100 text-emerald-800", icon: Truck },
    completed: { label: "Hoàn tất", cls: "bg-green-100 text-green-800", icon: CheckCircle },
    cancelled: { label: "Đã huỷ", cls: "bg-red-100 text-red-800", icon: XCircle },
  };
  const m = map[status ?? ""] ?? { label: status ?? "-", cls: "bg-muted text-muted-foreground", icon: Clock };
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${m.cls}`}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

function paymentBadge(status: string | null) {
  const map: Record<string, { label: string; cls: string }> = {
    unpaid: { label: "Chưa TT", cls: "bg-red-50 text-red-700 border border-red-200" },
    partial: { label: "Một phần", cls: "bg-orange-50 text-orange-700 border border-orange-200" },
    paid: { label: "Đã TT", cls: "bg-green-50 text-green-700 border border-green-200" },
    refunded: { label: "Hoàn tiền", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  };
  const m = map[status ?? ""] ?? { label: status ?? "-", cls: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function channelBadge(channel: string | null) {
  const m = CHANNELS[channel ?? ""];
  if (!m) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${m.cls}`}>
      <span>{m.icon}</span> {m.label}
    </span>
  );
}

type QuickFilter = { value: string; label: string; icon: typeof Clock; match: (o: DonHang) => boolean };
const QUICK_FILTERS: QuickFilter[] = [
  { value: "today", label: "Hôm nay", icon: Calendar, match: (o) => !!o.created_at && new Date(o.created_at).toDateString() === new Date().toDateString() },
  { value: "pending_payment", label: "Chờ thanh toán", icon: Wallet, match: (o) => o.payment_status === "unpaid" || o.payment_status === "partial" },
  { value: "active", label: "Đang xử lý", icon: RotateCw, match: (o) => ["pending", "confirmed", "processing", "shipping"].includes(o.status ?? "") },
  { value: "completed", label: "Hoàn tất", icon: CheckCircle, match: (o) => o.status === "completed" || o.status === "fulfilled" },
  { value: "cancelled", label: "Đã huỷ", icon: XCircle, match: (o) => o.status === "cancelled" },
  { value: "discount", label: "Có giảm giá", icon: Tag, match: (o) => (o.discount_amount ?? 0) > 0 },
];

export default function OrdersAdminPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [quickFilter, setQuickFilter] = useState("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [dangXuLyId, setDangXuLyId] = useState<string | null>(null);

  const donHangQuery = useQuery({
    queryKey: ["orders-list", search, page, statusFilter, paymentFilter, shopFilter, channelFilter, fromDate, toDate],
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
  const nguoiDungQuery = useCrudList<NguoiDung>("user-profiles", { page: 1, pageSize: 500 });

  const allDonHangs = donHangQuery.data?.items ?? [];

  // Áp dụng quick filter + date range + channel (filter client-side)
  const donHangs = useMemo(() => {
    const qf = QUICK_FILTERS.find((f) => f.value === quickFilter);
    return allDonHangs.filter((o) => {
      if (fromDate && o.created_at && new Date(o.created_at) < new Date(fromDate)) return false;
      if (toDate && o.created_at && new Date(o.created_at) > new Date(`${toDate}T23:59:59`)) return false;
      if (channelFilter && o.channel !== channelFilter) return false;
      if (qf && !qf.match(o)) return false;
      return true;
    });
  }, [allDonHangs, fromDate, toDate, channelFilter, quickFilter]);

  // Stats tính từ data trong trang (nhanh, không cần query riêng)
  const stats = useMemo(() => {
    const todayKey = new Date().toDateString();
    const tongDon = donHangs.length;
    const dangXuLy = donHangs.filter((o) => ["pending", "confirmed", "processing", "shipping"].includes(o.status ?? "")).length;
    const hoanTat = donHangs.filter((o) => o.status === "completed" || o.status === "fulfilled").length;
    const chuaThanhToan = donHangs.filter((o) => o.payment_status === "unpaid" || o.payment_status === "partial").length;
    const doanhThu = donHangs
      .filter((o) => o.status !== "cancelled" && (o.payment_status === "paid" || o.payment_status === "partial"))
      .reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);
    const doanhThuHomNay = donHangs
      .filter((o) => o.created_at && new Date(o.created_at).toDateString() === todayKey && o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);
    return { tongDon, dangXuLy, hoanTat, chuaThanhToan, doanhThu, doanhThuHomNay };
  }, [donHangs]);

  const tongTrang = donHangQuery.data?.totalPages ?? 1;
  const tongDon = donHangQuery.data?.total ?? 0;

  const khachHangMap = useMemo(() => new Map((khachHangQuery.data?.items ?? []).map((c) => [c.id, c])), [khachHangQuery.data]);
  const chiNhanhMap = useMemo(() => new Map((chiNhanhQuery.data?.items ?? []).map((s) => [s.id, s])), [chiNhanhQuery.data]);
  const nguoiDungMap = useMemo(() => new Map((nguoiDungQuery.data?.items ?? []).map((u) => [u.id, u])), [nguoiDungQuery.data]);
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
    setChannelFilter("");
    setFromDate("");
    setToDate("");
    setQuickFilter("today");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* ====== STATS CARDS ====== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Tổng đơn</div>
                <div className="text-2xl font-bold mt-1">{tongDon.toLocaleString("vi-VN")}</div>
              </div>
              <Receipt className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Đang xử lý</div>
                <div className="text-2xl font-bold mt-1 text-amber-600">{stats.dangXuLy}</div>
              </div>
              <RotateCw className="h-8 w-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Hoàn tất</div>
                <div className="text-2xl font-bold mt-1 text-green-600">{stats.hoanTat}</div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Chờ thanh toán</div>
                <div className="text-2xl font-bold mt-1 text-red-600">{stats.chuaThanhToan}</div>
              </div>
              <Wallet className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Doanh thu</div>
                <div className="text-base font-bold mt-1 text-emerald-600">{dinhDangTien(stats.doanhThu)}</div>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Hôm nay</div>
                <div className="text-base font-bold mt-1 text-violet-600">{dinhDangTien(stats.doanhThuHomNay)}</div>
              </div>
              <Calendar className="h-8 w-8 text-violet-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Quản lý đơn hàng
              </CardTitle>
              <CardDescription>
                Đang hiển thị <strong>{donHangs.length}</strong> / {tongDon.toLocaleString("vi-VN")} đơn
                {tongDon > donHangs.length && tongDon > 0 ? " (lọc)" : ""}
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

          {/* Quick filter chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_FILTERS.map((f) => {
              const Icon = f.icon;
              const active = quickFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => { setQuickFilter(f.value); setPage(1); }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-input"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {f.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => { setQuickFilter(""); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                quickFilter === ""
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-input"
              }`}
            >
              Tất cả
            </button>
          </div>

          {/* Search + filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2 pt-2">
            <div className="sm:col-span-2 md:col-span-4 space-y-1">
              <Label className="text-xs flex items-center gap-1"><Search className="h-3 w-3" /> Tìm kiếm</Label>
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Mã đơn hoặc ghi chú..."
                className="h-9"
              />
            </div>
            <div className="md:col-span-2 space-y-1">
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
            <div className="md:col-span-2 space-y-1">
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
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs flex items-center gap-1"><Store className="h-3 w-3" /> Cửa hàng</Label>
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
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Kênh bán</Label>
              <Select value={channelFilter || "__all__"} onValueChange={(v) => { setChannelFilter(v === "__all__" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả</SelectItem>
                  {Object.entries(CHANNELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 space-y-1">
              <Label className="text-xs">Từ ngày</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
            </div>
            <div className="md:col-span-3 space-y-1">
              <Label className="text-xs">Đến ngày</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs">Thao tác</Label>
              <Button variant="outline" className="h-9 w-full" onClick={resetFilter}>
                <RotateCcw className="h-3 w-3 mr-1" /> Đặt lại
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Chi nhánh</TableHead>
                  <TableHead>Kênh</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thanh toán</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead className="text-right w-32">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donHangs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                      {donHangQuery.isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Đang tải đơn hàng...
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Receipt className="h-10 w-10 mx-auto text-muted-foreground/30" />
                          <p>Không có đơn nào khớp bộ lọc</p>
                          <Button variant="link" size="sm" onClick={resetFilter}>Đặt lại bộ lọc</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  donHangs.map((o, index) => {
                    const khach = o.customer_id ? khachHangMap.get(o.customer_id) : null;
                    const shop = o.shop_id ? chiNhanhMap.get(o.shop_id) : null;
                    const nguoiTao = o.created_by ? nguoiDungMap.get(o.created_by) : null;
                    const dangXuLy = dangXuLyId === o.id;
                    const stt = (page - 1) * PAGE_SIZE + index + 1;
                    const daHoanTat = o.status === "completed" || o.status === "fulfilled";
                    const daHuy = o.status === "cancelled";
                    const hasDiscount = (o.discount_amount ?? 0) > 0;
                    return (
                      <TableRow key={o.id} className="group">
                        <TableCell className="text-center text-xs text-muted-foreground">{stt}</TableCell>
                        <TableCell>
                          <Link href={`/quanly/orders/${o.id}`} className="font-semibold text-primary hover:underline">
                            {o.order_number}
                          </Link>
                          {o.pos_session_id && (
                            <div className="text-[9px] text-muted-foreground/60 font-mono">POS</div>
                          )}
                          {o.note && (
                            <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-[200px] mt-0.5" title={o.note}>
                              📝 {o.note}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium">{thoiGianTuongDoi(o.created_at)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {o.created_at ? new Date(o.created_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {khach ? (
                            <div>
                              <div className="text-sm font-medium">{khach.full_name ?? "—"}</div>
                              <div className="text-[10px] text-muted-foreground">{khach.phone ?? ""}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Khách lẻ</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">{shop?.name ?? <span className="text-muted-foreground">—</span>}</div>
                          {shop?.code && <div className="text-[9px] text-muted-foreground/60 font-mono">{shop.code}</div>}
                        </TableCell>
                        <TableCell>{channelBadge(o.channel)}</TableCell>
                        <TableCell>{statusBadge(o.status)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {paymentBadge(o.payment_status)}
                            {nguoiTao && (
                              <div className="text-[9px] text-muted-foreground flex items-center gap-0.5" title={nguoiTao.email ?? ""}>
                                <UserIcon className="h-2.5 w-2.5" /> {nguoiTao.full_name ?? "—"}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold tabular-nums">{dinhDangTien(o.total_amount)}</div>
                          {hasDiscount && (
                            <div className="text-[10px] text-orange-600 flex items-center justify-end gap-0.5">
                              <Tag className="h-2.5 w-2.5" /> -{dinhDangTien(o.discount_amount)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-0.5 opacity-70 group-hover:opacity-100 transition">
                            <Button asChild size="sm" variant="ghost" title="Xem chi tiết" className="h-7 w-7 p-0">
                              <Link href={`/quanly/orders/${o.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              disabled={dangXuLy || daHoanTat || daHuy}
                              onClick={() => hoanTatDon(o.id)}
                              title="Đánh dấu hoàn tất"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              disabled={dangXuLy || daHuy || daHoanTat}
                              onClick={() => huyDon(o.id)}
                              title="Huỷ đơn"
                            >
                              <X className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {tongTrang > 1 && (
            <div className="flex items-center justify-between pt-3">
              <span className="text-xs text-muted-foreground">
                Trang <strong>{page}</strong>/<strong>{tongTrang}</strong> · {tongDon.toLocaleString("vi-VN")} đơn
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
