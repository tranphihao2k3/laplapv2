"use client";

/**
 * Dialog chọn thời hạn bảo hành cho phiếu sửa chữa ngay tại POS.
 *
 * Flow cũ: admin phải vào `/quanly/repair-tickets` → bấm "Hoàn tất" → chọn tháng BH
 *   → quay lại POS mới thanh toán được. Phiếu vào POS thanh toán thẳng (status = repairing / ...)
 *   thì /complete bị fallback `warranty_months ?? 0` → 0 → KHÔNG tạo warranty.
 *
 * Flow mới (hướng A đề xuất): trước khi gọi /complete, mở dialog này. Admin chọn số tháng
 *   (mặc định lấy theo `ticket.warranty_months` nếu đã set, nếu không mặc định 0 = "Không BH").
 *   Confirm → truyền `warranty_months` vào body `/complete` → service tự tạo warranty
 *   nếu `months > 0 && customer_id`. Sau đó mới tiến hành PaymentDialog như cũ.
 *
 * UI: chip chọn nhanh 0/1/3/6/12 tháng + preview ngày hết hạn + tóm tắt KH / thiết bị.
 */

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, ShieldOff, Calendar, Smartphone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { RepairTicket } from "./repair-ticket-picker";
import { formatVND } from "./types";

const WARRANTY_OPTIONS: Array<{ value: number; label: string; popular?: boolean }> = [
  { value: 0, label: "Không BH" },
  { value: 1, label: "1 tháng" },
  { value: 3, label: "3 tháng", popular: true },
  { value: 6, label: "6 tháng", popular: true },
  { value: 12, label: "12 tháng" },
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatEndDate(start: Date, months: number): string {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysUntil(end: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(end);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: RepairTicket | null;
  /** Submitting state từ mutation đang chạy (disable Confirm). */
  submitting?: boolean;
  /**
   * Gọi khi bấm "Xác nhận" → trả về số tháng BH đã chọn.
   * Nếu months = 0 thì service sẽ KHÔNG tạo warranty (chỉ chuyển sang done).
   */
  onConfirm: (months: number) => void;
};

export function RepairWarrantyDialog({
  open,
  onOpenChange,
  ticket,
  submitting = false,
  onConfirm,
}: Props) {
  // Mặc định: lấy theo ticket.warranty_months nếu đã set, fallback 0.
  const initial = ticket?.warranty_months ?? 0;
  const [months, setMonths] = useState<number>(initial);

  // Mỗi lần mở dialog với ticket khác nhau → reset theo ticket mới.
  useEffect(() => {
    if (open) setMonths(ticket?.warranty_months ?? 0);
  }, [open, ticket?.id, ticket?.warranty_months]);

  const startDate = useMemo(() => {
    // Nếu ticket đã có completed_at thì dùng làm start; nếu chưa thì dùng hôm nay.
    return ticket?.completed_at ? new Date(ticket.completed_at) : new Date();
  }, [ticket?.completed_at]);

  const endDate = useMemo(() => {
    if (months <= 0) return null;
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + months);
    return d;
  }, [months, startDate]);

  const endDays = endDate ? daysUntil(endDate) : null;
  const customerName = ticket?.customer_full_name || ticket?.customer_name || "Khách lẻ";
  const deviceName = ticket?.device_name || "Máy sửa";
  const customerId = ticket?.customer_id ?? null;
  const canIssue = customerId != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Cấp bảo hành sửa chữa
          </DialogTitle>
          <DialogDescription>
            Chọn thời hạn bảo hành cho máy vừa sửa xong. Bước này sẽ chạy trước khi
            vào màn thanh toán.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tóm tắt phiếu */}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium truncate">{deviceName}</span>
              {ticket?.ticket_code && (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  #{ticket.ticket_code}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-muted-foreground">
                {customerName}
                {ticket?.customer_phone && (
                  <span className="ml-2 font-mono text-[11px]">{ticket.customer_phone}</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Phí sửa:</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatVND(ticket?.actual_cost || ticket?.estimated_cost || 0)}
              </span>
            </div>
          </div>

          {!canIssue && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
              Phiếu chưa gắn khách hàng — bảo hành chỉ cấp được khi phiếu có KH. Chọn
              &ldquo;Không BH&rdquo; để tiếp tục.
            </div>
          )}

          {/* Chọn số tháng */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Thời hạn bảo hành</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {WARRANTY_OPTIONS.map((opt) => {
                const active = months === opt.value;
                const disabled = opt.value > 0 && !canIssue;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => setMonths(opt.value)}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-lg border-2 px-1 py-2.5 text-xs font-medium transition-all",
                      active
                        ? opt.value === 0
                          ? "border-slate-500 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          : "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-transparent bg-muted/40 hover:border-muted hover:bg-accent",
                      disabled && "cursor-not-allowed opacity-40 hover:bg-muted/40",
                    )}
                  >
                    {opt.popular && opt.value > 0 && !active && (
                      <span className="absolute -top-1.5 right-1 rounded-full bg-amber-400 px-1.5 py-0 text-[8px] font-bold text-amber-950 shadow-sm">
                        HOT
                      </span>
                    )}
                    <span className="text-sm font-bold tabular-nums">
                      {opt.value === 0 ? "0" : opt.value}
                    </span>
                    <span className="text-[10px] leading-none mt-0.5">
                      {opt.value === 0 ? "tháng" : "tháng"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview ngày hết hạn */}
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              months > 0 && canIssue
                ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700/50 dark:bg-emerald-950/20"
                : "border-dashed bg-muted/30",
            )}
          >
            {months > 0 && canIssue ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-semibold">
                    Bảo hành {months} tháng sẽ được cấp
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Bắt đầu</div>
                    <div className="font-medium tabular-nums">
                      {startDate.toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Hết hạn</div>
                    <div className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {formatEndDate(startDate, months)}
                    </div>
                  </div>
                </div>
                {endDays !== null && endDays >= 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                    <Calendar className="h-3 w-3" />
                    Còn khoảng {endDays} ngày
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldOff className="h-4 w-4" />
                <span>Không cấp bảo hành cho phiếu này.</span>
              </div>
            )}
          </div>

          {/* Cảnh báo nếu đã có BH cũ */}
          {ticket?.warranty_end_date && ticket.warranty_months && ticket.warranty_months > 0 && (
            <div className="rounded-md border border-blue-300/60 bg-blue-50/60 px-3 py-2 text-xs text-blue-900 dark:border-blue-700/50 dark:bg-blue-950/20 dark:text-blue-200">
              <Badge variant="secondary" className="mr-1.5 text-[10px]">
                Đã có BH
              </Badge>
              Phiếu này hiện đang có BH {ticket.warranty_months} tháng (đến{" "}
              {new Date(ticket.warranty_end_date).toLocaleDateString("vi-VN")}). Nếu chọn
              lại ở đây, hệ thống sẽ giữ nguyên record cũ (không tạo trùng).
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Huỷ
          </Button>
          <Button
            onClick={() => onConfirm(months)}
            disabled={submitting || (months > 0 && !canIssue)}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600"
          >
            {submitting ? (
              "Đang xử lý..."
            ) : months > 0 ? (
              <>
                <ShieldCheck className="mr-1 h-4 w-4" />
                Cấp BH {months} tháng &amp; tiếp tục
              </>
            ) : (
              "Tiếp tục không BH"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
