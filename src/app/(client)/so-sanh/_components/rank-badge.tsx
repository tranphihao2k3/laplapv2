"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NEGLIGIBLE_PCT } from "@/lib/compare/ranking";
import type { Cell } from "@/lib/compare/types";

/** Màu badge theo hạng: vàng · bạc · đồng · xám. */
const RANK_STYLE: Record<number, string> = {
  1: "bg-amber-100 text-amber-800 ring-amber-200",
  2: "bg-slate-100 text-slate-700 ring-slate-200",
  3: "bg-orange-100/70 text-orange-800 ring-orange-200",
  4: "bg-slate-50 text-slate-500 ring-slate-200",
};

const BAR_STYLE: Record<number, string> = {
  1: "bg-amber-400",
  2: "bg-slate-400",
  3: "bg-orange-300",
  4: "bg-slate-300",
};

export function RankBadge({ rank, allEqual }: { rank: number | null; allEqual: boolean }) {
  if (allEqual) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
        <Minus className="h-2.5 w-2.5" />
        Ngang nhau
      </span>
    );
  }
  if (rank == null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
        RANK_STYLE[rank] ?? RANK_STYLE[4],
      )}
    >
      TOP {rank}
    </span>
  );
}

/**
 * Câu diễn giải chênh lệch, 1 dòng.
 *
 * Quy tắc chọn cách nói:
 *  - chênh dưới 3% → "gần như tương đương" (tránh cảm giác giả tạo kiểu
 *    "1.40kg vs 1.42kg → kém 1.4%")
 *  - chênh từ 2 lần trở lên → nói "gấp N lần" vì "-182%" rất khó hiểu
 *  - còn lại → nói phần trăm
 */
export function DiffNote({ cell, allEqual }: { cell: Cell; allEqual: boolean }) {
  if (allEqual || cell.rank == null) return null;

  // TOP 1: khoe hơn hạng nhì bao nhiêu.
  if (cell.leadPct != null) {
    if (cell.leadPct < NEGLIGIBLE_PCT) {
      return <p className="text-[10px] text-slate-400">Nhỉnh hơn không đáng kể</p>;
    }
    return (
      <p className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
        <ArrowUp className="h-2.5 w-2.5" />
        Hơn hạng nhì {formatPct(cell.leadPct)}
      </p>
    );
  }

  if (cell.vsBestPct == null || cell.vsBestPct === 0) return null;

  const gap = Math.abs(cell.vsBestPct);
  if (gap < NEGLIGIBLE_PCT) {
    return <p className="text-[10px] text-slate-400">Gần như tương đương</p>;
  }

  return (
    <p className="flex items-center gap-0.5 text-[10px] text-slate-500">
      <ArrowDown className="h-2.5 w-2.5" />
      {cell.vsBestTimes != null && cell.vsBestTimes >= 2
        ? `TOP 1 gấp ${cell.vsBestTimes} lần`
        : `Kém TOP 1 ${formatPct(gap)}`}
    </p>
  );
}

/** Thanh bar thể hiện tương quan, thuần thị giác. */
export function RankBar({ cell }: { cell: Cell }) {
  if (cell.barPct == null) return null;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          BAR_STYLE[cell.rank ?? 4] ?? BAR_STYLE[4],
        )}
        style={{ width: `${Math.max(4, cell.barPct)}%` }}
      />
    </div>
  );
}

function formatPct(v: number): string {
  const n = Math.abs(v);
  return n >= 10 ? `${Math.round(n)}%` : `${n.toFixed(1)}%`;
}
