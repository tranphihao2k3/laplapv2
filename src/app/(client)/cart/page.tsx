"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingCart, ArrowLeft, Tag, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency } from "@/lib/utils";
import type { AppliedVoucher, ValidateVoucherResponse } from "@/types/voucher";

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <ShoppingCart className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">Giỏ hàng trống</h2>
      <p className="mb-8 max-w-sm text-sm text-muted-foreground">
        Bạn chưa thêm sản phẩm nào vào giỏ hàng. Hãy khám phá các sản phẩm của chúng tôi ngay!
      </p>
      <Button asChild size="lg" className="rounded-xl px-8">
        <Link href="/products">Khám phá sản phẩm</Link>
      </Button>
    </div>
  );
}

function CartItemRow({ item }: { item: ReturnType<typeof useCartStore.getState>["items"][number] }) {
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const atMax = item.quantity >= item.stockQty;

  const handleMinus = () => setQuantity(item.variantId, item.quantity - 1);
  const handlePlus = () => {
    if (!atMax) setQuantity(item.variantId, item.quantity + 1);
  };

  return (
    <div className="flex gap-4 rounded-xl border border-border/60 bg-white p-4 transition-colors hover:bg-muted/30 sm:p-5">
      {/* Ảnh */}
      <Link href={`/products/${item.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:h-24 sm:w-24">
        {item.image ? (
          <Image src={item.image} alt={item.name} fill className="object-cover" sizes="96px" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No img</div>
        )}
      </Link>

      {/* Thông tin */}
      <div className="flex flex-1 flex-col justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <Link
            href={`/products/${item.slug}`}
            className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors hover:text-primary sm:text-base"
          >
            {item.name}
          </Link>
          {item.attributes && (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.attributes}</p>
          )}
        </div>

        {/* Giá + qty */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground sm:text-base">
            {formatCurrency(item.price * item.quantity)}
          </span>

          <div className="flex items-center gap-2">
            {/* Qty controls */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-white">
              <button
                type="button"
                onClick={handleMinus}
                aria-label="Giảm số lượng"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <Minus className="h-3 w-3" />
              </button>
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setQuantity(item.variantId, Math.min(val, item.stockQty));
                }}
                min={1}
                max={item.stockQty}
                className="h-7 w-10 border-0 p-0 text-center text-xs font-medium focus-visible:ring-0"
                aria-label={`Số lượng ${item.name}`}
              />
              <button
                type="button"
                onClick={handlePlus}
                disabled={atMax}
                aria-label="Tăng số lượng"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {/* Xoá */}
            <button
              type="button"
              onClick={() => removeItem(item.variantId)}
              aria-label={`Xoá ${item.name} khỏi giỏ hàng`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoucherSection() {
  const [voucherCode, setVoucherCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appliedVoucher = useCartStore((s) => s.appliedVoucher);
  const applyVoucher = useCartStore((s) => s.applyVoucher);
  const removeVoucher = useCartStore((s) => s.removeVoucher);
  const subtotal = useCartStore((s) => s.subtotal());
  const items = useCartStore((s) => s.items);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      setError("Vui lòng nhập mã voucher");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const supabase = createClient();
      const response = await fetch("/api/public/vouchers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucherCode.trim(),
          order_amount: subtotal,
          product_ids: items.map((i) => i.productId),
        }),
      });

      const result: ValidateVoucherResponse = await response.json();

      if (!result.valid) {
        setError(result.error_message || "Mã voucher không hợp lệ");
        return;
      }

      const applied: AppliedVoucher = {
        id: result.voucher_id!,
        code: voucherCode.trim().toUpperCase(),
        name: result.voucher_name!,
        type: result.voucher_type!,
        value: 0, // Value will be recalculated based on subtotal
        discount_amount: result.discount_amount!,
        max_discount_amount: null,
      };

      applyVoucher(applied);
      setVoucherCode("");
      toast.success(`Đã áp dụng voucher "${applied.name}"`);
    } catch (err) {
      setError("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveVoucher = () => {
    removeVoucher();
    toast.success("Đã xoá voucher");
  };

  if (appliedVoucher) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-800 truncate">{appliedVoucher.name}</p>
              <p className="text-xs text-emerald-600">Mã: {appliedVoucher.code}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground shrink-0 hover:text-destructive"
            onClick={handleRemoveVoucher}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Xoá
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={voucherCode}
            onChange={(e) => {
              setVoucherCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Nhập mã voucher"
            className="pl-9 font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApplyVoucher();
              }
            }}
          />
        </div>
        <Button
          onClick={handleApplyVoucher}
          disabled={isValidating || !voucherCode.trim()}
          className="shrink-0"
          size="sm"
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Áp dụng"
          )}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const syncStock = useCartStore((s) => s.syncStock);
  const subtotal = useCartStore((s) => s.subtotal());
  const appliedVoucher = useCartStore((s) => s.appliedVoucher);
  const discountAmount = useCartStore((s) => s.discountAmount());
  const totalAfterDiscount = useCartStore((s) => s.totalAfterDiscount());
  const totalItems = useCartStore((s) => s.totalItems());
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current || items.length === 0) return;
    fetched.current = true;

    const variantIds = items.map((i) => i.variantId);
    const supabase = createClient();
    supabase
      .from("stock_levels")
      .select("product_variant_id, available_qty")
      .in("product_variant_id", variantIds)
      .then(({ data }) => {
        const stockByVariant: Record<string, number> = {};
        for (const s of data ?? []) {
          if (!s.product_variant_id) continue;
          stockByVariant[s.product_variant_id] =
            (stockByVariant[s.product_variant_id] ?? 0) + (s.available_qty ?? 0);
        }
        // Ensure all variants have an entry (0 if not found → out of stock)
        for (const vid of variantIds) {
          if (stockByVariant[vid] === undefined) stockByVariant[vid] = 0;
        }
        syncStock(stockByVariant);
      });
  }, [items, syncStock]);

  if (items.length === 0) {
    return (
      <div className="container mx-auto min-h-screen px-4 pb-20">
        <EmptyCart />
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-screen px-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 py-6">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/products" aria-label="Quay lại">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Giỏ hàng</h1>
          <p className="text-sm text-muted-foreground">{totalItems} sản phẩm</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Danh sách sản phẩm */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <CartItemRow key={item.variantId} item={item} />
          ))}

          <div className="pt-2">
            <Button variant="outline" asChild className="rounded-xl text-sm">
              <Link href="/products" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Tiếp tục mua sắm
              </Link>
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Tóm tắt đơn hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* Voucher Input */}
              <div className="pb-3 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  <Tag className="inline h-3 w-3 mr-1" />
                  Mã giảm giá
                </p>
                <VoucherSection />
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Tạm tính ({totalItems} sản phẩm)</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              
              {/* Discount */}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Giảm giá</span>
                <span className={cn(
                  "font-medium",
                  appliedVoucher ? "text-emerald-600" : "text-muted-foreground"
                )}>
                  {appliedVoucher ? (
                    <span className="flex items-center gap-1">
                      - {formatCurrency(discountAmount)}
                      <Badge variant="outline" className="text-[10px] h-4 ml-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                        {appliedVoucher.code}
                      </Badge>
                    </span>
                  ) : (
                    <span>0 đ</span>
                  )}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí vận chuyển</span>
                <span className="font-medium">
                  {subtotal >= 5000000 ? (
                    <span className="text-emerald-600">Miễn phí</span>
                  ) : (
                    <span className="text-orange-500">Chưa tính</span>
                  )}
                </span>
              </div>

              {subtotal < 5000000 && (
                <div className="rounded-lg bg-orange-50 p-3 text-xs text-orange-700">
                  <strong>Mua thêm {formatCurrency(5000000 - subtotal)}</strong> để được miễn phí vận chuyển!
                </div>
              )}

              <div className="h-px bg-border" />

              <div className="flex justify-between text-base font-bold">
                <span>Tổng cộng</span>
                <span className={cn(
                  appliedVoucher && discountAmount > 0 && "text-emerald-600"
                )}>
                  {formatCurrency(appliedVoucher ? totalAfterDiscount : subtotal)}
                </span>
              </div>
              
              {appliedVoucher && discountAmount > 0 && (
                <p className="text-xs text-emerald-600 text-center">
                  Tiết kiệm {formatCurrency(discountAmount)} với voucher!
                </p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-0">
              <Button className="w-full rounded-xl text-sm font-semibold" size="lg">
                Tiến hành thanh toán
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
