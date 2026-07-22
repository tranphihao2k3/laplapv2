"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Edit, Trash2, Wrench, Star } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCrudList,
  useCrudCreate,
  useCrudUpdate,
  useCrudDelete,
} from "@/lib/api/admin-crud";
import type { RepairServiceRow, RepairServicePriceType } from "@/types/database";
import {
  REPAIR_SERVICE_CATEGORIES,
  PRICE_TYPE_OPTIONS,
  formatServicePrice,
} from "@/lib/repair-services";

type FormData = {
  category: string;
  name: string;
  description: string;
  price_type: RepairServicePriceType;
  price_min: string;
  price_max: string;
  unit: string;
  warranty_text: string;
  position: string;
  is_active: boolean;
  is_featured: boolean;
};

const emptyForm: FormData = {
  category: REPAIR_SERVICE_CATEGORIES[0].slug,
  name: "",
  description: "",
  price_type: "from",
  price_min: "",
  price_max: "",
  unit: "",
  warranty_text: "",
  position: "0",
  is_active: true,
  is_featured: false,
};

function groupDigits(s: string) {
  const d = s.replace(/\D/g, "");
  return d ? Number(d).toLocaleString("vi-VN") : "";
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const payload = error as { error?: { message?: string } };
    if (payload.error?.message) return payload.error.message;
  }
  return "Có lỗi xảy ra";
}

export default function RepairServicesAdminPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RepairServiceRow | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const listQuery = useCrudList<RepairServiceRow>("repair-services", {
    search,
    page: 1,
    pageSize: 200,
  });
  const services = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  const createMutation = useCrudCreate<RepairServiceRow, Record<string, unknown>>("repair-services");
  const updateMutation = useCrudUpdate<RepairServiceRow, Record<string, unknown>>("repair-services");
  const deleteMutation = useCrudDelete("repair-services");

  // Gom dịch vụ theo nhóm, giữ thứ tự nhóm cố định.
  const grouped = useMemo(() => {
    return REPAIR_SERVICE_CATEGORIES.map((cat) => ({
      ...cat,
      items: services
        .filter((s) => s.category === cat.slug)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, "vi")),
    }));
  }, [services]);

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(s: RepairServiceRow) {
    setEditing(s);
    setForm({
      category: s.category,
      name: s.name,
      description: s.description ?? "",
      price_type: s.price_type,
      price_min: s.price_min != null ? String(s.price_min) : "",
      price_max: s.price_max != null ? String(s.price_max) : "",
      unit: s.unit ?? "",
      warranty_text: s.warranty_text ?? "",
      position: String(s.position ?? 0),
      is_active: s.is_active,
      is_featured: s.is_featured,
    });
    setDialogOpen(true);
  }

  function buildPayload(): Record<string, unknown> {
    const min = form.price_min.replace(/\D/g, "");
    const max = form.price_max.replace(/\D/g, "");
    const needsMin = form.price_type !== "contact";
    const needsMax = form.price_type === "range";
    return {
      category: form.category,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_type: form.price_type,
      price_min: needsMin && min ? Number(min) : null,
      price_max: needsMax && max ? Number(max) : null,
      unit: form.unit.trim() || null,
      warranty_text: form.warranty_text.trim() || null,
      position: Number(form.position.replace(/\D/g, "")) || 0,
      is_active: form.is_active,
      is_featured: form.is_featured,
    };
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên dịch vụ");
      return;
    }
    if (form.price_type !== "contact" && !form.price_min.replace(/\D/g, "")) {
      toast.error("Vui lòng nhập giá (hoặc chọn kiểu Liên hệ)");
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: buildPayload() });
        toast.success("Đã cập nhật dịch vụ");
      } else {
        await createMutation.mutateAsync(buildPayload());
        toast.success("Đã thêm dịch vụ mới");
      }
      setDialogOpen(false);
      setForm(emptyForm);
      setEditing(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success("Đã xoá dịch vụ");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  const isLoading = listQuery.isLoading;
  const total = services.length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Dịch vụ sửa chữa
            </CardTitle>
            <CardDescription>
              Bảng giá các hạng mục sửa chữa laptop — hiển thị công khai ở trang{" "}
              <code className="rounded bg-muted px-1 text-xs">/dich-vu-sua-chua</code>. Tổng {total} dịch vụ.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm dịch vụ..."
                className="w-full pl-8"
              />
            </div>
            <Button onClick={openCreate} className="w-full sm:w-auto">
              <Plus className="mr-1.5 size-4" />
              Thêm dịch vụ
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Đang tải...</CardContent>
        </Card>
      ) : total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {search ? "Không tìm thấy dịch vụ phù hợp." : "Chưa có dịch vụ nào. Bấm \"Thêm dịch vụ\" để bắt đầu."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {grouped
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <Card key={g.slug} className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30 py-3">
                  <CardTitle className="text-base">{g.label}</CardTitle>
                  <CardDescription className="text-xs">{g.blurb}</CardDescription>
                </CardHeader>
                <CardContent className="divide-y p-0">
                  {g.items.map((s) => (
                    <div
                      key={s.id}
                      className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {s.is_featured && (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                          )}
                          <span className="truncate text-sm font-medium">{s.name}</span>
                          {!s.is_active && (
                            <span className="shrink-0 whitespace-nowrap rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                              Ẩn
                            </span>
                          )}
                        </div>
                        {s.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.description}</p>
                        )}
                        {s.warranty_text && (
                          <p className="mt-0.5 text-[11px] text-emerald-600">{s.warranty_text}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="whitespace-nowrap text-sm font-semibold text-primary">
                          {formatServicePrice(s)}
                        </div>
                        <div className="mt-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingId(s.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Dialog thêm / sửa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Cập nhật dịch vụ" : "Thêm dịch vụ mới"}</DialogTitle>
            <DialogDescription>Hạng mục sửa chữa và cách hiển thị giá.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nhóm dịch vụ</Label>
                <Select value={form.category} onValueChange={(v) => setField("category", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPAIR_SERVICE_CATEGORIES.map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Thứ tự</Label>
                <Input
                  inputMode="numeric"
                  value={form.position}
                  onChange={(e) => setField("position", e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Tên dịch vụ <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="VD: Thay pin laptop"
              />
            </div>

            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Mô tả ngắn (tuỳ chọn) — tốt cho SEO"
              />
            </div>

            <div className="space-y-2">
              <Label>Kiểu giá</Label>
              <Select
                value={form.price_type}
                onValueChange={(v) => setField("price_type", v as RepairServicePriceType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.price_type !== "contact" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{form.price_type === "range" ? "Giá tối thiểu" : "Giá"}</Label>
                  <div className="relative">
                    <Input
                      inputMode="numeric"
                      className="pr-8 text-right"
                      value={groupDigits(form.price_min)}
                      onChange={(e) => setField("price_min", e.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      đ
                    </span>
                  </div>
                </div>
                {form.price_type === "range" && (
                  <div className="space-y-2">
                    <Label>Giá tối đa</Label>
                    <div className="relative">
                      <Input
                        inputMode="numeric"
                        className="pr-8 text-right"
                        value={groupDigits(form.price_max)}
                        onChange={(e) => setField("price_max", e.target.value.replace(/\D/g, ""))}
                        placeholder="0"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        đ
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Đơn vị (tuỳ chọn)</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setField("unit", e.target.value)}
                  placeholder="/ lần, / máy..."
                />
              </div>
              <div className="space-y-2">
                <Label>Bảo hành (tuỳ chọn)</Label>
                <Input
                  value={form.warranty_text}
                  onChange={(e) => setField("warranty_text", e.target.value)}
                  placeholder="VD: BH 6 tháng"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 rounded-md border bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.is_active} onCheckedChange={(v) => setField("is_active", v)} />
                Hiển thị
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.is_featured} onCheckedChange={(v) => setField("is_featured", v)} />
                Nổi bật
              </label>
              {/* Xem trước giá */}
              <div className="ml-auto self-center text-sm">
                <span className="text-muted-foreground">Xem trước: </span>
                <span className="font-semibold text-primary">
                  {formatServicePrice({
                    price_type: form.price_type,
                    price_min: form.price_min ? Number(form.price_min.replace(/\D/g, "")) : null,
                    price_max: form.price_max ? Number(form.price_max.replace(/\D/g, "")) : null,
                    unit: form.unit.trim() || null,
                  })}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
                setForm(emptyForm);
              }}
            >
              Huỷ
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? "Đang lưu..."
                : editing
                  ? "Lưu thay đổi"
                  : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog xoá */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xoá dịch vụ này? Hành động này không thể hoàn tác.
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
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Đang xoá..." : "Xoá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
