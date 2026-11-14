"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  Tag,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoucherPickerDialog } from "@/components/client/vouchers/voucher-picker-dialog";
import { useCartStore } from "@/stores/cart-store";
import { formatCurrency } from "@/lib/utils";
import { validateVoucherForCart } from "@/lib/vouchers/client";

type PlacedOrder = {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
};

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const hydrated = useCartStore((s) => s.hydrated);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = useCartStore((s) => s.subtotal());
  const discountAmount = useCartStore((s) => s.discountAmount());
  const appliedVoucher = useCartStore((s) => s.appliedVoucher);
  const applyVoucher = useCartStore((s) => s.applyVoucher);
  const removeVoucher = useCartStore((s) => s.removeVoucher);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "bank_transfer">("cod");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const [voucherInput, setVoucherInput] = useState("");
  const [voucherApplying, setVoucherApplying] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherPickerOpen, setVoucherPickerOpen] = useState(false);

  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);
  const freeShipping =
    appliedVoucher?.type === "free_shipping" || subtotal >= 5_000_000;

  async function handleApplyVoucher(code: string) {
    if (!code.trim() || voucherApplying) return;
    setVoucherApplying(true);
    setVoucherError(null);
    try {
      const voucher = await validateVoucherForCart({
        code,
        subtotal,
        productIds: items.map((i) => i.productId),
      });
      applyVoucher(voucher);
      setVoucherInput("");
      toast.success(`Đã áp dụng voucher "${voucher.name}"`);
    } catch (e) {
      setVoucherError(
        e instanceof Error ? e.message : "Không áp dụng được voucher",
      );
    } finally {
      setVoucherApplying(false);
    }
  }

  useEffect(() => {
    if (hydrated && items.length === 0 && !placed) {
      // let user see message instead of hard redirect loops
    }
  }, [hydrated, items.length, placed]);

  if (!hydrated) {
    return (
      <div className="container mx-auto min-h-[60vh] px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (placed) {
    return (
      <div className="container mx-auto min-h-[60vh] px-4 py-16">
        <Card className="mx-auto max-w-xl rounded-2xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold">Đặt hàng thành công</h1>
            <p className="text-sm text-muted-foreground">
              Cảm ơn bạn đã đặt hàng. Mã đơn hàng của bạn:
            </p>
            <div className="inline-flex rounded-lg border bg-muted/40 px-4 py-2 font-mono text-lg font-semibold">
              {placed.order_number}
            </div>
            <p className="text-sm text-muted-foreground">
              Tổng thanh toán: <span className="font-semibold text-foreground">{formatCurrency(placed.total_amount ?? total)}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button asChild>
                <Link href="/products">Tiếp tục mua sắm</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/account/orders">Xem đơn hàng</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto min-h-[60vh] px-4 py-16">
        <Card className="mx-auto max-w-xl rounded-2xl">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-7 w-7 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold">Giỏ hàng trống</h1>
            <p className="text-sm text-muted-foreground">Bạn chưa có sản phẩm để thanh toán.</p>
            <Button asChild>
              <Link href="/cart">Quay lại giỏ hàng</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      toast.error("Vui lòng điền họ tên, số điện thoại và địa chỉ nhận hàng.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim(),
          note: note.trim() || undefined,
          paymentMethod,
          voucherCode: appliedVoucher?.code || undefined,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || "Không thể đặt hàng. Vui lòng thử lại.");
      }
      const order = json.data?.order as PlacedOrder | undefined;
      if (!order) throw new Error("Không nhận được thông tin đơn hàng.");
      clearCart();
      setPlaced(order);
      toast.success("Đặt hàng thành công");
    } catch (err: any) {
      toast.error(err?.message || "Không thể đặt hàng. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto min-h-screen px-4 pb-24">
      <div className="flex items-center gap-4 py-6">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/cart" aria-label="Quay lại giỏ hàng">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Thanh toán</h1>
          <p className="text-sm text-muted-foreground">Điền thông tin để hoàn tất đặt hàng</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Thông tin giao hàng</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="fullName">Họ và tên *</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" required />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="phone">Số điện thoại *</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email (tuỳ chọn)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Địa chỉ nhận hàng *</Label>
                <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" required rows={3} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="note">Ghi chú (tuỳ chọn)</Label>
                <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Yêu cầu thêm cho đơn hàng..." rows={2} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Phương thức thanh toán</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label htmlFor="pm-cod" className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  id="pm-cod"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <div>
                  <div className="font-medium">Thanh toán khi nhận hàng (COD)</div>
                  <div className="text-sm text-muted-foreground">Thanh toán bằng tiền mặt khi nhận sản phẩm.</div>
                </div>
              </label>
              <label htmlFor="pm-bank" className="flex items-start gap-3 rounded-xl border p-4 cursor-pointer hover:bg-muted/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  id="pm-bank"
                  name="paymentMethod"
                  value="bank_transfer"
                  checked={paymentMethod === "bank_transfer"}
                  onChange={() => setPaymentMethod("bank_transfer")}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <div>
                  <div className="font-medium">Chuyển khoản ngân hàng</div>
                  <div className="text-sm text-muted-foreground">Cửa hàng sẽ liên hệ xác nhận và gửi thông tin chuyển khoản.</div>
                </div>
              </label>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-20 rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Đơn hàng ({items.length} sản phẩm)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.variantId} className="flex gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {item.image ? (
                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="56px" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-medium leading-snug">{item.name}</p>
                      {item.attributes ? <p className="text-[11px] text-muted-foreground truncate">{item.attributes}</p> : null}
                      <p className="text-xs text-muted-foreground">SL: {item.quantity}</p>
                    </div>
                    <div className="text-xs font-medium whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-border" />

              {appliedVoucher ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-emerald-800">
                          {appliedVoucher.name}
                        </p>
                        <p className="text-xs text-emerald-700">
                          Mã {appliedVoucher.code}
                          {discountAmount > 0
                            ? ` · giảm ${formatCurrency(discountAmount)}`
                            : appliedVoucher.type === "free_shipping"
                              ? " · miễn phí vận chuyển"
                              : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeVoucher();
                        setVoucherError(null);
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-100"
                      aria-label="Bỏ voucher"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Ticket className="h-3.5 w-3.5" />
                    Mã giảm giá
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={voucherInput}
                        onChange={(e) => {
                          setVoucherInput(e.target.value.toUpperCase());
                          setVoucherError(null);
                        }}
                        placeholder="Nhập mã"
                        className="h-9 pl-8 font-mono text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleApplyVoucher(voucherInput);
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0"
                      disabled={!voucherInput.trim() || voucherApplying}
                      onClick={() => void handleApplyVoucher(voucherInput)}
                    >
                      {voucherApplying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Áp dụng"
                      )}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVoucherPickerOpen(true)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Chọn từ voucher đang có →
                  </button>
                  {voucherError ? (
                    <p className="text-xs text-red-500">{voucherError}</p>
                  ) : null}
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Tạm tính</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Giảm giá</span>
                <span className="font-medium text-emerald-600">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí vận chuyển</span>
                <span
                  className={
                    freeShipping
                      ? "font-medium text-emerald-600"
                      : "font-medium text-muted-foreground"
                  }
                >
                  {freeShipping ? "Miễn phí" : "Liên hệ xác nhận"}
                </span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between text-base font-bold">
                <span>Tổng cộng</span>
                <span>{formatCurrency(total)}</span>
              </div>

              <Button type="submit" className="w-full rounded-xl" size="lg" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang đặt hàng...</> : "Xác nhận đặt hàng"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Bằng việc đặt hàng, bạn đồng ý để cửa hàng liên hệ xác nhận đơn.
              </p>
            </CardContent>
          </Card>
        </div>
      </form>

      <VoucherPickerDialog
        open={voucherPickerOpen}
        onOpenChange={setVoucherPickerOpen}
        selectedCode={appliedVoucher?.code}
        onSelect={(code) => {
          setVoucherPickerOpen(false);
          void handleApplyVoucher(code);
        }}
      />
    </div>
  );
}
