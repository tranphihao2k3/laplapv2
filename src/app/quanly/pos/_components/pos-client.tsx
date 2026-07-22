"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Minus, Plus, Trash2, ShoppingCart, Store } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { httpPost } from "@/lib/api/http";
import { useCrudList, useMyShops } from "@/lib/api/admin-crud";
import { useUser } from "@/hooks/use-user";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { ProductSearch, type PosSearchHit } from "./product-search";
import { CustomerPicker } from "./customer-picker";
import { RepairTicketPicker, type RepairTicket } from "./repair-ticket-picker";
import { PaymentDialog } from "./payment-dialog";
import { ReceiptDialog } from "./receipt-dialog";
import {
  formatVND,
  type CartLine,
  type Customer,
  type PaymentMethod,
} from "./types";

type CheckoutResult = {
  order_id?: string;
  order_number?: string;
  [k: string]: unknown;
};

type Setting = {
  key: string | null;
  value: unknown;
  shop_id: string | null;
};

export function PosClient() {
  const [shopId, setShopId] = useState<string>("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [discountInput, setDiscountInput] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [payOpen, setPayOpen] = useState(false);

  // Luồng thanh toán phí sửa chữa (hóa đơn riêng, không trộn với giỏ sản phẩm)
  const [repairTicket, setRepairTicket] = useState<RepairTicket | null>(null);
  const [repairPayOpen, setRepairPayOpen] = useState(false);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    orderNumber?: string;
    lines: CartLine[];
    customer: Customer | null;
    subtotal: number;
    discount: number;
    total: number;
    method: PaymentMethod | null;
    received: number;
    change: number;
    shopName: string;
    shopStampText: string;
    shopAddress: string | null;
    shopPhone: string | null;
    cashierName: string | null;
    issuedAt: string;
    policy: string | null;
    footer: string | null;
  } | null>(null);

  // Chỉ hiển thị cửa hàng mà tài khoản đang đăng nhập được gán (qua shop_staff).
  const shopsQuery = useMyShops();
  const settingsQuery = useCrudList<Setting>("settings", { page: 1, pageSize: 200 });
  const shops = useMemo(() => shopsQuery.data ?? [], [shopsQuery.data]);
  const shopOptions = useMemo<SearchableOption[]>(
    () => shops.map((s) => ({ value: s.id, label: s.name, keywords: s.code ?? "" })),
    [shops],
  );

  useEffect(() => {
    if (!shopId && shops.length > 0) setShopId(shops[0].id);
  }, [shopId, shops]);

  const currentShop = useMemo(() => shops.find((s) => s.id === shopId) ?? null, [shops, shopId]);
  const settings = useMemo(() => settingsQuery.data?.items ?? [], [settingsQuery.data]);

  const shopSettings = useMemo(
    () => settings.filter((s) => !s.shop_id || s.shop_id === shopId),
    [settings, shopId],
  );

  const shopDisplayName = useMemo(() => {
    const found = shopSettings.find((s) => s.key === "receipt.shop_name");
    if (typeof found?.value === "string" && found.value.trim()) return found.value.trim();
    return currentShop?.name ?? "LapLap";
  }, [shopSettings, currentShop]);

  const shopStampText = useMemo(() => {
    const found = shopSettings.find((s) => s.key === "receipt.stamp_text");
    if (typeof found?.value === "string" && found.value.trim()) return found.value.trim();
    return shopDisplayName;
  }, [shopSettings, shopDisplayName]);

  const receiptFooter = useMemo(() => {
    const found = shopSettings.find((s) => s.key === "receipt.footer");
    return typeof found?.value === "string" && found.value.trim() ? found.value.trim() : null;
  }, [shopSettings]);

  const receiptPolicy = useMemo(() => {
    const found = shopSettings.find((s) => s.key === "receipt.policy");
    return typeof found?.value === "string" && found.value.trim() ? found.value.trim() : null;
  }, [shopSettings]);

  // Thu ngân / người bán = tài khoản đang đăng nhập.
  const userQuery = useUser();
  const cashierName = useMemo(() => {
    const u = userQuery.data;
    if (!u) return null;
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const name = meta.full_name ?? meta.name ?? meta.display_name;
    if (typeof name === "string" && name.trim()) return name.trim();
    return u.email ?? null;
  }, [userQuery.data]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("vi-VN"), []);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0),
    [lines],
  );
  const discount = Math.min(subtotal, Number(discountInput.replace(/\D/g, "")) || 0);
  const total = Math.max(0, subtotal - discount);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  const addLine = (hit: PosSearchHit) => {
    if (hit.stock <= 0) {
      toast.error(`"${hit.display_name}" đã hết tồn tại cửa hàng này.`);
      return;
    }
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.variant_id === hit.variant_id);
      if (idx >= 0) {
        const current = prev[idx];
        if (current.quantity >= hit.stock) {
          toast.error(
            `Chỉ còn ${hit.stock} sản phẩm "${hit.display_name}" tại cửa hàng này.`,
          );
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...current, quantity: current.quantity + 1, stock: hit.stock };
        return next;
      }
      return [
        ...prev,
        {
          variant_id: hit.variant_id,
          product_id: hit.product_id,
          display_name: hit.display_name,
          sku: hit.sku,
          thumbnail_url: hit.thumbnail_url,
          list_price: hit.selling_price,
          unit_price: hit.selling_price,
          quantity: 1,
          stock: hit.stock,
        },
      ];
    });
  };

  const setQty = (variantId: string, qty: number) => {
    if (qty <= 0) {
      setLines((prev) => prev.filter((l) => l.variant_id !== variantId));
      return;
    }
    setLines((prev) =>
      prev.map((l) => {
        if (l.variant_id !== variantId) return l;
        if (qty > l.stock) {
          toast.error(`Chỉ còn ${l.stock} sản phẩm "${l.display_name}" tại cửa hàng này.`);
          return { ...l, quantity: l.stock };
        }
        return { ...l, quantity: qty };
      }),
    );
  };

  const setUnitPrice = (variantId: string, unitPrice: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.variant_id !== variantId) return l;
        return { ...l, unit_price: Math.max(0, unitPrice) };
      }),
    );
  };
  const commitUnitPriceDraft = (variantId: string) => {
    const draft = priceDrafts[variantId];
    if (draft == null) return;
    const val = Number(draft.replace(/\D/g, "")) || 0;
    setUnitPrice(variantId, val);
    setPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[variantId];
      return next;
    });
  };

  const repairAmount = useMemo(
    () => (repairTicket ? repairTicket.actual_cost ?? repairTicket.estimated_cost ?? 0 : 0),
    [repairTicket],
  );

  const handlePickRepair = useCallback((ticket: RepairTicket) => {
    setRepairTicket(ticket);
    setRepairPayOpen(true);
  }, []);

  const queryClient = useQueryClient();

  // Sau khi thanh toán xong: tồn kho đã thay đổi → làm mới dữ liệu tìm kiếm sản phẩm ở POS.
  const refreshPosData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pos-search"] });
  }, [queryClient]);

  const checkoutMutation = useMutation({
    mutationFn: (payload: unknown) => httpPost<CheckoutResult>("/v1/checkout", payload),
  });

  const repairCheckoutMutation = useMutation({
    mutationFn: ({ ticketId, payload }: { ticketId: string; payload: unknown }) =>
      httpPost<CheckoutResult>(`/v1/repair-tickets/${ticketId}/checkout`, payload),
  });

  const handleConfirmPayment = async (args: {
    method: PaymentMethod;
    amount: number;
    transaction_code?: string;
  }) => {
    if (!shopId) {
      toast.error("Chọn cửa hàng trước khi thanh toán");
      return;
    }
    if (lines.length === 0) {
      toast.error("Giỏ hàng trống");
      return;
    }
    try {
      const payload = {
        shop_id: shopId,
        customer_id: customer?.id ?? null,
        channel: "pos" as const,
        items: lines.map((l) => ({
          product_variant_id: l.variant_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        discount_amount: discount,
        payment: {
          method: args.method,
          amount: args.amount,
          transaction_code: args.transaction_code ?? null,
        },
        note: note.trim() || null,
      };
      const result = await checkoutMutation.mutateAsync(payload);
      toast.success("Đã lên hóa đơn");
      const received = args.method === "cash" ? Math.max(args.amount, total) : total;
      setLastReceipt({
        orderNumber: result?.order_number ?? (result?.order_id ? String(result.order_id).slice(0, 8) : undefined),
        lines: [...lines],
        customer,
        subtotal,
        discount,
        total,
        method: args.method,
        received,
        change: Math.max(0, received - total),
        shopName: shopDisplayName,
        shopStampText,
        shopAddress: currentShop?.address ?? null,
        shopPhone: currentShop?.phone ?? null,
        cashierName,
        issuedAt: new Date().toISOString(),
        policy: receiptPolicy,
        footer: receiptFooter,
      });
      setPayOpen(false);
      setReceiptOpen(true);
      refreshPosData();
    } catch (e) {
      const apiErr = e as {
        error?: {
          code?: string;
          message?: string;
          details?: { variant_id?: string; requested_qty?: number; available_qty?: number };
        };
      };
      if (apiErr?.error?.code === "INSUFFICIENT_STOCK") {
        const variantId = apiErr.error.details?.variant_id;
        const line = lines.find((l) => l.variant_id === variantId);
        const requested = apiErr.error.details?.requested_qty ?? 0;
        const available = apiErr.error.details?.available_qty ?? 0;
        toast.error(
          `Không đủ tồn kho: ${line?.display_name ?? variantId ?? "Sản phẩm"}. Yêu cầu ${requested}, khả dụng ${available}.`,
        );
        return;
      }
      const msg = apiErr?.error?.message ?? "Không thể tạo hóa đơn";
      toast.error(msg);
    }
  };

  const handleConfirmRepairPayment = async (args: {
    method: PaymentMethod;
    amount: number;
    transaction_code?: string;
    total?: number;
  }) => {
    if (!repairTicket) return;
    // Phí sửa có thể được nhân viên chỉnh trực tiếp ở màn thanh toán POS.
    const finalAmount = args.total != null && args.total > 0 ? args.total : repairAmount;
    try {
      const result = await repairCheckoutMutation.mutateAsync({
        ticketId: repairTicket.id,
        payload: {
          payment: {
            method: args.method,
            amount: args.amount,
            transaction_code: args.transaction_code ?? null,
          },
          actual_cost: finalAmount,
        },
      });
      toast.success("Đã tính tiền phí sửa");
      const repairLine: CartLine = {
        variant_id: `repair-${repairTicket.id}`,
        product_id: null,
        display_name: `${repairTicket.device_name || "Máy sửa"} (Phí sửa)`,
        sku: repairTicket.serial_number || repairTicket.id.slice(0, 8),
        thumbnail_url: null,
        list_price: finalAmount,
        unit_price: finalAmount,
        quantity: 1,
        stock: 1,
      };
      const received = args.method === "cash" ? Math.max(args.amount, finalAmount) : finalAmount;
      setLastReceipt({
        orderNumber:
          result?.order_number ??
          (result?.order_id ? String(result.order_id).slice(0, 8) : undefined),
        lines: [repairLine],
        customer,
        subtotal: finalAmount,
        discount: 0,
        total: finalAmount,
        method: args.method,
        received,
        change: Math.max(0, received - finalAmount),
        shopName: shopDisplayName,
        shopStampText,
        shopAddress: currentShop?.address ?? null,
        shopPhone: currentShop?.phone ?? null,
        cashierName,
        issuedAt: new Date().toISOString(),
        policy: receiptPolicy,
        footer: receiptFooter,
      });
      setRepairPayOpen(false);
      setReceiptOpen(true);
      refreshPosData();
    } catch (e) {
      const apiErr = e as { error?: { message?: string } };
      toast.error(apiErr?.error?.message ?? "Không thể tính tiền phí sửa");
    }
  };

  const resetForNewOrder = () => {
    setLines([]);
    setDiscountInput("");
    setNote("");
    setCustomer(null);
    setReceiptOpen(false);
    setRepairTicket(null);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cửa hàng</Label>
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            <SearchableSelect
              className="flex-1"
              options={shopOptions}
              value={shopId}
              onValueChange={setShopId}
              placeholder="Chọn cửa hàng"
              searchPlaceholder="Tìm cửa hàng..."
              disabled={shops.length === 0}
            />
          </div>
          {!shopsQuery.isLoading && shops.length === 0 && (
            <p className="text-xs text-amber-600">Tài khoản chưa được gán cửa hàng nào.</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Khách hàng</Label>
          <CustomerPicker value={customer} onChange={setCustomer} />
        </div>
        <div className="hidden items-end md:flex">
          <div className="rounded-md border bg-card px-3 py-2 text-right">
            <div className="text-xs text-muted-foreground">Sản phẩm trên đơn</div>
            <div className="text-lg font-semibold">{itemCount}</div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2">
        <ProductSearch onPick={addLine} shopId={shopId} />
        <RepairTicketPicker onPick={handlePickRepair} />
      </div>

      {/* Body: cart + totals */}
      <div className="grid flex-1 min-h-0 gap-3 lg:grid-cols-[1fr_360px]">
        {/* Cart */}
        <div className="flex min-h-0 flex-col rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShoppingCart className="h-4 w-4" />
              Hóa đơn ({lines.length} dòng)
            </div>
            {lines.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setLines([])}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Xoá tất cả
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {lines.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
                Giỏ hàng đang trống.
                <br />
                Quét mã hoặc tìm sản phẩm phía trên để thêm vào.
              </div>
            ) : (
              <table className="w-full min-w-[520px] text-sm">
                <thead className="sticky top-0 bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Sản phẩm</th>
                    <th className="px-2 py-2 text-center font-medium w-40">Đơn giá bán</th>
                    <th className="px-2 py-2 text-center font-medium">SL</th>
                    <th className="px-2 py-2 text-right font-medium">Thành tiền</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const diff = l.list_price - l.unit_price;
                    return (
                      <tr key={l.variant_id} className="border-t">
                        <td className="px-4 py-2">
                          <div className="font-medium">{l.display_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {l.sku ?? "—"}
                            <span
                              className={`ml-2 ${
                                l.quantity >= l.stock ? "text-destructive" : ""
                              }`}
                            >
                              · Tồn CN: {l.stock}
                            </span>
                            {diff !== 0 && (
                              <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                                Giảm lẻ {formatVND(diff)}/cái
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-1 items-end">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={
                                priceDrafts[l.variant_id] !== undefined
                                  ? priceDrafts[l.variant_id]
                                  : numberFormatter.format(l.unit_price)
                              }
                              onFocus={() => {
                                setPriceDrafts((prev) => ({
                                  ...prev,
                                  [l.variant_id]: String(l.unit_price),
                                }));
                              }}
                              onChange={(e) => {
                                setPriceDrafts((prev) => ({
                                  ...prev,
                                  [l.variant_id]: e.target.value.replace(/\D/g, ""),
                                }));
                              }}
                              onBlur={() => commitUnitPriceDraft(l.variant_id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  commitUnitPriceDraft(l.variant_id);
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className="h-7 w-28 text-right font-medium"
                            />
                            {diff !== 0 && (
                              <span className="text-[10px] text-muted-foreground line-through">
                                {formatVND(l.list_price)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => setQty(l.variant_id, l.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              value={l.quantity}
                              onChange={(e) => {
                                const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                                setQty(l.variant_id, n);
                              }}
                              className="h-7 w-12 text-center"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              disabled={l.quantity >= l.stock}
                              onClick={() => setQty(l.variant_id, l.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">
                          {formatVND(l.unit_price * l.quantity)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setQty(l.variant_id, 0)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Totals panel */}
        <div className="flex flex-col gap-3">
          <div className="rounded-md border bg-card p-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tạm tính</span>
                <span className="tabular-nums">{formatVND(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="pos-discount" className="text-muted-foreground">
                  Giảm giá
                </Label>
                <Input
                  id="pos-discount"
                  inputMode="numeric"
                  value={discountInput ? numberFormatter.format(Number(discountInput.replace(/\D/g, "")) || 0) : ""}
                  onChange={(e) => setDiscountInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="h-8 max-w-[140px] text-right"
                />
              </div>
              <div className="border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">Tổng cộng</span>
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    {formatVND(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-card p-4">
            <Label htmlFor="pos-note" className="text-xs text-muted-foreground">
              Ghi chú đơn hàng
            </Label>
            <Input
              id="pos-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú nội bộ (nếu có)"
              className="mt-1"
            />
          </div>

          <Button
            size="lg"
            className="h-14 text-lg font-semibold"
            disabled={lines.length === 0 || !shopId}
            onClick={() => setPayOpen(true)}
          >
            Thanh toán · {formatVND(total)}
          </Button>
        </div>
      </div>

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={total}
        submitting={checkoutMutation.isPending}
        onConfirm={handleConfirmPayment}
      />
      <PaymentDialog
        open={repairPayOpen}
        onOpenChange={setRepairPayOpen}
        total={repairAmount}
        submitting={repairCheckoutMutation.isPending}
        editableTotal
        editableLabel="Phí sửa chữa"
        onConfirm={handleConfirmRepairPayment}
      />
      {lastReceipt && (
        <ReceiptDialog
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          orderNumber={lastReceipt.orderNumber}
          lines={lastReceipt.lines}
          customer={lastReceipt.customer}
          subtotal={lastReceipt.subtotal}
          discount={lastReceipt.discount}
          total={lastReceipt.total}
          method={lastReceipt.method}
          received={lastReceipt.received}
          change={lastReceipt.change}
          shopName={lastReceipt.shopName}
          shopStampText={lastReceipt.shopStampText}
          shopAddress={lastReceipt.shopAddress}
          shopPhone={lastReceipt.shopPhone}
          cashierName={lastReceipt.cashierName}
          issuedAt={lastReceipt.issuedAt}
          policy={lastReceipt.policy}
          footer={lastReceipt.footer}
          onNew={resetForNewOrder}
        />
      )}
    </div>
  );
}
