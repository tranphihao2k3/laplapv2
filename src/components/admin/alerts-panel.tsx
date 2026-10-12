"use client";

/**
 * AlertsPanel — Panel "cần làm gì hôm nay" hiển thị đầu Dashboard.
 * Polling mỗi 60s. Click vào alert → navigate tới trang filter sẵn.
 */
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  AlertOctagonIcon,
  InfoIcon,
  ChevronRightIcon,
  BellIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { httpGet } from "@/lib/api/http";
import { cn } from "@/lib/utils";

export type AlertSeverity = "critical" | "warning" | "info";
export type AdminAlert = {
  id: string;
  severity: AlertSeverity;
  type: string;
  title: string;
  description: string;
  count: number;
  href: string;
};
export type AdminAlertsResponse = {
  generatedAt: string;
  totals: { critical: number; warning: number; info: number };
  alerts: AdminAlert[];
};

const SEV_STYLES: Record<AlertSeverity, {
  card: string;
  icon: string;
  badge: string;
  Icon: React.ElementType;
  label: string;
}> = {
  critical: {
    card: "border-rose-200/80 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20",
    icon: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/50",
    Icon: AlertOctagonIcon,
    label: "Khẩn cấp",
  },
  warning: {
    card: "border-amber-200/80 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20",
    icon: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/50",
    Icon: AlertTriangleIcon,
    label: "Cảnh báo",
  },
  info: {
    card: "border-sky-200/80 bg-sky-50/40 dark:border-sky-900/60 dark:bg-sky-950/20",
    icon: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/50",
    Icon: InfoIcon,
    label: "Theo dõi",
  },
};

export function AlertsPanel() {
  const q = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => httpGet<AdminAlertsResponse>("/v1/admin/alerts"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (q.isLoading) return <AlertsSkeleton />;
  if (q.error || !q.data) return null;

  const { alerts, totals } = q.data;

  if (alerts.length === 0) {
    return (
      <Card className="border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <CardContent className="flex items-center gap-3 py-4 sm:py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 sm:h-10 sm:w-10">
            <CheckCircle2Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold sm:text-base">Mọi thứ đang ổn</p>
            <p className="text-xs text-muted-foreground sm:text-sm">Không có cảnh báo nào cần xử lý.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 sm:h-8 sm:w-8">
            <BellIcon className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
          </div>
          <CardTitle className="text-sm sm:text-base">Cần xử lý hôm nay</CardTitle>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {totals.critical > 0 && (
              <Badge variant="outline" className="border-rose-300/50 bg-rose-500/15 text-[10px] text-rose-700 dark:text-rose-300 sm:text-xs">
                <AlertOctagonIcon className="mr-1 h-3 w-3" />
                {totals.critical} khẩn
              </Badge>
            )}
            {totals.warning > 0 && (
              <Badge variant="outline" className="border-amber-300/50 bg-amber-500/15 text-[10px] text-amber-700 dark:text-amber-300 sm:text-xs">
                <AlertTriangleIcon className="mr-1 h-3 w-3" />
                {totals.warning} cảnh báo
              </Badge>
            )}
            {totals.info > 0 && (
              <Badge variant="outline" className="border-sky-300/50 bg-sky-500/15 text-[10px] text-sky-700 dark:text-sky-300 sm:text-xs">
                <InfoIcon className="mr-1 h-3 w-3" />
                {totals.info} theo dõi
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {alerts.map((a) => {
            const s = SEV_STYLES[a.severity];
            return (
              <Link
                key={a.id}
                href={a.href}
                className={cn(
                  "group flex items-start gap-2.5 rounded-lg border p-2.5 transition hover:shadow-sm sm:p-3",
                  s.card,
                )}
              >
                <s.Icon className={cn("mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5", s.icon)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold sm:text-sm">{a.title}</p>
                    <Badge variant="outline" className={cn("shrink-0 px-1.5 py-0 text-[10px] font-bold", s.badge)}>
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
      </CardContent>
    </Card>
  );
}

function AlertsSkeleton() {
  return (
    <Card>
      <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
