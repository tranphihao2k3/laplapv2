"use client";

import { useState, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ActiveBadge, IdCell, RowActions, RowIndexCell } from "@/components/admin/table-cells";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCrudList,
  useCrudCreate,
  useCrudUpdate,
  useCrudDelete,
  useCrudBulkDelete,
} from "@/lib/api/admin-crud";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";

type Brand = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  description: string | null;
  show_on_homepage: boolean;
  created_at: string;
};

type FormData = {
  name: string;
  slug: string;
  logo_url: string;
  description: string;
  show_on_homepage: boolean;
};

const emptyForm: FormData = {
  name: "",
  slug: "",
  logo_url: "",
  description: "",
  show_on_homepage: false,
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D"))
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function truncate(text: string | null, max: number): string {
  if (!text) return "-";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

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

export default function BrandsAdminPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const listQuery = useCrudList<Brand>("brands", {
    search,
    page: 1,
    pageSize: 50,
  });
  const brands = listQuery.data?.items ?? [];

  const createMutation = useCrudCreate<Brand, Record<string, unknown>>("brands");
  const updateMutation = useCrudUpdate<Brand, Record<string, unknown>>("brands");
  const deleteMutation = useCrudDelete("brands");
  const bulkDeleteMutation = useCrudBulkDelete("brands");
  const selection = useBulkSelection();

  const pageIds = useMemo(() => brands.map((b: Brand) => b.id), [brands]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selection.isSelected(id));
  const someOnPageSelected = pageIds.some((id: string) => selection.isSelected(id));

  const stats = useMemo(() => {
    const onHomepage = brands.filter((b) => b.show_on_homepage).length;
    return { total: brands.length, onHomepage };
  }, [brands]);

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setSlugManuallyEdited(false);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditing(brand);
    setForm({
      name: brand.name ?? "",
      slug: brand.slug ?? "",
      logo_url: brand.logo_url ?? "",
      description: brand.description ?? "",
      show_on_homepage: brand.show_on_homepage ?? false,
    });
    setSlugManuallyEdited(true);
    setDialogOpen(true);
  }

  function openDelete(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNameChange(value: string) {
    setField("name", value);
    if (!slugManuallyEdited && !editing) {
      setField("slug", slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true);
    setField("slug", value);
  }

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      show_on_homepage: form.show_on_homepage,
    };
    if (form.slug.trim()) payload.slug = form.slug.trim();
    if (form.logo_url.trim()) payload.logo_url = form.logo_url.trim();
    if (form.description.trim()) payload.description = form.description.trim();
    return payload;
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên thương hiệu");
      return;
    }
    const payload = buildPayload();
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: payload });
        toast.success("Đã cập nhật thương hiệu");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo thương hiệu mới");
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
      toast.success("Đã xoá thương hiệu");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleBulkDelete() {
    const ids = selection.array;
    if (ids.length === 0) return;
    try {
      const result = await bulkDeleteMutation.mutateAsync(ids);
      const deletedCount = result.deleted?.length ?? 0;
      const missingCount = result.missing?.length ?? 0;
      if (deletedCount === 0) {
        toast.error("Không xoá được bản ghi nào (có thể đã bị xoá trước đó)");
      } else if (missingCount > 0) {
        toast.warning(`Đã xoá ${deletedCount}, bỏ qua ${missingCount} không tồn tại`);
      } else {
        toast.success(`Đã xoá ${deletedCount} thương hiệu`);
      }
      selection.clear();
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
            <CardTitle>Quản lý thương hiệu</CardTitle>
            <CardDescription>
              Quản lý các thương hiệu sản phẩm trong hệ thống
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên, slug..."
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
            entityLabel="thương hiệu"
            onClear={selection.clear}
            onRequestDelete={() => {
              if (window.confirm(`Xoá ${selection.count} thương hiệu đã chọn? Hành động không thể hoàn tác.`)) {
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
                <TableHead>Slug</TableHead>
                <TableHead>Logo</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Trang chủ</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead className="hidden md:table-cell">Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : brands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {search ? "Không tìm thấy kết quả" : "Chưa có thương hiệu nào"}
                  </TableCell>
                </TableRow>
              ) : (
                brands.map((brand, idx) => {
                  const checked = selection.isSelected(brand.id);
                  return (
                    <TableRow key={brand.id} data-state={checked ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => selection.toggle(brand.id)}
                          aria-label={`Chọn ${brand.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <RowIndexCell index={idx + 1} />
                      </TableCell>
                      <TableCell className="font-medium">{brand.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {brand.slug ?? "—"}
                      </TableCell>
                      <TableCell>
                        {brand.logo_url ? (
                          <img
                            src={brand.logo_url}
                            alt={brand.name}
                            className="h-8 w-8 rounded object-contain"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {truncate(brand.description, 60)}
                      </TableCell>
                      <TableCell>
                        <ActiveBadge
                          value={brand.show_on_homepage}
                          trueLabel="Hiển thị"
                          falseLabel="Ẩn"
                        />
                      </TableCell>
                      <TableCell>
                        <IdCell id={brand.id} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <DateInline value={brand.created_at} />
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          onEdit={() => openEdit(brand)}
                          onDelete={() => openDelete(brand.id)}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Cập nhật thương hiệu" : "Thêm thương hiệu mới"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Chỉnh sửa thông tin thương hiệu"
                : "Nhập thông tin thương hiệu mới"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">
                Tên thương hiệu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brand-name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ví dụ: LapLap"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-slug">Slug</Label>
              <Input
                id="brand-slug"
                value={form.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="Ví dụ: laplap"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-logo">Logo URL</Label>
              <Input
                id="brand-logo"
                value={form.logo_url}
                onChange={(e) => setField("logo_url", e.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-desc">Mô tả</Label>
              <Textarea
                id="brand-desc"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Mô tả về thương hiệu..."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <Switch
                id="brand-show-homepage"
                checked={form.show_on_homepage}
                onCheckedChange={(checked) => setField("show_on_homepage", checked)}
              />
              <div>
                <Label htmlFor="brand-show-homepage" className="mb-1 block text-sm font-semibold">
                  Hiển thị trên trang chủ
                </Label>
                <p className="text-xs text-slate-500">
                  Bật để thương hiệu này hiển thị ở section thương hiệu trang chủ.
                </p>
              </div>
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
              Bạn có chắc chắn muốn xoá thương hiệu này? Hành động này không thể hoàn tác.
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

function DateInline({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const d = new Date(value);
  if (isNaN(d.getTime())) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {d.toLocaleDateString("vi-VN")}
    </span>
  );
}
