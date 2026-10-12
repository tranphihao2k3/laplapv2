"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiItem = {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "danger" | "warning" | "info";
  hint?: string;
  /** Có thêm sparkline 7 ngày */
  sparkline?: number[];
};

const TONE_BG: Record<NonNullable<KpiItem["tone"]>, string> = {
  default: "bg-card",
  success: "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60",
  danger: "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60",
  warning: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60",
  info: "bg-sky-50/50 dark:bg-sky-950/20 border-sky-200/60",
};

const TONE_TEXT: Record<NonNullable<KpiItem["tone"]>, string> = {
  default: "text-foreground",
  success: "text-emerald-700 dark:text-emerald-300",
  danger: "text-rose-700 dark:text-rose-300",
  warning: "text-amber-700 dark:text-amber-300",
  info: "text-sky-700 dark:text-sky-300",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-8 w-full mt-2"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function ReportKpiRow({ items }: { items: KpiItem[] }) {
  const cols = items.length <= 3 ? 3 : items.length <= 4 ? 4 : items.length <= 6 ? 3 : 4;
  return (
    <div
      className={cn(
        "grid gap-2 sm:gap-3",
        cols === 3 && "grid-cols-1 sm:grid-cols-3",
        cols === 4 && "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {items.map((it, i) => {
        const tone = it.tone ?? "default";
        const Icon = it.icon;
        return (
          <Card key={`${it.label}-${i}`} className={cn("border", TONE_BG[tone])}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground truncate">
                    {it.label}
                  </div>
                  <div className={cn("text-lg sm:text-xl font-bold tabular-nums truncate", TONE_TEXT[tone])}>
                    {it.value}
                  </div>
                  {it.hint && (
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                      {it.hint}
                    </div>
                  )}
                </div>
                {Icon && (
                  <div className="shrink-0 rounded-md bg-muted/60 p-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
              {it.sparkline && (
                <Sparkline
                  data={it.sparkline}
                  color={
                    tone === "success" ? "#10b981"
                      : tone === "danger" ? "#f43f5e"
                        : tone === "warning" ? "#f59e0b"
                          : tone === "info" ? "#0ea5e9"
                            : "#6366f1"
                  }
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
