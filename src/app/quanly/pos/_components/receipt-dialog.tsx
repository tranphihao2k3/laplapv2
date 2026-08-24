"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Printer,
  Plus,
  Share2,
  Copy,
  MapPin,
  Phone,
  Mail,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatVND, PAYMENT_METHOD_LABEL, type CartLine, type Customer, type PaymentPart } from "./types";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderNumber?: string;
  lines: CartLine[];
  customer: Customer | null;
  subtotal: number;
  discount: number;
  loyaltyDiscount?: number;
  total: number;
  payments: PaymentPart[];
  received: number;
  change: number;
  shopName: string;
  shopStampText: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  shopEmail?: string | null;
  cashierName?: string | null;
  /** Thời điểm lập hoá đơn (ISO). Nếu bỏ trống sẽ không hiện ngày. */
  issuedAt?: string | null;
  /** Chính sách bảo hành / đổi trả (mỗi dòng 1 mục). */
  policy?: string | null;
  footer?: string | null;
  onNew: () => void;
};

type PaperSize = "thermal80" | "thermal58" | "a4";

const DEFAULT_POLICY = [
  "Bảo hành theo phiếu, đúng thời hạn ghi trên sản phẩm.",
  "Đổi/trả trong 7 ngày nếu lỗi do nhà sản xuất (còn nguyên tem, phụ kiện, hộp).",
  "Không bảo hành với hư hỏng do rơi vỡ, vào nước, cháy nổ, tự ý can thiệp phần cứng.",
  "Vui lòng giữ hoá đơn này để được hỗ trợ bảo hành.",
];

function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReceiptDialog({
  open,
  onOpenChange,
  orderNumber,
  lines,
  customer,
  subtotal,
  discount,
  loyaltyDiscount = 0,
  total,
  payments,
  received,
  change,
  shopName,
  shopStampText,
  shopAddress,
  shopPhone,
  shopEmail,
  cashierName,
  issuedAt,
  policy,
  footer,
  onNew,
}: Props) {
  const [includePolicy, setIncludePolicy] = useState(true);
  const [paperSize, setPaperSize] = useState<PaperSize>("thermal80");
  const [autoPrinted, setAutoPrinted] = useState(false);

  // Auto-print lần đầu mở
  useEffect(() => {
    if (!open || autoPrinted) return;
    setAutoPrinted(true);
    const timer = setTimeout(() => {
      try {
        window.print();
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [open, autoPrinted]);

  const policyLines = (policy?.trim() ? policy.split(/\r?\n/) : DEFAULT_POLICY)
    .map((l) => l.trim())
    .filter(Boolean);
  const dateText = formatDateTime(issuedAt) || formatDateTime(new Date().toISOString());

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const handleShare = async () => {
    if (!orderNumber) return;
    const text = `LapLap - Hóa đơn ${orderNumber}\n${formatVND(total)}\nCảm ơn quý khách!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Hóa đơn ${orderNumber}`, text });
      } catch {
        // user cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Đã sao chép thông tin hóa đơn");
      } catch {
        toast.error("Không thể sao chép");
      }
    }
  };

  const handleCopy = async () => {
    if (!orderNumber) return;
    try {
      await navigator.clipboard.writeText(orderNumber);
      toast.success("Đã sao chép mã đơn");
    } catch {
      toast.error("Không thể sao chép");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-md print:max-h-none print:max-w-none print:overflow-visible print:border-none print:p-0 print:shadow-none">
        <DialogHeader className="border-b bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 px-4 py-3 print:hidden">
          <DialogTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            Thanh toán thành công
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(92vh-160px)] overflow-y-auto px-4 py-4 print:max-h-none print:overflow-visible print:p-0">
          {/* Controls ẩn khi in */}
          <div className="mb-3 space-y-2 print:hidden">
            {/* Chọn khổ giấy */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground">Khổ giấy:</span>
              {(
                [
                  { v: "thermal80", label: "80mm" },
                  { v: "thermal58", label: "58mm" },
                  { v: "a4", label: "A4" },
                ] as Array<{ v: PaperSize; label: string }>
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setPaperSize(opt.v)}
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium transition ${
                    paperSize === opt.v
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={includePolicy}
                onChange={(e) => setIncludePolicy(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>In kèm chính sách bảo hành / đổi trả</span>
            </label>
          </div>

          {/* ====== VÙNG IN HOÁ ĐƠN ====== */}
          <div
            id="receipt-print"
            data-paper={paperSize}
            className={`receipt mx-auto space-y-3 rounded-md border bg-white p-4 text-sm text-neutral-900 print:rounded-none print:border-none print:p-0 print:text-[12px] ${
              paperSize === "thermal58"
                ? "max-w-[220px]"
                : paperSize === "thermal80"
                  ? "max-w-[320px]"
                  : "max-w-[210mm]"
            }`}
          >
            {/* Header cửa hàng */}
            <div className="space-y-1 text-center">
              <div className="text-lg font-bold uppercase leading-tight">{shopName}</div>
              {shopAddress && (
                <div className="flex items-center justify-center gap-1 text-[11px] text-neutral-600">
                  <MapPin className="h-3 w-3 shrink-0 print:hidden" />
                  <span>{shopAddress}</span>
                </div>
              )}
              {shopPhone && (
                <div className="flex items-center justify-center gap-1 text-[11px] text-neutral-600">
                  <Phone className="h-3 w-3 shrink-0 print:hidden" />
                  <span>ĐT: {shopPhone}</span>
                </div>
              )}
              {shopEmail && (
                <div className="flex items-center justify-center gap-1 text-[11px] text-neutral-600">
                  <Mail className="h-3 w-3 shrink-0 print:hidden" />
                  <span>{shopEmail}</span>
                </div>
              )}
            </div>

            <div className="border-y border-dashed py-2 text-center">
              <div className="text-base font-bold uppercase tracking-wide">Hoá đơn bán hàng</div>
              <div className="text-[11px] text-neutral-500">Ngày {dateText}</div>
            </div>

            {/* Thông tin đơn */}
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <span className="text-neutral-500">Số hoá đơn</span>
              <span className="text-right font-mono font-semibold">
                {orderNumber ?? "—"}
              </span>
              <span className="text-neutral-500">Khách hàng</span>
              <span className="text-right">{customer?.full_name ?? "Khách lẻ"}</span>
              {customer?.phone && (
                <>
                  <span className="text-neutral-500">Điện thoại</span>
                  <span className="text-right">{customer.phone}</span>
                </>
              )}
              {payments.length > 0 && (
                <>
                  <span className="text-neutral-500">Thanh toán</span>
                  <span className="text-right">
                    {payments.length === 1
                      ? PAYMENT_METHOD_LABEL[payments[0].method]
                      : `${payments.length} PT`}
                  </span>
                </>
              )}
              {cashierName && (
                <>
                  <span className="text-neutral-500">Người bán</span>
                  <span className="text-right">{cashierName}</span>
                </>
              )}
            </div>

            {/* Bảng sản phẩm */}
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-y text-neutral-500">
                  <th className="py-1 text-left font-medium">Sản phẩm</th>
                  <th className="py-1 text-center font-medium">SL</th>
                  <th className="py-1 text-right font-medium">Đơn giá</th>
                  <th className="py-1 text-right font-medium">T.Tiền</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.variant_id} className="border-b border-dashed align-top">
                    <td className="py-1 pr-1">
                      <div className="font-medium leading-snug">{l.display_name}</div>
                      {l.sku && (
                        <div className="text-[10px] text-neutral-400">{l.sku}</div>
                      )}
                    </td>
                    <td className="py-1 text-center">{l.quantity}</td>
                    <td className="py-1 text-right">{formatVND(l.unit_price)}</td>
                    <td className="py-1 text-right font-medium">
                      {formatVND(l.unit_price * l.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tổng kết */}
            <div className="space-y-1 border-t pt-2">
              <div className="flex justify-between">
                <span className="text-neutral-500">Tạm tính</span>
                <span className="tabular-nums">{formatVND(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Giảm giá</span>
                  <span className="tabular-nums">-{formatVND(discount)}</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Điểm thưởng</span>
                  <span className="tabular-nums">-{formatVND(loyaltyDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Tổng cộng</span>
                <span className="tabular-nums">{formatVND(total)}</span>
              </div>

              {/* Chi tiết thanh toán (nếu split) */}
              {payments.length > 0 && (
                <div className="border-t pt-1">
                  {payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-xs text-neutral-600">
                      <span>
                        {PAYMENT_METHOD_LABEL[p.method]}
                        {p.transaction_code ? ` · ${p.transaction_code}` : ""}
                      </span>
                      <span className="tabular-nums">{formatVND(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {received > 0 && (
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Đã nhận</span>
                  <span className="tabular-nums">{formatVND(totalPaid)}</span>
                </div>
              )}
              {change > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Tiền thối lại</span>
                  <span className="font-medium tabular-nums">{formatVND(change)}</span>
                </div>
              )}
            </div>

            {/* Chính sách bảo hành / đổi trả (tuỳ chọn) */}
            {includePolicy && policyLines.length > 0 && (
              <div className="space-y-1 border-t border-dashed pt-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
                  Chính sách bảo hành &amp; đổi trả
                </div>
                <ul className="list-disc space-y-0.5 pl-4 text-[10px] leading-snug text-neutral-600">
                  {policyLines.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* QR + signature */}
            <div className="grid grid-cols-2 gap-2 pt-3 text-center text-[10px] text-neutral-500">
              <div className="space-y-6">
                <div>Người mua hàng</div>
                <div className="italic">(Ký, ghi rõ họ tên)</div>
              </div>
              <div className="space-y-1">
                <div>Người bán hàng</div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary/70 text-center text-[9px] font-semibold uppercase leading-tight text-primary">
                  {shopStampText}
                </div>
              </div>
            </div>

            {/* Footer cảm ơn */}
            <div className="border-t border-dashed pt-2 text-center text-[11px] italic text-neutral-600">
              {footer?.trim() || "Cảm ơn quý khách. Hẹn gặp lại!"}
            </div>

            {/* Mã QR tham khảo — optional */}
            {orderNumber && (
              <div className="flex flex-col items-center gap-1 pt-1 text-[10px] text-neutral-500">
                <ScanLine className="h-4 w-4" />
                <span className="font-mono">{orderNumber}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/30 px-4 py-3 sm:gap-2 print:hidden">
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={handleShare} size="sm">
              <Share2 className="mr-1 h-3.5 w-3.5" />
              Chia sẻ
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleCopy} size="sm" disabled={!orderNumber}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Mã đơn
              </Button>
              <Button variant="outline" onClick={() => window.print()} size="sm">
                <Printer className="mr-1 h-3.5 w-3.5" />
                In
              </Button>
              <Button onClick={onNew} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Đơn mới
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}