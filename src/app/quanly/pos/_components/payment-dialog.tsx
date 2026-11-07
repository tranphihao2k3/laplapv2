"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  Star,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatVND, type Customer, type PaymentMethod, type PaymentPart } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  submitting: boolean;
  /** Cho phép sửa "Tổng cần thu" trực tiếp (dùng cho hoá đơn sửa chữa). */
  editableTotal?: boolean;
  /** Nhãn ô sửa giá khi editableTotal (mặc định "Số tiền cần thu"). */
  editableLabel?: string;
  /** Khách hàng đang gắn với đơn (để hiển thị loyalty & redeem). */
  customer?: Customer | null;
  /** Tỷ lệ quy đổi 1 điểm = bao nhiêu VND. Mặc định 1000. */
  loyaltyRate?: number;
  /** Callback khi áp dụng điểm loyalty (trừ vào tổng). */
  onLoyaltyRedeem?: (points: number, valueVnd: number) => void;
  /** Callback khi huỷ redeem (cộng lại vào tổng). */
  onLoyaltyClear?: () => void;
  /** Số điểm đã redeem (hiển thị). */
  redeemedPoints?: number;
  /** Giá trị VND đã redeem (hiển thị). */
  redeemedValue?: number;
  /** Đã áp dụng redeem? */
  hasRedeemed?: boolean;
  onConfirm: (args: {
    payments: PaymentPart[];
    /** Tổng cần thu sau khi áp dụng redeem (cho backend). */
    total?: number;
  }) => void;
};

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Tiền mặt", icon: Banknote },
  { value: "card", label: "Quẹt thẻ", icon: CreditCard },
  { value: "transfer", label: "Chuyển khoản", icon: Landmark },
  { value: "ewallet", label: "Ví điện tử", icon: Smartphone },
];

/**
 * Thanh toán nhanh: chọn phương thức → Xác nhận.
 * Không nhập "tiền khách đưa" / numpad — tự ghi đúng số tiền cần thu.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  total,
  submitting,
  editableTotal = false,
  editableLabel = "Số tiền cần thu",
  customer,
  loyaltyRate = 1000,
  onLoyaltyRedeem,
  onLoyaltyClear,
  redeemedPoints = 0,
  redeemedValue = 0,
  hasRedeemed = false,
  onConfirm,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [txCode, setTxCode] = useState<string>("");
  const [totalDraft, setTotalDraft] = useState<string>("");
  const [redeemInput, setRedeemInput] = useState<string>("");

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setTxCode("");
      setTotalDraft(String(total));
      setRedeemInput("");
    }
  }, [open, total]);

  const effectiveTotal = editableTotal
    ? Number(totalDraft.replace(/\D/g, "")) || 0
    : total;

  const canSubmit = effectiveTotal > 0 && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    const payment: PaymentPart = {
      method,
      amount: effectiveTotal,
      transaction_code:
        method === "transfer" || method === "ewallet"
          ? txCode.trim() || null
          : null,
    };
    onConfirm({
      payments: [payment],
      total: effectiveTotal,
    });
  };

  const customerPoints = customer?.loyalty_points ?? 0;
  const maxRedeemValue = Math.min(customerPoints * loyaltyRate, effectiveTotal);
  const maxRedeemPoints = Math.floor(maxRedeemValue / loyaltyRate);
  const requestedPoints = Number(redeemInput.replace(/\D/g, "")) || 0;
  const appliedPoints = Math.min(requestedPoints, maxRedeemPoints);

  const applyRedeem = () => {
    if (appliedPoints <= 0 || !onLoyaltyRedeem) return;
    onLoyaltyRedeem(appliedPoints, appliedPoints * loyaltyRate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] gap-3 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="sticky top-0 z-10 border-b bg-gradient-to-br from-primary/10 via-primary/5 to-background px-4 py-4 backdrop-blur sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Banknote className="h-5 w-5 text-primary" />
            Thanh toán
          </DialogTitle>
          <DialogDescription className="text-xs">
            Chọn phương thức rồi xác nhận — không cần nhập tiền khách đưa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-4 pb-4 sm:px-6">
          {editableTotal ? (
            <div className="space-y-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3">
              <Label htmlFor="pos-total" className="text-xs text-muted-foreground">
                {editableLabel} (có thể chỉnh)
              </Label>
              <div className="relative">
                <Input
                  id="pos-total"
                  inputMode="numeric"
                  value={
                    totalDraft
                      ? Number(totalDraft.replace(/\D/g, "")).toLocaleString("vi-VN")
                      : ""
                  }
                  onChange={(e) => setTotalDraft(e.target.value.replace(/\D/g, ""))}
                  className="h-12 pr-8 text-right text-2xl font-bold text-primary"
                  placeholder="0"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  đ
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Tổng cần thu</div>
              <div className="text-3xl font-bold text-primary tabular-nums">
                {formatVND(effectiveTotal)}
              </div>
            </div>
          )}

          {customer && customerPoints > 0 && !hasRedeemed && onLoyaltyRedeem && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 dark:border-amber-700/50 dark:bg-amber-950/20">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                Đổi điểm thưởng — Khách có {customerPoints.toLocaleString("vi-VN")} điểm
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={redeemInput ? Number(redeemInput).toLocaleString("vi-VN") : ""}
                  onChange={(e) =>
                    setRedeemInput(e.target.value.replace(/\D/g, "").slice(0, 7))
                  }
                  placeholder={`Tối đa ${maxRedeemPoints.toLocaleString("vi-VN")} điểm`}
                  className="h-10 min-w-0 flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRedeemInput(String(maxRedeemPoints))}
                  className="h-10 shrink-0"
                >
                  Max
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={applyRedeem}
                  disabled={appliedPoints <= 0}
                  className="h-10 shrink-0 bg-amber-600 hover:bg-amber-700"
                >
                  Áp dụng
                </Button>
              </div>
              {appliedPoints > 0 && (
                <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">
                  = {formatVND(appliedPoints * loyaltyRate)} giảm giá
                </p>
              )}
            </div>
          )}

          {hasRedeemed && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-300/50 bg-emerald-50/60 px-3 py-2 dark:border-emerald-700/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Đã dùng {redeemedPoints.toLocaleString("vi-VN")} điểm (-
                {formatVND(redeemedValue)})
              </div>
              {onLoyaltyClear && (
                <Button size="sm" variant="ghost" onClick={onLoyaltyClear}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          <div>
            <Label className="mb-2 text-xs text-muted-foreground">Phương thức</Label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg border-2 px-1 py-2 text-[11px] font-medium transition-all sm:min-h-0 sm:px-2 sm:py-2.5 sm:text-xs ${
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-transparent hover:border-muted hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="w-full truncate text-center">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(method === "transfer" || method === "ewallet") && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Mã giao dịch (tuỳ chọn)
              </Label>
              <Input
                value={txCode}
                onChange={(e) => setTxCode(e.target.value)}
                placeholder="VD: mã CK / mã ví"
                className="h-10 text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 z-10 gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur sm:gap-2 sm:px-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-11 w-full sm:w-auto"
          >
            Huỷ
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            size="lg"
            className="w-full min-w-0 truncate bg-gradient-to-r from-primary to-primary/80 sm:w-auto sm:min-w-40"
          >
            {submitting ? (
              "Đang xử lý..."
            ) : (
              <>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Xác nhận · {formatVND(effectiveTotal)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
