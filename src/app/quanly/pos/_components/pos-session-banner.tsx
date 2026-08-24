"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Clock4, XCircle } from "lucide-react";
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
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200/60 bg-emerald-50/70 px-3 py-1.5 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
        <Clock4 className="h-3.5 w-3.5" />
        <span className="font-semibold">Ca đang mở</span>
        <span className="opacity-70">·</span>
        <span>
          Quỹ đầu:{" "}
          <strong>
            {new Intl.NumberFormat("vi-VN").format(session.opening_cash ?? 0)}
            ₫
          </strong>
        </span>
        <span className="opacity-70">·</span>
        <span>Đã mở: <strong>{elapsed}</strong></span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 border-emerald-300 bg-white/60 px-2 text-xs hover:bg-white dark:bg-emerald-950/40"
          onClick={() => setClosingOpen(true)}
        >
          <XCircle className="mr-1 h-3.5 w-3.5" />
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
