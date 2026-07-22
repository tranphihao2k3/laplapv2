"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Printer, Plus, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatVND, PAYMENT_METHOD_LABEL, type CartLine, type Customer, type PaymentMethod } from "./types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
  shopAddress?: string | null;
  shopPhone?: string | null;
  cashierName?: string | null;
  /** Thời điểm lập hoá đơn (ISO). Nếu bỏ trống sẽ không hiện ngày. */
  issuedAt?: string | null;
  /** Chính sách bảo hành / đổi trả (mỗi dòng 1 mục). */
  policy?: string | null;
  footer?: string | null;
  onNew: () => void;
};

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
  total,
  method,
  received,
  change,
  shopName,
  shopStampText,
  shopAddress,
  shopPhone,
  cashierName,
  issuedAt,
  policy,
  footer,
  onNew,
}: Props) {
  const [includePolicy, setIncludePolicy] = useState(true);

  // Tự động in sau khi mở (chờ layout ổn định).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [open]);

  const policyLines = (policy?.trim() ? policy.split(/\r?\n/) : DEFAULT_POLICY)
    .map((l) => l.trim())
    .filter(Boolean);
  const dateText = formatDateTime(issuedAt) || formatDateTime(new Date().toISOString());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md print:max-h-none print:max-w-none print:overflow-visible print:border-none print:p-0 print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            Thanh toán thành công
          </DialogTitle>
        </DialogHeader>

        {/* Tuỳ chọn in chính sách — ẩn khi in */}
        <label className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm print:hidden">
          <input
            type="checkbox"
            checked={includePolicy}
            onChange={(e) => setIncludePolicy(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>In kèm chính sách bảo hành / đổi trả</span>
        </label>

        {/* ====== VÙNG IN HOÁ ĐƠN ====== */}
        <div
          id="receipt-print"
          className="space-y-3 rounded-md border bg-white p-4 text-sm text-neutral-900 print:rounded-none print:border-none print:p-0 print:text-[12px]"
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
          </div>

          <div className="border-y border-dashed py-2 text-center">
            <div className="text-base font-bold uppercase tracking-wide">Hoá đơn bán hàng</div>
            <div className="text-[11px] text-neutral-500">Ngày {dateText}</div>
          </div>

          {/* Thông tin đơn */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <span className="text-neutral-500">Số hoá đơn</span>
            <span className="text-right font-mono font-semibold">{orderNumber ?? "—"}</span>
            <span className="text-neutral-500">Khách hàng</span>
            <span className="text-right">{customer?.full_name ?? "Khách lẻ"}</span>
            {customer?.phone && (
              <>
                <span className="text-neutral-500">Điện thoại</span>
                <span className="text-right">{customer.phone}</span>
              </>
            )}
            <span className="text-neutral-500">Thanh toán</span>
            <span className="text-right">{method ? PAYMENT_METHOD_LABEL[method] : "—"}</span>
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
                    {l.sku && <div className="text-[10px] text-neutral-400">{l.sku}</div>}
                  </td>
                  <td className="py-1 text-center">{l.quantity}</td>
                  <td className="py-1 text-right">{formatVND(l.unit_price)}</td>
                  <td className="py-1 text-right font-medium">{formatVND(l.unit_price * l.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Tổng kết */}
          <div className="space-y-1 border-t pt-2">
            <div className="flex justify-between">
              <span className="text-neutral-500">Tạm tính</span>
              <span>{formatVND(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-500">Giảm giá</span>
                <span>-{formatVND(discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 text-base font-bold">
              <span>Tổng cộng</span>
              <span>{formatVND(total)}</span>
            </div>
            <div className="flex justify-between text-xs text-neutral-500">
              <span>Đã nhận</span>
              <span>{formatVND(received)}</span>
            </div>
            {change > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Tiền thối lại</span>
                <span className="font-medium">{formatVND(change)}</span>
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

          {/* Chữ ký / dấu mộc */}
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
        </div>

        <DialogFooter className="gap-2 sm:gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            In hoá đơn
          </Button>
          <Button onClick={onNew}>
            <Plus className="mr-1 h-4 w-4" />
            Đơn mới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
