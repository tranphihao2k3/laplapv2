"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCrudBulkDelete,
  useCrudList,
  useCrudCreate,
  useCrudUpdate,
  useCrudDelete,
} from "@/lib/api/admin-crud";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";
import { httpGet } from "@/lib/api/http";
import { CustomerHistorySheet } from "./_components/customer-history-sheet";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Cake,
  Star,
  Users,
  Award,
  TrendingUp,
  TrendingDown,
  Crown,
  UserPlus,
  Eye,
  Pencil,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { IdCell, RowIndexCell } from "@/components/admin/table-cells";
import { zaloLink } from "@/lib/contact";

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  tier: string | null;
  loyalty_points?: number | null;
  created_at?: string | null;
};

type LoyaltyTx = {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  points: number | null;
  type: string | null;
  created_at: string | null;
};

type Paginated<T> = { items: T[]; total: number };

const TIER_MAP: Record<string, { label: string; cls: string }> = {
  bronze: { label: "Đồng", cls: "bg-amber-100 text-amber-800" },
  silver: { label: "Bạc", cls: "bg-gray-100 text-gray-700" },
  gold: { label: "Vàng", cls: "bg-yellow-100 text-yellow-800" },
  platinum: { label: "Bạch kim", cls: "bg-indigo-100 text-indigo-800" },
};

const TIER_OPTIONS = [
  { value: "bronze", label: "Đồng" },
  { value: "silver", label: "Bạc" },
  { value: "gold", label: "Vàng" },
  { value: "platinum", label: "Bạch kim" },
];

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "Mới tạo gần đây" },
  { value: "created_at:asc", label: "Cũ nhất trước" },
  { value: "loyalty_points:desc", label: "Điểm cao → thấp" },
  { value: "loyalty_points:asc", label: "Điểm thấp → cao" },
  { value: "full_name:asc", label: "Tên A → Z" },
  { value: "full_name:desc", label: "Tên Z → A" },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return d; }
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("vi-VN"); } catch { return d; }
}

function thoiGianTuongDoi(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} ngày trước`;
  return fmtDate(iso);
}

/* ============================================================
   Trang chính: Khách hàng + Điểm thưởng (gộp)
   ============================================================ */
export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [sort, setSort] = useState("loyalty_points:desc");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ tier: "bronze" });
  const [selected, setSelected] = useState<Customer | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openTx, setOpenTx] = useState(false);
  const [txForm, setTxForm] = useState<Record<string, any>>({ type: "adjust", points: 0 });

  // List khách hàng (sort trực tiếp vì useCrudList chưa hỗ trợ)
  const q = useQuery({
    queryKey: ["admin-customers-list", search, sort, tierFilter],
    queryFn: () =>
      httpGet<Paginated<Customer>>("/v1/customers", {
        search: search || undefined,
        page: 1,
        pageSize: 200,
        sort,
      }),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
  const items = q.data?.items ?? [];

  // Tính stats từ data có sẵn + 1 query phụ
  const allTxQ = useQuery({
    queryKey: ["customer-stats-tx"],
    queryFn: () =>
      httpGet<Paginated<LoyaltyTx>>("/v1/loyalty-transactions", {
        pageSize: 500,
        sort: "created_at:desc",
      }),
    staleTime: 60_000,
  });
  const allTx = allTxQ.data?.items ?? [];

  // Áp dụng filter tier trên client
  const filteredItems = useMemo(() => {
    if (!tierFilter) return items;
    return items.filter((c) => (c.tier ?? "") === tierFilter);
  }, [items, tierFilter]);

  // ====== Stats ======
  const stats = useMemo(() => {
    const tongKhach = items.length;
    const khachCoDiem = items.filter((c) => Number(c.loyalty_points ?? 0) > 0).length;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const khachMoiThangNay = items.filter(
      (c) => c.created_at && new Date(c.created_at) >= startOfMonth,
    ).length;
    const vang = items.filter((c) => c.tier === "gold" || c.tier === "platinum").length;

    let earned = 0;
    let redeemed = 0;
    for (const tx of allTx) {
      const p = Number(tx.points ?? 0);
      if (tx.type === "earn" || tx.type === "adjust") earned += Math.max(0, p);
      else if (tx.type === "redeem" || tx.type === "expire") redeemed += Math.abs(p);
    }

    return { tongKhach, khachCoDiem, khachMoiThangNay, vang, earned, redeemed };
  }, [items, allTx]);

  const createMutation = useCrudCreate("customers");
  const updateMutation = useCrudUpdate("customers");
  const deleteMutation = useCrudDelete("customers");
  const bulkDeleteMutation = useCrudBulkDelete("customers");
  const createTxMutation = useCrudCreate("loyalty-transactions");
  const selection = useBulkSelection();

  const pageIds = useMemo(() => filteredItems.map((c) => c.id), [filteredItems]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selection.isSelected(id));
  const someOnPageSelected = pageIds.some((id: string) => selection.isSelected(id));

  async function handleBulkDelete() {
    const ids = selection.array;
    if (ids.length === 0) return;
    try {
      const result = await bulkDeleteMutation.mutateAsync(ids);
      const deletedCount = result.deleted?.length ?? 0;
      const missingCount = result.missing?.length ?? 0;
      if (deletedCount === 0) {
        toast.error("Không xoá được bản ghi nào (có thể do khoá ngoại)");
      } else if (missingCount > 0) {
        toast.warning(`Đã xoá ${deletedCount}, bỏ qua ${missingCount} không tồn tại`);
      } else {
        toast.success(`Đã xoá ${deletedCount} khách hàng`);
      }
      selection.clear();
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  function resetForm() { setForm({ tier: "bronze" }); setEditing(null); }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      full_name: c.full_name,
      phone: c.phone,
      email: c.email,
      birthday: c.birthday?.slice(0, 10) ?? "",
      tier: c.tier ?? "bronze",
    });
    setOpenNew(true);
  }

  async function handleSubmit() {
    try {
      const body: Record<string, any> = { ...form };
      if (body.birthday) body.birthday = new Date(body.birthday).toISOString();
      else body.birthday = null;
      if (!body.phone?.trim()) body.phone = null;
      if (!body.email?.trim()) body.email = null;
      if (!body.full_name?.trim()) body.full_name = null;
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: body as any });
        toast.success("Đã cập nhật khách hàng");
      } else {
        await createMutation.mutateAsync(body as any);
        toast.success("Đã thêm khách hàng");
      }
      resetForm();
      setOpenNew(false);
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`Xoá khách hàng "${c.full_name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(c.id);
      toast.success("Đã xoá");
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  function openHistory(c: Customer) {
    setSelected(c);
    setHistoryOpen(true);
  }

  async function handleCreateTx() {
    if (!txForm.customer_id) {
      toast.error("Chọn khách hàng");
      return;
    }
    try {
      await createTxMutation.mutateAsync(txForm as any);
      toast.success("Đã tạo giao dịch điểm");
      setTxForm({ type: "adjust", points: 0 });
      setOpenTx(false);
      q.refetch();
      allTxQ.refetch();
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  return (
    <div className="space-y-4">
      {/* ====== STATS CARDS ====== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Tổng khách</div>
                <div className="text-2xl font-bold mt-1">{stats.tongKhach.toLocaleString("vi-VN")}</div>
              </div>
              <Users className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Có điểm thưởng</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">{stats.khachCoDiem}</div>
              </div>
              <Award className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Hạng Vàng+</div>
                <div className="text-2xl font-bold mt-1 text-amber-600">{stats.vang}</div>
              </div>
              <Crown className="h-8 w-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">KH mới (tháng)</div>
                <div className="text-2xl font-bold mt-1 text-violet-600">{stats.khachMoiThangNay}</div>
              </div>
              <UserPlus className="h-8 w-8 text-violet-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Điểm phát ra</div>
                <div className="text-lg font-bold mt-1 text-green-600 tabular-nums">
                  +{stats.earned.toLocaleString("vi-VN")}
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Điểm đã đổi</div>
                <div className="text-lg font-bold mt-1 text-red-600 tabular-nums">
                  -{stats.redeemed.toLocaleString("vi-VN")}
                </div>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Khách hàng & Điểm thưởng
              </CardTitle>
              <CardDescription>
                Tìm kiếm, phân hạng, cộng/trừ điểm. Click 1 dòng để xem lịch sử mua hàng & cộng điểm.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch gap-2 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm tên / SĐT / email..."
                  className="w-full sm:w-64 pl-8"
                />
              </div>
              <Select value={tierFilter || "__all__"} onValueChange={(v) => setTierFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Hạng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả</SelectItem>
                  {TIER_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setTxForm({ type: "adjust", points: 0 });
                  setOpenTx(true);
                }}
                className="w-full sm:w-auto"
              >
                <Star className="mr-2 h-4 w-4" /> Tạo GD điểm
              </Button>
              <Button onClick={() => { resetForm(); setOpenNew(true); }} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Thêm KH
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <BulkActionsToolbar
            count={selection.count}
            entityLabel="khách hàng"
            onClear={selection.clear}
            onRequestDelete={() => {
              if (window.confirm(`Xoá ${selection.count} khách hàng đã chọn? Hành động không thể hoàn tác.`)) {
                void handleBulkDelete();
              }
            }}
            isPending={bulkDeleteMutation.isPending}
          />
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={() => selection.toggleAll(pageIds)}
                      aria-label="Chọn tất cả"
                      ref={(el) => {
                        if (el && "indeterminate" in el) {
                          (el as HTMLInputElement).indeterminate = !allOnPageSelected && someOnPageSelected;
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="w-[56px] text-center">STT</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead>Ngày sinh</TableHead>
                  <TableHead className="text-center">Hạng</TableHead>
                  <TableHead className="text-right">Điểm</TableHead>
                  <TableHead>Tham gia</TableHead>
                  <TableHead>Mã</TableHead>
                  <TableHead className="text-right w-32">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Đang tải...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {tierFilter ? `Không có khách hạng ${TIER_MAP[tierFilter]?.label ?? tierFilter}` : "Chưa có khách hàng"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((c, idx) => {
                    const tier = TIER_MAP[c.tier ?? ""] ?? { label: c.tier ?? "—", cls: "bg-muted" };
                    const checked = selection.isSelected(c.id);
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        data-state={checked ? "selected" : undefined}
                        onClick={() => openHistory(c)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => selection.toggle(c.id)}
                            aria-label={`Chọn ${c.full_name ?? c.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <RowIndexCell index={idx + 1} />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{c.full_name ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Mở để xem lịch sử
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-xs">
                            {c.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />{c.phone}
                              </span>
                            )}
                            {c.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />{c.email}
                              </span>
                            )}
                            {!c.phone && !c.email && <span className="text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.birthday ? (
                            <span className="flex items-center gap-1">
                              <Cake className="h-3 w-3" />{fmtDate(c.birthday)}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tier.cls}`}>
                            {tier.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-600 tabular-nums">
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            {(c.loyalty_points ?? 0).toLocaleString("vi-VN")}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {thoiGianTuongDoi(c.created_at)}
                        </TableCell>
                        <TableCell>
                          <IdCell id={c.id} />
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-0.5">
                            {(() => {
                              const zalo = zaloLink(c.phone);
                              if (!zalo) return null;
                              return (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 hover:bg-sky-50"
                                  onClick={() => window.open(zalo, "_blank", "noopener,noreferrer")}
                                  title={`Chat Zalo với ${c.full_name ?? c.phone}`}
                                >
                                  <MessageCircle className="h-3.5 w-3.5 text-sky-600" />
                                </Button>
                              );
                            })()}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openHistory(c)}
                              title="Xem lịch sử"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => openEdit(c)}
                              title="Sửa"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleDelete(c)}
                              title="Xoá"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
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
          <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
            <span>Hiển thị {filteredItems.length} / {items.length} khách (tối đa 200 mỗi lượt)</span>
            {(search || tierFilter) && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => { setSearch(""); setTierFilter(""); }}
              >
                Xoá bộ lọc
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sheet lịch sử khách hàng */}
      <CustomerHistorySheet
        customer={selected}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      {/* Dialog sửa/thêm khách hàng */}
      <Dialog open={openNew} onOpenChange={(o) => { if (!o) { resetForm(); } setOpenNew(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
            <DialogDescription>Nhập thông tin cơ bản & phân hạng.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Họ tên</Label>
              <Input value={form.full_name ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, full_name: e.target.value }))} placeholder="Nguyễn Văn A" />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, phone: e.target.value }))} placeholder="090xxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, email: e.target.value }))} placeholder="a@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Ngày sinh</Label>
              <Input type="date" value={form.birthday ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, birthday: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Hạng *</Label>
              <Select value={form.tier ?? "bronze"} onValueChange={(v) => setForm((p: any) => ({ ...p, tier: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setOpenNew(false); }}>Huỷ</Button>
            <Button disabled={createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {editing ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog tạo giao dịch điểm */}
      <Dialog open={openTx} onOpenChange={(o) => { if (!o) setOpenTx(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              Tạo giao dịch điểm
            </DialogTitle>
            <DialogDescription>Điều chỉnh thủ công điểm thưởng khách hàng.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Khách hàng *</Label>
              <Select
                value={txForm.customer_id ?? ""}
                onValueChange={(v) => setTxForm((p: any) => ({ ...p, customer_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn khách hàng" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name ?? c.id.slice(0, 8)}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loại</Label>
              <Select
                value={txForm.type ?? "adjust"}
                onValueChange={(v) => setTxForm((p: any) => ({ ...p, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earn">Tích điểm</SelectItem>
                  <SelectItem value="redeem">Đổi điểm</SelectItem>
                  <SelectItem value="adjust">Điều chỉnh</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số điểm (dương hoặc âm tuỳ loại)</Label>
              <Input
                type="number"
                value={txForm.points ?? 0}
                onChange={(e) => setTxForm((p: any) => ({ ...p, points: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTx(false)}>Huỷ</Button>
            <Button
              disabled={!txForm.customer_id || createTxMutation.isPending}
              onClick={handleCreateTx}
            >
              Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
