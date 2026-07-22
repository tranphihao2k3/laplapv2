"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCrudList, useCrudCreate, useCrudUpdate, useCrudDelete } from "@/lib/api/admin-crud";
import { Search, Plus, Edit, Trash2, RefreshCw } from "lucide-react";

type TradeIn = {
  id: string;
  customer_id: string | null;
  device_name: string | null;
  serial_number: string | null;
  condition_note: string | null;
  offered_price: number | null;
  status: string | null;
  created_at: string | null;
};

type Customer = { id: string; full_name: string | null; phone: string | null };

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Chờ định giá", cls: "bg-yellow-100 text-yellow-700" },
  evaluating: { label: "Đang định giá", cls: "bg-blue-100 text-blue-700" },
  approved: { label: "Đã duyệt", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Từ chối", cls: "bg-red-100 text-red-700" },
  completed: { label: "Hoàn tất", cls: "bg-green-100 text-green-700" },
};

const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([value, s]) => ({ value, label: s.label }));

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("vi-VN"); } catch { return d; }
}

export default function TradeInPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<TradeIn | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ status: "pending" });

  const q = useCrudList<TradeIn>("trade-in-requests", { search, page: 1, pageSize: 100 });
  const customersQ = useCrudList<Customer>("customers", { page: 1, pageSize: 500 });
  const customerMap = useMemo(() => new Map((customersQ.data?.items ?? []).map((c) => [c.id, c])), [customersQ.data]);

  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    return statusFilter === "all" ? all : all.filter((t) => t.status === statusFilter);
  }, [q.data, statusFilter]);

  const createMutation = useCrudCreate("trade-in-requests");
  const updateMutation = useCrudUpdate("trade-in-requests");
  const deleteMutation = useCrudDelete("trade-in-requests");

  function resetForm() { setForm({ status: "pending" }); setEditing(null); }

  function openEdit(t: TradeIn) {
    setEditing(t);
    setForm({
      customer_id: t.customer_id, device_name: t.device_name, serial_number: t.serial_number,
      condition_note: t.condition_note, offered_price: t.offered_price, status: t.status ?? "pending",
    });
    setOpenNew(true);
  }

  async function handleSubmit() {
    try {
      const body: Record<string, any> = {};
      Object.entries(form).forEach(([k, v]) => { if (v !== "" && v !== null) body[k] = v; });
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: body as any });
        toast.success("Đã cập nhật yêu cầu");
      } else {
        await createMutation.mutateAsync(body as any);
        toast.success("Đã tạo yêu cầu thu cũ");
      }
      resetForm();
      setOpenNew(false);
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  async function handleDelete(t: TradeIn) {
    if (!confirm(`Xoá yêu cầu "${t.device_name}"?`)) return;
    try { await deleteMutation.mutateAsync(t.id); toast.success("Đã xoá"); }
    catch (e: any) { toast.error(e?.error?.message ?? "Có lỗi xảy ra"); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Thu cũ đổi mới</CardTitle>
            <CardDescription>Định giá & xử lý yêu cầu thu mua thiết bị cũ</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Thiết bị / serial..." className="w-full sm:w-56 pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { resetForm(); setOpenNew(true); }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Tạo yêu cầu
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thiết bị</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Ghi chú tình trạng</TableHead>
                <TableHead className="text-right">Giá đề xuất</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Chưa có yêu cầu thu cũ</TableCell></TableRow>
              ) : (
                items.map((t) => {
                  const st = STATUS_MAP[t.status ?? ""] ?? { label: t.status ?? "-", cls: "bg-muted" };
                  const c = t.customer_id ? customerMap.get(t.customer_id) : null;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.device_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{t.serial_number ?? "—"}</TableCell>
                      <TableCell className="text-xs">{c?.full_name ?? "—"}{c?.phone ? ` (${c.phone})` : ""}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{t.condition_note ?? "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtCurrency(t.offered_price)}</TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(t)}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(t)}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogTitle>{editing ? "Sửa yêu cầu" : "Tạo yêu cầu thu cũ"}</DialogTitle>
            <DialogDescription>Nhập thông tin thiết bị khách muốn bán lại.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Tên thiết bị *</Label>
              <Input value={form.device_name ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, device_name: e.target.value }))} placeholder="VD: iPhone 13 128GB" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Khách hàng</Label>
              <Select value={form.customer_id ?? ""} onValueChange={(v) => setForm((p: any) => ({ ...p, customer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn KH" /></SelectTrigger>
                <SelectContent>{(customersQ.data?.items ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.id.slice(0, 8)}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serial / IMEI</Label>
              <Input value={form.serial_number ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, serial_number: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select value={form.status ?? "pending"} onValueChange={(v) => setForm((p: any) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Ghi chú tình trạng</Label>
              <Textarea value={form.condition_note ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, condition_note: e.target.value }))} placeholder="Mô tả tình trạng, trầy xước, màn hình..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Giá đề xuất (VND)</Label>
              <Input type="number" min={0} value={form.offered_price ?? ""} onChange={(e) => setForm((p: any) => ({ ...p, offered_price: Number(e.target.value) || null }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setOpenNew(false); }}>Huỷ</Button>
            <Button disabled={!form.device_name || createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {editing ? "Cập nhật" : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
