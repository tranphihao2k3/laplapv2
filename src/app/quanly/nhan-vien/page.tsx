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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCrudList, useCrudUpdate } from "@/lib/api/admin-crud";
import { httpGet } from "@/lib/api/http";
import { RowIndexCell } from "@/components/admin/table-cells";
import { zaloLink } from "@/lib/contact";
import { Search, Pencil, Phone, Users, CalendarDays, MessageCircle } from "lucide-react";

type UserProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string | null;
};

type Paginated<T> = { items: T[]; total: number };

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return d; }
}

export default function NhanVienPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [openEdit, setOpenEdit] = useState(false);

  const q = useQuery({
    queryKey: ["admin-user-profiles", search],
    queryFn: () =>
      httpGet<Paginated<UserProfile>>("/v1/user-profiles", {
        search: search || undefined,
        page: 1,
        pageSize: 200,
        sort: "created_at:desc",
      }),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const updateMutation = useCrudUpdate("user-profiles");

  const items = useMemo(() => {
    const list = q.data?.items ?? [];
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(s) ||
        u.phone?.includes(s),
    );
  }, [q.data, search]);

  function openEditDialog(u: UserProfile) {
    setEditing(u);
    setForm({ full_name: u.full_name ?? "", phone: u.phone ?? "" });
    setOpenEdit(true);
  }

  async function handleSubmit() {
    if (!editing) return;
    if (!form.full_name.trim()) {
      toast.error("Họ tên không được để trống");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        input: {
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
        } as never,
      });
      toast.success("Đã cập nhật nhân viên");
      setOpenEdit(false);
      setEditing(null);
      q.refetch();
    } catch (e: any) {
      toast.error(e?.error?.message ?? "Có lỗi xảy ra");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Tổng nhân viên</div>
                <div className="text-2xl font-bold mt-1">{items.length}</div>
              </div>
              <Users className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Có SĐT</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600">
                  {items.filter((u) => u.phone).length}
                </div>
              </div>
              <Phone className="h-8 w-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Quản lý nhân viên
            </CardTitle>
            <CardDescription>
              Danh sách tài khoản nhân viên. Chỉnh sửa họ tên và số điện thoại.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên / SĐT..."
              className="w-full sm:w-64 pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[56px] text-center">STT</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right w-24">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Đang tải...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Không tìm thấy nhân viên
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((u, idx) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-center">
                        <RowIndexCell index={idx + 1} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{u.full_name ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        {u.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="tabular-nums">{u.phone}</span>
                            <a
                              href={zaloLink(u.phone) ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-500 hover:text-blue-700"
                              title="Nhắn Zalo"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          {fmtDate(u.created_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openEdit} onOpenChange={(o) => { if (!o) setEditing(null); setOpenEdit(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa nhân viên</DialogTitle>
            <DialogDescription>Cập nhật họ tên và số điện thoại.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Họ tên *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="09xxxxxxxx"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenEdit(false); setEditing(null); }}>
              Huỷ
            </Button>
            <Button
              disabled={updateMutation.isPending || !form.full_name.trim()}
              onClick={handleSubmit}
            >
              Cập nhật
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
