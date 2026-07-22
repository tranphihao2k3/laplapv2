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
import { useCrudList, useCrudCreate, useCrudUpdate, useCrudDelete } from "@/lib/api/admin-crud";
import { Search, Plus, Edit, Trash2, Phone, Mail, Cake } from "lucide-react";

type Customer = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  tier: string | null;
};

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

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return d; }
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ tier: "bronze" });

  const q = useCrudList<Customer>("customers", { search, page: 1, pageSize: 100 });

  const createMutation = useCrudCreate("customers");
  const updateMutation = useCrudUpdate("customers");
  const deleteMutation = useCrudDelete("customers");

  function resetForm() { setForm({ tier: "bronze" }); setEditing(null); }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ full_name: c.full_name, phone: c.phone, email: c.email, birthday: c.birthday?.slice(0, 10) ?? "", tier: c.tier ?? "bronze" });
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Khách hàng</CardTitle>
            <CardDescription>Quản lý hồ sơ & phân hạng khách hàng</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên / SĐT / email..." className="w-full sm:w-64 pl-8" />
            </div>
            <Button onClick={() => { resetForm(); setOpenNew(true); }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Thêm KH
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead>Ngày sinh</TableHead>
                <TableHead>Hạng</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : (q.data?.items ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có khách hàng</TableCell></TableRow>
              ) : (
                (q.data?.items ?? []).map((c) => {
                  const tier = TIER_MAP[c.tier ?? ""] ?? { label: c.tier ?? "—", cls: "bg-muted" };
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.full_name ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                          {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.birthday ? <span className="flex items-center gap-1"><Cake className="h-3 w-3" />{fmtDate(c.birthday)}</span> : "—"}
                      </TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tier.cls}`}>{tier.label}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(c)}>
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
    </div>
  );
}
