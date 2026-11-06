"use client";

import { Pause, Play, Trash2, User, Clock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatVND, formatNumber, type HeldBill } from "./types";

type Props = {
  heldBills: HeldBill[];
  onResume: (bill: HeldBill) => void;
  onDelete: (id: string) => void;
};

export function HoldBillDrawer({ heldBills, onResume, onDelete }: Props) {
  const count = heldBills.length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-11 flex-1 items-center justify-center gap-2 px-3 sm:h-9 sm:flex-none">
          <Pause className="h-4 w-4 shrink-0" />
          <span className="hidden truncate sm:inline">Đơn tạm</span>
          <span className="truncate sm:hidden">Tạm</span>
          {count > 0 && (
            <span className="absolute right-0 top-0 flex h-5 min-w-[20px] -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5 text-primary" />
            Đơn đang giữ ({count})
          </SheetTitle>
          <SheetDescription>
            Đơn tạm chưa thanh toán. Nhấn để mở lại.
          </SheetDescription>
        </SheetHeader>

        {count === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Pause className="h-10 w-10 opacity-30" />
            <p>Chưa có đơn tạm nào.</p>
            <p className="text-xs">
              Trong lúc thanh toán, bạn có thể bấm &ldquo;Giữ đơn&rdquo; để xử lý đơn khác trước.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-hidden overflow-y-auto">
            <ul className="divide-y">
              {heldBills.map((bill) => {
                const subtotal = bill.lines.reduce(
                  (s, l) => s + l.unit_price * l.quantity,
                  0,
                );
                const total = Math.max(0, subtotal - bill.discount);
                const itemCount = bill.lines.reduce((n, l) => n + l.quantity, 0);
                return (
                  <li key={bill.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-semibold">{bill.name}</p>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {bill.customer && (
                            <span className="flex min-w-0 items-center gap-0.5">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {bill.customer.full_name || bill.customer.phone}
                              </span>
                            </span>
                          )}
                          <span className="flex shrink-0 items-center gap-0.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            {formatTimeAgo(bill.createdAt)}
                          </span>
                          <span className="shrink-0">{formatNumber(itemCount)} SP</span>
                        </div>
                        <div className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">
                          {formatVND(total)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => onResume(bill)}
                          className="h-10 px-3"
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Mở lại
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(bill.id)}
                          className="h-10 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Xoá đơn tạm"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
        </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const seconds = Math.floor((Date.now() - t) / 1000);
  if (seconds < 60) return `${seconds}s trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}