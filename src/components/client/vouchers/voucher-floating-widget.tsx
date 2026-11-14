"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Gift, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { useCartStore } from "@/stores/cart-store";
import { validateVoucherForCart } from "@/lib/vouchers/client";
import { cn } from "@/lib/utils";
import {
  usePublicVouchers,
  VoucherPickerDialog,
} from "./voucher-picker-dialog";

const DISMISS_KEY = "laplap-voucher-banner-hidden-until";
const HIDE_FOR_MS = 3 * 24 * 60 * 60 * 1000; // 3 ngày

/**
 * Banner nhỏ ở góc dưới phải, quảng cáo voucher đang chạy.
 * Bấm vào mở dialog danh sách voucher; chọn "Dùng mã" sẽ tự áp vào giỏ.
 */
export function VoucherFloatingWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const { vouchers, loading } = usePublicVouchers(true);
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);

  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const applyVoucher = useCartStore((s) => s.applyVoucher);

  useEffect(() => {
    const until = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    setHidden(Date.now() < until);
  }, []);

  const shouldHide = useMemo(() => {
    if (hidden) return true;
    if (loading || vouchers.length === 0) return true;
    if (pathname === "/checkout") return true;
    if (pathname === "/account/vouchers") return true;
    return false;
  }, [hidden, loading, vouchers.length, pathname]);

  function dismiss(e: React.MouseEvent) {
    e.stopPropagation();
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + HIDE_FOR_MS));
    setHidden(true);
  }

  async function handleSelect(code: string) {
    setApplyingCode(code);
    try {
      if (items.length === 0) {
        await navigator.clipboard.writeText(code);
        toast.success(`Đã copy mã ${code}. Thêm sản phẩm vào giỏ để sử dụng.`);
        router.push("/products");
        return;
      }

      const voucher = await validateVoucherForCart({
        code,
        subtotal,
        productIds: items.map((i) => i.productId),
      });
      applyVoucher(voucher);
      toast.success(`Đã áp dụng voucher "${voucher.name}"`);
      router.push("/cart");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không áp dụng được voucher");
    } finally {
      setApplyingCode(null);
    }
  }

  if (shouldHide) return null;

  const topVoucher = vouchers[0];
  const label =
    topVoucher.type === "percent"
      ? `Giảm ${topVoucher.value}%`
      : topVoucher.type === "fixed_amount"
        ? `Giảm ${new Intl.NumberFormat("vi-VN").format(topVoucher.value)}đ`
        : "Miễn phí ship";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group fixed bottom-28 right-3 z-40 flex w-[min(92vw,290px)] items-center gap-3 rounded-2xl border border-primary/20 bg-white p-3 text-left shadow-[0_18px_45px_-18px_rgba(15,23,42,0.45)] transition-all sm:bottom-24 sm:right-5",
          "hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-18px_rgba(15,23,42,0.55)]",
        )}
        aria-label="Xem voucher giảm giá"
      >
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-white shadow-inner">
          <Gift className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-950">
            {vouchers.length}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-bold text-slate-900">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Voucher giảm giá
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {label}
            {topVoucher.min_order_amount > 0
              ? ` · đơn từ ${new Intl.NumberFormat("vi-VN").format(
                  topVoucher.min_order_amount,
                )}đ`
              : " · dùng ngay"}
          </span>
        </span>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
          <ArrowRight className="h-4 w-4" />
        </span>

        <span
          role="button"
          tabIndex={0}
          onClick={dismiss}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") dismiss(e as unknown as React.MouseEvent);
          }}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-white text-muted-foreground shadow-sm hover:text-foreground"
          aria-label="Ẩn banner voucher"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      </button>

      <VoucherPickerDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={applyingCode ? undefined : handleSelect}
      />

      {applyingCode ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
          Đang áp dụng voucher...
        </div>
      ) : null}
    </>
  );
}
