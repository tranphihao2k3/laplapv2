"use client";

/**
 * Bảng quản lý pc_components_specs — spec kỹ thuật của từng linh kiện PC.
 *
 * Mỗi dòng trong bảng là 1 product kèm spec hiện có (nếu có). Click "Sửa spec"
 * mở Dialog form với các field:
 *   - socket (CPU / mainboard)
 *   - ram_type (mainboard / RAM)
 *   - form_factor (mainboard / case / cooler)
 *   - tdp_w (CPU / GPU)
 *   - length_mm (GPU)
 *   - wattage_w (PSU)
 *   - storage_interface (SSD / HDD)
 *   - extras (JSON textarea)
 *
 * Lưu: upsert vào pc_components_specs (product_id là PK → không cần id).
 * - Server component fetch initial: products join categories (slug ∈ list pc) + specs join
 * - Client dùng useQuery với filter/search để refetch khi cần.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  parseExtras,
  stringifyExtras,
  type PcComponentsSpecRow,
} from "./helpers";

const PC_CATEGORY_SLUGS = [
  "cpu",
  "mainboard",
  "ram",
  "gpu",
  "ssd",
  "hdd",
  "psu",
  "case",
  "cooler",
  "monitor",
  "keyboard",
  "mouse",
  "headset",
];

const CATEGORY_LABELS: Record<string, string> = {
  cpu: "CPU",
  mainboard: "Bo mạch chủ",
  ram: "RAM",
  gpu: "VGA / GPU",
  ssd: "SSD",
  hdd: "HDD",
  psu: "Nguồn",
  case: "Vỏ case",
  cooler: "Tản nhiệt",
  monitor: "Màn hình",
  keyboard: "Bàn phím",
  mouse: "Chuột",
  headset: "Tai nghe",
};

type ProductLite = {
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
  thumbnail_url: string | null;
  category_id: string | null;
  category: { id: string; name: string; slug: string } | null;
};

type ProductWithSpec = ProductLite & {
  spec: PcComponentsSpecRow | null;
};

type InitialPayload = {
  products: ProductWithSpec[];
  categories: Array<{ id: string; name: string; slug: string }>;
};

type Filters = {
  search: string;
  category: string;
};

function buildQueryKey(filters: Filters) {
  return ["admin-pc-specs", filters.search, filters.category] as const;
}

/**
 * Client refetch: lấy tất cả products thuộc danh mục PC + specs hiện có.
 * Query này đắt nhưng dữ liệu PC parts thường ít (vài chục đến vài trăm) — chấp nhận được.
 */
async function fetchSpecRows(filters: Filters): Promise<ProductWithSpec[]> {
  const supabase = createClient();

  // Lấy tất cả products có category slug thuộc PC group
  let query = supabase
    .from("products")
    .select("id, name, slug, status, thumbnail_url, category_id, category:categories!inner(id, name, slug)")
    .in("category.slug", PC_CATEGORY_SLUGS)
    .order("name", { ascending: true })
    .limit(500);

  if (filters.category !== "__all__") {
    query = query.eq("category.slug", filters.category);
  }
  if (filters.search.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, (m) => `\\${m}`);
    query = query.ilike("name", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const products = (data ?? []) as unknown as ProductWithSpec[];

  // Lấy specs của các products này (1 query thay vì N+1)
  const productIds = products.map((p) => p.id);
  const specsByProduct = new Map<string, PcComponentsSpecRow>();
  if (productIds.length > 0) {
    const { data: specRows, error: specErr } = await supabase
      .from("pc_components_specs")
      .select("*")
      .in("product_id", productIds);
    if (specErr) throw new Error(specErr.message);
    for (const s of (specRows ?? []) as PcComponentsSpecRow[]) {
      specsByProduct.set(s.product_id, s);
    }
  }

  return products.map((p) => ({ ...p, spec: specsByProduct.get(p.id) ?? null }));
}

/** Form state cho dialog sửa spec — dùng string cho số để tiện validation rỗng. */
type SpecFormState = {
  socket: string;
  ram_type: string;
  form_factor: string;
  tdp_w: string;
  length_mm: string;
  wattage_w: string;
  storage_interface: string;
  extras: string;
};

const emptyForm: SpecFormState = {
  socket: "",
  ram_type: "",
  form_factor: "",
  tdp_w: "",
  length_mm: "",
  wattage_w: "",
  storage_interface: "",
  extras: "",
};

function formFromSpec(spec: PcComponentsSpecRow | null): SpecFormState {
  if (!spec) return emptyForm;
  return {
    socket: spec.socket ?? "",
    ram_type: spec.ram_type ?? "",
    form_factor: spec.form_factor ?? "",
    tdp_w: spec.tdp_w != null ? String(spec.tdp_w) : "",
    length_mm: spec.length_mm != null ? String(spec.length_mm) : "",
    wattage_w: spec.wattage_w != null ? String(spec.wattage_w) : "",
    storage_interface: spec.storage_interface ?? "",
    extras: stringifyExtras(parseExtras(spec.extras)),
  };
}

export function SpecEditor({ initialData }: { initialData: InitialPayload }) {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("__all__");
  const [editing, setEditing] = useState<ProductWithSpec | null>(null);
  const [form, setForm] = useState<SpecFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const filters: Filters = { search, category };

  const query = useQuery({
    queryKey: buildQueryKey(filters),
    queryFn: () => fetchSpecRows(filters),
    initialData: !search.trim() && category === "__all__" ? initialData.products : undefined,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const rows = query.data ?? initialData.products;

  const stats = useMemo(() => {
    const total = rows.length;
    const withSpec = rows.filter((r) => r.spec).length;
    return { total, withSpec, missing: total - withSpec };
  }, [rows]);

  function openEdit(row: ProductWithSpec) {
    setEditing(row);
    setForm(formFromSpec(row.spec));
  }

  function closeEdit() {
    setEditing(null);
    setForm(emptyForm);
  }

  function setField<K extends keyof SpecFormState>(key: K, value: SpecFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!editing) return;
    const categorySlug = editing.category?.slug;
    if (!categorySlug || !PC_CATEGORY_SLUGS.includes(categorySlug)) {
      toast.error("Sản phẩm phải thuộc nhóm linh kiện PC");
      return;
    }

    // Validate JSON extras
    let parsedExtras: Record<string, unknown> | null = null;
    if (form.extras.trim()) {
      try {
        const parsed = JSON.parse(form.extras);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          toast.error("Extras phải là object JSON");
          return;
        }
        parsedExtras = parsed as Record<string, unknown>;
      } catch (e) {
        toast.error("Extras không phải JSON hợp lệ");
        return;
      }
    }

    const intOrNull = (v: string) => {
      if (!v.trim()) return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : null;
    };

    setSaving(true);
    const supabase = createClient();
    const payload = {
      product_id: editing.id,
      category_slug: categorySlug,
      socket: form.socket.trim() || null,
      ram_type: form.ram_type.trim() || null,
      form_factor: form.form_factor.trim() || null,
      tdp_w: intOrNull(form.tdp_w),
      length_mm: intOrNull(form.length_mm),
      wattage_w: intOrNull(form.wattage_w),
      storage_interface: form.storage_interface.trim() || null,
      extras: parsedExtras,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("pc_components_specs")
      .upsert(payload, { onConflict: "product_id" });

    setSaving(false);

    if (error) {
      toast.error(`Lưu thất bại: ${error.message}`);
      return;
    }
    toast.success(editing.spec ? "Đã cập nhật spec" : "Đã tạo spec mới");
    closeEdit();
    qc.invalidateQueries({ queryKey: ["admin-pc-specs"] });
  }

  function resetFilters() {
    setSearch("");
    setCategory("__all__");
  }

  const isFiltered = search.trim().length > 0 || category !== "__all__";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
            <div>
              <CardTitle>Spec linh kiện PC</CardTitle>
              <CardDescription>
                Quản lý thông số kỹ thuật cho các linh kiện trong module PC Builder
                (dùng để check tương thích khi khách dựng cấu hình).
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 rounded bg-muted">
                Tổng: <strong className="text-foreground">{stats.total}</strong>
              </span>
              <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">
                Có spec: <strong>{stats.withSpec}</strong>
              </span>
              <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">
                Thiếu: <strong>{stats.missing}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Tìm theo tên linh kiện</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="VD: Ryzen 5 5600, RTX 4060..."
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Danh mục</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả linh kiện PC</SelectItem>
                  {PC_CATEGORY_SLUGS.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {CATEGORY_LABELS[slug] ?? slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={resetFilters}
              disabled={!isFiltered}
            >
              Đặt lại
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Ảnh</TableHead>
                  <TableHead>Linh kiện</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Socket</TableHead>
                  <TableHead>RAM</TableHead>
                  <TableHead className="text-right">TDP (W)</TableHead>
                  <TableHead className="text-right">Length (mm)</TableHead>
                  <TableHead className="text-right">PSU (W)</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Không có linh kiện nào khớp bộ lọc
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const s = row.spec;
                    return (
                      <TableRow key={row.id} className={s ? "" : "bg-amber-50/40"}>
                        <TableCell>
                          {row.thumbnail_url ? (
                            <Image
                              src={row.thumbnail_url}
                              alt=""
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded object-cover border"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded border bg-muted" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm leading-tight line-clamp-2">
                            {row.name}
                          </div>
                          {row.slug && (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {row.slug}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[11px]">
                            {CATEGORY_LABELS[row.category?.slug ?? ""] ?? row.category?.slug ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{s?.socket ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{s?.ram_type ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {s?.tdp_w ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {s?.length_mm ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {s?.wattage_w ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {s?.storage_interface ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="h-7" onClick={() => openEdit(row)}>
                            <Settings2 className="h-3.5 w-3.5 mr-1" />
                            {s ? "Sửa" : "Sửa spec"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog sửa spec */}
      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Spec linh kiện — {editing?.name}</DialogTitle>
            <DialogDescription>
              {editing?.spec
                ? "Cập nhật thông số kỹ thuật cho linh kiện này."
                : "Chưa có spec — nhập thông số kỹ thuật để hỗ trợ kiểm tra tương thích."}
              <br />
              <span className="text-xs text-muted-foreground">
                Danh mục: {editing ? CATEGORY_LABELS[editing.category?.slug ?? ""] ?? "—" : ""}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Socket</Label>
              <Input
                value={form.socket}
                onChange={(e) => setField("socket", e.target.value)}
                placeholder="VD: LGA1700, AM5"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">CPU / Bo mạch chủ</p>
            </div>
            <div className="space-y-1.5">
              <Label>RAM type</Label>
              <Input
                value={form.ram_type}
                onChange={(e) => setField("ram_type", e.target.value)}
                placeholder="VD: DDR4, DDR5"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">Bo mạch chủ / RAM</p>
            </div>
            <div className="space-y-1.5">
              <Label>Form factor</Label>
              <Input
                value={form.form_factor}
                onChange={(e) => setField("form_factor", e.target.value)}
                placeholder="VD: ATX, mATX, ITX, E-ATX"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">Bo mạch chủ / Case / Tản nhiệt</p>
            </div>
            <div className="space-y-1.5">
              <Label>Storage interface</Label>
              <Input
                value={form.storage_interface}
                onChange={(e) => setField("storage_interface", e.target.value)}
                placeholder="VD: NVMe, SATA"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">SSD / HDD</p>
            </div>
            <div className="space-y-1.5">
              <Label>TDP (W)</Label>
              <Input
                type="number"
                min={0}
                value={form.tdp_w}
                onChange={(e) => setField("tdp_w", e.target.value)}
                placeholder="VD: 65, 125, 220"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">CPU / GPU</p>
            </div>
            <div className="space-y-1.5">
              <Label>Length (mm)</Label>
              <Input
                type="number"
                min={0}
                value={form.length_mm}
                onChange={(e) => setField("length_mm", e.target.value)}
                placeholder="VD: 280, 330"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                GPU: chiều dài card. Case: chiều dài tối đa hỗ trợ.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Wattage (W)</Label>
              <Input
                type="number"
                min={0}
                value={form.wattage_w}
                onChange={(e) => setField("wattage_w", e.target.value)}
                placeholder="VD: 550, 650, 850"
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">Nguồn (PSU)</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Extras (JSON)</Label>
              <Textarea
                value={form.extras}
                onChange={(e) => setField("extras", e.target.value)}
                placeholder='{"color": "black", "warranty_months": 36}'
                rows={5}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Các spec bổ sung dạng object JSON — ví dụ: màu sắc, số cổng, loại cổng, bảo hành...
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={saving}>
              Huỷ
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Đang lưu..." : editing?.spec ? "Cập nhật spec" : "Tạo spec"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}