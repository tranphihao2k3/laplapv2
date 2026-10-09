"use client";

/**
 * Banner cảnh báo tương thích, hiển thị ở đầu build-summary.
 *
 * - Severity error → nền đỏ, icon AlertOctagon.
 * - Warning → nền vàng, icon AlertTriangle.
 * - Info → nền xanh, icon Info.
 * - Có thể thu gọn nếu quá nhiều (chỉ hiện 3 đầu tiên + nút Xem thêm).
 */

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompatibilityIssue } from "@/lib/pc-builder/types";

const SEVERITY_META: Record<
  CompatibilityIssue["severity"],
  {
    bg: string;
    border: string;
    text: string;
    icon: typeof AlertCircle;
    label: string;
  }
> = {
  error: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-800",
    icon: AlertCircle,
    label: "Lỗi tương thích",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    icon: AlertTriangle,
    label: "Cảnh báo",
  },
  info: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-800",
    icon: Info,
    label: "Thông tin",
  },
};

type Props = {
  issues: CompatibilityIssue[];
};

export function CompatibilityBanner({ issues }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Mọi linh kiện tương thích với nhau.</span>
      </div>
    );
  }

  // Ưu tiên hiển thị error → warning → info
  const sorted = [...issues].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  const previewCount = 3;
  const visible = expanded ? sorted : sorted.slice(0, previewCount);

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-3",
        errorCount > 0
          ? "border-rose-200"
          : warnCount > 0
            ? "border-amber-200"
            : "border-sky-200",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {errorCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
              <AlertCircle className="h-3 w-3" />
              {errorCount} lỗi
            </span>
          ) : null}
          {warnCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {warnCount} cảnh báo
            </span>
          ) : null}
          {infoCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">
              <Info className="h-3 w-3" />
              {infoCount} thông tin
            </span>
          ) : null}
        </div>
        {sorted.length > previewCount ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
          >
            {expanded ? "Thu gọn" : `Xem ${sorted.length - previewCount} thêm`}
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        ) : null}
      </div>
      <ul className="space-y-1.5">
        {visible.map((issue, idx) => {
          const meta = SEVERITY_META[issue.severity];
          const Icon = meta.icon;
          return (
            <li
              key={`${issue.severity}-${idx}-${issue.message}`}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                meta.bg,
                meta.border,
                meta.text,
              )}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="leading-snug">{issue.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
