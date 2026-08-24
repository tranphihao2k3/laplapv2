"use client";

import { useMemo, useState } from "react";
import { CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ActiveBadge,
  DateCell,
  IdCell,
  RowActions,
  RowIndexCell,
} from "@/components/admin/table-cells";
import { useCrudBulkDelete, useCrudCreate, useCrudDelete, useCrudList, useCrudUpdate } from "@/lib/api/admin-crud";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";

type Category = {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  position: number | null;
  created_at?: string | null;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function uniqueSlug(base: string, existing: string[]) {
  if (!base) return "";
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

type CategoryNode = Category & { depth: number };

/**
 * Sắp xếp danh mục thành dạng cây: cha → con → cháu...
 * Trong cùng cấp sort theo position rồi đến name.
 * Trả về list phẳng kèm `depth` để render thụt lề.
 */
function buildTree(items: Category[]): CategoryNode[] {
  const sortFn = (a: Category, b: Category) => {
    const pa = a.position ?? 0;
    const pb = b.position ?? 0;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name, "vi");
  };

  // group children theo parent_id
  const byParent = new Map<string | null, Category[]>();
  for (const c of items) {
    const key = c.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const arr of byParent.values()) arr.sort(sortFn);

  const validIds = new Set(items.map((c) => c.id));
  const out: CategoryNode[] = [];
  const visited = new Set<string>();

  const walk = (parentId: string | null, depth: number) => {
    const children = byParent.get(parentId) ?? [];
    for (const c of children) {
      if (visited.has(c.id)) continue;
      visited.add(c.id);
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);

  // Mục có parent_id trỏ tới id không tồn tại (mồ côi) → đưa về root
  for (const c of items) {
    if (visited.has(c.id)) continue;
    if (c.parent_id && !validIds.has(c.parent_id)) {
      visited.add(c.id);
      out.push({ ...c, depth: 0 });
      walk(c.id, 1);
    }
  }
  return out;
}

/** Lấy danh sách hậu duệ của một node (bao gồm chính nó) để loại khỏi dropdown chọn cha. */
function getDescendantIds(rootId: string, items: Category[]): Set<string> {
  const out = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of items) {
      if (c.parent_id && out.has(c.parent_id) && !out.has(c.id)) {
        out.add(c.id);
        changed = true;
      }
    }
  }
  return out;
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

export default function CategoriesAdminPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState("");
  const [position, setPosition] = useState(0);

  const listQuery = useCrudList<Category>("categories", { search, page: 1, pageSize: 100 });
  const categories = listQuery.data?.items ?? [];

  const createMutation = useCrudCreate<Category, Record<string, unknown>>("categories");
  const updateMutation = useCrudUpdate<Category, Record<string, unknown>>("categories");
  const deleteMutation = useCrudDelete("categories");
  const bulkDeleteMutation = useCrudBulkDelete("categories");
  const selection = useBulkSelection();

  // Cây danh mục đã sort cha-con để render bảng
  const tree = useMemo(() => buildTree(categories), [categories]);

  const pageIds = useMemo(() => tree.map((t) => t.id), [tree]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selection.isSelected(id));
  const someOnPageSelected = pageIds.some((id: string) => selection.isSelected(id));

  const stats = useMemo(() => {
    const rootCount = tree.filter((t) => t.depth === 0).length;
    const childCount = tree.filter((t) => t.depth > 0).length;
    return { total: tree.length, root: rootCount, child: childCount };
  }, [tree]);

  async function handleBulkDelete() {
    const ids = selection.array;
    if (ids.length === 0) return;
    try {
      const result = await bulkDeleteMutation.mutateAsync(ids);
      const deletedCount = result.deleted?.length ?? 0;
      const missingCount = result.missing?.length ?? 0;
      if (deletedCount === 0) {
        toast.error("Không xoá được bản ghi nào (có thể do khoá ngoại)");
      } else if (missingCount > 0) {
        toast.warning(`Đã xoá ${deletedCount}, bỏ qua ${missingCount} không tồn tại`);
      } else {
        toast.success(`Đã xoá ${deletedCount} danh mục`);
      }
      selection.clear();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  // Dropdown chọn cha: hiển thị theo cây + loại bỏ chính nó và toàn bộ hậu duệ (tránh chu trình)
  const parentOptions = useMemo(() => {
    if (!editing) return tree;
    const excluded = getDescendantIds(editing.id, categories);
    return tree.filter((n) => !excluded.has(n.id));
  }, [tree, categories, editing]);

  function resetForm() {
    setEditing(null);
    setName("");
    setSlug("");
    setSlugTouched(false);
    setParentId("");
    setPosition(0);
  }

  function startCreate() {
    resetForm();
    setOpen(true);
  }

  function startEdit(item: Category) {
    setEditing(item);
    setName(item.name ?? "");
    setSlug(item.slug ?? "");
    // Khi edit, coi như slug đã có người chỉnh — không tự ghi đè theo tên nữa.
    setSlugTouched(true);
    setParentId(item.parent_id ?? "");
    setPosition(item.position ?? 0);
    setOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên danh mục");
      return;
    }

    const payload = {
      name: name.trim(),
      slug: slug.trim() || null,
      parent_id: parentId || null,
      position: Number(position) || 0,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: payload });
        toast.success("Đã cập nhật danh mục");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo danh mục");
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
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Quản lý danh mục</CardTitle>
              <CardDescription>
                Cấu trúc cây cha-con, sort theo thứ tự và tên. Slug tự sinh từ tên.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên / slug..."
                className="w-full sm:w-56"
              />
              <Button onClick={startCreate} className="w-full sm:w-auto">
                Thêm mới
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-lg border bg-card px-3 py-2 flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Tổng danh mục</span>
              <span className="text-lg font-bold leading-tight tabular-nums">{stats.total}</span>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Gốc</span>
              <span className="text-lg font-bold leading-tight tabular-nums">{stats.root}</span>
            </div>
            <div className="rounded-lg border bg-card px-3 py-2 flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Con / Cháu</span>
              <span className="text-lg font-bold leading-tight tabular-nums text-muted-foreground">{stats.child}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <BulkActionsToolbar
            count={selection.count}
            entityLabel="danh mục"
            onClear={selection.clear}
            onRequestDelete={() => {
              if (window.confirm(`Xoá ${selection.count} danh mục đã chọn? Hành động không thể hoàn tác.`)) {
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
                <TableHead className="min-w-[240px]">Tên</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Danh mục cha</TableHead>
                <TableHead className="text-right">Thứ tự</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead className="hidden md:table-cell">Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tree.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {listQuery.isLoading ? "Đang tải..." : "Không có dữ liệu"}
                  </TableCell>
                </TableRow>
              ) : (
                tree.map((item, idx) => {
                  const parent = item.parent_id
                    ? categories.find((c) => c.id === item.parent_id)
                    : null;
                  const checked = selection.isSelected(item.id);
                  return (
                    <TableRow key={item.id} data-state={checked ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => selection.toggle(item.id)}
                          aria-label={`Chọn ${item.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <RowIndexCell index={idx + 1} />
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex items-center gap-1.5"
                          style={{ paddingLeft: item.depth * 20 }}
                        >
                          {item.depth > 0 && (
                            <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span
                            className={
                              item.depth === 0
                                ? "font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.slug ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {parent ? (
                          <span className="text-muted-foreground">{parent.name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.position ?? 0}
                      </TableCell>
                      <TableCell>
                        <IdCell id={item.id} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <DateCell value={item.created_at} />
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          onEdit={() => startEdit(item)}
                          onDelete={async () => {
                            if (!window.confirm(`Xoá danh mục "${item.name}"?`)) return;
                            try {
                              await deleteMutation.mutateAsync(item.id);
                              toast.success("Đã xoá");
                            } catch (error) {
                              toast.error(getErrorMessage(error));
                            }
                          }}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Cập nhật danh mục" : "Tạo danh mục"}</DialogTitle>
            <DialogDescription>Những field liên kết đều dùng select, không nhập tay ID.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Tên danh mục</Label>
              <Input
                value={name}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setName(nextName);
                  if (!slugTouched) {
                    const base = slugify(nextName);
                    const others = categories
                      .filter((c) => c.id !== editing?.id)
                      .map((c) => c.slug ?? "")
                      .filter(Boolean);
                    setSlug(uniqueSlug(base, others));
                  }
                }}
                placeholder="Laptop"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slug</Label>
                <div className="flex gap-2">
                  <Input
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                    placeholder="laptop"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const base = slugify(name);
                      const others = categories
                        .filter((c) => c.id !== editing?.id)
                        .map((c) => c.slug ?? "")
                        .filter(Boolean);
                      setSlug(uniqueSlug(base, others));
                      setSlugTouched(false);
                    }}
                    title="Sinh lại slug từ tên"
                  >
                    Tự sinh
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tự động sinh từ tên. Bấm &quot;Tự sinh&quot; để tạo lại sau khi đổi tên.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Thứ tự</Label>
                <Input type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Danh mục cha</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn danh mục cha (nếu có)" />
                </SelectTrigger>
                <SelectContent>
                  {parentOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <span style={{ paddingLeft: item.depth * 12 }}>
                        {item.depth > 0 ? "↳ " : ""}
                        {item.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
