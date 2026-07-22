"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrudList, useMyShops } from "@/lib/api/admin-crud";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";

type StockLevel = {
  warehouse_id: string;
  product_variant_id: string;
  available_qty: number | null;
  reserved_qty: number | null;
  incoming_qty: number | null;
};

type Warehouse = { id: string; name: string; code: string | null };
type ProductVariant = { id: string; name: string | null; sku: string | null };

export default function StockLevelsAdminPage() {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quickQty, setQuickQty] = useState("");

  const query = useCrudList<StockLevel>("stock-levels", { search, page: 1, pageSize: 100 });
  const myShopsQuery = useMyShops();
  // Kho lọc theo cửa hàng đang chọn (giống form sản phẩm & POS). Chưa chọn cửa hàng → hiện tất cả.
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

  const shopOptions = useMemo<SearchableOption[]>(
    () => myShops.map((s) => ({ value: s.id, label: s.name, keywords: s.code ?? "" })),
    [myShops],
  );
  const warehouseOptions = useMemo<SearchableOption[]>(
    () => warehouses.map((w) => ({ value: w.id, label: w.name, keywords: w.code ?? "" })),
    [warehouses],
  );
  const variantOptions = useMemo<SearchableOption[]>(
    () => variants.map((v) => ({ value: v.id, label: v.name ?? v.id, keywords: v.sku ?? "" })),
    [variants],
  );

  // Tự chọn cửa hàng đầu tiên của tài khoản khi load xong.
  useEffect(() => {
    if (!selectedShopId && myShops.length > 0) setSelectedShopId(myShops[0].id);
  }, [selectedShopId, myShops]);

  // Khi kho load lại theo cửa hàng, đảm bảo kho đang chọn vẫn hợp lệ; nếu không → chọn kho đầu.
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

  return (
    <div className="space-y-4">
      {/* Form thêm tồn kho nhanh */}
      <Card>
        <CardHeader>
          <CardTitle>Nhập tồn kho / Thêm tồn kho sản phẩm cũ</CardTitle>
          <CardDescription>
            Chọn kho, sản phẩm và nhập số lượng tồn. Nếu sản phẩm đã có trong kho, hệ thống sẽ cập nhật đè số lượng mới.
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
                  setSelectedWarehouseId(""); // reset để effect chọn lại kho của cửa hàng mới
                }}
                placeholder="Chọn cửa hàng..."
                searchPlaceholder="Tìm cửa hàng..."
                disabled={myShops.length === 0}
              />
              {!myShopsQuery.isLoading && myShops.length === 0 && (
                <p className="text-xs text-amber-600">Tài khoản chưa được gán cửa hàng nào.</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Chọn kho hàng</label>
              <SearchableSelect
                options={warehouseOptions}
                value={selectedWarehouseId}
                onValueChange={setSelectedWarehouseId}
                placeholder="Chọn kho..."
                searchPlaceholder="Tìm kho..."
                disabled={warehouses.length === 0}
              />
              {warehouses.length === 0 && (
                <p className="text-xs text-amber-600">
                  {selectedShopId ? "Cửa hàng này chưa có kho." : "Chưa có kho nào."}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Chọn sản phẩm (biến thể)</label>
              <SearchableSelect
                options={variantOptions}
                value={selectedVariantId}
                onValueChange={setSelectedVariantId}
                placeholder="Chọn sản phẩm..."
                searchPlaceholder="Tìm theo tên / SKU..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Số lượng khả dụng</label>
              <Input
                value={quickQty}
                inputMode="numeric"
                onChange={(e) => setQuickQty(e.target.value.replace(/\D/g, ""))}
                placeholder="Nhập số tồn... ví dụ: 5"
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

      <Card>
        <CardHeader className="flex flex-col items-stretch gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Bảng danh sách tồn kho</CardTitle>
            <CardDescription>Danh sách tồn kho hiện hữu trong hệ thống</CardDescription>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo SKU/tên biến thể..."
            className="w-full sm:w-64"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kho</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Khả dụng</TableHead>
                <TableHead>Đang giữ</TableHead>
                <TableHead>Sắp về</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {query.isLoading ? "Đang tải..." : "Không có dữ liệu"}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, idx) => {
                  const key = `${r.warehouse_id}:${r.product_variant_id}`;
                  const warehouse = warehouseMap.get(r.warehouse_id);
                  const variant = variantMap.get(r.product_variant_id);
                  const value = draft[key] ?? String(r.available_qty ?? 0);
                  return (
                    <TableRow key={`${r.warehouse_id}-${r.product_variant_id}-${idx}`}>
                      <TableCell>
                        <div className="font-medium">{warehouse?.name ?? r.warehouse_id}</div>
                        <div className="text-xs text-muted-foreground">{warehouse?.code ?? r.warehouse_id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{variant?.name ?? r.product_variant_id}</div>
                        <div className="text-xs text-muted-foreground">{variant?.sku ?? r.product_variant_id}</div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={value}
                          inputMode="numeric"
                          onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value.replace(/\D/g, "") }))}
                          className="h-8 w-28"
                        />
                      </TableCell>
                      <TableCell>{r.reserved_qty ?? 0}</TableCell>
                      <TableCell>{r.incoming_qty ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => saveQty(r)} disabled={savingKey === key}>
                          {savingKey === key ? "Đang lưu..." : "Lưu"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
