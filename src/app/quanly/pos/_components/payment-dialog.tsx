"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  Star,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatVND, calcChange, type Customer, type PaymentMethod, type PaymentPart } from "./types";

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

const QUICK_CASH = [50000, 100000, 200000, 500000, 1000000];

const NUMPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"];

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
  const [parts, setParts] = useState<PaymentPart[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [draft, setDraft] = useState<string>(""); // chuỗi số đang gõ
  const [txCode, setTxCode] = useState<string>("");
  // Tổng có thể sửa (chỉ dùng khi editableTotal). Khởi tạo theo total truyền vào.
  const [totalDraft, setTotalDraft] = useState<string>("");
  // Số điểm muốn redeem
  const [redeemInput, setRedeemInput] = useState<string>("");

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setParts([]);
      setDraft("");
      setTxCode("");
      setTotalDraft(String(total));
      setRedeemInput("");
    }
  }, [open, total]);

  const effectiveTotal = editableTotal
    ? Number(totalDraft.replace(/\D/g, "")) || 0
    : total;
  const paid = parts.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, effectiveTotal - paid);
  const change = calcChange(paid, effectiveTotal);

  const draftNum = Number(draft.replace(/\D/g, "")) || 0;

  const addPart = () => {
    if (draftNum <= 0) return;
    if (method === "cash" && draftNum > remaining) {
      // Tiền mặt cho phép nhận dư (tính tiền thối)
      setParts((prev) => [
        ...prev,
        { method, amount: draftNum, transaction_code: null },
      ]);
    } else {
      setParts((prev) => [
        ...prev,
        {
          method,
          amount: Math.min(draftNum, remaining),
          transaction_code:
            method === "transfer" || method === "ewallet"
              ? txCode.trim() || null
              : null,
        },
      ]);
    }
    setDraft("");
    setTxCode("");
  };

  const removePart = (idx: number) => {
    setParts((prev) => prev.filter((_, i) => i !== idx));
  };

  const quickFill = (amount: number) => {
    setDraft(String(amount));
  };

  const pressKey = (key: string) => {
    if (key === "⌫") {
      setDraft((d) => d.slice(0, -1));
      return;
    }
    setDraft((d) => (d + key).replace(/^0+(?=\d)/, ""));
  };

  // Auto-fill exact change với cash
  const useExact = () => {
    setDraft(String(remaining));
  };

  const canSubmit = remaining === 0 && parts.length > 0 && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm({
      payments: parts,
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
      <DialogContent className="max-h-[95vh] gap-3 overflow-y-auto p-0 sm:max-w-2xl">
        {/* Header sticky với gradient */}
        <DialogHeader className="sticky top-0 z-10 border-b bg-gradient-to-br from-primary/10 via-primary/5 to-background px-4 py-4 backdrop-blur sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Banknote className="h-5 w-5 text-primary" />
            Thanh toán
          </DialogTitle>
          <DialogDescription className="text-xs">
            Chọn phương thức và xác nhận để hoàn tất đơn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-4 pb-4 sm:px-6">
          {/* Tổng cần thu */}
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

          {/* Loyalty redeem — chỉ hiển thị khi có KH và chưa redeem */}
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
                  className="h-9"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRedeemInput(String(maxRedeemPoints))}
                >
                  Max
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={applyRedeem}
                  disabled={appliedPoints <= 0}
                  className="bg-amber-600 hover:bg-amber-700"
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

          {/* Hiển thị đã redeem */}
          {hasRedeemed && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-300/50 bg-emerald-50/60 px-3 py-2 dark:border-emerald-700/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Đã dùng {redeemedPoints.toLocaleString("vi-VN")} điểm (-{formatVND(redeemedValue)})
              </div>
              {onLoyaltyClear && (
                <Button size="sm" variant="ghost" onClick={onLoyaltyClear}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Danh sách payment parts */}
          {parts.length > 0 && (
            <div className="space-y-1.5 rounded-lg border bg-muted/20 p-2">
              <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
                <span>Đã thanh toán ({parts.length})</span>
                <span className="tabular-nums">{formatVND(paid)}</span>
              </div>
              {parts.map((p, idx) => (
                <div
                  key={`${p.method}-${idx}`}
                  className="flex items-center gap-2 rounded-md bg-card px-2.5 py-1.5 text-sm shadow-sm"
                >
                  <Badge variant="secondary" className="text-[10px]">
                    {labelOf(p.method)}
                  </Badge>
                  <span className="flex-1 truncate tabular-nums">
                    {formatVND(p.amount)}
                  </span>
                  {p.transaction_code && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {p.transaction_code}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePart(idx)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {remaining > 0 && (
                <div className="flex items-center justify-between border-t px-1 pt-1.5 text-xs">
                  <span className="text-muted-foreground">Còn lại</span>
                  <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatVND(remaining)}
                  </span>
                </div>
              )}
              {change > 0 && (
                <div className="flex items-center justify-between border-t px-1 pt-1.5 text-xs">
                  <span className="text-muted-foreground">Tiền thối</span>
                  <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatVND(change)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Chọn phương thức */}
          <div>
            <Label className="mb-2 text-xs text-muted-foreground">Phương thức</Label>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2.5 text-xs font-medium transition-all ${
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-transparent hover:border-muted hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nhập số tiền + Numpad */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pos-amount" className="text-xs">
                Số tiền {method === "cash" ? "khách đưa" : "thanh toán"}
              </Label>
              <div className="relative">
                <Input
                  id="pos-amount"
                  inputMode="numeric"
                  value={draft ? Number(draft || "0").toLocaleString("vi-VN") : ""}
                  onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="h-12 pr-12 text-right text-lg font-semibold tabular-nums"
                  readOnly
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  đ
                </span>
              </div>

              {method === "cash" && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={useExact}
                      className="h-7 text-xs"
                    >
                      Vừa đủ
                    </Button>
                    {QUICK_CASH.map((amt) => (
                      <Button
                        key={amt}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => quickFill(amt)}
                        className="h-7 text-xs tabular-nums"
                      >
                        {(amt / 1000).toLocaleString("vi-VN")}k
                      </Button>
                    ))}
                  </div>
                </>
              )}

              {(method === "transfer" || method === "ewallet") && (
                <Input
                  value={txCode}
                  onChange={(e) => setTxCode(e.target.value)}
                  placeholder="Mã giao dịch (tuỳ chọn)"
                  className="h-9 text-sm"
                />
              )}

              <Button
                type="button"
                onClick={addPart}
                disabled={draftNum <= 0}
                variant="secondary"
                className="w-full"
              >
                <Plus className="mr-1 h-4 w-4" />
                Thêm {labelOf(method)} {draftNum > 0 && `· ${formatVND(draftNum)}`}
              </Button>
            </div>

            {/* Numpad (chỉ với cash; với method khác vẫn dùng được) */}
            <div className="grid grid-cols-3 gap-1.5">
              {NUMPAD_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => pressKey(k)}
                  className={`rounded-lg border bg-card py-3 text-center text-lg font-semibold transition-all hover:bg-accent active:scale-95 ${
                    k === "⌫" ? "text-destructive" : ""
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Cảnh báo nếu remaining > 0 */}
          {parts.length > 0 && remaining > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/50 px-3 py-2 text-xs dark:border-amber-700/50 dark:bg-amber-950/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-900 dark:text-amber-200">
                Cần thu thêm <strong className="tabular-nums">{formatVND(remaining)}</strong>{" "}
                để hoàn tất.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 z-10 border-t bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Huỷ
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            size="lg"
            className="min-w-40 bg-gradient-to-r from-primary to-primary/80"
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

function labelOf(m: PaymentMethod): string {
  return m === "cash" ? "Tiền mặt" : m === "card" ? "Thẻ" : m === "transfer" ? "CK" : "Ví";
}