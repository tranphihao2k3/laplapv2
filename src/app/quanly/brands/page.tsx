"use client";

import { useState, useMemo } from "react";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
} from "@/lib/api/admin-crud";

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Logo</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead>Trang chủ</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : brands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {search ? "Không tìm thấy kết quả" : "Chưa có thương hiệu nào"}
                  </TableCell>
                </TableRow>
              ) : (
                brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {brand.slug ?? "-"}
                    </TableCell>
                    <TableCell>
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.name}
                          className="h-8 w-8 rounded object-contain"
                        />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {truncate(brand.description, 60)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {brand.created_at
                        ? new Date(brand.created_at).toLocaleDateString("vi-VN")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {brand.show_on_homepage ? "Có" : "Không"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(brand)}
                        >
                          <Edit className="mr-1 size-3.5" />
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openDelete(brand.id)}
                        >
                          <Trash2 className="mr-1 size-3.5" />
                          Xoá
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
