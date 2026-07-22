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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useCrudList, useCrudUpdate } from "@/lib/api/admin-crud";
import { Search, Edit, Phone, User as UserIcon } from "lucide-react";

type UserProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
};

export default function UserProfilesAdminPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<Partial<UserProfile>>({});

  const q = useCrudList<UserProfile>("user-profiles", { search, page: 1, pageSize: 100 });
  const updateMutation = useCrudUpdate("user-profiles");

  function openEdit(u: UserProfile) {
    setEditing(u);
    setForm({ full_name: u.full_name, phone: u.phone, avatar_url: u.avatar_url });
  }

  function handleClose() { setEditing(null); setForm({}); }

  async function handleSubmit() {
    if (!editing) return;
    try {
      await updateMutation.mutateAsync({ id: editing.id, input: form as any });
      toast.success("Đã cập nhật hồ sơ");
      handleClose();
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  const filtered = useMemo(() => {
    const items = q.data?.items ?? [];
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((i) =>
      i.full_name?.toLowerCase().includes(s) || i.phone?.includes(s)
    );
  }, [q.data, search]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Hồ sơ người dùng</CardTitle>
            <CardDescription>Quản lý thông tin cá nhân của nhân viên</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên / SĐT..." className="w-full sm:w-64 pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Số điện thoại</TableHead>
                <TableHead>Avatar</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Chưa có hồ sơ</TableCell></TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={u.avatar_url ?? undefined} alt={u.full_name ?? ""} />
                          <AvatarFallback className="text-xs">
                            <UserIcon className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{u.full_name ?? "—"}</span>
                          <span className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}...</span>
                        </div>
                      </span>
                    </TableCell>
                    <TableCell>
                      {u.phone ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {u.phone}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {u.avatar_url ? (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] inline-block">{u.avatar_url}</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sửa hồ sơ</DialogTitle>
            <DialogDescription>Cập nhật thông tin cá nhân.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>User ID</Label>
              <Input value={editing?.id ?? ""} disabled className="font-mono text-xs" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Họ tên</Label>
              <Input value={form.full_name ?? ""} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Nguyễn Văn A" />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="090xxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>Avatar URL</Label>
              <Input value={form.avatar_url ?? ""} onChange={(e) => setForm((p) => ({ ...p, avatar_url: e.target.value }))} placeholder="https://example.com/avatar.jpg" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Huỷ</Button>
            <Button disabled={updateMutation.isPending} onClick={handleSubmit}>Cập nhật</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
