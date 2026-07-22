"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCrudCreate, useCrudDelete, useCrudList, useCrudUpdate } from "@/lib/api/admin-crud";
import { buildCategoryTree } from "@/lib/category-tree";

type Category = { id: string; name: string; parent_id: string | null; position?: number | null };

type FieldType = "text" | "number" | "boolean" | "select";
type SpecField = { key: string; label: string; type: FieldType; options?: string[] };

type SpecTemplate = { id: string; name: string; category_id: string | null; fields: unknown };

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "text", label: "Chữ (text)" },
  { value: "number", label: "Số (number)" },
  { value: "boolean", label: "Có/Không" },
  { value: "select", label: "Chọn từ danh sách" },
];

function slugifyKey(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeFields(raw: unknown): SpecField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const obj = r as Record<string, unknown>;
      const key = typeof obj.key === "string" ? obj.key : "";
      const label = typeof obj.label === "string" ? obj.label : key;
      const t = typeof obj.type === "string" ? obj.type : "text";
      const type: FieldType = (["text", "number", "boolean", "select"] as const).includes(t as FieldType)
        ? (t as FieldType)
        : "text";
      const options = Array.isArray(obj.options) ? obj.options.filter((o) => typeof o === "string") : undefined;
      if (!key) return null;
      return { key, label, type, options } as SpecField;
    })
    .filter((x): x is SpecField => x !== null);
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const payload = error as { error?: { message?: string; fields?: Record<string, string[] | undefined>; requestId?: string } };
    const msg = payload.error?.message;
    const fieldMsg = Object.values(payload.error?.fields ?? {}).flat().filter(Boolean).join(" · ");
    const requestId = payload.error?.requestId;
    if (msg || fieldMsg || requestId) {
      return [msg, fieldMsg, requestId ? `requestId=${requestId}` : ""].filter(Boolean).join(" | ");
    }
  }
  return "Có lỗi xảy ra";
}

export default function SpecTemplatesAdminPage() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [fields, setFields] = useState<SpecField[]>([{ key: "ram", label: "RAM", type: "text" }]);

  function addField() {
    setFields((prev) => [...prev, { key: "", label: "", type: "text" }]);
  }
  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }
  function moveField(idx: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }
  function updateField(idx: number, patch: Partial<SpecField>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  const templatesQuery = useCrudList<SpecTemplate>("spec-templates", { search, page: 1, pageSize: 50 });
  const categoriesQuery = useCrudList<Category>("categories", { page: 1, pageSize: 100 });

  const createMutation = useCrudCreate<SpecTemplate, Record<string, unknown>>("spec-templates");
  const updateMutation = useCrudUpdate<SpecTemplate, Record<string, unknown>>("spec-templates");
  const deleteMutation = useCrudDelete("spec-templates");

  const templates = templatesQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.items ?? [];

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  // Cây danh mục để render dropdown thụt lề cha-con
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Đếm số con cháu của 1 category (để hiển thị badge "+ N danh mục con")
  const descendantCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categories) {
      let cur = c.parent_id;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        map.set(cur, (map.get(cur) ?? 0) + 1);
        const parent = categories.find((p) => p.id === cur);
        cur = parent?.parent_id ?? null;
      }
    }
    return map;
  }, [categories]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCategoryId("");
    setFields([{ key: "ram", label: "RAM", type: "text" }]);
  }

  function startCreate() {
    resetForm();
    setOpen(true);
  }

  function startEdit(item: SpecTemplate) {
    setEditingId(item.id);
    setName(item.name ?? "");
    setCategoryId(item.category_id ?? "");
    setFields(normalizeFields(item.fields));
    setOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên mẫu");
      return;
    }

    // Lọc field rỗng, validate key trùng
    const cleaned = fields
      .map((f) => ({ ...f, key: f.key.trim(), label: f.label.trim() }))
      .filter((f) => f.key);

    const keys = cleaned.map((f) => f.key);
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dup) {
      toast.error(`Trường "${dup}" bị trùng key`);
      return;
    }

    for (const f of cleaned) {
      if (f.type === "select" && (!f.options || f.options.length === 0)) {
        toast.error(`Trường "${f.label || f.key}" cần ít nhất 1 lựa chọn`);
        return;
      }
    }

    const payload = {
      name: name.trim(),
      category_id: categoryId || null,
      fields: cleaned,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: payload });
        toast.success("Đã cập nhật Spec Template");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo Spec Template");
      }
      setOpen(false);
      resetForm();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle>Quản lý Spec Templates</CardTitle>
            <CardDescription>Mẫu thông số kỹ thuật theo loại sản phẩm</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm..." className="w-full sm:w-56" />
            <Button onClick={startCreate} className="w-full sm:w-auto">Thêm mới</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên mẫu</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {templatesQuery.isLoading ? "Đang tải..." : "Không có dữ liệu"}
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((item) => {
                  const childCount = item.category_id ? descendantCount.get(item.category_id) ?? 0 : 0;
                  return (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      {item.category_id ? (
                        <div className="flex items-center gap-2">
                          <span>{categoryNameById.get(item.category_id) ?? item.category_id}</span>
                          {childCount > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              + {childCount} danh mục con
                            </Badge>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[420px] truncate font-mono text-xs">{JSON.stringify(item.fields ?? [])}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            try {
                              await deleteMutation.mutateAsync(item.id);
                              toast.success("Đã xoá");
                            } catch (error) {
                              toast.error(getErrorMessage(error));
                            }
                          }}
                        >
                          Xoá
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Cập nhật Spec Template" : "Tạo Spec Template"}</DialogTitle>
            <DialogDescription>Chọn category bằng dropdown, không cần nhập Category ID tay.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Tên mẫu</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Laptop standard" />
            </div>
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn category..." />
                </SelectTrigger>
                <SelectContent>
                  {categoryTree.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span style={{ paddingLeft: c.depth * 12 }}>
                        {c.depth > 0 ? "↳ " : ""}
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Chọn danh mục cha sẽ <strong className="text-foreground">tự áp dụng cho mọi danh mục con</strong>.
                Ví dụ: chọn &quot;Laptop&quot; → áp dụng luôn cho &quot;Laptop Gaming&quot;, &quot;Laptop Văn phòng&quot;, ...
                {categoryId && (descendantCount.get(categoryId) ?? 0) > 0 && (
                  <>
                    {" "}Mẫu này hiện sẽ áp dụng cho{" "}
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      + {descendantCount.get(categoryId)} danh mục con
                    </Badge>
                    .
                  </>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Các trường thông số kỹ thuật</Label>
                <Button type="button" size="sm" variant="outline" onClick={addField}>
                  <Plus className="size-3.5" />
                  Thêm trường
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mỗi dòng là một thông số sẽ xuất hiện khi tạo sản phẩm thuộc danh mục này.
                <br />
                <strong className="text-foreground">Key</strong>: mã không dấu (vd: <code>cpu</code>, <code>ram</code>). •{" "}
                <strong className="text-foreground">Nhãn</strong>: tên hiển thị cho người dùng. •{" "}
                <strong className="text-foreground">Kiểu</strong>: loại dữ liệu nhập vào.
              </p>

              {fields.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Chưa có trường nào. Bấm &quot;Thêm trường&quot; để bắt đầu.
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((f, idx) => (
                    <div key={idx} className="rounded-md border p-3 space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Nhãn hiển thị</Label>
                          <Input
                            value={f.label}
                            placeholder="CPU"
                            onChange={(e) => {
                              const label = e.target.value;
                              // Nếu key chưa được tự nhập, gợi ý từ label
                              const shouldSyncKey =
                                !f.key || f.key === slugifyKey(f.label);
                              updateField(idx, {
                                label,
                                key: shouldSyncKey ? slugifyKey(label) : f.key,
                              });
                            }}
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Key</Label>
                          <Input
                            value={f.key}
                            placeholder="cpu"
                            className="font-mono text-xs"
                            onChange={(e) =>
                              updateField(idx, { key: slugifyKey(e.target.value) })
                            }
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Kiểu</Label>
                          <Select
                            value={f.type}
                            onValueChange={(v) =>
                              updateField(idx, {
                                type: v as FieldType,
                                options: v === "select" ? f.options ?? [] : undefined,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3 flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={idx === 0}
                            onClick={() => moveField(idx, -1)}
                            title="Lên"
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={idx === fields.length - 1}
                            onClick={() => moveField(idx, 1)}
                            title="Xuống"
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeField(idx)}
                            title="Xoá"
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {f.type === "select" && (
                        <div className="space-y-1">
                          <Label className="text-xs">Lựa chọn (mỗi dòng 1 giá trị)</Label>
                          <textarea
                            value={(f.options ?? []).join("\n")}
                            placeholder={"8GB\n16GB\n32GB"}
                            onChange={(e) =>
                              updateField(idx, {
                                options: e.target.value
                                  .split("\n")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
