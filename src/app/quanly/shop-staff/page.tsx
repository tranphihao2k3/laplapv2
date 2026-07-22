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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Search, Plus, Edit, Trash2, Store, User, ShieldCheck, CheckCircle, XCircle } from "lucide-react";

type ShopStaff = {
  id: string;
  shop_id: string;
  user_id: string;
  role_id: string | null;
  is_active: boolean;
};

type Shop = { id: string; name: string };
type UserProfile = { id: string; full_name: string | null; phone: string | null };
type Role = { id: string; name: string; code: string };

const INIT_FORM: Partial<ShopStaff> = {
  shop_id: "",
  user_id: "",
  role_id: "",
  is_active: true,
};

export default function ShopStaffAdminPage() {
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<ShopStaff | null>(null);
  const [form, setForm] = useState<Partial<ShopStaff>>(INIT_FORM);

  const q = useCrudList<ShopStaff>("shop-staff", { search, page: 1, pageSize: 100 });
  const shopsQ = useCrudList<Shop>("shops", { page: 1, pageSize: 200 });
  const usersQ = useCrudList<UserProfile>("user-profiles", { page: 1, pageSize: 200 });
  const rolesQ = useCrudList<Role>("roles", { page: 1, pageSize: 200 });

  const shopMap = useMemo(() => {
    const m = new Map<string, Shop>();
    (shopsQ.data?.items ?? []).forEach((s) => m.set(s.id, s));
    return m;
  }, [shopsQ.data]);
  const userMap = useMemo(() => {
    const m = new Map<string, UserProfile>();
    (usersQ.data?.items ?? []).forEach((u) => m.set(u.id, u));
    return m;
  }, [usersQ.data]);
  const roleMap = useMemo(() => {
    const m = new Map<string, Role>();
    (rolesQ.data?.items ?? []).forEach((r) => m.set(r.id, r));
    return m;
  }, [rolesQ.data]);

  const createMutation = useCrudCreate("shop-staff");
  const updateMutation = useCrudUpdate("shop-staff");
  const deleteMutation = useCrudDelete("shop-staff");

  function resetForm() { setForm(INIT_FORM); setEditing(null); }

  function openEdit(s: ShopStaff) {
    setEditing(s);
    setForm({ shop_id: s.shop_id, user_id: s.user_id, role_id: s.role_id ?? "", is_active: s.is_active });
    setOpenNew(true);
  }

  async function handleSubmit() {
    if (!form.shop_id || !form.user_id) { toast.error("Cửa hàng và nhân viên không được để trống"); return; }
    try {
      const body: Record<string, any> = {
        shop_id: form.shop_id,
        user_id: form.user_id,
        role_id: form.role_id || null,
        is_active: form.is_active,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: body as any });
        toast.success("Đã cập nhật phân công");
      } else {
        await createMutation.mutateAsync(body as any);
        toast.success("Đã thêm phân công");
      }
      resetForm();
      setOpenNew(false);
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  async function handleDelete(s: ShopStaff) {
    const userName = userMap.get(s.user_id)?.full_name ?? s.user_id.slice(0, 8);
    if (!confirm(`Xoá phân công "${userName}" khỏi cửa hàng?`)) return;
    try {
      await deleteMutation.mutateAsync(s.id);
      toast.success("Đã xoá");
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  const filtered = useMemo(() => {
    const items = q.data?.items ?? [];
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((i) => {
      const u = userMap.get(i.user_id);
      return u?.full_name?.toLowerCase().includes(s) || u?.phone?.includes(s);
    });
  }, [q.data, search, userMap]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Nhân sự cửa hàng</CardTitle>
            <CardDescription>Gán nhân viên vào cửa hàng và vai trò tương ứng</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên / SĐT..." className="w-full sm:w-64 pl-8" />
            </div>
            <Button onClick={() => { resetForm(); setOpenNew(true); }} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Thêm phân công
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cửa hàng</TableHead>
                <TableHead>Nhân viên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có phân công</TableCell></TableRow>
              ) : (
                filtered.map((s) => {
                  const shop = shopMap.get(s.shop_id);
                  const user = userMap.get(s.user_id);
                  const role = s.role_id ? roleMap.get(s.role_id) : null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          <Store className="h-3.5 w-3.5 text-muted-foreground" />
                          {shop?.name ?? s.shop_id.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {user?.full_name ?? s.user_id.slice(0, 8)}
                        </span>
                        {user?.phone && <span className="ml-2 text-xs text-muted-foreground">{user.phone}</span>}
                      </TableCell>
                      <TableCell>
                        {role ? (
                          <span className="flex items-center gap-1.5 text-sm">
                            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            {role.name}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.is_active ? "text-green-600" : "text-muted-foreground"}`}>
                          {s.is_active ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          {s.is_active ? "Hoạt động" : "Vô hiệu"}
                        </span>
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
            <DialogTitle>{editing ? "Sửa phân công" : "Thêm phân công"}</DialogTitle>
            <DialogDescription>Gán nhân viên vào cửa hàng với vai trò tương ứng.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Cửa hàng *</Label>
              <Select value={form.shop_id ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, shop_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn cửa hàng" /></SelectTrigger>
                <SelectContent>
                  {(shopsQ.data?.items ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Nhân viên *</Label>
              <Select value={form.user_id ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                <SelectContent>
                  {(usersQ.data?.items ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ?? u.id.slice(0, 8)}{u.phone ? ` (${u.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Vai trò</Label>
              <Select value={form.role_id ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, role_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn vai trò (không bắt buộc)" /></SelectTrigger>
                <SelectContent>
                  {(rolesQ.data?.items ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name} ({r.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="is_active"
                checked={form.is_active ?? true}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v === true }))}
              />
              <Label htmlFor="is_active">Đang hoạt động</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setOpenNew(false); }}>Huỷ</Button>
            <Button disabled={!form.shop_id || !form.user_id || createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
              {editing ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
