"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCrudList, useMyShops } from "@/lib/api/admin-crud";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { InventoryHelpSection } from "@/app/quanly/inventory/_components/inventory-help";
import { Package, AlertTriangle, XCircle, CheckCircle2, TrendingDown, Warehouse, ShoppingCart, ArrowRight } from "lucide-react";

type StockLevel = {
  warehouse_id: string;
  product_variant_id: string;
  available_qty: number | null;
  reserved_qty: number | null;
  incoming_qty: number | null;
};

type Warehouse = { id: string; name: string; code: string | null };
type ProductVariant = { 
  id: string; 
  name: string | null; 
  sku: string | null;
  product?: { name: string | null; image_url?: string | null };
};

const LOW_STOCK_THRESHOLD = 5;
const CRITICAL_STOCK_THRESHOLD = 2;

function StockStatusBadge({ qty }: { qty: number }) {
  if (qty === 0) {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Hết hàng</Badge>;
  }
  if (qty <= CRITICAL_STOCK_THRESHOLD) {
    return <Badge variant="destructive" className="gap-1 bg-orange-500"><AlertTriangle className="h-3 w-3" /> Còn {qty}</Badge>;
  }
  if (qty <= LOW_STOCK_THRESHOLD) {
    return <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300"><TrendingDown className="h-3 w-3" /> Còn {qty}</Badge>;
  }
  return <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50"><CheckCircle2 className="h-3 w-3" /> {qty}</Badge>;
}

export default function StockLevelsAdminPage() {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quickQty, setQuickQty] = useState("");

  const query = useCrudList<StockLevel>("stock-levels", { search, page: 1, pageSize: 500 });
  const myShopsQuery = useMyShops();
  const warehousesQuery = useCrudList<Warehouse>("warehouses", {
    page: 1,
    pageSize: 200,
    filters: selectedShopId ? { shop_id: selectedShopId } : undefined,
  });
  const variantsQuery = useCrudList<ProductVariant>("product-variants", { page: 1, pageSize: 500 });

  const rows = query.data?.items ?? [];
  const warehouseMap = useMemo(() => new Map((warehousesQuery.data?.items ?? []).map((w) => [w.id, w])), [warehousesQuery.data]);
  const variantMap = useMemo(() => new Map((variantsQuery.data?.items ?? []).map((v) => [v.id, v])), [variantsQuery.data]);

  const myShops = useMemo(() => myShopsQuery.data ?? [], [myShopsQuery.data]);
  const variants = useMemo(() => variantsQuery.data?.items ?? [], [variantsQuery.data]);
  const warehouses = useMemo(() => warehousesQuery.data?.items ?? [], [warehousesQuery.data]);

  // Tính toán thống kê
  const stats = useMemo(() => {
    let outOfStock = 0;
    let critical = 0;
    let lowStock = 0;
    let healthy = 0;
    let totalItems = 0;
    let totalQty = 0;

    rows.forEach((r) => {
      const qty = r.available_qty ?? 0;
      totalItems++;
      totalQty += qty;
      if (qty === 0) outOfStock++;
      else if (qty <= CRITICAL_STOCK_THRESHOLD) critical++;
      else if (qty <= LOW_STOCK_THRESHOLD) lowStock++;
      else healthy++;
    });

    return { outOfStock, critical, lowStock, healthy, totalItems, totalQty };
  }, [rows]);

  // Nhóm theo kho
  const groupedByWarehouse = useMemo(() => {
    const groups: Record<string, typeof rows> = {};
    rows.forEach((r) => {
      const w = warehouseMap.get(r.warehouse_id);
      const key = w?.name ?? r.warehouse_id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }, [rows, warehouseMap]);

  const shopOptions = useMemo<SearchableOption[]>(
    () => myShops.map((s) => ({ value: s.id, label: s.name, keywords: s.code ?? "" })),
    [myShops],
  );
  const warehouseOptions = useMemo<SearchableOption[]>(
    () => warehouses.map((w) => ({ value: w.id, label: w.name, keywords: w.code ?? "" })),
    [warehouses],
  );
  const variantOptions = useMemo<SearchableOption[]>(
    () => variants.map((v) => ({ 
      value: v.id, 
      label: v.product?.name ? `${v.product.name} - ${v.name}` : (v.name ?? v.id),
      keywords: v.sku ?? ""
    })),
    [variants],
  );

  useEffect(() => {
    if (!selectedShopId && myShops.length > 0) setSelectedShopId(myShops[0].id);
  }, [selectedShopId, myShops]);

  useEffect(() => {
    if (warehouses.length === 0) {
      if (selectedWarehouseId) setSelectedWarehouseId("");
      return;
    }
    if (!selectedWarehouseId || !warehouses.some((w) => w.id === selectedWarehouseId)) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);

  const handleQuickAdjust = async () => {
    if (!selectedWarehouseId || !selectedVariantId || !quickQty) {
      toast.error("Vui lòng chọn Kho, Sản phẩm và điền Số lượng");
      return;
    }
    const qty = Number(quickQty.replace(/\D/g, "")) || 0;
    try {
      setSavingKey("quick");
      const res = await fetch("/api/v1/stock-levels/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: selectedWarehouseId,
          product_variant_id: selectedVariantId,
          available_qty: qty,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Cập nhật thất bại");
      toast.success("Đã thêm/cập nhật tồn kho thành công");
      setQuickQty("");
      query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cập nhật tồn thất bại");
    } finally {
      setSavingKey(null);
    }
  };

  const saveQty = async (row: StockLevel) => {
    const key = `${row.warehouse_id}:${row.product_variant_id}`;
    const qty = Number((draft[key] ?? String(row.available_qty ?? 0)).replace(/\D/g, "")) || 0;
    try {
      setSavingKey(key);
      const res = await fetch("/api/v1/stock-levels/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id: row.warehouse_id,
          product_variant_id: row.product_variant_id,
          available_qty: qty,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Cập nhật thất bại");
      toast.success("Đã cập nhật tồn kho");
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      query.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cập nhật tồn thất bại");
    } finally {
      setSavingKey(null);
    }
  };

  // Lọc theo kho đang chọn
  const filteredRows = useMemo(() => {
    if (!selectedWarehouseId) return rows;
    return rows.filter(r => r.warehouse_id === selectedWarehouseId);
  }, [rows, selectedWarehouseId]);

  // Tìm kiếm
  const searchedRows = useMemo(() => {
    if (!search.trim()) return filteredRows;
    const term = search.toLowerCase();
    return filteredRows.filter(r => {
      const variant = variantMap.get(r.product_variant_id);
      return (
        variant?.name?.toLowerCase().includes(term) ||
        variant?.sku?.toLowerCase().includes(term) ||
        variant?.product?.name?.toLowerCase().includes(term)
      );
    });
  }, [filteredRows, search, variantMap]);

  return (
    <div className="space-y-6">
      <InventoryHelpSection variant="stock" />

      {/* Card thống kê tổng quan */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className={stats.outOfStock > 0 ? "border-red-300 bg-red-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hết hàng</CardTitle>
            <XCircle className={`h-4 w-4 ${stats.outOfStock > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.outOfStock > 0 ? "text-red-600" : ""}`}>{stats.outOfStock}</div>
            <p className="text-xs text-muted-foreground">sản phẩm</p>
          </CardContent>
        </Card>
        <Card className={stats.critical > 0 ? "border-orange-300 bg-orange-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sắp hết</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.critical > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.critical > 0 ? "text-orange-600" : ""}`}>{stats.critical}</div>
            <p className="text-xs text-muted-foreground">còn ≤{CRITICAL_STOCK_THRESHOLD}</p>
          </CardContent>
        </Card>
        <Card className={stats.lowStock > 0 ? "border-yellow-300 bg-yellow-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thấp</CardTitle>
            <TrendingDown className={`h-4 w-4 ${stats.lowStock > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.lowStock > 0 ? "text-yellow-700" : ""}`}>{stats.lowStock}</div>
            <p className="text-xs text-muted-foreground">còn ≤{LOW_STOCK_THRESHOLD}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Còn nhiều</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.healthy}</div>
            <p className="text-xs text-muted-foreground">sản phẩm</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng tồn</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalQty.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.totalItems} SKU</p>
          </CardContent>
        </Card>
      </div>

      {/* Form nhập tồn nhanh */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Nhập / Cập nhật tồn kho nhanh
          </CardTitle>
          <CardDescription>
            Chọn cửa hàng → kho → sản phẩm → nhập số lượng. Nếu sản phẩm đã có trong kho, hệ thống sẽ cập nhật đè số lượng mới.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-2">
              <label className="text-xs font-semibold">Cửa hàng</label>
              <SearchableSelect
                options={shopOptions}
                value={selectedShopId}
                onValueChange={(v) => {
                  setSelectedShopId(v);
                  setSelectedWarehouseId("");
                }}
                placeholder="Chọn cửa hàng..."
                searchPlaceholder="Tìm cửa hàng..."
                disabled={myShops.length === 0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Kho hàng</label>
              <SearchableSelect
                options={warehouseOptions}
                value={selectedWarehouseId}
                onValueChange={setSelectedWarehouseId}
                placeholder="Chọn kho..."
                searchPlaceholder="Tìm kho..."
                disabled={warehouses.length === 0}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Sản phẩm (biến thể)</label>
              <SearchableSelect
                options={variantOptions}
                value={selectedVariantId}
                onValueChange={setSelectedVariantId}
                placeholder="Tìm sản phẩm..."
                searchPlaceholder="Tìm theo tên / SKU..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Số lượng tồn</label>
              <Input
                value={quickQty}
                inputMode="numeric"
                onChange={(e) => setQuickQty(e.target.value.replace(/\D/g, ""))}
                placeholder="VD: 10"
              />
            </div>
            <div>
              <Button onClick={handleQuickAdjust} disabled={savingKey === "quick"} className="w-full">
                {savingKey === "quick" ? "Đang cập nhật..." : "Cập nhật tồn kho"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danh sách tồn kho */}
      <Card>
        <CardHeader className="flex flex-col items-stretch gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Tồn kho theo kho
            </CardTitle>
            <CardDescription>
              {searchedRows.length} sản phẩm • Click vào kho để xem chi tiết
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên / SKU..."
              className="w-48"
            />
          </div>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải dữ liệu...</div>
          ) : searchedRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {rows.length === 0 ? "Chưa có dữ liệu tồn kho" : "Không tìm thấy sản phẩm phù hợp"}
            </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">Tất cả ({searchedRows.length})</TabsTrigger>
                <TabsTrigger value="problem" className="text-red-600">
                  Cần xử lý ({stats.outOfStock + stats.critical})
                </TabsTrigger>
                <TabsTrigger value="low">Thấp ({stats.lowStock})</TabsTrigger>
                <TabsTrigger value="healthy">Tốt ({stats.healthy})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all">
                <StockTable rows={searchedRows} variantMap={variantMap} warehouseMap={warehouseMap} draft={draft} savingKey={savingKey} onDraftChange={setDraft} onSave={saveQty} />
              </TabsContent>
              <TabsContent value="problem">
                <StockTable 
                  rows={searchedRows.filter(r => (r.available_qty ?? 0) <= CRITICAL_STOCK_THRESHOLD)} 
                  variantMap={variantMap} 
                  warehouseMap={warehouseMap} 
                  draft={draft} 
                  savingKey={savingKey} 
                  onDraftChange={setDraft} 
                  onSave={saveQty} 
                />
              </TabsContent>
              <TabsContent value="low">
                <StockTable 
                  rows={searchedRows.filter(r => {
                    const qty = r.available_qty ?? 0;
                    return qty > CRITICAL_STOCK_THRESHOLD && qty <= LOW_STOCK_THRESHOLD;
                  })} 
                  variantMap={variantMap} 
                  warehouseMap={warehouseMap} 
                  draft={draft} 
                  savingKey={savingKey} 
                  onDraftChange={setDraft} 
                  onSave={saveQty} 
                />
              </TabsContent>
              <TabsContent value="healthy">
                <StockTable 
                  rows={searchedRows.filter(r => (r.available_qty ?? 0) > LOW_STOCK_THRESHOLD)} 
                  variantMap={variantMap} 
                  warehouseMap={warehouseMap} 
                  draft={draft} 
                  savingKey={savingKey} 
                  onDraftChange={setDraft} 
                  onSave={saveQty} 
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Tách component để tái sử dụng
function StockTable({
  rows,
  variantMap,
  warehouseMap,
  draft,
  savingKey,
  onDraftChange,
  onSave,
}: {
  rows: StockLevel[];
  variantMap: Map<string, ProductVariant>;
  warehouseMap: Map<string, Warehouse>;
  draft: Record<string, string>;
  savingKey: string | null;
  onDraftChange: (d: Record<string, string>) => void;
  onSave: (r: StockLevel) => void;
}) {
  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Không có sản phẩm</div>
      ) : (
        rows.map((r, idx) => {
          const key = `${r.warehouse_id}:${r.product_variant_id}`;
          const warehouse = warehouseMap.get(r.warehouse_id);
          const variant = variantMap.get(r.product_variant_id);
          const qty = r.available_qty ?? 0;
          const value = draft[key] ?? String(qty);
          
          return (
            <div 
              key={`${r.warehouse_id}-${r.product_variant_id}-${idx}`}
              className={`flex items-center gap-4 p-4 rounded-lg border ${
                qty === 0 ? "border-red-200 bg-red-50" :
                qty <= CRITICAL_STOCK_THRESHOLD ? "border-orange-200 bg-orange-50" :
                qty <= LOW_STOCK_THRESHOLD ? "border-yellow-200 bg-yellow-50" :
                "border-border bg-card"
              }`}
            >
              {/* Icon & Tên sản phẩm */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {variant?.product?.name ?? variant?.name ?? "Sản phẩm không xác định"}
                </div>
                {variant?.name && variant?.product?.name && (
                  <div className="text-sm text-muted-foreground truncate">{variant.name}</div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                    SKU: {variant?.sku ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    • Kho: {warehouse?.name ?? r.warehouse_id}
                  </span>
                </div>
              </div>
              
              {/* Các cột số lượng */}
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center min-w-[80px]">
                  <div className="text-xs text-muted-foreground">Khả dụng</div>
                  <div className="font-bold text-lg">{qty}</div>
                </div>
                <div className="text-center min-w-[60px]">
                  <div className="text-xs text-muted-foreground">Đang giữ</div>
                  <div>{r.reserved_qty ?? 0}</div>
                </div>
                <div className="text-center min-w-[60px]">
                  <div className="text-xs text-muted-foreground">Sắp về</div>
                  <div>{r.incoming_qty ?? 0}</div>
                </div>
              </div>
              
              {/* Trạng thái */}
              <StockStatusBadge qty={qty} />
              
              {/* Nút điều chỉnh */}
              <div className="flex items-center gap-2">
                <Input
                  value={value}
                  inputMode="numeric"
                  onChange={(e) => onDraftChange({ ...draft, [key]: e.target.value.replace(/\D/g, "") })}
                  className="w-20 h-8"
                  placeholder="Số mới"
                />
                <Button size="sm" onClick={() => onSave(r)} disabled={savingKey === key || value === String(qty)}>
                  {savingKey === key ? "..." : "Lưu"}
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
