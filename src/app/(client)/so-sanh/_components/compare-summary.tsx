"use client";

import Image from "next/image";
import { Award, CircleHelp, Coins, Trophy } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { CompareResult } from "@/lib/compare/types";

/**
 * Khối tổng kết đặt TRÊN bảng thông số: điểm tổng, máy đáng tiền nhất,
 * máy tốt nhất cho từng nhu cầu.
 *
 * Mọi con số ở đây do CODE tính (buildCompareResult), kể cả khi đã có điểm AI —
 * AI chỉ đóng góp điểm CPU/GPU/màn hình làm đầu vào. Nhờ vậy nhãn "Tốt nhất cho
 * Gaming" không bao giờ mâu thuẫn với bảng xếp hạng ngay bên dưới.
 */
export function CompareSummary({ result }: { result: CompareResult }) {
  const { products, overall, valueScores, bestByNeed, hasAiScores } = result;

  const productById = new Map(products.map((p) => [p.id, p]));
  const overallById = new Map(overall.map((o) => [o.productId, o]));
  const maxScore = Math.max(...overall.map((o) => o.score), 1);

  const bestValue = valueScores
    .filter((v) => v.value != null)
    .reduce<(typeof valueScores)[number] | null>(
      (best, v) => (best == null || (v.value as number) > (best.value as number) ? v : best),
      null,
    );

  // Điểm dựa trên quá ít thông số thì phải nói rõ, đừng để khách tưởng đã
  // đánh giá đầy đủ. Chỉ cần MỘT máy thiếu là cả bảng đã lệch.
  const anyLowConfidence = overall.some((o) => o.lowConfidence);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Trophy className="h-4 w-4 text-amber-500" />
          Điểm tổng
        </h2>
        <p className="text-[11px] text-slate-400">
          {hasAiScores
            ? "Đã tính cả điểm AI cho CPU, GPU và chất lượng màn hình"
            : "Chưa gồm CPU/GPU/màn hình — bấm “AI phân tích” để chấm thêm"}
        </p>
      </header>

      <ol className="space-y-2.5">
        {[...overall]
          .sort((a, b) => a.rank - b.rank || b.score - a.score)
          .map((o) => {
            const p = productById.get(o.productId);
            if (!p) return null;
            const isTop = o.rank === 1;
            return (
              <li key={o.productId} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    isTop ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {o.rank}
                </span>

                <div className="relative h-8 w-8 shrink-0">
                  {p.image ? (
                    <Image src={p.image} alt="" fill sizes="32px" className="object-contain" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[12px] leading-tight",
                      isTop ? "font-semibold text-slate-900" : "text-slate-700",
                    )}
                    title={p.name}
                  >
                    {p.name}
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        isTop ? "bg-amber-400" : "bg-slate-300",
                      )}
                      style={{ width: `${Math.max(4, (o.score / maxScore) * 100)}%` }}
                    />
                  </div>
                </div>

                <span
                  className={cn(
                    "shrink-0 text-[13px] font-semibold tabular-nums",
                    isTop ? "text-amber-700" : "text-slate-600",
                  )}
                >
                  {o.score.toFixed(1)}
                </span>
              </li>
            );
          })}
      </ol>

      {anyLowConfidence && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
          <CircleHelp className="mt-px h-3 w-3 shrink-0" />
          Một số máy còn thiếu thông số nên điểm chỉ mang tính tham khảo.
        </p>
      )}

      {(bestValue || bestByNeed.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {bestValue && (
            <Highlight
              icon={<Coins className="h-3 w-3" />}
              label="Đáng tiền nhất"
              name={productById.get(bestValue.productId)?.name ?? ""}
              note={
                (() => {
                  const p = productById.get(bestValue.productId);
                  const o = overallById.get(bestValue.productId);
                  return p && o ? `${o.score.toFixed(1)} điểm · ${formatCurrency(p.price)}` : undefined;
                })()
              }
              tone="emerald"
            />
          )}
          {bestByNeed.map((b) => (
            <Highlight
              key={b.needSlug}
              icon={<Award className="h-3 w-3" />}
              label={`Tốt nhất cho ${b.needLabel}`}
              name={productById.get(b.productId)?.name ?? ""}
              tone="slate"
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Highlight({
  icon,
  label,
  name,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  note?: string;
  tone: "emerald" | "slate";
}) {
  if (!name) return null;
  return (
    <div
      className={cn(
        "min-w-[160px] flex-1 rounded-lg border px-3 py-2",
        tone === "emerald" ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/50",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
          tone === "emerald" ? "text-emerald-700" : "text-slate-500",
        )}
      >
        {icon}
        {label}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug text-slate-800">
        {name}
      </p>
      {note && <p className="mt-0.5 text-[10px] text-slate-500">{note}</p>}
    </div>
  );
}
