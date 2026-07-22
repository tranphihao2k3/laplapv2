"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { httpGet, httpPost } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";

type Warehouse = { id: string; name: string; code: string | null };
type Variant = { id: string; name: string | null; sku: string | null };

type TransferItem = {
  key: string;
  product_variant_id: string;
  variant_name: string;
  quantity: number;
};

let itemKeyCounter = 0;
function nextKey() { return `item_${++itemKeyCounter}`; }

export default function TransferPage() {
  const qc = useQueryClient();

  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [note, setNote] = useState("");

  const { data: warehousesData } = useQuery({
    queryKey: ["warehouses-all"],
    queryFn: () => httpGet<{ items: Warehouse[]; total: number }>("/v1/warehouses", { page: 1, pageSize: 100 }),
  });
  const warehouses = warehousesData?.items ?? [];

  const transferMut = useMutation({
    mutationFn: (payload: unknown) => httpPost("/v1/inventory/transfer", payload),
    onSuccess: () => {
      toast.success("Chuyển kho thành công!");
      qc.invalidateQueries({ queryKey: ["admin-crud", "stock-levels"] });
      qc.invalidateQueries({ queryKey: ["admin-crud", "inventory-transactions"] });
      setFromWarehouse("");
      setToWarehouse("");
      setItems([]);
      setNote("");
    },
    onError: (e: unknown) => {
      const msg = (e as { error?: { message?: string } })?.error?.message ?? "Chuyển kho thất bại";
      toast.error(msg);
    },
  });

  const [variantSearch, setVariantSearch] = useState("");
  const [showVariantPicker, setShowVariantPicker] = useState(false);

  const { data: variantsData, isFetching: variantsLoading } = useQuery({
    queryKey: ["variants-search", variantSearch],
    enabled: showVariantPicker && variantSearch.length >= 1,
    queryFn: () =>
      httpGet<Paginated<Variant>>("/v1/product-variants", { search: variantSearch, page: 1, pageSize: 20 }),
  });
  const variants = variantsData?.items ?? [];

  const addItem = (v: Variant) => {
    if (items.some(i => i.product_variant_id === v.id)) {
      toast.info("Sản phẩm đã có trong danh sách");
      return;
    }
    setItems(prev => [...prev, { key: nextKey(), product_variant_id: v.id, variant_name: v.name ?? v.sku ?? v.id, quantity: 1 }]);
    setShowVariantPicker(false);
    setVariantSearch("");
  };

  const updateQty = (key: string, qty: number) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const removeItem = (key: string) => {
    setItems(prev => prev.filter(i => i.key !== key));
  };

  const handleSubmit = () => {
    if (!fromWarehouse) { toast.error("Chọn kho nguồn"); return; }
    if (!toWarehouse) { toast.error("Chọn kho đích"); return; }
    if (fromWarehouse === toWarehouse) { toast.error("Kho nguồn và kho đích phải khác nhau"); return; }
    if (items.length === 0) { toast.error("Thêm ít nhất 1 sản phẩm"); return; }

    transferMut.mutate({
      from_warehouse: fromWarehouse,
      to_warehouse: toWarehouse,
      items: items.map(i => ({ product_variant_id: i.product_variant_id, quantity: i.quantity })),
      note: note.trim() || null,
    });
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Chuyển kho</CardTitle>
              <CardDescription>
                Chuyển hàng giữa các kho. Hệ thống sẽ tự động cập nhật tồn kho và ghi nhận giao dịch.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Kho nguồn - Kho đích */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kho nguồn</Label>
              <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn kho nguồn" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.id !== toWarehouse).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name} ({w.code ?? ""})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kho đích</Label>
              <Select value={toWarehouse} onValueChange={setToWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn kho đích" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.id !== fromWarehouse).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name} ({w.code ?? ""})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Danh sách sản phẩm */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Danh sách sản phẩm</Label>
              <Button size="sm" variant="outline" onClick={() => { setShowVariantPicker(true); setVariantSearch(""); }}>
                <Plus className="h-4 w-4 mr-1" /> Thêm sản phẩm
              </Button>
            </div>

            {showVariantPicker && (
              <Card className="border-dashed">
                <CardContent className="p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={variantSearch}
                      onChange={e => setVariantSearch(e.target.value)}
                      placeholder="Nhập tên hoặc SKU sản phẩm..."
                      autoFocus
                      className="flex-1"
                    />
                    <Button size="sm" variant="ghost" onClick={() => setShowVariantPicker(false)}>Đóng</Button>
                  </div>
                  {variantSearch.length >= 1 && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {variantsLoading ? (
                        <p className="text-sm text-muted-foreground">Đang tìm...</p>
                      ) : variants.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Không tìm thấy sản phẩm</p>
                      ) : (
                        variants.map(v => (
                          <button
                            key={v.id}
                            type="button"
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm flex justify-between"
                            onClick={() => addItem(v)}
                          >
                            <span>{v.name ?? "(không tên)"}</span>
                            <span className="text-muted-foreground font-mono text-xs">{v.sku}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Chưa có sản phẩm nào</p>
            ) : (
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.key} className="flex items-center gap-2 rounded-md border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.variant_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label className="text-xs">SL:</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => updateQty(item.key, Number(e.target.value) || 1)}
                        className="h-8 w-20 text-center"
                      />
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeItem(item.key)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ghi chú */}
          <div className="space-y-2">
            <Label>Ghi chú (tuỳ chọn)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Lý do chuyển kho..."
              rows={2}
            />
          </div>

          {/* Submit */}
          <Button
            size="lg"
            className="w-full h-12 text-base"
            disabled={transferMut.isPending || items.length === 0 || !fromWarehouse || !toWarehouse}
            onClick={handleSubmit}
          >
            <ArrowRightLeft className="h-5 w-5 mr-2" />
            {transferMut.isPending ? "Đang chuyển..." : "Xác nhận chuyển kho"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
