"use client";

import Image from "next/image";
import Link from "next/link";
import { Award, CircleHelp, Coins, Crown, Sparkles } from "lucide-react";
import { METRIC_BY_ID } from "@/lib/compare/spec-registry";
import { cn, formatCurrency } from "@/lib/utils";
import type { CompareResult, MetricStanding } from "@/lib/compare/types";
import { specIcon } from "@/components/client/compare/spec-icons";

/**
 * Khối xếp hạng tổng, đặt TRÊN bảng thông số.
 *
 * Nguyên tắc: mọi con số ở đây do CODE tính (buildCompareResult), kể cả khi đã
 * có điểm AI — AI chỉ đóng góp điểm CPU/GPU/màn hình làm đầu vào. Nhờ vậy thứ
 * hạng ở đây không bao giờ mâu thuẫn với bảng xếp hạng ngay bên dưới.
 *
 * Mỗi thẻ kèm "thắng N/M tiêu chí" + danh sách tiêu chí thắng, để khách kiểm
 * chứng được thứ hạng thay vì phải tin một con số trần trụi.
 */
export function CompareSummary({ result }: { result: CompareResult }) {
  const { products, overall, breakdowns, valueScores, bestByNeed, hasAiScores } = result;

  const productById = new Map(products.map((p) => [p.id, p]));
  const breakdownById = new Map(breakdowns.map((b) => [b.productId, b]));
  const valueById = new Map(valueScores.map((v) => [v.productId, v]));
  const maxScore = Math.max(...overall.map((o) => o.score), 1);

  const ranked = [...overall].sort((a, b) => a.rank - b.rank || b.score - a.score);
  const bestValueId =
    valueScores.filter((v) => v.rank === 1 && v.value != null)[0]?.productId ?? null;

  // Điểm dựa trên quá ít thông số thì phải nói rõ, đừng để khách tưởng đã
  // đánh giá đầy đủ. Chỉ cần MỘT máy thiếu là cả bảng đã lệch.
  const anyLowConfidence = overall.some((o) => o.lowConfidence);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-amber-50/70 to-white px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Crown className="h-4 w-4 text-amber-500" />
          Bảng xếp hạng tổng
        </h2>
        <p
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            hasAiScores
              ? "bg-violet-100 text-violet-700"
              : "bg-slate-100 text-slate-500",
          )}
        >
          {hasAiScores ? (
            <>
              <Sparkles className="h-2.5 w-2.5" />
              Đã gồm điểm AI cho CPU · GPU · màn hình
            </>
          ) : (
            "Chưa gồm CPU · GPU · màn hình"
          )}
        </p>
      </header>

      <ol className="divide-y divide-slate-100">
        {ranked.map((o) => {
          const p = productById.get(o.productId);
          if (!p) return null;
          const bd = breakdownById.get(o.productId);
          const value = valueById.get(o.productId);
          const isTop = o.rank === 1;

          return (
            <li
              key={o.productId}
              className={cn(
                "flex gap-3 px-4 py-3 sm:px-5",
                isTop && "bg-amber-50/40",
              )}
            >
              {/* Hạng */}
              <div className="flex w-7 shrink-0 flex-col items-center pt-0.5">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold",
                    isTop
                      ? "bg-amber-400 text-white shadow-sm shadow-amber-200"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {o.rank}
                </span>
              </div>

              {/* Ảnh */}
              <Link
                href={`/products/${p.slug}`}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-white"
              >
                {p.image ? (
                  <Image src={p.image} alt="" fill sizes="56px" className="object-contain p-1" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] font-semibold text-slate-200">
                    LapLap
                  </span>
                )}
              </Link>

              {/* Nội dung */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${p.slug}`}
                      className={cn(
                        "block truncate text-[13px] leading-tight hover:text-primary",
                        isTop ? "font-semibold text-slate-900" : "font-medium text-slate-700",
                      )}
                      title={p.name}
                    >
                      {p.name}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {p.price > 0 ? formatCurrency(p.price) : "Liên hệ"}
                      {value?.value != null && (
                        <span className="text-slate-400"> · {value.value} điểm/triệu</span>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={cn(
                        "text-[17px] font-bold leading-none tabular-nums",
                        isTop ? "text-amber-600" : "text-slate-700",
                      )}
                    >
                      {o.score.toFixed(1)}
                    </span>
                    <span className="ml-0.5 text-[10px] text-slate-400">/100</span>
                    {bd && bd.rankedCount > 0 && (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Thắng {bd.wins}/{bd.rankedCount} tiêu chí
                      </p>
                    )}
                  </div>
                </div>

                {/* Thanh điểm */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      isTop ? "bg-amber-400" : "bg-slate-300",
                    )}
                    style={{ width: `${Math.max(4, (o.score / maxScore) * 100)}%` }}
                  />
                </div>

                {/* Tiêu chí thắng — bằng chứng cho thứ hạng */}
                {bd && bd.wins > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {bd.standings
                      .filter((s) => s.rank === 1 && !s.allEqual)
                      .map((s) => (
                        <WinChip key={s.metricId} standing={s} />
                      ))}
                  </div>
                )}

                {/* Nhãn nổi bật */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {bestValueId === p.id && (
                    <Tag icon={<Coins className="h-2.5 w-2.5" />} tone="emerald">
                      Đáng tiền nhất
                    </Tag>
                  )}
                  {bestByNeed
                    .filter((b) => b.productId === p.id)
                    .map((b) => (
                      <Tag key={b.needSlug} icon={<Award className="h-2.5 w-2.5" />} tone="sky">
                        Tốt nhất cho {b.needLabel}
                      </Tag>
                    ))}
                  {o.lowConfidence && (
                    <Tag icon={<CircleHelp className="h-2.5 w-2.5" />} tone="slate">
                      Thiếu thông số
                    </Tag>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-5">
        <p className="text-[10px] leading-relaxed text-slate-500">
          Điểm tính từ CPU, GPU, RAM, ổ cứng, màn hình, pin và trọng lượng — tiêu chí quan trọng hơn
          có trọng số cao hơn. <span className="text-slate-400">Giá không tính vào điểm</span> (nếu
          tính, máy rẻ-yếu sẽ thắng oan) mà tách riêng thành chỉ số “điểm/triệu”.
          {anyLowConfidence && " Máy gắn nhãn “thiếu thông số” có điểm chỉ mang tính tham khảo."}
        </p>
      </footer>
    </section>
  );
}

/**
 * Chip một tiêu chí thắng. Tiêu chí trọng số cao được tô đậm hơn — thắng CPU
 * (28đ) đáng giá hơn hẳn thắng tần số quét (4đ), nên nhìn phải thấy khác nhau.
 */
function WinChip({ standing }: { standing: MetricStanding }) {
  const metric = METRIC_BY_ID.get(standing.metricId);
  const Icon = specIcon(metric?.iconName);
  const major = standing.weight >= 14;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1",
        major
          ? "bg-amber-100 text-amber-800 ring-amber-200"
          : "bg-slate-50 text-slate-600 ring-slate-200",
      )}
      title={`Đứng nhất về ${metric?.label ?? standing.metricId}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {metric?.label ?? standing.metricId}
    </span>
  );
}

function Tag({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: "emerald" | "sky" | "slate";
  children: React.ReactNode;
}) {
  const TONE = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    slate: "bg-slate-50 text-slate-500 ring-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
        TONE[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}
