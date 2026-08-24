"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCrudBulkDelete,
  useCrudList,
  useCrudCreate,
  useCrudUpdate,
  useCrudDelete,
} from "@/lib/api/admin-crud";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";
import { ActiveBadge, IdCell, RowActions, RowIndexCell } from "@/components/admin/table-cells";

type Organization = {
  id: string;
  name: string;
  code: string | null;
  tax_code: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  website: string | null;
  is_active: boolean;
  parent_id: string | null;
  settings: Record<string, unknown> | null;
  created_at: string;
};

type FormData = {
  name: string;
  code: string;
  tax_code: string;
  tax_id: string;
  phone: string;
  email: string;
  address: string;
  logo_url: string;
  website: string;
  is_active: boolean;
  parent_id: string;
  settings: string;
};

const emptyForm: FormData = {
  name: "",
  code: "",
  tax_code: "",
  tax_id: "",
  phone: "",
  email: "",
  address: "",
  logo_url: "",
  website: "",
  is_active: true,
  parent_id: "",
  settings: "",
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const payload = error as {
      error?: {
        message?: string;
        fields?: Record<string, string[] | undefined>;
        requestId?: string;
      };
    };
    const parts: string[] = [];
    if (payload.error?.message) parts.push(payload.error.message);
    const fieldMsgs = Object.values(payload.error?.fields ?? {})
      .flat()
      .filter(Boolean)
      .join(" · ");
    if (fieldMsgs) parts.push(fieldMsgs);
    if (payload.error?.requestId) parts.push(`requestId=${payload.error.requestId}`);
    if (parts.length) return parts.join(" | ");
  }
  return "Có lỗi xảy ra";
}

export default function OrganizationsAdminPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const listQuery = useCrudList<Organization>("organizations", {
    search,
    page: 1,
    pageSize: 50,
  });
  const orgs = listQuery.data?.items ?? [];

  const createMutation = useCrudCreate<Organization, Record<string, unknown>>("organizations");
  const updateMutation = useCrudUpdate<Organization, Record<string, unknown>>("organizations");
  const deleteMutation = useCrudDelete("organizations");
  const bulkDeleteMutation = useCrudBulkDelete("organizations");
  const selection = useBulkSelection();

  const pageIds = useMemo(() => orgs.map((o) => o.id), [orgs]);
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
        toast.error("Không xoá được bản ghi nào");
      } else if (missingCount > 0) {
        toast.warning(`Đã xoá ${deletedCount}, bỏ qua ${missingCount} không tồn tại`);
      } else {
        toast.success(`Đã xoá ${deletedCount} tổ chức`);
      }
      selection.clear();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(org: Organization) {
    setEditing(org);
    setForm({
      name: org.name ?? "",
      code: org.code ?? "",
      tax_code: org.tax_code ?? "",
      tax_id: org.tax_id ?? "",
      phone: org.phone ?? "",
      email: org.email ?? "",
      address: org.address ?? "",
      logo_url: org.logo_url ?? "",
      website: org.website ?? "",
      is_active: org.is_active ?? true,
      parent_id: org.parent_id ?? "",
      settings: org.settings ? JSON.stringify(org.settings, null, 2) : "",
    });
    setDialogOpen(true);
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      is_active: form.is_active,
    };
    if (form.code.trim()) payload.code = form.code.trim();
    if (form.tax_code.trim()) payload.tax_code = form.tax_code.trim();
    if (form.tax_id.trim()) payload.tax_id = form.tax_id.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.address.trim()) payload.address = form.address.trim();
    if (form.logo_url.trim()) payload.logo_url = form.logo_url.trim();
    if (form.website.trim()) payload.website = form.website.trim();
    if (form.parent_id) payload.parent_id = form.parent_id;
    else payload.parent_id = null;
    if (form.settings.trim()) {
      try {
        payload.settings = JSON.parse(form.settings);
      } catch {
        payload.settings = form.settings.trim();
      }
    } else {
      payload.settings = null;
    }
    return payload;
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên tổ chức");
      return;
    }
    const payload = buildPayload();
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: payload });
        toast.success("Đã cập nhật tổ chức");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo tổ chức mới");
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success("Đã xoá tổ chức");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  const isLoading = listQuery.isLoading;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle>Tổ chức</CardTitle>
            <CardDescription>
              Quản lý các tổ chức/doanh nghiệp trong hệ thống
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên, mã..."
                className="w-full sm:w-56 pl-8"
              />
            </div>
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-1.5 size-4" />
              Thêm mới
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <BulkActionsToolbar
            count={selection.count}
            entityLabel="tổ chức"
            onClear={selection.clear}
            onRequestDelete={() => {
              if (window.confirm(`Xoá ${selection.count} tổ chức đã chọn? Hành động không thể hoàn tác.`)) {
                void handleBulkDelete();
              }
            }}
            isPending={bulkDeleteMutation.isPending}
          />
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
                <TableHead className="w-[56px] text-center">STT</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Mã số thuế</TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Kích hoạt</TableHead>
                <TableHead className="hidden md:table-cell">Ngày tạo</TableHead>
                <TableHead>Mã ID</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : orgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    {search ? "Không tìm thấy kết quả" : "Chưa có tổ chức nào"}
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map((org, idx) => {
                  const checked = selection.isSelected(org.id);
                  return (
                  <TableRow key={org.id} data-state={checked ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => selection.toggle(org.id)}
                        aria-label={`Chọn ${org.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <RowIndexCell index={idx + 1} />
                    </TableCell>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {org.code ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{org.tax_code ?? "—"}</TableCell>
                    <TableCell>{org.phone ?? "—"}</TableCell>
                    <TableCell className="text-xs">{org.email ?? "—"}</TableCell>
                    <TableCell>
                      <ActiveBadge
                        value={org.is_active}
                        trueLabel="Hoạt động"
                        falseLabel="Vô hiệu"
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {org.created_at ? (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {new Date(org.created_at).toLocaleDateString("vi-VN")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <IdCell id={org.id} />
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        onEdit={() => openEdit(org)}
                        onDelete={() => openDelete(org.id)}
                      />
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Cập nhật tổ chức" : "Thêm tổ chức mới"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Chỉnh sửa thông tin tổ chức"
                : "Nhập thông tin tổ chức mới"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="org-name">
                Tên tổ chức <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Ví dụ: LapLap Group"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-code">Mã tổ chức</Label>
              <Input
                id="org-code"
                value={form.code}
                onChange={(e) => setField("code", e.target.value)}
                placeholder="Ví dụ: LAPLAP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-parent">Tổ chức cha</Label>
              <Select
                value={form.parent_id}
                onValueChange={(v) => setField("parent_id", v)}
              >
                <SelectTrigger id="org-parent">
                  <SelectValue placeholder="Chọn tổ chức cha (nếu có)" />
                </SelectTrigger>
                <SelectContent>
                  {orgs
                    .filter((o) => o.id !== editing?.id)
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-tax-code">Mã số thuế</Label>
              <Input
                id="org-tax-code"
                value={form.tax_code}
                onChange={(e) => setField("tax_code", e.target.value)}
                placeholder="MST"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-tax-id">Tax ID</Label>
              <Input
                id="org-tax-id"
                value={form.tax_id}
                onChange={(e) => setField("tax_id", e.target.value)}
                placeholder="Tax ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-phone">Điện thoại</Label>
              <Input
                id="org-phone"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="Số điện thoại"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">Email</Label>
              <Input
                id="org-email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-website">Website</Label>
              <Input
                id="org-website"
                value={form.website}
                onChange={(e) => setField("website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-logo">Logo URL</Label>
              <Input
                id="org-logo"
                value={form.logo_url}
                onChange={(e) => setField("logo_url", e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="org-address">Địa chỉ</Label>
              <Textarea
                id="org-address"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                placeholder="Địa chỉ tổ chức"
                rows={2}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="org-settings">Settings (JSON)</Label>
              <Textarea
                id="org-settings"
                value={form.settings}
                onChange={(e) => setField("settings", e.target.value)}
                placeholder='{"key": "value"}'
                rows={3}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="org-active"
                checked={form.is_active}
                onCheckedChange={(v) => setField("is_active", v)}
              />
              <Label htmlFor="org-active">Kích hoạt</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Huỷ
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Đang lưu..."
                : editing
                  ? "Lưu thay đổi"
                  : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xoá tổ chức này? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingId(null);
              }}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Đang xoá..." : "Xoá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
