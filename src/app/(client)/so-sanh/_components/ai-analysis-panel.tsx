"use client";

import Image from "next/image";
import { AlertCircle, Check, Loader2, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { needTagLabel } from "@/lib/product-collections";
import { cn } from "@/lib/utils";
import type { CompareAiPayload, ProductForCompare } from "@/lib/compare/types";

type Props = {
  products: ProductForCompare[];
  data: CompareAiPayload | null;
  isPending: boolean;
  error: string | null;
  cached: boolean;
  onRun: () => void;
};

/**
 * Nút "AI phân tích" + khối kết quả.
 *
 * Panel này CHỈ hiện phần định tính (nhận xét, điểm mạnh/yếu, kết luận).
 * Toàn bộ xếp hạng và phần trăm nằm ở bảng thông số phía dưới — cố tình KHÔNG
 * lặp lại ở đây để hai chỗ không bao giờ nói khác nhau.
 */
export function AiAnalysisPanel({ products, data, isPending, error, cached, onRun }: Props) {
  const machineByProduct = new Map(
    data?.scores.map((s, i) => [s.productId, data.machines[i]]) ?? [],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-violet-50 to-white px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-violet-500" />
            AI phân tích hiệu năng
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {data
              ? "Nhận xét từng máy. Thứ hạng và phần trăm xem ở bảng phía trên."
              : "AI chấm điểm CPU, GPU và chất lượng màn hình để xếp hạng đầy đủ hơn."}
          </p>
        </div>

        {!data && (
          <Button onClick={onRun} disabled={isPending} className="bg-violet-600 hover:bg-violet-700">
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Đang phân tích…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-4 w-4" />
                AI phân tích
              </>
            )}
          </Button>
        )}
      </header>

      {/* Chưa bấm thì header đứng một mình — không để lại khoảng trống thừa. */}
      {(isPending || error || data) && (
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">

      {isPending && !data && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <p className="text-[11px] text-slate-400">
            Thường mất 10-20 giây. Lần sau so đúng bộ máy này sẽ có ngay.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRun}
              disabled={isPending}
              className="mt-2 h-7 text-[11px]"
            >
              Thử lại
            </Button>
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.verdict && (
            <p className="rounded-lg bg-violet-50/60 p-3 text-[13px] leading-relaxed text-slate-700 ring-1 ring-violet-100">
              {data.verdict}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => {
              const m = machineByProduct.get(p.id);
              if (!m) return null;
              return (
                <article
                  key={p.id}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 shrink-0">
                      {p.image ? (
                        <Image src={p.image} alt="" fill sizes="32px" className="object-contain" />
                      ) : null}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-800">
                      {p.name}
                    </p>
                  </div>

                  {m.summary && (
                    <p className="mt-2 text-[12px] leading-relaxed text-slate-600">{m.summary}</p>
                  )}

                  <dl className="mt-2.5 space-y-1.5">
                    <ScoreLine label="CPU" score={m.cpu_score} note={m.cpu_note} />
                    <ScoreLine label="GPU" score={m.gpu_score} note={m.gpu_note} />
                    <ScoreLine label="Màn hình" score={m.display_score} note={m.display_note} />
                  </dl>

                  {(m.strengths.length > 0 || m.weaknesses.length > 0) && (
                    <ul className="mt-2.5 space-y-1 border-t border-slate-100 pt-2.5">
                      {m.strengths.map((s) => (
                        <li key={s} className="flex items-start gap-1.5 text-[11px] text-emerald-700">
                          <Check className="mt-0.5 h-3 w-3 shrink-0" />
                          {s}
                        </li>
                      ))}
                      {m.weaknesses.map((w) => (
                        <li key={w} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                          <Minus className="mt-0.5 h-3 w-3 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>

          {data.needNotes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Chọn theo nhu cầu
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.needNotes.map((n) => (
                  <div
                    key={n.need_slug}
                    className="rounded-lg border border-slate-200 bg-white/70 p-2.5"
                  >
                    <p className="text-[11px] font-semibold text-slate-700">
                      {needTagLabel(n.need_slug)}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{n.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400">
            Điểm do AI ước lượng từ thông số, dùng để tham khảo — không phải kết quả benchmark thực tế
            {cached && " · lấy từ kết quả đã lưu"}.
          </p>
        </div>
      )}
      </div>
      )}
    </section>
  );
}

function ScoreLine({ label, score, note }: { label: string; score: number; note: string }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-[62px] shrink-0 text-[11px] text-slate-500">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2">
        <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full",
              score >= 75 ? "bg-emerald-400" : score >= 45 ? "bg-amber-400" : "bg-slate-300",
            )}
            style={{ width: `${Math.max(3, score)}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-700">
          {score}
        </span>
        {note && <span className="min-w-0 truncate text-[11px] text-slate-400">{note}</span>}
      </dd>
    </div>
  );
}
