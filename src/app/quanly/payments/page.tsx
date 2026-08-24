"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Eye,
  Plus,
  Receipt,
  Search,
  Store as StoreIcon,
  User as UserIcon,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCrudBulkDelete, useCrudList, useCrudCreate, useCrudUpdate, useCrudDelete } from "@/lib/api/admin-crud";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DateCell,
  IdCell,
  MoneyCell,
  RowActions,
  RowIndexCell,
} from "@/components/admin/table-cells";
import { httpGet } from "@/lib/api/http";

type Payment = {
  id: string;
  order_id: string | null;
  method: string | null;
  amount: number | null;
  status: string | null;
  transaction_code: string | null;
  paid_at: string | null;
  created_at: string | null;
};

type Order = {
  id: string;
  order_number: string;
  total_amount: number | null;
  subtotal: number | null;
  status: string | null;
  customer_id: string | null;
  shop_id: string | null;
};

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type Shop = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
};

type OrderFull = {
  order: {
    id: string;
    order_number: string;
    status: string | null;
    payment_status: string | null;
    channel: string | null;
    subtotal: number | null;
    discount_amount: number | null;
    total_amount: number | null;
    created_at: string | null;
    customer_id: string | null;
    shop_id: string | null;
  } | null;
  items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    product_variant: {
      id: string;
      sku: string;
      name: string | null;
      product: { id: string; name: string; slug: string; thumbnail_url: string | null } | null;
    } | null;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    status: string;
    transaction_code: string | null;
    paid_at: string | null;
  }>;
  customer: Customer | null;
  shop: Shop | null;
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Tiền mặt",
  card: "Thẻ",
  transfer: "Chuyển khoản",
  ewallet: "Ví điện tử",
  cod: "COD",
  credit: "Tín dụng",
};

const METHOD_OPTIONS = Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }));

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  unpaid: { label: "Chưa TT", cls: "bg-red-50 text-red-700" },
  partial: { label: "Một phần", cls: "bg-orange-50 text-orange-700" },
  paid: { label: "Đã TT", cls: "bg-green-50 text-green-700" },
  refunded: { label: "Hoàn tiền", cls: "bg-blue-50 text-blue-700" },
};

const STATUS_OPTIONS = [
  { value: "unpaid", label: "Chưa TT" },
  { value: "partial", label: "Một phần" },
  { value: "paid", label: "Đã TT" },
  { value: "refunded", label: "Hoàn tiền" },
];

const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  fulfilled: "Đã giao",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

function fmtCurrency(v: number | null | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v ?? 0);
}

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ method: "cash", status: "paid" });

  // Chi tiết
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const baseQ = useCrudList<Payment>("payments", { search, page: 1, pageSize: 100 });
  const items = useMemo(() => {
    const all = baseQ.data?.items ?? [];
    return all.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      return true;
    });
  }, [baseQ.data, statusFilter, methodFilter]);

  const pageIds = useMemo(() => items.map((p) => p.id), [items]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selection.isSelected(id));
  const someOnPageSelected = pageIds.some((id: string) => selection.isSelected(id));

  const ordersQ = useCrudList<Order>("orders", { page: 1, pageSize: 500 });
  const customersQ = useCrudList<Customer>("customers", { page: 1, pageSize: 500 });
  const shopsQ = useCrudList<Shop>("shops", { page: 1, pageSize: 500 });

  const orderMap = useMemo(() => new Map((ordersQ.data?.items ?? []).map((o) => [o.id, o])), [ordersQ.data]);
  const customerMap = useMemo(
    () => new Map((customersQ.data?.items ?? []).map((c) => [c.id, c])),
    [customersQ.data],
  );
  const shopMap = useMemo(
    () => new Map((shopsQ.data?.items ?? []).map((s) => [s.id, s])),
    [shopsQ.data],
  );

  // Stats tổng hợp
  const stats = useMemo(() => {
    const all = baseQ.data?.items ?? [];
    let collected = 0;
    let refunded = 0;
    let count = all.length;
    for (const p of all) {
      const amt = Number(p.amount ?? 0);
      if (p.status === "refunded") refunded += amt;
      else collected += amt;
    }
    return { count, collected, refunded };
  }, [baseQ.data]);

  const createMutation = useCrudCreate("payments");
  const updateMutation = useCrudUpdate("payments");
  const deleteMutation = useCrudDelete("payments");
  const bulkDeleteMutation = useCrudBulkDelete("payments");
  const selection = useBulkSelection();

  async function handleBulkDelete() {
    const ids = selection.array;
    if (ids.length === 0) return;
    try {
      const result = await bulkDeleteMutation.mutateAsync(ids);
      const deletedCount = result.deleted?.length ?? 0;
      const missingCount = result.missing?.length ?? 0;
      if (deletedCount === 0) {
        toast.error("Không xoá được bản ghi nào");
      } else if (missingCount > 0) {
        toast.warning(`Đã xoá ${deletedCount}, bỏ qua ${missingCount} không tồn tại`);
      } else {
        toast.success(`Đã xoá ${deletedCount} thanh toán`);
      }
      selection.clear();
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  function resetForm() { setForm({ method: "cash", status: "paid" }); setEditing(null); }

  function openEdit(p: Payment) {
    setEditing(p);
    setForm({ order_id: p.order_id, method: p.method, amount: p.amount, status: p.status, transaction_code: p.transaction_code, paid_at: p.paid_at?.slice(0, 16) ?? "" });
    setOpenNew(true);
  }

  async function handleSubmit() {
    try {
      const body: Record<string, any> = { ...form };
      if (body.paid_at) body.paid_at = new Date(body.paid_at).toISOString();
      else body.paid_at = null;
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: body as any });
        toast.success("Đã cập nhật thanh toán");
      } else {
        await createMutation.mutateAsync(body as any);
        toast.success("Đã thêm thanh toán");
      }
      resetForm();
      setOpenNew(false);
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  async function handleDelete(p: Payment) {
    if (!window.confirm("Xoá thanh toán này?")) return;
    try {
      await deleteMutation.mutateAsync(p.id);
      toast.success("Đã xoá");
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  function openDetail(orderId: string | null) {
    if (!orderId) {
      toast.error("Thanh toán này không gắn với đơn hàng");
      return;
    }
    setDetailOrderId(orderId);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Tổng số giao dịch</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{stats.count.toLocaleString("vi-VN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Tổng tiền đã thu</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums text-emerald-600">{fmtCurrency(stats.collected)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Tổng tiền hoàn</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums text-blue-600">{fmtCurrency(stats.refunded)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Thanh toán</CardTitle>
            <CardDescription>Quản lý giao dịch thanh toán đơn hàng</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mã giao dịch..." className="w-full sm:w-48 pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả TT</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả PT</SelectItem>
                {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { resetForm(); setOpenNew(true); }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Thêm TT
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <BulkActionsToolbar
            count={selection.count}
            entityLabel="thanh toán"
            onClear={selection.clear}
            onRequestDelete={() => {
              if (window.confirm(`Xoá ${selection.count} thanh toán đã chọn? Hành động không thể hoàn tác.`)) {
                void handleBulkDelete();
              }
            }}
            isPending={bulkDeleteMutation.isPending}
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableHead className="w-[44px] text-center">STT</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Đơn hàng</TableHead>
                  <TableHead className="hidden md:table-cell">Cửa hàng</TableHead>
                  <TableHead>Phương thức</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Mã GD</TableHead>
                  <TableHead>Thanh toán lúc</TableHead>
                  <TableHead className="hidden lg:table-cell">Mã ID</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baseQ.isLoading ? (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-10">
                      <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <div>Chưa có giao dịch thanh toán nào</div>
                      <div className="text-xs mt-1">Hãy thêm thanh toán mới hoặc điều chỉnh bộ lọc.</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((p, idx) => {
                    const st = STATUS_LABEL[p.status ?? ""] ?? { label: p.status ?? "-", cls: "bg-muted" };
                    const checked = selection.isSelected(p.id);
                    const order = p.order_id ? orderMap.get(p.order_id) : null;
                    const customer = order?.customer_id ? customerMap.get(order.customer_id) : null;
                    const shop = order?.shop_id ? shopMap.get(order.shop_id) : null;
                    return (
                      <TableRow key={p.id} data-state={checked ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => selection.toggle(p.id)}
                            aria-label={`Chọn thanh toán ${p.id}`}
                          />
                        </TableCell>
                        <TableCell><RowIndexCell index={idx + 1} /></TableCell>
                        <TableCell>
                          {customer ? (
                            <div className="space-y-0.5">
                              <div className="font-medium text-sm leading-tight">{customer.full_name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{customer.phone ?? "—"}</div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Khách lẻ</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order ? (
                            <div className="flex items-start gap-2 min-w-[160px]">
                              <Receipt className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                              <div className="space-y-0.5 min-w-0">
                                <div className="font-semibold text-sm leading-tight truncate">{order.order_number}</div>
                                <div className="text-xs text-muted-foreground tabular-nums">{fmtCurrency(order.total_amount)}</div>
                              </div>
                            </div>
                          ) : p.order_id ? (
                            <span className="text-xs text-muted-foreground font-mono">{p.order_id.slice(0, 8)}…</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {shop ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <StoreIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[160px]">{shop.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted">{METHOD_LABEL[p.method ?? ""] ?? p.method}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <MoneyCell value={p.amount} />
                        </TableCell>
                        <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{p.transaction_code ?? "—"}</TableCell>
                        <TableCell><DateCell value={p.paid_at} showTime /></TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <IdCell id={p.id} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-7 w-7"
                                    onClick={() => openDetail(p.order_id)}
                                    disabled={!p.order_id}
                                    aria-label="Xem chi tiết"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Xem chi tiết đơn</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <RowActions
                              onEdit={() => openEdit(p)}
                              onDelete={() => handleDelete(p)}
                              isDeleting={deleteMutation.isPending && deleteMutation.variables === p.id}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog thêm / sửa */}
      <Dialog open={openNew} onOpenChange={(o) => { if (!o) { resetForm(); } setOpenNew(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa thanh toán" : "Thêm thanh toán"}</DialogTitle>
            <DialogDescription>Nhập thông tin giao dịch.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Đơn hàng</Label>
              <Select value={form.order_id ?? ""} onValueChange={(v) => setForm((p: any) => ({ ...p, order_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn đơn hàng" /></SelectTrigger>
                <SelectContent>
                  {(ordersQ.data?.items ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.order_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phương thức</Label>
              <Select value={form.method ?? "cash"} onValueChange={(v) => setForm((p: any) => ({ ...p, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={form.status ?? "paid"} onValueChange={(v) => setForm((p: any) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Số tiền</Label>
              <Input type="number" min={0} value={form.amount ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, amount: Number(e.target.value) || 0 }))} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Mã giao dịch</Label>
              <Input value={form.transaction_code ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, transaction_code: e.target.value }))} placeholder="Mã từ ngân hàng/ví" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Thời gian thanh toán</Label>
              <Input type="datetime-local" value={form.paid_at ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, paid_at: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setOpenNew(false); }}>Huỷ</Button>
            <Button disabled={!form.order_id || createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {editing ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaymentDetailDialog
        open={detailOpen}
        onOpenChange={(o) => { setDetailOpen(o); if (!o) setDetailOrderId(null); }}
        orderId={detailOrderId}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialog chi tiết thanh toán (gọi /v1/orders/[id]/full)                     */
/* -------------------------------------------------------------------------- */

function PaymentDetailDialog({
  open,
  onOpenChange,
  orderId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string | null;
}) {
  const { data, isLoading, error } = useQuery<OrderFull>({
    queryKey: ["order-full", orderId],
    queryFn: () => httpGet<OrderFull>(`/v1/orders/${orderId}/full`),
    enabled: !!orderId && open,
  });

  // Reset state khi đóng
  useEffect(() => {
    if (!open) return;
  }, [open]);

  const order = data?.order;
  const items = data?.items ?? [];
  const payments = data?.payments ?? [];
  const customer = data?.customer ?? null;
  const shop = data?.shop ?? null;
  const discount = Number(order?.discount_amount ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Chi tiết thanh toán
          </DialogTitle>
          <DialogDescription>
            {order ? `Đơn hàng ${order.order_number}` : "Đang tải thông tin đơn hàng..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error || !order ? (
          <div className="text-center py-10 text-destructive">
            Không tải được chi tiết đơn hàng.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Box tóm tắt */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md border p-3 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <UserIcon className="h-3 w-3" /> Khách hàng
                </div>
                <div className="font-medium">{customer?.full_name ?? "Khách lẻ"}</div>
                <div className="text-xs text-muted-foreground">SĐT: {customer?.phone ?? "—"}</div>
                <div className="text-xs text-muted-foreground">Email: {customer?.email ?? "—"}</div>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <StoreIcon className="h-3 w-3" /> Cửa hàng
                </div>
                <div className="font-medium">{shop?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">SĐT: {shop?.phone ?? "—"}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">ĐC: {shop?.address ?? "—"}</div>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Kênh bán</div>
                <div className="font-medium uppercase">{order.channel ?? "—"}</div>
                <div className="text-xs text-muted-foreground">TT: {order.payment_status ?? "—"}</div>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Trạng thái đơn</div>
                <div className="font-medium">
                  {ORDER_STATUS_LABEL[order.status ?? ""] ?? order.status ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tạo: {order.created_at ? new Date(order.created_at).toLocaleString("vi-VN") : "—"}
                </div>
              </div>
            </div>

            {/* Box giao dịch thanh toán */}
            <div className="rounded-md border">
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div className="text-sm font-semibold">Giao dịch thanh toán ({payments.length})</div>
              </div>
              {payments.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Chưa có giao dịch thanh toán
                </div>
              ) : (
                <ul className="divide-y">
                  {payments.map((p) => (
                    <li key={p.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {METHOD_LABEL[p.method] ?? p.method}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.paid_at ? new Date(p.paid_at).toLocaleString("vi-VN") : "—"} · Mã: {p.transaction_code ?? "—"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold tabular-nums">{fmtCurrency(p.amount)}</div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            (STATUS_LABEL[p.status] ?? { cls: "bg-muted text-muted-foreground" }).cls
                          }`}
                        >
                          {(STATUS_LABEL[p.status] ?? { label: p.status }).label}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Bảng sản phẩm đã mua */}
            <div className="rounded-md border">
              <div className="px-3 py-2 border-b">
                <div className="text-sm font-semibold">Sản phẩm đã mua ({items.length})</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[44px]"></TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-center">SL</TableHead>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-right">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                        Chưa có sản phẩm
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((it) => {
                      const thumb = it.product_variant?.product?.thumbnail_url;
                      return (
                        <TableRow key={it.id}>
                          <TableCell>
                            {thumb ? (
                              <Image
                                src={thumb}
                                alt=""
                                width={36}
                                height={36}
                                className="rounded border object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="h-9 w-9 rounded border bg-muted" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {it.product_variant?.product?.name ?? "—"}
                            </div>
                            {it.product_variant?.name && (
                              <div className="text-[10px] text-muted-foreground">
                                {it.product_variant.name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {it.product_variant?.sku ?? "—"}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">{it.quantity}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtCurrency(it.unit_price)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {fmtCurrency(it.total_price)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Tổng kết */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tạm tính</span>
                <span className="tabular-nums">{fmtCurrency(order.subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Giảm giá</span>
                  <span className="tabular-nums">-{fmtCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1.5 border-t">
                <span>Tổng cộng</span>
                <span className="tabular-nums">{fmtCurrency(order.total_amount)}</span>
              </div>
              <div className="pt-1 text-right">
                <Link
                  href={`/quanly/orders/${order.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  Mở trang đơn hàng đầy đủ →
                </Link>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
