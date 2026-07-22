"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
  useCrudList,
  useCrudCreate,
  useCrudUpdate,
  useCrudDelete,
} from "@/lib/api/admin-crud";
import { Search, Plus, Edit, Trash2 } from "lucide-react";

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

type Order = { id: string; order_number: string };

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

function fmtCurrency(v: number | null | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v ?? 0);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("vi-VN"); } catch { return d; }
}

export default function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ method: "cash", status: "paid" });

  const baseQ = useCrudList<Payment>("payments", { search, page: 1, pageSize: 100 });
  const items = useMemo(() => {
    const all = baseQ.data?.items ?? [];
    return all.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      return true;
    });
  }, [baseQ.data, statusFilter, methodFilter]);
  const ordersQ = useCrudList<Order>("orders", { page: 1, pageSize: 500 });
  const orderMap = useMemo(() => new Map((ordersQ.data?.items ?? []).map((o) => [o.id, o])), [ordersQ.data]);

  const createMutation = useCrudCreate("payments");
  const updateMutation = useCrudUpdate("payments");
  const deleteMutation = useCrudDelete("payments");

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
    if (!confirm("Xoá thanh toán này?")) return;
    try {
      await deleteMutation.mutateAsync(p.id);
      toast.success("Đã xoá");
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  return (
    <div className="space-y-4">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Đơn hàng</TableHead>
                <TableHead>Phương thức</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Mã GD</TableHead>
                <TableHead>Thanh toán lúc</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {baseQ.isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có thanh toán</TableCell></TableRow>
              ) : (
                items.map((p) => {
                  const st = STATUS_LABEL[p.status ?? ""] ?? { label: p.status ?? "-", cls: "bg-muted" };
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-mono">{p.order_id ? (orderMap.get(p.order_id)?.order_number ?? p.order_id.slice(0, 8) + "...") : "—"}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted">{METHOD_LABEL[p.method ?? ""] ?? p.method}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{fmtCurrency(p.amount)}</TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{p.transaction_code ?? "—"}</TableCell>
                      <TableCell className="text-xs">{fmtDate(p.paid_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
    </div>
  );
}
