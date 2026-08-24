"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useCrudBulkDelete,
  useCrudCreate,
  useCrudDelete,
  useCrudList,
  useCrudUpdate,
} from "@/lib/api/admin-crud";
import { BulkActionsToolbar, useBulkSelection } from "@/components/admin/bulk-actions";

type ProductRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  thumbnail_url?: string | null;
  brand_id?: string | null;
  category_id?: string | null;
};

type VariantRow = Record<string, unknown> & {
  id?: string;
  product_id?: string | null;
  sku?: string | null;
};

type StockRow = {
  warehouse_id: string;
  product_variant_id: string;
  available_qty: number | null;
};

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

export default function ProductVariantsAdminPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [skuTouched, setSkuTouched] = useState(false);
  const [form, setForm] = useState<VariantForm>(EMPTY_FORM);
  const [attrs, setAttrs] = useState<KeyValueItem[]>([{ key: "", value: "" }]);
  const [specs, setSpecs] = useState<KeyValueItem[]>([{ key: "", value: "" }]);
  /** Card nào đang mở rộng (không collapse để dễ scan tất cả) */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  /** Lọc theo sản phẩm cụ thể */
  const [productFilter, setProductFilter] = useState<string>("__all__");

  const list = useCrudList<VariantRow>("product-variants", { search, page: 1, pageSize: 200 });
  const products = useCrudList<ProductRow>("products", { page: 1, pageSize: 500 });
  const stocks = useCrudList<StockRow>("stock-levels", { page: 1, pageSize: 1000 });
  const categories = useCrudList<CategoryRow>("categories", { page: 1, pageSize: 200 });
  const brands = useCrudList<BrandRow>("brands", { page: 1, pageSize: 200 });

  const createMutation = useCrudCreate<VariantRow, Record<string, unknown>>("product-variants");
  const updateMutation = useCrudUpdate<VariantRow, Record<string, unknown>>("product-variants");
  const deleteMutation = useCrudDelete("product-variants");
  const bulkDeleteMutation = useCrudBulkDelete("product-variants");
  const selection = useBulkSelection();

  const productOptions = useMemo(() => products.data?.items ?? [], [products.data?.items]);
  const productMap = useMemo(() => new Map(productOptions.map((p) => [p.id, p])), [productOptions]);
  const categoryMap = useMemo(
    () => new Map((categories.data?.items ?? []).map((c) => [c.id, c.name])),
    [categories.data?.items],
  );
  const brandMap = useMemo(
    () => new Map((brands.data?.items ?? []).map((b) => [b.id, b.name])),
    [brands.data?.items],
  );
  const stockByVariant = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of stocks.data?.items ?? []) {
      const qty = Number(s.available_qty ?? 0);
      map.set(s.product_variant_id, (map.get(s.product_variant_id) ?? 0) + qty);
    }
    return map;
  }, [stocks.data?.items]);

  const allRows = list.data?.items ?? [];

  // ===== Gom variants theo sản phẩm =====
  type VariantGroup = {
    product: ProductRow | null;
    productId: string;
    brandName: string | null;
    categoryName: string | null;
    variants: VariantRow[];
    totalStock: number;
    priceMin: number;
    priceMax: number;
  };

  const grouped = useMemo<VariantGroup[]>(() => {
    const byProduct = new Map<string, VariantRow[]>();
    const orphans: VariantRow[] = [];
    for (const row of allRows) {
      const pid = row.product_id ? String(row.product_id) : "";
      if (pid && productMap.has(pid)) {
        const arr = byProduct.get(pid) ?? [];
        arr.push(row);
        byProduct.set(pid, arr);
      } else if (pid) {
        orphans.push(row);
      } else {
        orphans.push(row);
      }
    }

    const groups: VariantGroup[] = [];
    for (const [productId, variants] of byProduct.entries()) {
      const product = productMap.get(productId) ?? null;
      const brandName = product?.brand_id ? brandMap.get(product.brand_id) ?? null : null;
      const categoryName = product?.category_id ? categoryMap.get(product.category_id) ?? null : null;
      const totalStock = variants.reduce((sum, v) => sum + (stockByVariant.get(String(v.id ?? "")) ?? 0), 0);
      const prices = variants.map((v) => Number(v.selling_price ?? 0)).filter((n) => n > 0);
      const priceMin = prices.length ? Math.min(...prices) : 0;
      const priceMax = prices.length ? Math.max(...prices) : 0;
      groups.push({ product, productId, brandName, categoryName, variants, totalStock, priceMin, priceMax });
    }
    // Sắp xếp theo tên SP A-Z, orphan xuống cuối
    groups.sort((a, b) => {
      const an = a.product?.name ?? `~~~${a.productId}`;
      const bn = b.product?.name ?? `~~~${b.productId}`;
      return an.localeCompare(bn, "vi");
    });
    if (orphans.length > 0) {
      groups.push({
        product: null,
        productId: "__orphan__",
        brandName: null,
        categoryName: null,
        variants: orphans,
        totalStock: orphans.reduce((sum, v) => sum + (stockByVariant.get(String(v.id ?? "")) ?? 0), 0),
        priceMin: 0,
        priceMax: 0,
      });
    }
    return groups;
  }, [allRows, productMap, brandMap, categoryMap, stockByVariant]);

  // Áp dụng filter sản phẩm
  const visibleGroups = useMemo(() => {
    if (productFilter === "__all__") return grouped;
    return grouped.filter((g) => g.productId === productFilter);
  }, [grouped, productFilter]);

  const pageIds = useMemo(() => visibleGroups.flatMap((g) => g.variants.map((v) => String(v.id ?? ""))), [visibleGroups]);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id: string) => selection.isSelected(id));
  const someOnPageSelected = pageIds.some((id: string) => selection.isSelected(id));

  // ===== Stats =====
  const stats = useMemo(() => {
    const totalVariants = allRows.length;
    const totalStock = allRows.reduce((sum, v) => sum + (stockByVariant.get(String(v.id ?? "")) ?? 0), 0);
    const outOfStock = allRows.filter((v) => (stockByVariant.get(String(v.id ?? "")) ?? 0) === 0).length;
    const productsWithVariants = grouped.filter((g) => g.productId !== "__orphan__").length;
    return { totalVariants, totalStock, outOfStock, productsWithVariants };
  }, [allRows, stockByVariant, grouped]);

  // ===== Helpers cho mỗi group =====
  function isGroupAllSelected(group: VariantGroup): boolean {
    const ids = group.variants.map((v) => String(v.id ?? "")).filter(Boolean);
    return ids.length > 0 && ids.every((id) => selection.isSelected(id));
  }
  function isGroupSomeSelected(group: VariantGroup): boolean {
    return group.variants.some((v) => selection.isSelected(String(v.id ?? "")));
  }
  function toggleGroup(group: VariantGroup) {
    const ids = group.variants.map((v) => String(v.id ?? "")).filter(Boolean);
    if (isGroupAllSelected(group)) {
      ids.forEach((id) => selection.toggle(id)); // bỏ chọn (sẽ xoá vì toggle đảo trạng thái)
      // dùng clear-from-set pattern: gọi isSelected trước rồi bỏ chọn các id đang selected
    } else {
      const notSelected = ids.filter((id) => !selection.isSelected(id));
      notSelected.forEach((id) => selection.toggle(id));
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
        toast.error("Không xoá được bản ghi nào (có thể do khoá ngoại)");
      } else if (missingCount > 0) {
        toast.warning(`Đã xoá ${deletedCount}, bỏ qua ${missingCount} không tồn tại`);
      } else {
        toast.success(`Đã xoá ${deletedCount} biến thể`);
      }
      selection.clear();
    } catch {
      toast.error("Có lỗi khi xoá");
    }
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

  function openCreateForProduct(productId?: string) {
    resetForm();
    if (productId) {
      const product = productMap.get(productId);
      setForm((prev) => ({
        ...prev,
        product_id: productId,
        sku: makeSku(product),
      }));
    }
    setOpen(true);
  }

  function startEdit(row: VariantRow) {
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
  }

  async function handleDelete(row: VariantRow) {
    const sku = String(row.sku ?? row.id ?? "");
    if (!window.confirm(`Xoá biến thể "${sku}"?`)) return;
    try {
      await deleteMutation.mutateAsync(String(row.id));
      toast.success("Đã xoá biến thể");
    } catch {
      toast.error("Không thể xoá biến thể");
    }
  }

  // Khi toggle cả group, ta cần đảo ngược từng id đang có/không
  function handleGroupToggle(group: VariantGroup) {
    const ids = group.variants.map((v) => String(v.id ?? "")).filter(Boolean);
    const allSel = ids.every((id) => selection.isSelected(id));
    if (allSel) {
      // bỏ chọn tất cả
      const toUnselect = ids.filter((id) => selection.isSelected(id));
      toUnselect.forEach((id) => selection.toggle(id));
    } else {
      // chọn những cái chưa chọn
      const toSelect = ids.filter((id) => !selection.isSelected(id));
      toSelect.forEach((id) => selection.toggle(id));
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* ===== Header card: stats + filters ===== */}
        <Card>
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Biến thể sản phẩm</CardTitle>
                <CardDescription>
                  Mỗi sản phẩm gom thành 1 nhóm. Tồn kho là tổng across các kho.
                </CardDescription>
              </div>
              <Button onClick={() => openCreateForProduct()} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Thêm biến thể
              </Button>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <StatBox label="Sản phẩm có biến thể" value={stats.productsWithVariants} accent="text-foreground" />
              <StatBox label="Tổng biến thể" value={stats.totalVariants} accent="text-foreground" />
              <StatBox label="Tổng tồn kho" value={stats.totalStock} accent="text-emerald-600 dark:text-emerald-400" />
              <StatBox label="Hết hàng" value={stats.outOfStock} accent={stats.outOfStock > 0 ? "text-destructive" : "text-muted-foreground"} />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm SKU, tên biến thể..."
                  className="pl-8"
                />
              </div>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="sm:w-64">
                  <SelectValue placeholder="Lọc theo sản phẩm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả sản phẩm ({grouped.length})</SelectItem>
                  {grouped
                    .filter((g) => g.product)
                    .map((g) => (
                      <SelectItem key={g.productId} value={g.productId}>
                        {g.product?.name} ({g.variants.length})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        <BulkActionsToolbar
          count={selection.count}
          entityLabel="biến thể"
          onClear={selection.clear}
          onRequestDelete={() => {
            if (window.confirm(`Xoá ${selection.count} biến thể đã chọn? Hành động không thể hoàn tác.`)) {
              void handleBulkDelete();
            }
          }}
          isPending={bulkDeleteMutation.isPending}
        />

        {/* ===== Grouped variant cards ===== */}
        {list.isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">Đang tải...</CardContent>
          </Card>
        ) : visibleGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-muted-foreground mb-3">
                {search || productFilter !== "__all__"
                  ? "Không có biến thể nào khớp bộ lọc"
                  : "Chưa có biến thể nào"}
              </div>
              <Button onClick={() => openCreateForProduct()} variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Tạo biến thể đầu tiên
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibleGroups.map((group) => {
              const isCollapsed = collapsed[group.productId] ?? false;
              const allGroupSelected = isGroupAllSelected(group);
              const someGroupSelected = isGroupSomeSelected(group);
              return (
                <Card key={group.productId} className="overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
                    <Checkbox
                      checked={allGroupSelected}
                      onCheckedChange={() => handleGroupToggle(group)}
                      aria-label={`Chọn tất cả biến thể của ${group.product?.name ?? "không xác định"}`}
                      ref={(el) => {
                        if (el && "indeterminate" in el) {
                          (el as HTMLInputElement).indeterminate = !allGroupSelected && someGroupSelected;
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((prev) => ({ ...prev, [group.productId]: !isCollapsed }))
                      }
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      {group.product?.thumbnail_url ? (
                        <Image
                          src={group.product.thumbnail_url}
                          alt=""
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded object-cover border shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center border text-[9px] text-muted-foreground shrink-0">
                          ?
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm leading-tight truncate">
                          {group.product?.name ?? (
                            <span className="text-destructive italic">Sản phẩm không tồn tại / đã xoá</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {[group.brandName, group.categoryName].filter(Boolean).join(" · ") ||
                            group.product?.slug ||
                            ""}
                        </div>
                      </div>
                    </button>

                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="font-mono">
                        {group.variants.length} biến thể
                      </Badge>
                      {group.totalStock > 0 && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                          Tồn: {group.totalStock}
                        </Badge>
                      )}
                      {group.totalStock === 0 && group.variants.length > 0 && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800">
                          Hết hàng
                        </Badge>
                      )}
                      {group.priceMin > 0 && group.priceMax > 0 && (
                        <Badge variant="outline" className="font-mono">
                          {group.priceMin === group.priceMax
                            ? formatVND(group.priceMin)
                            : `${formatVND(group.priceMin)} – ${formatVND(group.priceMax)}`}
                        </Badge>
                      )}
                    </div>

                    {group.productId !== "__orphan__" && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openCreateForProduct(group.productId)}
                            className="h-8 w-8 shrink-0"
                            aria-label="Thêm biến thể cho sản phẩm này"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Thêm biến thể vào sản phẩm này</TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Mobile stats (chỉ hiện trên mobile) */}
                  <div className="sm:hidden flex items-center gap-2 px-4 py-2 text-xs border-b bg-muted/20 flex-wrap">
                    <Badge variant="secondary" className="font-mono">{group.variants.length} biến thể</Badge>
                    {group.totalStock > 0 && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200">
                        Tồn {group.totalStock}
                      </Badge>
                    )}
                    {group.priceMin > 0 && (
                      <Badge variant="outline" className="font-mono">
                        {formatVND(group.priceMin)}
                      </Badge>
                    )}
                  </div>

                  {/* Variant table */}
                  {!isCollapsed && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead>SKU / Barcode</TableHead>
                          <TableHead className="min-w-[200px]">Cấu hình</TableHead>
                          <TableHead className="text-right">Giá bán</TableHead>
                          <TableHead className="text-right hidden md:table-cell">Giá vốn</TableHead>
                          <TableHead className="text-right hidden lg:table-cell">Lãi gộp</TableHead>
                          <TableHead className="text-right">Tồn</TableHead>
                          <TableHead className="hidden md:table-cell">TT</TableHead>
                          <TableHead className="text-right">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.variants.map((row, idx) => {
                          const id = String(row.id ?? "");
                          const sell = Number(row.selling_price ?? 0);
                          const cost = Number(row.cost_price ?? 0);
                          const margin = sell - cost;
                          const stock = stockByVariant.get(id) ?? 0;
                          const attrs = recordToEntries(row.attributes);
                          const specs = recordToEntries(row.specs);
                          const checked = selection.isSelected(id);
                          return (
                            <TableRow key={id || idx} data-state={checked ? "selected" : undefined}>
                              <TableCell>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => selection.toggle(id)}
                                  aria-label={`Chọn biến thể ${String(row.sku ?? id)}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="font-mono text-xs font-semibold">{String(row.sku ?? "—")}</div>
                                {row.barcode ? (
                                  <div className="font-mono text-[10px] text-muted-foreground">📊 {String(row.barcode)}</div>
                                ) : null}
                                {row.name ? (
                                  <div className="text-xs mt-0.5">{String(row.name)}</div>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {attrs.map(([k, v]) => (
                                    <span
                                      key={`a-${k}`}
                                      className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900"
                                    >
                                      {k}: <strong className="ml-1">{v}</strong>
                                    </span>
                                  ))}
                                  {specs.slice(0, 3).map(([k, v]) => (
                                    <span
                                      key={`s-${k}`}
                                      className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 border"
                                    >
                                      {k}: <strong className="ml-1">{v}</strong>
                                    </span>
                                  ))}
                                  {specs.length > 3 && (
                                    <span className="inline-flex items-center rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground border">
                                      +{specs.length - 3}
                                    </span>
                                  )}
                                  {attrs.length === 0 && specs.length === 0 && !row.name && (
                                    <span className="text-[11px] text-muted-foreground italic">Không có cấu hình</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-sm whitespace-nowrap">
                                {formatVND(sell)}
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground hidden md:table-cell whitespace-nowrap">
                                {formatVND(cost)}
                              </TableCell>
                              <TableCell
                                className={`text-right text-sm font-medium hidden lg:table-cell whitespace-nowrap ${
                                  margin > 0
                                    ? "text-emerald-600"
                                    : margin < 0
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                                }`}
                              >
                                {margin === 0 ? "—" : formatVND(margin)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={`inline-block min-w-[2rem] rounded-full px-2 py-0.5 text-xs font-bold ${
                                    stock === 0
                                      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                                      : stock < 5
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  }`}
                                >
                                  {stock}
                                </span>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                    row.is_active === false
                                      ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                      : "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
                                  }`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${row.is_active === false ? "bg-gray-500" : "bg-green-600"}`} />
                                  {row.is_active === false ? "Ẩn" : "Bán"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-7 w-7"
                                        onClick={() => startEdit(row)}
                                        aria-label="Sửa"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Sửa biến thể</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="destructive"
                                        className="h-7 w-7"
                                        onClick={() => handleDelete(row)}
                                        aria-label="Xoá"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Xoá biến thể</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Select-all bar ở footer cho trang dài */}
        {visibleGroups.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span>
              Tổng {stats.totalVariants} biến thể trong {visibleGroups.length} nhóm
            </span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={allOnPageSelected}
                onCheckedChange={() => {
                  if (allOnPageSelected) {
                    pageIds.forEach((id) => selection.toggle(id));
                  } else {
                    pageIds
                      .filter((id) => !selection.isSelected(id))
                      .forEach((id) => selection.toggle(id));
                  }
                }}
                ref={(el) => {
                  if (el && "indeterminate" in el) {
                    (el as HTMLInputElement).indeterminate = !allOnPageSelected && someOnPageSelected;
                  }
                }}
              />
              <span>Chọn tất cả {pageIds.length} biến thể</span>
            </label>
          </div>
        )}

        {/* ===== Edit/Create dialog ===== */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Cập nhật biến thể" : "Thêm biến thể"}</DialogTitle>
              <DialogDescription>Chọn sản phẩm và SKU tự động gợi ý</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sản phẩm</Label>
                <Select
                  value={form.product_id}
                  onValueChange={(value) => {
                    const product = productMap.get(value);
                    setForm((prev) => ({
                      ...prev,
                      product_id: value,
                      sku: skuTouched ? prev.sku : makeSku(product),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn sản phẩm" />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name || p.slug || p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.sku}
                    onChange={(e) => {
                      setSkuTouched(true);
                      setForm((prev) => ({ ...prev, sku: e.target.value }));
                    }}
                    placeholder="SKU"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const product = productMap.get(form.product_id);
                      setSkuTouched(false);
                      setForm((prev) => ({ ...prev, sku: makeSku(product) }));
                    }}
                  >
                    Tạo
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tên biến thể</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Barcode</Label>
                <Input value={form.barcode} onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Giá vốn</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.cost_price}
                  onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Giá bán</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.selling_price}
                  onChange={(e) => setForm((p) => ({ ...p, selling_price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cân nặng</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.weight}
                  onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Kích hoạt</Label>
                <Select value={form.is_active} onValueChange={(value) => setForm((p) => ({ ...p, is_active: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAttrs((prev) => [...prev, { key: "", value: "" }])}
                  >
                    + Thêm thuộc tính
                  </Button>
                </div>
                <div className="space-y-2">
                  {attrs.map((attr, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="Tên thuộc tính (vd: color)"
                        value={attr.key}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAttrs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, key: val } : item)),
                          );
                        }}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Giá trị (vd: Black)"
                        value={attr.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAttrs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, value: val } : item)),
                          );
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setAttrs((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={attrs.length === 1 && !attr.key && !attr.value}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Specs Row */}
              <div className="space-y-3 sm:col-span-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Thông số kỹ thuật (Specs - ví dụ: CPU, VGA)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSpecs((prev) => [...prev, { key: "", value: "" }])}
                  >
                    + Thêm thông số
                  </Button>
                </div>
                <div className="space-y-2">
                  {specs.map((spec, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="Tên thông số (vd: cpu)"
                        value={spec.key}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSpecs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, key: val } : item)),
                          );
                        }}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Giá trị (vd: M4 Max)"
                        value={spec.value}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSpecs((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, value: val } : item)),
                          );
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSpecs((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={specs.length === 1 && !spec.key && !spec.value}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Huỷ
              </Button>
              <Button onClick={onSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Lưu" : "Tạo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold leading-tight tabular-nums ${accent}`}>{value}</span>
    </div>
  );
}