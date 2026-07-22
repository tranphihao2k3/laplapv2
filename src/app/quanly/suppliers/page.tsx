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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCrudList, useCrudCreate, useCrudUpdate, useCrudDelete } from "@/lib/api/admin-crud";
import { Search, Plus, Edit, Trash2, Phone, Mail, MapPin, BadgeInfo } from "lucide-react";

type Supplier = {
  id: string;
  company_name: string | null;
  tax_code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

const INIT_FORM: Partial<Supplier> = {
  company_name: "",
  tax_code: "",
  phone: "",
  email: "",
  address: "",
};

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Partial<Supplier>>(INIT_FORM);

  const q = useCrudList<Supplier>("suppliers", { search, page: 1, pageSize: 100 });
  const filtered = useMemo(() => {
    const items = q.data?.items ?? [];
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((i) =>
      i.company_name?.toLowerCase().includes(s) ||
      i.phone?.includes(s) ||
      i.email?.toLowerCase().includes(s)
    );
  }, [q.data, search]);

  const createMutation = useCrudCreate("suppliers");
  const updateMutation = useCrudUpdate("suppliers");
  const deleteMutation = useCrudDelete("suppliers");

  function resetForm() { setForm(INIT_FORM); setEditing(null); }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ company_name: s.company_name, tax_code: s.tax_code, phone: s.phone, email: s.email, address: s.address });
    setOpenNew(true);
  }

  async function handleSubmit() {
    if (!form.company_name) { toast.error("Tên công ty không được để trống"); return; }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: form as any });
        toast.success("Đã cập nhật nhà cung cấp");
      } else {
        await createMutation.mutateAsync(form as any);
        toast.success("Đã thêm nhà cung cấp");
      }
      resetForm();
      setOpenNew(false);
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  async function handleDelete(s: Supplier) {
    if (!confirm(`Xoá nhà cung cấp "${s.company_name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(s.id);
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
            <CardTitle>Nhà cung cấp</CardTitle>
            <CardDescription>Quản lý đối tác cung cấp hàng hoá</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên / SĐT / email..." className="w-full sm:w-64 pl-8" />
            </div>
            <Button onClick={() => { resetForm(); setOpenNew(true); }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Thêm NCC
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Công ty</TableHead>
                <TableHead>Mã số thuế</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có nhà cung cấp</TableCell></TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.company_name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.tax_code ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs">
                        {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                        {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.address ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{s.address}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(s)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={openNew} onOpenChange={(o) => { if (!o) { resetForm(); } setOpenNew(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}</DialogTitle>
            <DialogDescription>Nhập thông tin đối tác cung cấp hàng.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Tên công ty *</Label>
              <Input value={form.company_name ?? ""} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} placeholder="Công ty TNHH ABC" />
            </div>
            <div className="space-y-2">
              <Label>Mã số thuế</Label>
              <Input value={form.tax_code ?? ""} onChange={(e) => setForm((p) => ({ ...p, tax_code: e.target.value }))} placeholder="MST" />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="090xxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email ?? ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="contact@abc.vn" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Địa chỉ</Label>
              <Input value={form.address ?? ""} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Đường A, Quận B, TP.HCM" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setOpenNew(false); }}>Huỷ</Button>
            <Button disabled={!form.company_name || createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {editing ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
