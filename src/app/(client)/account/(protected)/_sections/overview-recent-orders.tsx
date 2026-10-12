"use client";

import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";

type OrderRow = {
  id: string;
  order_number: string;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  created_at: string | null;
};

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Nháp", bg: "bg-zinc-100", text: "text-zinc-700" },
  pending: { label: "Chờ xử lý", bg: "bg-amber-50", text: "text-amber-700" },
  confirmed: { label: "Đã xác nhận", bg: "bg-blue-50", text: "text-blue-700" },
  processing: { label: "Đang xử lý", bg: "bg-indigo-50", text: "text-indigo-700" },
  shipping: { label: "Đang giao", bg: "bg-violet-50", text: "text-violet-700" },
  fulfilled: { label: "Đã giao", bg: "bg-emerald-50", text: "text-emerald-700" },
  completed: { label: "Hoàn tất", bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { label: "Đã huỷ", bg: "bg-rose-50", text: "text-rose-700" },
};

export function OverviewRecentOrders({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Package className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">Bạn chưa có đơn hàng nào</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Khám phá các laptop và phụ kiện phù hợp với nhu cầu của bạn.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/products">Mua sắm ngay</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {orders.map((o) => {
        const status = STATUS_MAP[o.status ?? ""] ?? {
          label: o.status ?? "—",
          bg: "bg-muted",
          text: "text-muted-foreground",
        };
        return (
          <li key={o.id}>
            <Link
              href={`/account/orders/${o.id}`}
              className="group flex items-center gap-3 py-3 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-lg"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="font-mono">#{o.order_number}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      status.bg,
                      status.text,
                    )}
                  >
                    {status.label}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {o.created_at
                    ? new Date(o.created_at).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {formatCurrency(o.total_amount ?? 0)}
              </p>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
