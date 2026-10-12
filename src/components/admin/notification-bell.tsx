"use client";

/**
 * NotificationBell — Icon chuông trên top-bar với badge đếm số alert.
 * Click mở dropdown liệt kê tất cả alerts, click alert → navigate tới trang.
 * Polling mỗi 60s. Đánh dấu "đã xem" lưu localStorage.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BellIcon,
  AlertOctagonIcon,
  AlertTriangleIcon,
  InfoIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  InboxIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { httpGet } from "@/lib/api/http";
import { cn } from "@/lib/utils";
import type { AdminAlertsResponse, AlertSeverity } from "@/components/admin/alerts-panel";

const SEV_META: Record<AlertSeverity, { Icon: React.ElementType; color: string; label: string }> = {
  critical: { Icon: AlertOctagonIcon, color: "text-rose-600 dark:text-rose-400", label: "Khẩn" },
  warning: { Icon: AlertTriangleIcon, color: "text-amber-600 dark:text-amber-400", label: "Cảnh báo" },
  info: { Icon: InfoIcon, color: "text-sky-600 dark:text-sky-400", label: "Theo dõi" },
};

const STORAGE_KEY = "admin-alerts-last-seen";

export function NotificationBell() {
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setLastSeenAt(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* SSR / private mode */
    }
  }, []);

  const q = useQuery({
    queryKey: ["admin-alerts-bell"],
    queryFn: () => httpGet<AdminAlertsResponse>("/v1/admin/alerts"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const data = q.data;
  const alerts = data?.alerts ?? [];
  const totals = data?.totals ?? { critical: 0, warning: 0, info: 0 };

  // Tính số alert "chưa xem" = tạo sau lần xem cuối
  const unseenCount = lastSeenAt && data?.generatedAt
    ? alerts.filter((a) => data!.generatedAt > lastSeenAt).length
    : alerts.length;
  const criticalUnseen = (lastSeenAt && data?.generatedAt)
    ? alerts.filter((a) => a.severity === "critical" && data!.generatedAt > lastSeenAt).length
    : totals.critical;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && data) {
      try {
        localStorage.setItem(STORAGE_KEY, data.generatedAt);
        setLastSeenAt(data.generatedAt);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label="Thông báo"
        >
          <BellIcon className="h-4 w-4" />
          {unseenCount > 0 && (
            <Badge
              variant={criticalUnseen > 0 ? "destructive" : "default"}
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                criticalUnseen === 0 && unseenCount > 0 && "bg-amber-500 text-white",
              )}
            >
              {unseenCount > 99 ? "99+" : unseenCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-md p-0 sm:w-96">
        <div className="flex items-center justify-between px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Thông báo</DropdownMenuLabel>
          <div className="flex items-center gap-1.5">
            {totals.critical > 0 && (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                {totals.critical} khẩn
              </Badge>
            )}
            {totals.warning > 0 && (
              <Badge variant="outline" className="border-amber-300/60 bg-amber-500/15 px-1.5 py-0 text-[10px] text-amber-700 dark:text-amber-300">
                {totals.warning}
              </Badge>
            )}
            {totals.info > 0 && (
              <Badge variant="outline" className="border-sky-300/60 bg-sky-500/15 px-1.5 py-0 text-[10px] text-sky-700 dark:text-sky-300">
                {totals.info}
              </Badge>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />

        {q.isLoading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center text-muted-foreground">
            <CheckCircle2Icon className="h-7 w-7 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">Mọi thứ đang ổn</p>
            <p className="text-xs">Không có cảnh báo nào.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {alerts.map((a) => {
              const meta = SEV_META[a.severity];
              return (
                <Link
                  key={a.id}
                  href={a.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-start gap-2.5 border-b px-3 py-2.5 last:border-0 hover:bg-muted/50"
                >
                  <meta.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold sm:text-sm">{a.title}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 px-1.5 py-0 text-[10px] font-bold",
                          a.severity === "critical" && "border-rose-300/60 bg-rose-500/15 text-rose-700 dark:text-rose-300",
                          a.severity === "warning" && "border-amber-300/60 bg-amber-500/15 text-amber-700 dark:text-amber-300",
                          a.severity === "info" && "border-sky-300/60 bg-sky-500/15 text-sky-700 dark:text-sky-300",
                        )}
                      >
                        {a.count}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">{a.description}</p>
                  </div>
                  <ChevronRightIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>
        )}

        <DropdownMenuSeparator />
        <div className="p-1.5">
          <Link
            href="/quanly"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/5"
          >
            <InboxIcon className="h-3.5 w-3.5" />
            Xem tất cả trên Dashboard
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
