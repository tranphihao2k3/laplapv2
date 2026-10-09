"use client";

/**
 * Sidebar trái của trang PC Builder.
 *
 * - Liệt kê các slot theo `SLOT_ORDER`.
 * - Mỗi slot hiển thị: icon, label, số lượng, tổng giá, badge đỏ nếu có issue.
 * - Click → gọi `onSelect(slot)` để parent mở picker.
 * - Active slot được highlight border.
 */

import {
  Cpu,
  CircuitBoard,
  MemoryStick,
  Monitor,
  HardDrive,
  Disc3,
  Zap,
  Box,
  Fan,
  Keyboard,
  Mouse,
  Headphones,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import {
  SLOT_LABEL,
  SLOT_ORDER,
  type BuildState,
  type CompatibilityIssue,
  type SlotKey,
} from "@/lib/pc-builder/types";

const ICON_MAP: Record<SlotKey, LucideIcon> = {
  cpu: Cpu,
  mainboard: CircuitBoard,
  ram: MemoryStick,
  gpu: Monitor,
  ssd: HardDrive,
  hdd: Disc3,
  psu: Zap,
  case: Box,
  cooler: Fan,
  monitor: Monitor,
  keyboard: Keyboard,
  mouse: Mouse,
  headset: Headphones,
};

type Props = {
  build: BuildState;
  issues: CompatibilityIssue[];
  activeSlot: SlotKey | null;
  onSelect: (slot: SlotKey) => void;
};

function getSlotTotal(state: BuildState, slot: SlotKey): number {
  const items = state[slot] ?? [];
  return items.reduce((sum, it) => sum + (it.unitPrice || 0) * (it.qty || 0), 0);
}

function getSlotCount(state: BuildState, slot: SlotKey): number {
  const items = state[slot] ?? [];
  return items.reduce((sum, it) => sum + (it.qty || 0), 0);
}

export function CategoryRail({ build, issues, activeSlot, onSelect }: Props) {
  // Tập slot có issue (mọi severity) để hiển thị badge.
  const issueSlotSet = new Set<SlotKey>();
  for (const issue of issues) {
    issueSlotSet.add(issue.slot);
    if (issue.relatedSlot) issueSlotSet.add(issue.relatedSlot);
  }

  const totalEstimate = SLOT_ORDER.reduce(
    (sum, slot) => sum + getSlotTotal(build, slot),
    0,
  );

  return (
    <aside className="lg:sticky lg:top-20 lg:self-start">
      <div className="flex items-center justify-between rounded-t-xl border border-b-0 bg-gradient-to-b from-slate-50 to-white px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Linh kiện</h2>
          <p className="text-[11px] text-slate-500">
            Chọn từng món để dựng cấu hình
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-500">Tạm tính</p>
          <p className="text-sm font-bold text-slate-900">
            {formatCurrency(totalEstimate)}
          </p>
        </div>
      </div>
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-b-xl border bg-white">
        <ul className="divide-y divide-slate-100">
          {SLOT_ORDER.map((slot) => {
            const Icon = ICON_MAP[slot];
            const count = getSlotCount(build, slot);
            const total = getSlotTotal(build, slot);
            const hasIssue = issueSlotSet.has(slot);
            const isActive = activeSlot === slot;
            const errorCount = issues.filter(
              (i) => i.severity === "error" && (i.slot === slot || i.relatedSlot === slot),
            ).length;
            const warnCount = issues.filter(
              (i) => i.severity === "warning" && (i.slot === slot || i.relatedSlot === slot),
            ).length;
            return (
              <li key={slot}>
                <button
                  type="button"
                  onClick={() => onSelect(slot)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    "hover:bg-slate-50",
                    isActive && "bg-slate-50",
                    isActive && "border-l-2 border-primary",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white transition-colors",
                      hasIssue
                        ? "border-rose-200 bg-rose-50 text-rose-600"
                        : isActive
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-slate-200 text-slate-600 group-hover:border-slate-300",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {SLOT_LABEL[slot]}
                      </p>
                      {count > 0 ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          ×{count}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-slate-500">
                      {count > 0
                        ? `${count} món · ${formatCurrency(total)}`
                        : "Chưa chọn"}
                    </p>
                  </div>
                  {hasIssue ? (
                    <Badge
                      variant="destructive"
                      className={cn(
                        "shrink-0 px-1.5 py-0 text-[10px]",
                        warnCount > 0 && errorCount === 0 && "bg-amber-500",
                      )}
                    >
                      {errorCount > 0 ? `!${errorCount}` : `~${warnCount}`}
                    </Badge>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
