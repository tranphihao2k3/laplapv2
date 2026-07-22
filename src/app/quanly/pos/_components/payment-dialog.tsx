"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatVND, type PaymentMethod } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  submitting: boolean;
  /** Cho phép sửa "Tổng cần thu" trực tiếp (dùng cho hoá đơn sửa chữa). */
  editableTotal?: boolean;
  /** Nhãn ô sửa giá khi editableTotal (mặc định "Số tiền cần thu"). */
  editableLabel?: string;
  onConfirm: (args: {
    method: PaymentMethod;
    amount: number;
    transaction_code?: string;
    total?: number;
  }) => void;
};

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Tiền mặt", icon: Banknote },
  { value: "card", label: "Quẹt thẻ", icon: CreditCard },
  { value: "transfer", label: "Chuyển khoản", icon: Landmark },
  { value: "ewallet", label: "Ví điện tử", icon: Smartphone },
];

const QUICK_CASH = [0, 50000, 100000, 200000, 500000];

export function PaymentDialog({
  open,
  onOpenChange,
  total,
  submitting,
  editableTotal = false,
  editableLabel = "Số tiền cần thu",
  onConfirm,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState<string>("");
  const [txCode, setTxCode] = useState<string>("");
  // Tổng có thể sửa (chỉ dùng khi editableTotal). Khởi tạo theo total truyền vào.
  const [totalDraft, setTotalDraft] = useState<string>("");

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setReceived(String(total));
      setTotalDraft(String(total));
      setTxCode("");
    }
  }, [open, total]);

  const effectiveTotal = editableTotal
    ? Number(totalDraft.replace(/\D/g, "")) || 0
    : total;
  const receivedNum = Number(received.replace(/\D/g, "")) || 0;
  const change = useMemo(() => Math.max(0, receivedNum - effectiveTotal), [receivedNum, effectiveTotal]);

  const submit = () => {
    const amount = method === "cash" ? Math.min(receivedNum, effectiveTotal) : effectiveTotal;
    onConfirm({
      method,
      amount,
      transaction_code: method === "transfer" || method === "ewallet" ? txCode.trim() || undefined : undefined,
      total: effectiveTotal,
    });
  };

  const canSubmit =
    effectiveTotal > 0 &&
    (method === "cash" ? receivedNum >= effectiveTotal : true) &&
    !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thanh toán</DialogTitle>
          <DialogDescription>
            Chọn phương thức và xác nhận để lên hóa đơn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {editableTotal ? (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <Label htmlFor="pos-total" className="text-xs text-muted-foreground">
                {editableLabel} (có thể chỉnh)
              </Label>
              <div className="relative">
                <Input
                  id="pos-total"
                  inputMode="numeric"
                  value={totalDraft ? Number(totalDraft.replace(/\D/g, "")).toLocaleString("vi-VN") : ""}
                  onChange={(e) => setTotalDraft(e.target.value.replace(/\D/g, ""))}
                  className="h-12 pr-8 text-right text-2xl font-bold text-primary"
                  placeholder="0"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">đ</span>
              </div>
            </div>
          ) : (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Tổng cần thu</div>
              <div className="text-3xl font-bold text-primary">{formatVND(total)}</div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const active = method === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-xs transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {method === "cash" && (
            <div className="space-y-2">
              <Label htmlFor="pos-received">Tiền khách đưa</Label>
              <Input
                id="pos-received"
                inputMode="numeric"
                value={received}
                onChange={(e) => setReceived(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-lg font-semibold"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_CASH.map((amt) => {
                  const value = amt === 0 ? effectiveTotal : amt;
                  const label = amt === 0 ? "Vừa đủ" : formatVND(amt);
                  return (
                    <Button
                      key={amt}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setReceived(String(value))}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                <span className="text-muted-foreground">Tiền thừa trả khách</span>
                <span className="text-lg font-semibold">{formatVND(change)}</span>
              </div>
            </div>
          )}

          {(method === "transfer" || method === "ewallet") && (
            <div className="space-y-2">
              <Label htmlFor="pos-txcode">Mã giao dịch (tuỳ chọn)</Label>
              <Input
                id="pos-txcode"
                value={txCode}
                onChange={(e) => setTxCode(e.target.value)}
                placeholder="Mã GD ngân hàng / ví"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!canSubmit} className="min-w-32">
            {submitting ? "Đang xử lý..." : "Xác nhận thanh toán"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
