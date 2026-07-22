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
import { useCrudCreate, useCrudDelete, useCrudList, useCrudUpdate } from "@/lib/api/admin-crud";

type Category = {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  position: number | null;
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

  // Cây danh mục đã sort cha-con để render bảng
  const tree = useMemo(() => buildTree(categories), [categories]);

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
        <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle>Quản lý danh mục</CardTitle>
            <CardDescription>CRUD categories với chọn danh mục cha bằng dropdown</CardDescription>
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
                <TableHead>Tên</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Danh mục cha</TableHead>
                <TableHead>Thứ tự</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tree.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {listQuery.isLoading ? "Đang tải..." : "Không có dữ liệu"}
                  </TableCell>
                </TableRow>
              ) : (
                tree.map((item) => {
                  const parent = item.parent_id
                    ? categories.find((c) => c.id === item.parent_id)
                    : null;
                  return (
                    <TableRow key={item.id}>
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
                        {item.slug ?? "-"}
                      </TableCell>
                      <TableCell>{parent?.name ?? "-"}</TableCell>
                      <TableCell>{item.position ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(item)}>Sửa</Button>
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
