"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { httpGet, httpPatch, httpPost, httpDelete } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";

type Shop = {
  id: string;
  organization_id: string | null;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

function getApiErrorMsg(e: unknown) {
  const err = e as { error?: { message?: string } };
  return err?.error?.message ?? "Có lỗi xảy ra";
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

export default function ShopsPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");

  const shopsQ = useQuery({
    queryKey: ["shops", search],
    queryFn: () =>
      httpGet<Paginated<Shop>>("/v1/shops", { page: 1, pageSize: 200, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const shops = shopsQ.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = shops.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && shops[0]) setSelectedId(shops[0].id);
  }, [shops, selectedId]);

  const [form, setForm] = useState<Partial<Shop>>({});
  useEffect(() => {
    if (selected) setForm({ ...selected });
  }, [selected?.id]);

  function setField<K extends keyof Shop>(k: K, v: Shop[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Shop> }) =>
      httpPatch<Shop>(`/v1/shops/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      toast.success("Đã cập nhật cửa hàng");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  const create = useMutation({
    mutationFn: (body: Partial<Shop>) => httpPost<Shop>("/v1/shops", body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      setSelectedId(data.id);
      toast.success("Đã thêm cửa hàng");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => httpDelete(`/v1/shops/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      if (selectedId === deleteTarget) setSelectedId(null);
      toast.success("Đã xoá cửa hàng");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState<Partial<Shop>>({ is_active: true, timezone: "Asia/Ho_Chi_Minh" });
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function handleSave() {
    if (!selected) return;
    update.mutate({
      id: selected.id,
      body: {
        name: form.name,
        code: form.code ?? null,
        phone: form.phone ?? null,
        email: form.email ?? null,
        address: form.address ?? null,
        timezone: form.timezone ?? null,
        is_active: form.is_active ?? true,
      },
    });
  }

  function handleReset() {
    if (selected) setForm({ ...selected });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* LEFT PANEL */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Cửa hàng</CardTitle>
          <Button size="sm" onClick={() => { setNewForm({ is_active: true, timezone: "Asia/Ho_Chi_Minh" }); setNewOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" />
            Thêm mới
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 p-2">
          <div className="relative px-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            {shopsQ.isLoading ? (
              <div className="p-3 text-sm text-muted-foreground">Đang tải...</div>
            ) : shops.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">
                {search ? "Không tìm thấy cửa hàng nào" : "Chưa có cửa hàng nào"}
              </div>
            ) : (
              shops.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    s.id === selected?.id ? "bg-muted font-medium" : ""
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{s.name}</span>
                    <Badge variant={s.is_active ? "default" : "secondary"} className="shrink-0 text-[10px]">
                      {s.is_active ? "Hoạt động" : "Tạm ngưng"}
                    </Badge>
                  </div>
                  <span className="mt-0.5 text-xs text-muted-foreground">{s.code ?? "—"}</span>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* RIGHT PANEL */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Thông tin cửa hàng</CardTitle>
            <p className="text-sm text-muted-foreground">
              Cập nhật thông tin cửa hàng.
            </p>
          </div>
          {selected && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(selected.id)}>
              <Trash2 className="mr-1 h-4 w-4" />
              Xoá
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="mb-2 h-10 w-10" />
              <p className="text-sm">Chọn một cửa hàng để chỉnh sửa</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên cửa hàng" required>
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => setField("name", e.target.value)}
                />
              </Field>
              <Field label="Mã cửa hàng" required>
                <Input
                  value={form.code ?? ""}
                  onChange={(e) => setField("code", e.target.value || null)}
                  placeholder="LPL-CT01"
                />
              </Field>
              <Field label="Số điện thoại">
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => setField("phone", e.target.value || null)}
                  placeholder="0123 456 789"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setField("email", e.target.value || null)}
                />
              </Field>
              <Field label="Địa chỉ" className="sm:col-span-2">
                <Textarea
                  value={form.address ?? ""}
                  onChange={(e) => setField("address", e.target.value || null)}
                  placeholder="123 đường ABC, Quận 1, TP.HCM"
                  rows={3}
                />
              </Field>
              <Field label="Múi giờ">
                <Input
                  value={form.timezone ?? ""}
                  onChange={(e) => setField("timezone", e.target.value || null)}
                  placeholder="Asia/Ho_Chi_Minh"
                />
              </Field>
              <div className="flex items-end space-y-0">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.is_active ?? true}
                    onCheckedChange={(v) => setField("is_active", v)}
                    id="is-active"
                  />
                  <Label htmlFor="is-active" className="cursor-pointer">
                    {form.is_active ? "Đang hoạt động" : "Tạm ngưng"}
                  </Label>
                </div>
              </div>
              <Field label="Thuộc tổ chức">
                <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                  {selected.organization_id ?? "—"}
                </div>
              </Field>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={handleReset}>
                  Hoàn tác
                </Button>
                <Button disabled={update.isPending || !form.name || !form.code} onClick={handleSave}>
                  {update.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE DIALOG */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm cửa hàng</DialogTitle>
            <DialogDescription>
              Mã cửa hàng phải duy nhất trong hệ thống.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên cửa hàng" required>
              <Input
                value={newForm.name ?? ""}
                onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Field>
            <Field label="Mã" required>
              <Input
                value={newForm.code ?? ""}
                onChange={(e) => setNewForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="LPL-CT02"
              />
            </Field>
            <Field label="Số điện thoại">
              <Input
                value={newForm.phone ?? ""}
                onChange={(e) => setNewForm((p) => ({ ...p, phone: e.target.value || null }))}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={newForm.email ?? ""}
                onChange={(e) => setNewForm((p) => ({ ...p, email: e.target.value || null }))}
              />
            </Field>
            <Field label="Địa chỉ" className="sm:col-span-2">
              <Input
                value={newForm.address ?? ""}
                onChange={(e) => setNewForm((p) => ({ ...p, address: e.target.value || null }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={create.isPending || !newForm.name || !newForm.code}
              onClick={() => {
                create.mutate(newForm, {
                  onSuccess: () => {
                    setNewOpen(false);
                    setNewForm({ is_active: true, timezone: "Asia/Ho_Chi_Minh" });
                  },
                });
              }}
            >
              {create.isPending ? "Đang tạo..." : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xoá</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xoá cửa hàng này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) del.mutate(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
