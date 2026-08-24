"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  Store,
  Tag,
  Pause,
  Banknote,
  AlertTriangle,
  Receipt,
  Percent,
  StickyNote,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { httpPost } from "@/lib/api/http";
import { useCrudList, useMyShops } from "@/lib/api/admin-crud";
import { useUser } from "@/hooks/use-user";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { ProductSearch, type PosSearchHit } from "./product-search";
import { CustomerPicker } from "./customer-picker";
import { RepairTicketPicker, type RepairTicket } from "./repair-ticket-picker";
import { PaymentDialog } from "./payment-dialog";
import { ReceiptDialog } from "./receipt-dialog";
import { HoldBillDrawer } from "./hold-bill-drawer";
import { PosSessionBanner } from "./pos-session-banner";
import { PosSessionProvider, usePosSession } from "@/hooks/use-pos-session";
import { PosSessionGate } from "./pos-session-gate";
import {
  formatVND,
  formatNumber,
  calcSubtotal,
  calcItemCount,
  type CartLine,
  type Customer,
  type HeldBill,
  type PaymentPart,
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

const DEFAULT_LOYALTY_RATE = 1000;

export function PosClient() {
  return (
    <PosSessionProvider>
      <PosClientInner />
    </PosSessionProvider>
  );
}

function PosClientInner() {
  // ===== Core state =====
  const [shopId, setShopId] = useState<string>("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [discountInput, setDiscountInput] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [showNote, setShowNote] = useState(false);

  // ===== Hold bills =====
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);

  // ===== Loyalty redeem =====
  const [redeemedPoints, setRedeemedPoints] = useState(0);
  const [redeemedValue, setRedeemedValue] = useState(0);

  // ===== Dialogs =====
  const [payOpen, setPayOpen] = useState(false);
  const [repairTicket, setRepairTicket] = useState<RepairTicket | null>(null);
  const [repairPayOpen, setRepairPayOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    orderNumber?: string;
    lines: CartLine[];
    customer: Customer | null;
    subtotal: number;
    discount: number;
    loyaltyDiscount: number;
    total: number;
    payments: PaymentPart[];
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

  // ===== Data =====
  const shopsQuery = useMyShops();
  const settingsQuery = useCrudList<Setting>("settings", { page: 1, pageSize: 200 });
  const userQuery = useUser();

  const shops = useMemo(() => shopsQuery.data ?? [], [shopsQuery.data]);
  const shopOptions = useMemo<SearchableOption[]>(
    () => shops.map((s) => ({ value: s.id, label: s.name, keywords: s.code ?? "" })),
    [shops],
  );

  useEffect(() => {
    if (!shopId && shops.length > 0) setShopId(shops[0].id);
  }, [shopId, shops]);

  const currentShop = useMemo(
    () => shops.find((s) => s.id === shopId) ?? null,
    [shops, shopId],
  );
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

  // Lấy email shop để in receipt (chưa có field → để null)
  const shopEmail = null;

  const cashierName = useMemo(() => {
    const u = userQuery.data;
    if (!u) return null;
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const name = meta.full_name ?? meta.name ?? meta.display_name;
    if (typeof name === "string" && name.trim()) return name.trim();
    return u.email ?? null;
  }, [userQuery.data]);

  // ===== Derived totals =====
  const subtotal = useMemo(() => calcSubtotal(lines), [lines]);
  const flatDiscount = Math.min(subtotal, Number(discountInput.replace(/\D/g, "")) || 0);
  const loyaltyDiscount = redeemedValue;
  const total = useMemo(
    () => Math.max(0, subtotal - flatDiscount - loyaltyDiscount),
    [subtotal, flatDiscount, loyaltyDiscount],
  );
  const itemCount = useMemo(() => calcItemCount(lines), [lines]);

  // ===== Cart ops =====
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

  const clearCart = () => {
    if (lines.length === 0) return;
    if (!window.confirm("Xoá tất cả sản phẩm trong giỏ?")) return;
    setLines([]);
    setDiscountInput("");
  };

  // ===== Hold bill =====
  const holdBill = () => {
    if (lines.length === 0) {
      toast.error("Giỏ hàng trống");
      return;
    }
    if (!shopId) {
      toast.error("Chọn cửa hàng trước");
      return;
    }
    const id = `hold-${Date.now()}`;
    const idx = heldBills.length + 1;
    const name = customer?.full_name
      ? `${customer.full_name} #${idx}`
      : `Đơn #${idx}`;
    const bill: HeldBill = {
      id,
      name,
      createdAt: new Date().toISOString(),
      shopId,
      customer,
      lines: [...lines],
      discount: flatDiscount,
      note,
    };
    setHeldBills((prev) => [bill, ...prev]);
    // Reset cart (giữ KH? thường giữ cũng được — ở đây reset cho gọn)
    setLines([]);
    setDiscountInput("");
    setNote("");
    toast.success(`Đã giữ ${name}`);
  };

  const resumeBill = (bill: HeldBill) => {
    if (lines.length > 0) {
      if (!window.confirm("Giỏ hàng hiện tại sẽ bị thay thế bằng đơn đang mở. Tiếp tục?")) {
        return;
      }
    }
    setLines(bill.lines);
    setDiscountInput(bill.discount > 0 ? String(bill.discount) : "");
    setNote(bill.note);
    setCustomer(bill.customer);
    setHeldBills((prev) => prev.filter((b) => b.id !== bill.id));
    toast.success(`Đã mở ${bill.name}`);
  };

  const deleteHeldBill = (id: string) => {
    setHeldBills((prev) => prev.filter((b) => b.id !== id));
  };

  // ===== Loyalty redeem =====
  const handleRedeem = (points: number, valueVnd: number) => {
    setRedeemedPoints(points);
    setRedeemedValue(valueVnd);
    toast.success(`Đã áp dụng ${points} điểm (-${formatVND(valueVnd)})`);
  };
  const clearRedeem = () => {
    setRedeemedPoints(0);
    setRedeemedValue(0);
  };

  // ===== Repair ticket =====
  const repairAmount = useMemo(
    () => (repairTicket ? repairTicket.actual_cost ?? repairTicket.estimated_cost ?? 0 : 0),
    [repairTicket],
  );

  const handlePickRepair = useCallback((ticket: RepairTicket) => {
    setRepairTicket(ticket);
    setRepairPayOpen(true);
  }, []);

  // ===== Checkout =====
  const queryClient = useQueryClient();
  const refreshPosData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pos-search"] });
    queryClient.invalidateQueries({ queryKey: ["pos-sessions"] });
  }, [queryClient]);

  // Lấy session hiện tại cho shop để gắn vào checkout
  const { findOpenSession, refresh: refreshSession } = usePosSession();
  const currentSession = shopId ? findOpenSession(shopId) : null;

  const checkoutMutation = useMutation({
    mutationFn: (payload: unknown) => httpPost<CheckoutResult>("/v1/checkout", payload),
  });

  const repairCheckoutMutation = useMutation({
    mutationFn: ({ ticketId, payload }: { ticketId: string; payload: unknown }) =>
      httpPost<CheckoutResult>(`/v1/repair-tickets/${ticketId}/checkout`, payload),
  });

  const handleConfirmPayment = async (args: {
    payments: PaymentPart[];
    total?: number;
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
      const totalAmount = args.total ?? total;
      // Gộp payments thành 1 dòng đầu cho backend (chấp nhận multi method)
      // Backend hiện chỉ chấp nhận 1 payment — lấy payment đầu tiên là chính,
      // gộp phần còn lại vào note để đối chiếu.
      const primary = args.payments[0];
      const rest = args.payments.slice(1);
      const extraNote = rest.length
        ? `${note.trim() ? note.trim() + "\n" : ""}[Thanh toán ghép: ${rest
            .map((p) => `${formatVND(p.amount)} (${p.method})`)
            .join(" + ")}]`
        : note.trim() || null;

      const payload = {
        shop_id: shopId,
        customer_id: customer?.id ?? null,
        channel: "pos" as const,
        items: lines.map((l) => ({
          product_variant_id: l.variant_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        discount_amount: flatDiscount + loyaltyDiscount,
        payment: {
          method: primary.method,
          amount: totalAmount,
          transaction_code: primary.transaction_code ?? null,
        },
        note: extraNote,
        pos_session_id: currentSession?.id ?? null,
      };
      const result = await checkoutMutation.mutateAsync(payload);
      toast.success("Đã lên hóa đơn");
      // Cập nhật session expected_cash sau khi thanh toán
      void refreshSession();

      const received = args.payments.reduce((s, p) => s + p.amount, 0);
      setLastReceipt({
        orderNumber:
          result?.order_number ??
          (result?.order_id ? String(result.order_id).slice(0, 8) : undefined),
        lines: [...lines],
        customer,
        subtotal,
        discount: flatDiscount,
        loyaltyDiscount,
        total: totalAmount,
        payments: args.payments,
        received,
        change: Math.max(0, received - totalAmount),
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
    payments: PaymentPart[];
    total?: number;
  }) => {
    if (!repairTicket) return;
    const finalAmount = args.total != null && args.total > 0 ? args.total : repairAmount;
    try {
      const primary = args.payments[0];
      const result = await repairCheckoutMutation.mutateAsync({
        ticketId: repairTicket.id,
        payload: {
          payment: {
            method: primary.method,
            amount: finalAmount,
            transaction_code: primary.transaction_code ?? null,
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
      const received = args.payments.reduce((s, p) => s + p.amount, 0);
      setLastReceipt({
        orderNumber:
          result?.order_number ??
          (result?.order_id ? String(result.order_id).slice(0, 8) : undefined),
        lines: [repairLine],
        customer,
        subtotal: finalAmount,
        discount: 0,
        loyaltyDiscount: 0,
        total: finalAmount,
        payments: args.payments,
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
    clearRedeem();
    setReceiptOpen(false);
    setRepairTicket(null);
  };

  // ===== Shortcuts =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || (target?.isContentEditable ?? false);
      if (isEditable) return;
      // F2 → focus search
      if (e.key === "F2") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[aria-label="Tìm sản phẩm"]',
        );
        searchInput?.focus();
        return;
      }
      // F9 → thanh toán
      if (e.key === "F9") {
        e.preventDefault();
        if (lines.length > 0 && shopId) setPayOpen(true);
        return;
      }
      // F8 → giữ đơn
      if (e.key === "F8") {
        e.preventDefault();
        holdBill();
        return;
      }
      // Esc → đóng dialogs
      if (e.key === "Escape") {
        if (payOpen) setPayOpen(false);
        else if (repairPayOpen) setRepairPayOpen(false);
        else if (receiptOpen) setReceiptOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length, shopId, payOpen, repairPayOpen, receiptOpen]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("vi-VN"), []);

  const lowStockCount = useMemo(
    () => lines.filter((l) => l.quantity >= l.stock).length,
    [lines],
  );

  return (
    <PosSessionGate shopId={shopId}>
      <div className="flex h-full flex-col gap-3 pb-20 lg:pb-0">
        {/* Banner ca POS */}
        <PosSessionBanner shopId={shopId} />
        {/* ============== HEADER ============== */}
        <header className="rounded-xl border bg-gradient-to-br from-card via-card to-muted/30 p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">
              <Store className="mr-1 inline h-3 w-3" />
              Cửa hàng
            </Label>
            <SearchableSelect
              className="h-10"
              options={shopOptions}
              value={shopId}
              onValueChange={setShopId}
              placeholder="Chọn cửa hàng"
              searchPlaceholder="Tìm cửa hàng..."
              disabled={shops.length === 0}
            />
            {!shopsQuery.isLoading && shops.length === 0 && (
              <p className="text-xs text-amber-600">Tài khoản chưa được gán cửa hàng nào.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Khách hàng</Label>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </div>
          <div className="hidden items-end gap-2 sm:flex">
            <KpiTile label="Sản phẩm" value={formatNumber(itemCount)} />
            <KpiTile label="Dòng" value={String(lines.length)} />
          </div>
        </div>

        {/* Mobile KPI bar */}
        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <KpiTile label="Sản phẩm" value={formatNumber(itemCount)} className="flex-1" />
          <KpiTile label="Dòng" value={String(lines.length)} className="flex-1" />
        </div>
      </header>

      {/* ============== SEARCH BAR ============== */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-2 py-1.5 shadow-sm">
          <ScanLine className="ml-1 h-4 w-4 text-primary" />
          <ProductSearch onPick={addLine} shopId={shopId} />
        </div>
        <RepairTicketPicker onPick={handlePickRepair} />
        <HoldBillDrawer
          heldBills={heldBills}
          onResume={resumeBill}
          onDelete={deleteHeldBill}
        />
      </div>

      {/* ============== BODY: Cart + Totals ============== */}
      <div className="grid flex-1 min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ----- CART ----- */}
        <div className="flex min-h-0 flex-col rounded-xl border bg-card shadow-sm">
          {/* Cart header sticky */}
          <div className="flex items-center justify-between border-b bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span>Hóa đơn</span>
              <Badge variant="secondary" className="ml-1 font-mono">
                {lines.length} dòng
              </Badge>
              {lowStockCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  <AlertTriangle className="mr-0.5 h-3 w-3" />
                  {lowStockCount} đạt max
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {lines.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={holdBill}
                    className="h-8 text-xs"
                  >
                    <Pause className="mr-1 h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Giữ đơn</span>
                    <span className="sm:hidden">Giữ</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearCart}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Xoá tất cả</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Cart items */}
          <div className="min-h-0 flex-1 overflow-auto">
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Giỏ hàng đang trống</p>
                  <p className="text-sm text-muted-foreground">
                    Quét mã vạch hoặc tìm sản phẩm phía trên để thêm vào.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Phím tắt: <Kbd>F2</Kbd> tìm · <Kbd>F8</Kbd> giữ đơn · <Kbd>F9</Kbd> thanh toán
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {lines.map((l) => {
                  const lineTotal = l.unit_price * l.quantity;
                  const diff = l.list_price - l.unit_price;
                  const atMax = l.quantity >= l.stock;
                  return (
                    <div
                      key={l.variant_id}
                      className="group relative flex items-start gap-2 px-3 py-3 transition-colors hover:bg-muted/30 sm:px-4"
                    >
                      {/* Thumbnail placeholder */}
                      <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground sm:flex">
                        <Receipt className="h-5 w-5" />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-semibold">
                                {l.display_name}
                              </p>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="font-mono">{l.sku ?? "—"}</span>
                              <span
                                className={`flex items-center gap-0.5 ${
                                  atMax ? "font-semibold text-destructive" : ""
                                }`}
                              >
                                · Tồn: {l.stock}
                              </span>
                              {diff > 0 && (
                                <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                                  Giảm {formatVND(diff)}/cái
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setQty(l.variant_id, 0)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                            aria-label="Xoá dòng"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Price + Qty controls */}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Label className="hidden text-xs text-muted-foreground sm:block">
                              Đơn giá
                            </Label>
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
                              className="h-8 w-28 text-right text-sm font-medium tabular-nums"
                            />
                            {diff > 0 && (
                              <span className="hidden text-xs text-muted-foreground line-through sm:inline tabular-nums">
                                {formatVND(l.list_price)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center rounded-lg border bg-card shadow-sm">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-r-none"
                                onClick={() => setQty(l.variant_id, l.quantity - 1)}
                                aria-label="Giảm"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <Input
                                value={l.quantity}
                                onChange={(e) => {
                                  const n = Number(e.target.value.replace(/\D/g, "")) || 0;
                                  setQty(l.variant_id, n);
                                }}
                                className="h-8 w-12 rounded-none border-x-0 text-center text-sm font-semibold tabular-nums"
                                inputMode="numeric"
                                aria-label="Số lượng"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-l-none"
                                disabled={atMax}
                                onClick={() => setQty(l.variant_id, l.quantity + 1)}
                                aria-label="Tăng"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="min-w-[90px] text-right text-sm font-bold tabular-nums text-foreground">
                              {formatVND(lineTotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ----- TOTALS PANEL ----- */}
        <aside className="flex flex-col gap-3">
          {/* Tổng quan */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="space-y-2.5 text-sm">
              <Row label="Tạm tính" value={formatVND(subtotal)} />
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="pos-discount"
                  className="flex items-center gap-1 text-muted-foreground"
                >
                  <Tag className="h-3.5 w-3.5" />
                  Giảm giá
                </Label>
                <Input
                  id="pos-discount"
                  inputMode="numeric"
                  value={
                    discountInput
                      ? numberFormatter.format(Number(discountInput.replace(/\D/g, "")) || 0)
                      : ""
                  }
                  onChange={(e) => setDiscountInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="h-8 max-w-[140px] text-right tabular-nums"
                />
              </div>
              {loyaltyDiscount > 0 && (
                <Row
                  label="Điểm thưởng"
                  value={`-${formatVND(loyaltyDiscount)}`}
                  accent="text-amber-600 dark:text-amber-400"
                />
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Tổng cộng</span>
                <span className="text-2xl font-extrabold text-primary tabular-nums">
                  {formatVND(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Ghi chú */}
          <div className="rounded-xl border bg-card shadow-sm">
            <button
              type="button"
              onClick={() => setShowNote((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <StickyNote className="h-3.5 w-3.5" />
                Ghi chú đơn hàng
                {note && <Badge variant="secondary" className="ml-1 text-[10px]">Có</Badge>}
              </span>
              <span className="text-xs text-muted-foreground">{showNote ? "Ẩn" : "Mở"}</span>
            </button>
            {showNote && (
              <div className="border-t px-4 pb-3 pt-2">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú nội bộ (nếu có)"
                  className="h-9"
                />
              </div>
            )}
          </div>

          {/* Action buttons — sticky trên desktop, dính đáy mobile */}
          <div className="flex flex-col gap-2 lg:sticky lg:bottom-3">
            <Button
              size="lg"
              className="h-14 text-base font-bold shadow-md sm:text-lg"
              disabled={lines.length === 0 || !shopId}
              onClick={() => setPayOpen(true)}
            >
              <Banknote className="mr-2 h-5 w-5" />
              Thanh toán · {formatVND(total)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={lines.length === 0 || !shopId}
              onClick={holdBill}
            >
              <Pause className="mr-1.5 h-4 w-4" />
              Giữ đơn tạm
              <span className="ml-2 hidden text-[10px] text-muted-foreground sm:inline">
                F8
              </span>
            </Button>
          </div>

          {/* Tip */}
          {lines.length === 0 && (
            <div className="rounded-xl border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold">
                <Percent className="mr-1 inline h-3 w-3" />
                Phím tắt
              </p>
              <ul className="space-y-0.5">
                <li>
                  <Kbd>F2</Kbd> — Tìm sản phẩm
                </li>
                <li>
                  <Kbd>/</Kbd> — Tìm nhanh
                </li>
                <li>
                  <Kbd>F8</Kbd> — Giữ đơn
                </li>
                <li>
                  <Kbd>F9</Kbd> — Thanh toán
                </li>
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* ============== DIALOGS ============== */}
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        total={total}
        submitting={checkoutMutation.isPending}
        customer={customer}
        loyaltyRate={DEFAULT_LOYALTY_RATE}
        redeemedPoints={redeemedPoints}
        redeemedValue={redeemedValue}
        hasRedeemed={redeemedValue > 0}
        onLoyaltyRedeem={handleRedeem}
        onLoyaltyClear={clearRedeem}
        onConfirm={handleConfirmPayment}
      />
      <PaymentDialog
        open={repairPayOpen}
        onOpenChange={setRepairPayOpen}
        total={repairAmount}
        submitting={repairCheckoutMutation.isPending}
        editableTotal
        editableLabel="Phí sửa chữa"
        customer={customer}
        loyaltyRate={DEFAULT_LOYALTY_RATE}
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
          loyaltyDiscount={lastReceipt.loyaltyDiscount}
          total={lastReceipt.total}
          payments={lastReceipt.payments}
          received={lastReceipt.received}
          change={lastReceipt.change}
          shopName={lastReceipt.shopName}
          shopStampText={lastReceipt.shopStampText}
          shopAddress={lastReceipt.shopAddress}
          shopPhone={lastReceipt.shopPhone}
          shopEmail={shopEmail}
          cashierName={lastReceipt.cashierName}
          issuedAt={lastReceipt.issuedAt}
          policy={lastReceipt.policy}
          footer={lastReceipt.footer}
          onNew={resetForNewOrder}
        />
      )}
      </div>
    </PosSessionGate>
  );
}

// ============ Sub-components ============

function KpiTile({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border bg-card px-3 py-2 text-center shadow-sm ${className ?? ""}`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${accent ?? ""}`}>{value}</span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border bg-muted px-1 font-mono text-[10px] font-semibold text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}