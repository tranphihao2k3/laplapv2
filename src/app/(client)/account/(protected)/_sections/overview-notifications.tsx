"use client";

import Link from "next/link";
import { Bell, BellOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
};

export function OverviewNotifications({ items }: { items: Notification[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 text-center">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <BellOff className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium">Chưa có thông báo</p>
        <p className="text-xs text-muted-foreground">
          Cập nhật đơn hàng, khuyến mãi sẽ hiện ở đây.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.map((n) => {
        const Inner = (
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 transition-colors",
              n.is_read
                ? "border-border/60 bg-muted/30"
                : "border-primary/20 bg-primary/5",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                n.is_read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
              )}
            >
              <Bell className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{n.title}</p>
              {n.body && (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {n.body}
                </p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.created_at).toLocaleString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        );
        return (
          <li key={n.id}>
            {n.href ? <Link href={n.href}>{Inner}</Link> : Inner}
          </li>
        );
      })}
      <li>
        <Button asChild variant="ghost" size="sm" className="mt-1 h-7 w-full text-xs">
          <Link href="/account/notifications">
            Xem tất cả thông báo <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </li>
    </ul>
  );
}
