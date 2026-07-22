"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCrudCreate, useCrudDelete, useCrudList, useCrudUpdate } from "@/lib/api/admin-crud";

type ProductRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  thumbnail_url?: string | null;
  brand_id?: string | null;
  category_id?: string | null;
};
type VariantRow = Record<string, unknown>;
type StockRow = { warehouse_id: string; product_variant_id: string; available_qty: number | null };
type CategoryRow = { id: string; name: string };
type BrandRow = { id: string; name: string };

type VariantForm = {
  product_id: string;
  sku: string;
  barcode: string;
  name: string;
  cost_price: string;
  selling_price: string;
  weight: string;
  is_active: string;
};

type KeyValueItem = { key: string; value: string };

const EMPTY_FORM: VariantForm = {
  product_id: "",
  sku: "",
  barcode: "",
  name: "",
  cost_price: "0",
  selling_price: "0",
  weight: "",
  is_active: "true",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeSku(product?: ProductRow) {
  const base = product?.slug || slugify(product?.name || "sp");
  const suffix = Date.now().toString().slice(-6);
  return `${base.toUpperCase()}-${suffix}`;
}

function toInputString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ProductVariantsAdminPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [skuTouched, setSkuTouched] = useState(false);
  const [form, setForm] = useState<VariantForm>(EMPTY_FORM);
  const [attrs, setAttrs] = useState<KeyValueItem[]>([{ key: "", value: "" }]);
  const [specs, setSpecs] = useState<KeyValueItem[]>([{ key: "", value: "" }]);

  const list = useCrudList<VariantRow>("product-variants", { search, page: 1, pageSize: 50 });
  const products = useCrudList<ProductRow>("products", { page: 1, pageSize: 500 });
  const stocks = useCrudList<StockRow>("stock-levels", { page: 1, pageSize: 1000 });
  const categories = useCrudList<CategoryRow>("categories", { page: 1, pageSize: 200 });
  const brands = useCrudList<BrandRow>("brands", { page: 1, pageSize: 200 });
  const createMutation = useCrudCreate<VariantRow, Record<string, unknown>>("product-variants");
  const updateMutation = useCrudUpdate<VariantRow, Record<string, unknown>>("product-variants");
  const deleteMutation = useCrudDelete("product-variants");

  const productOptions = useMemo(() => products.data?.items ?? [], [products.data?.items]);
  const productMap = useMemo(() => new Map(productOptions.map((p) => [p.id, p])), [productOptions]);
  const categoryMap = useMemo(() => new Map((categories.data?.items ?? []).map((c) => [c.id, c.name])), [categories.data?.items]);
  const brandMap = useMemo(() => new Map((brands.data?.items ?? []).map((b) => [b.id, b.name])), [brands.data?.items]);
  const stockByVariant = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stocks.data?.items ?? []) {
      const qty = Number(s.available_qty ?? 0);
      map.set(s.product_variant_id, (map.get(s.product_variant_id) ?? 0) + qty);
    }
    return map;
  }, [stocks.data?.items]);
  const rows = list.data?.items ?? [];

  function formatVND(n: unknown) {
    const num = Number(n ?? 0);
    if (!num) return "—";
    return `${num.toLocaleString("vi-VN")}₫`;
  }

  function recordToEntries(value: unknown): Array<[string, string]> {
    if (!value || typeof value !== "object") return [];
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(([k, v]) => [k, String(v)]);
  }

  function resetForm() {
    setEditingId(null);
    setSkuTouched(false);
    setForm(EMPTY_FORM);
    setAttrs([{ key: "", value: "" }]);
    setSpecs([{ key: "", value: "" }]);
  }

  function parseJsonToKeyValue(value: unknown): KeyValueItem[] {
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > 0) {
        return entries.map(([key, val]) => ({ key, value: String(val) }));
      }
    }
    return [{ key: "", value: "" }];
  }

  function keyValueToMap(items: KeyValueItem[]): Record<string, string> | null {
    const result: Record<string, string> = {};
    let hasKeys = false;
    for (const item of items) {
      const k = item.key.trim();
      const v = item.value.trim();
      if (k) {
        result[k] = v;
        hasKeys = true;
      }
    }
    return hasKeys ? result : null;
  }

  function normalizePayload(input: VariantForm) {
    const payload: Record<string, unknown> = {
      product_id: input.product_id,
      sku: input.sku.trim(),
      barcode: input.barcode.trim() || null,
      name: input.name.trim() || null,
      cost_price: Number(input.cost_price || "0"),
      selling_price: Number(input.selling_price || "0"),
      is_active: input.is_active === "true",
    };
    payload.weight = input.weight.trim() === "" ? null : Number(input.weight);
    
    const attrMap = keyValueToMap(attrs);
    if (attrMap) payload.attributes = attrMap;
    
    const specMap = keyValueToMap(specs);
    if (specMap) payload.specs = specMap;
    
    return payload;
  }

  async function onSubmit() {
    try {
      const payload = normalizePayload(form);
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: payload });
        toast.success("Đã cập nhật biến thể");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo biến thể");
      }
      setOpen(false);
      resetForm();
    } catch {
      toast.error("Dữ liệu không hợp lệ, vui lòng kiểm tra lại");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle>Biến thể sản phẩm</CardTitle>
            <CardDescription>
              Mỗi sản phẩm có thể có nhiều biến thể (cấu hình i5/i7, RAM 8/16GB, màu sắc...). Tồn kho hiển thị là tổng across các kho.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm SKU/tên..." className="w-full sm:w-56" />
            <Button onClick={() => { resetForm(); setOpen(true); }} className="w-full sm:w-auto">Thêm biến thể</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[260px]">Sản phẩm</TableHead>
                <TableHead>SKU / Barcode</TableHead>
                <TableHead className="min-w-[200px]">Cấu hình / Thuộc tính</TableHead>
                <TableHead className="text-right">Giá bán</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">Lãi gộp</TableHead>
                <TableHead className="text-right">Tồn kho</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">{list.isLoading ? "Đang tải..." : "Không có dữ liệu"}</TableCell>
                </TableRow>
              ) : rows.map((row, idx) => {
                const product = productMap.get(String(row.product_id ?? ""));
                const sell = Number(row.selling_price ?? 0);
                const cost = Number(row.cost_price ?? 0);
                const margin = sell - cost;
                const stock = stockByVariant.get(String(row.id ?? "")) ?? 0;
                const attrs = recordToEntries(row.attributes);
                const specs = recordToEntries(row.specs);
                const brandName = product?.brand_id ? brandMap.get(product.brand_id) : null;
                const categoryName = product?.category_id ? categoryMap.get(product.category_id) : null;
                return (
                <TableRow key={String(row.id ?? idx)}>
                  <TableCell>
                    <div className="flex items-start gap-2.5">
                      {product?.thumbnail_url ? (
                        <Image src={product.thumbnail_url} alt="" width={44} height={44} className="h-11 w-11 rounded object-cover border flex-shrink-0" />
                      ) : (
                        <div className="h-11 w-11 bg-muted rounded flex items-center justify-center border text-[9px] text-muted-foreground flex-shrink-0">No img</div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm leading-tight">{product?.name ?? <span className="text-destructive italic">Sản phẩm không tồn tại</span>}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                          {[brandName, categoryName].filter(Boolean).join(" · ") || product?.slug || ""}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-xs font-semibold">{String(row.sku ?? "—")}</div>
                    {row.barcode ? (
                      <div className="font-mono text-[10px] text-muted-foreground">📊 {String(row.barcode)}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.name ? <div className="text-xs font-medium mb-1">{String(row.name)}</div> : null}
                    <div className="flex flex-wrap gap-1">
                      {attrs.map(([k, v]) => (
                        <span key={`a-${k}`} className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900">
                          {k}: <strong className="ml-1">{v}</strong>
                        </span>
                      ))}
                      {specs.slice(0, 4).map(([k, v]) => (
                        <span key={`s-${k}`} className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 border">
                          {k}: <strong className="ml-1">{v}</strong>
                        </span>
                      ))}
                      {specs.length > 4 ? (
                        <span className="inline-flex items-center rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground border">
                          +{specs.length - 4}
                        </span>
                      ) : null}
                      {attrs.length === 0 && specs.length === 0 && !row.name ? (
                        <span className="text-[11px] text-muted-foreground italic">Không có cấu hình</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm">{formatVND(sell)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{formatVND(cost)}</TableCell>
                  <TableCell className={`text-right text-sm font-medium ${margin > 0 ? "text-emerald-600" : margin < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {margin === 0 ? "—" : formatVND(margin)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-block min-w-[2.5rem] rounded-full px-2 py-0.5 text-xs font-bold ${
                      stock === 0 ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                      : stock < 5 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    }`}>
                      {stock}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      row.is_active === false ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      : "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${row.is_active === false ? "bg-gray-500" : "bg-green-600"}`} />
                      {row.is_active === false ? "Ẩn" : "Đang bán"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingId(String(row.id ?? ""));
                        setSkuTouched(true);
                        setForm({
                          product_id: toInputString(row.product_id),
                          sku: toInputString(row.sku),
                          barcode: toInputString(row.barcode),
                          name: toInputString(row.name),
                          cost_price: toInputString(row.cost_price ?? 0),
                          selling_price: toInputString(row.selling_price ?? 0),
                          weight: toInputString(row.weight),
                          is_active: row.is_active === false ? "false" : "true",
                        });
                        setAttrs(parseJsonToKeyValue(row.attributes));
                        setSpecs(parseJsonToKeyValue(row.specs));
                        setOpen(true);
                      }}>Sửa</Button>
                      <Button size="sm" variant="destructive" onClick={async () => {
                        try {
                          await deleteMutation.mutateAsync(String(row.id));
                          toast.success("Đã xoá biến thể");
                        } catch {
                          toast.error("Không thể xoá biến thể");
                        }
                      }}>Xoá</Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Cập nhật biến thể" : "Thêm biến thể"}</DialogTitle>
            <DialogDescription>Chọn sản phẩm và SKU tự động gợi ý</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Sản phẩm</Label>
              <Select value={form.product_id} onValueChange={(value) => {
                const product = productMap.get(value);
                setForm((prev) => ({
                  ...prev,
                  product_id: value,
                  sku: skuTouched ? prev.sku : makeSku(product),
                }));
              }}>
                <SelectTrigger><SelectValue placeholder="Chọn sản phẩm" /></SelectTrigger>
                <SelectContent>
                  {productOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name || p.slug || p.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <div className="flex gap-2">
                <Input value={form.sku} onChange={(e) => { setSkuTouched(true); setForm((prev) => ({ ...prev, sku: e.target.value })); }} placeholder="SKU" />
                <Button type="button" variant="outline" onClick={() => {
                  const product = productMap.get(form.product_id);
                  setSkuTouched(false);
                  setForm((prev) => ({ ...prev, sku: makeSku(product) }));
                }}>Tạo</Button>
              </div>
            </div>
            <div className="space-y-2"><Label>Tên biến thể</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Barcode</Label><Input value={form.barcode} onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Giá vốn</Label><Input type="number" min="0" value={form.cost_price} onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Giá bán</Label><Input type="number" min="0" value={form.selling_price} onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Cân nặng</Label><Input type="number" min="0" value={form.weight} onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Kích hoạt</Label>
              <Select value={form.is_active} onValueChange={(value) => setForm((p) => ({ ...p, is_active: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Có</SelectItem>
                  <SelectItem value="false">Không</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Attributes Row */}
            <div className="space-y-3 sm:col-span-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Thuộc tính (Attributes - ví dụ: Màu sắc, Dung lượng)</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setAttrs((prev) => [...prev, { key: "", value: "" }])}>+ Thêm thuộc tính</Button>
              </div>
              <div className="space-y-2">
                {attrs.map((attr, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input placeholder="Tên thuộc tính (vd: color)" value={attr.key} onChange={(e) => {
                      const val = e.target.value;
                      setAttrs((prev) => prev.map((item, i) => i === idx ? { ...item, key: val } : item));
                    }} className="flex-1" />
                    <Input placeholder="Giá trị (vd: Black)" value={attr.value} onChange={(e) => {
                      const val = e.target.value;
                      setAttrs((prev) => prev.map((item, i) => i === idx ? { ...item, value: val } : item));
                    }} className="flex-1" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setAttrs((prev) => prev.filter((_, i) => i !== idx))} disabled={attrs.length === 1 && !attr.key && !attr.value}>✕</Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Specs Row */}
            <div className="space-y-3 sm:col-span-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Thông số kỹ thuật (Specs - ví dụ: CPU, VGA)</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setSpecs((prev) => [...prev, { key: "", value: "" }])}>+ Thêm thông số</Button>
              </div>
              <div className="space-y-2">
                {specs.map((spec, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input placeholder="Tên thông số (vd: cpu)" value={spec.key} onChange={(e) => {
                      const val = e.target.value;
                      setSpecs((prev) => prev.map((item, i) => i === idx ? { ...item, key: val } : item));
                    }} className="flex-1" />
                    <Input placeholder="Giá trị (vd: M4 Max)" value={spec.value} onChange={(e) => {
                      const val = e.target.value;
                      setSpecs((prev) => prev.map((item, i) => i === idx ? { ...item, value: val } : item));
                    }} className="flex-1" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setSpecs((prev) => prev.filter((_, i) => i !== idx))} disabled={specs.length === 1 && !spec.key && !spec.value}>✕</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
            <Button onClick={onSubmit} disabled={createMutation.isPending || updateMutation.isPending}>{editingId ? "Lưu" : "Tạo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
