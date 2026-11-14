"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, XCircle } from "lucide-react";
import { toast } from "sonner";
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
import { usePosSession } from "@/hooks/use-pos-session";

type Props = {
  shopId: string;
};

/**
 * Banner trên header POS khi đang có ca mở.
 * - Hiển thị quỹ đầu ca + thời gian đã mở
 * - Có 2 action: "Xem" (modal chi tiết) và "Đóng ca" nhanh
 */
export function PosSessionBanner({ shopId }: Props) {
  const { findOpenSession, closeSession } = usePosSession();
  const session = shopId ? findOpenSession(shopId) : null;

  const [closingOpen, setClosingOpen] = useState(false);
  const [closingCash, setClosingCash] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // Tính thời gian đã mở (giờ:phút)
  const elapsed = useMemo(() => {
    if (!session?.opened_at) return "";
    const ms = Date.now() - new Date(session.opened_at).getTime();
    const mins = Math.floor(ms / 60_000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h <= 0) return `${m} phút`;
    return `${h}h ${m}m`;
  }, [session?.opened_at]);

  // Khi mở dialog, mặc định = expected_cash (nếu backend cung cấp) hoặc = quỹ đầu
  useEffect(() => {
    if (closingOpen && session) {
      setClosingCash(session.expected_cash ?? session.opening_cash ?? 0);
    }
  }, [closingOpen, session]);

  if (!session) return null;

  return (
    <>
      {/* Pill gọn — nằm chung hàng với cửa hàng/khách để tiết kiệm chiều cao. */}
      <div className="order-2 flex w-auto min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50/70 py-1 pl-2.5 pr-1 text-[11px] leading-tight text-emerald-700 sm:order-3 sm:ml-auto dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="shrink-0 font-semibold">Ca mở</span>
        <span className="hidden shrink-0 opacity-40 sm:inline">·</span>
        <span className="hidden min-w-0 truncate sm:inline">
          Quỹ <strong className="whitespace-nowrap">{new Intl.NumberFormat("vi-VN").format(session.opening_cash ?? 0)}₫</strong>
        </span>
        <span className="hidden shrink-0 opacity-40 sm:inline">·</span>
        <span className="hidden shrink-0 whitespace-nowrap sm:inline">{elapsed}</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 shrink-0 gap-1 rounded-full px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
          onClick={() => setClosingOpen(true)}
        >
          <XCircle className="h-3 w-3" />
          Đóng ca
        </Button>
      </div>

      <Dialog open={closingOpen} onOpenChange={setClosingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-500" />
              Đóng ca POS
            </DialogTitle>
            <DialogDescription>
              Nhập số tiền mặt thực tế trong két để hệ thống đối soát.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quỹ đầu ca:</span>
                <strong>
                  {new Intl.NumberFormat("vi-VN").format(
                    session.opening_cash ?? 0,
                  )}
                  ₫
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tiền mặt bán trong ca (HT dự kiến):</span>
                <strong>
                  {new Intl.NumberFormat("vi-VN").format(
                    session.expected_cash ?? 0,
                  )}
                  ₫
                </strong>
              </div>
              <p className="text-[10px] text-muted-foreground italic pt-1">
                * Tiền mặt kỳ vọng cuối ca = Quỹ đầu + tổng cash từ các hóa đơn
                thuộc ca này.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tiền mặt cuối ca (đếm thực tế) *</Label>
              <Input
                type="number"
                min={0}
                value={Number.isNaN(closingCash) ? 0 : closingCash}
                onChange={(e) =>
                  setClosingCash(Number(e.target.value) || 0)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClosingOpen(false)}
              disabled={submitting}
            >
              Huỷ
            </Button>
            <Button
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  const result = await closeSession({
                    session_id: session.id,
                    closing_cash: closingCash,
                  });
                  if (result) {
                    const diff = result.difference_cash ?? 0;
                    if (diff === 0) {
                      toast.success("Đã đóng ca — khớp tiền");
                    } else if (diff > 0) {
                      toast.success(
                        `Đã đóng ca — thừa ${new Intl.NumberFormat("vi-VN").format(diff)}₫`,
                      );
                    } else {
                      toast.warning(
                        `Đã đóng ca — thiếu ${new Intl.NumberFormat("vi-VN").format(Math.abs(diff))}₫`,
                      );
                    }
                    setClosingOpen(false);
                  } else {
                    toast.error("Không thể đóng ca");
                  }
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              Đóng ca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
