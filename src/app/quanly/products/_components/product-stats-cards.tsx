"use client";

import { Package, CheckCircle2, FileEdit, Archive, AlertTriangle, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatItem = {
  key: string;
  label: string;
  value: number | null;
  icon: LucideIcon;
  tone: "neutral" | "success" | "warning" | "muted" | "danger";
  /** Sub-label ngắn bên dưới số (VD: "12% tổng sản phẩm") */
  hint?: string;
  /** Highlight khi đang lọc theo status này */
  active?: boolean;
};

type Props = {
  total: number | null;
  active: number | null;
  draft: number | null;
  archived: number | null;
  /** Số sản phẩm KHÔNG có variant nào (tính từ data trong page). */
  withoutVariants: number;
  loading: boolean;
};

const TONE_STYLES: Record<StatItem["tone"], { bg: string; ring: string; icon: string; text: string }> = {
  neutral: {
    bg: "from-slate-50 to-white dark:from-slate-950/30",
    ring: "ring-slate-200/70",
    icon: "bg-slate-100 text-slate-700",
    text: "text-slate-700",
  },
  success: {
    bg: "from-emerald-50 to-white",
    ring: "ring-emerald-200/70",
    icon: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-700",
  },
  warning: {
    bg: "from-amber-50 to-white",
    ring: "ring-amber-200/70",
    icon: "bg-amber-100 text-amber-700",
    text: "text-amber-700",
  },
  muted: {
    bg: "from-zinc-50 to-white",
    ring: "ring-zinc-200/70",
    icon: "bg-zinc-100 text-zinc-600",
    text: "text-zinc-600",
  },
  danger: {
    bg: "from-rose-50 to-white",
    ring: "ring-rose-200/70",
    icon: "bg-rose-100 text-rose-700",
    text: "text-rose-700",
  },
};

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function ProductStatsCards({
  total,
  active,
  draft,
  archived,
  withoutVariants,
  loading,
}: Props) {
  const totalKnown = total ?? 0;
  const stats: StatItem[] = [
    {
      key: "total",
      label: "Tổng sản phẩm",
      value: total,
      icon: Package,
      tone: "neutral",
      hint: loading ? "Đang đếm..." : `Đang quản lý`,
    },
    {
      key: "active",
      label: "Đang bán",
      value: active,
      icon: CheckCircle2,
      tone: "success",
      hint:
        totalKnown > 0 && active != null
          ? `${Math.round((active / totalKnown) * 100)}% tổng số`
          : undefined,
    },
    {
      key: "draft",
      label: "Bản nháp",
      value: draft,
      icon: FileEdit,
      tone: "warning",
    },
    {
      key: "archived",
      label: "Ngừng bán",
      value: archived,
      icon: Archive,
      tone: "muted",
    },
    {
      key: "noVariants",
      label: "Chưa có biến thể",
      value: withoutVariants,
      icon: AlertTriangle,
      tone: "danger",
      hint: "Cần thêm SKU để bán được",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => {
        const tone = TONE_STYLES[s.tone];
        const Icon = s.icon;
        return (
          <Card
            key={s.key}
            className={cn(
              "group relative overflow-hidden border bg-gradient-to-br ring-1 ring-inset transition-all",
              tone.bg,
              tone.ring,
              s.active && "ring-2 ring-primary shadow-md",
            )}
          >
            <CardContent className="flex items-center gap-3 p-3 sm:p-4">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
                  tone.icon,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
                  {s.label}
                </p>
                {loading && s.key !== "noVariants" ? (
                  <Skeleton className="mt-1 h-6 w-12" />
                ) : (
                  <p className={cn("text-xl font-bold tabular-nums leading-tight sm:text-2xl", tone.text)}>
                    {(s.value ?? 0).toLocaleString("vi-VN")}
                  </p>
                )}
                {s.hint && (
                  <p className="mt-0.5 hidden truncate text-[10px] text-muted-foreground sm:block">
                    {s.hint}
                  </p>
                )}
              </div>
              {s.active && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
