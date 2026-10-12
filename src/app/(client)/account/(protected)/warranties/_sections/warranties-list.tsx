"use client";

import Link from "next/link";
import { ShieldCheck, ChevronRight, Calendar, Hash, Package, XCircle, AlertTriangle, Wrench, CheckCircle2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  serial_number: string | null;
  product_name: string;
  product_sku: string | null;
  order_number: string | null;
  purchase_date: string;
  warranty_start: string;
  warranty_end: string;
  warranty_months: number;
  status: string;
  note: string | null;
  order_id: string | null;
  days_left: number;
  derived_status: "active" | "expiring" | "expired" | "voided" | "claimed";
};

const STATUS_STYLES = {
  active: { label: "Còn hiệu lực", bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500", icon: CheckCircle2 },
  expiring: { label: "Sắp hết hạn", bg: "bg-orange-50", text: "text-orange-700", bar: "bg-orange-500", icon: AlertTriangle },
  expired: { label: "Đã hết hạn", bg: "bg-zinc-100", text: "text-zinc-600", bar: "bg-zinc-300", icon: XCircle },
  voided: { label: "Đã hủy", bg: "bg-rose-50", text: "text-rose-700", bar: "bg-rose-300", icon: XCircle },
  claimed: { label: "Đang bảo hành", bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500", icon: Wrench },
} as const;

function elapsedPct(it: Item): number {
  try {
    const start = new Date(it.warranty_start).getTime();
    const end = new Date(it.warranty_end).getTime();
    const now = Date.now();
    if (end <= start) return 0;
    const pct = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, pct));
  } catch {
    return 0;
  }
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

export function WarrantiesList({
  items,
  filterOrderId,
}: {
  items: Item[];
  filterOrderId?: string;
}) {
  const filtered = filterOrderId
    ? items.filter((i) => i.order_id === filterOrderId)
    : items;

  if (filtered.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Không có bảo hành nào trong đơn này.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((w) => {
        const style = STATUS_STYLES[w.derived_status];
        const Icon = style.icon;
        return (
          <Card
            key={w.id}
            className="overflow-hidden rounded-2xl border-border/60 transition-all hover:border-primary/30"
          >
            <div className={cn("h-1", style.bar)} />
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        style.bg,
                        style.text,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {style.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {w.warranty_months} tháng
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-semibold">
                    {w.product_name}
                  </p>
                  {w.serial_number && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Hash className="h-3 w-3" />
                      SN: <span className="font-mono">{w.serial_number}</span>
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:flex sm:items-center sm:gap-4">
                    {w.order_number && (
                      <Link
                        href={`/account/orders/${w.order_id ?? ""}`}
                        className="inline-flex items-center gap-1 font-mono hover:text-primary"
                      >
                        <Package className="h-3 w-3" />
                        #{w.order_number}
                      </Link>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Mua: {fmtDate(w.purchase_date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Hết: {fmtDate(w.warranty_end)}
                    </span>
                  </div>
                </div>
                <div className="sm:max-w-[160px] sm:flex-1">
                  {w.derived_status === "active" || w.derived_status === "expiring" ? (
                    <>
                      <div className="mb-1 flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Còn lại</span>
                        <span className="font-semibold">
                          {w.days_left > 0 ? `${w.days_left} ngày` : "Hết hạn hôm nay"}
                        </span>
                      </div>
                      <Progress value={elapsedPct(w)} className="h-1.5" />
                    </>
                  ) : null}
                  {w.derived_status === "expiring" && (
                    <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                      <Link href={`/account/repair-tickets?warranty=${w.id}`}>
                        <Wrench className="mr-1 h-3 w-3" />
                        Gửi bảo hành
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
