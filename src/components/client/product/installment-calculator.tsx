"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Info, Loader2, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  calcInstallment,
  DEFAULT_FINANCING,
  normalizeFinancing,
  type FinancingSetting,
} from "@/lib/financing";
import { cn, formatCurrency } from "@/lib/utils";

function useFinancing() {
  return useQuery<FinancingSetting>({
    queryKey: ["public-financing"],
    queryFn: async () => {
      const res = await fetch("/api/public/financing");
      if (!res.ok) throw new Error("Không tải được cấu hình trả góp");
      return normalizeFinancing(await res.json());
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Chỉ nhận số, hiển thị có dấu phân cách nghìn kiểu vi-VN. */
function parseAmount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function InstallmentCalculator({ price }: { price: number }) {
  const { data, isLoading } = useFinancing();
  const config = data ?? DEFAULT_FINANCING;

  const providers = config.providers;
  const minPrice = config.minPrice ?? 0;

  const [open, setOpen] = useState(false);
  const [providerIdx, setProviderIdx] = useState(0);
  const [termIdx, setTermIdx] = useState(0);
  // null = chưa nhập, dùng mức trả trước tối thiểu của bên đang chọn.
  const [downRaw, setDownRaw] = useState<string | null>(null);

  const provider = providers[Math.min(providerIdx, providers.length - 1)];
  const term = provider?.terms[Math.min(termIdx, provider.terms.length - 1)];

  const minDown = useMemo(
    () => Math.round((price * (provider?.minDownPercent ?? 0)) / 100),
    [price, provider?.minDownPercent],
  );

  const downPayment = downRaw === null ? minDown : Math.min(parseAmount(downRaw), price);
  const belowMin = downPayment < minDown;

  const plan = useMemo(
    () =>
      term
        ? calcInstallment(price, downPayment, term, provider?.conversionFeePercent ?? 0)
        : null,
    [price, downPayment, term, provider?.conversionFeePercent],
  );

  // Ước tính nhanh hiển thị ở nút mở: kỳ hạn dài nhất của bên đầu tiên.
  const teaser = useMemo(() => {
    const p = providers[0];
    const longest = p?.terms[p.terms.length - 1];
    if (!longest) return null;
    return calcInstallment(
      price,
      Math.round((price * (p.minDownPercent ?? 0)) / 100),
      longest,
      p.conversionFeePercent ?? 0,
    );
  }, [providers, price]);

  // Giá thấp hơn ngưỡng, tắt tính năng, hoặc chưa cấu hình bên nào → ẩn hẳn.
  // (đặt sau toàn bộ hook để không vi phạm rules-of-hooks)
  if (!config.enabled || price < minPrice || providers.length === 0) return null;

  function selectProvider(idx: number) {
    setProviderIdx(idx);
    setTermIdx(0);
    setDownRaw(null); // reset về mức tối thiểu của bên mới
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-900 hover:shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] sm:p-5"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-700 transition-colors group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white sm:h-12 sm:w-12">
            <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-slate-900 sm:text-base">Mua trả góp</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {teaser ? (
                <>
                  Chỉ từ{" "}
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(teaser.monthlyPayment)}
                  </span>
                  /tháng · {teaser.months} tháng
                </>
              ) : (
                "Xem các phương án trả góp"
              )}
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-slate-400 transition-colors group-hover:text-slate-900">
            Tính thử
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-slate-100 px-5 py-5 text-left sm:px-7">
          <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Tính trả góp
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Giá máy {formatCurrency(price)}. Nhập số tiền trả trước để xem mỗi tháng phải trả bao
            nhiêu.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải phương án trả góp…
          </div>
        ) : (
          <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_320px] lg:gap-8">
            {/* ══ Cột trái: các bước chọn ══ */}
            <div className="space-y-6">
            {/* Kết quả rút gọn dính trên đầu — CHỈ mobile, để số tiền/tháng
                luôn thấy được khi đang chọn bên/kỳ hạn phía dưới. */}
            {plan && (
              <div className="sticky -top-6 z-10 -mx-5 -mt-6 mb-1 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-5 py-3.5 text-white lg:hidden">
                <span className="text-[13px] text-white/60">Trả mỗi tháng</span>
                <span className="text-xl font-semibold tracking-tight tabular-nums">
                  {formatCurrency(plan.monthlyPayment)}
                </span>
              </div>
            )}

            {/* ── Bên trả góp ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                Bên trả góp
              </p>
              <div className="grid gap-2.5">
                {providers.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProvider(idx)}
                    className={cn(
                      "rounded-xl border px-4 py-3.5 text-left transition-all",
                      idx === providerIdx
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:border-slate-400",
                    )}
                  >
                    <p className="text-[15px] font-semibold">{p.name}</p>
                    {p.note && (
                      <p
                        className={cn(
                          "mt-0.5 text-[13px] leading-relaxed",
                          idx === providerIdx ? "text-white/60" : "text-slate-500",
                        )}
                      >
                        {p.note}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Trả trước ── */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Trả trước
                </p>
                {(provider?.minDownPercent ?? 0) > 0 && (
                  <p className="text-xs text-slate-400">
                    Tối thiểu {provider?.minDownPercent}% · {formatCurrency(minDown)}
                  </p>
                )}
              </div>

              <div className="relative">
                <Wallet className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={downPayment > 0 ? downPayment.toLocaleString("vi-VN") : ""}
                  onChange={(e) => setDownRaw(e.target.value)}
                  placeholder="0"
                  aria-label="Số tiền trả trước"
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-lg font-semibold tabular-nums text-slate-900 transition-colors placeholder:font-normal placeholder:text-slate-300 focus-visible:border-slate-900 focus-visible:outline-none"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-slate-400">
                  đ
                </span>
              </div>

              {/* Kéo nhanh 0 → giá máy */}
              <input
                type="range"
                min={0}
                max={price}
                step={500_000}
                value={downPayment}
                onChange={(e) => setDownRaw(e.target.value)}
                aria-label="Kéo chọn số tiền trả trước"
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900"
              />

              <div className="flex flex-wrap gap-2">
                {[0, 20, 30, 50].map((pct) => {
                  const value = Math.round((price * pct) / 100);
                  const active = downPayment === value;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDownRaw(String(value))}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400",
                      )}
                    >
                      {pct === 0 ? "Không trả trước" : `${pct}%`}
                    </button>
                  );
                })}
              </div>

              {belowMin && (
                <p className="text-[13px] font-medium text-amber-600">
                  Bên {provider?.name} yêu cầu trả trước tối thiểu {formatCurrency(minDown)}.
                </p>
              )}
            </div>

            {/* ── Kỳ hạn ── */}
            {provider && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Kỳ hạn
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {provider.terms.map((t, idx) => {
                    const p = calcInstallment(
                      price,
                      downPayment,
                      t,
                      provider.conversionFeePercent ?? 0,
                    );
                    const active = idx === termIdx;
                    return (
                      <button
                        key={t.months}
                        type="button"
                        onClick={() => setTermIdx(idx)}
                        className={cn(
                          "rounded-xl border px-2 py-3 text-center transition-all",
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white hover:border-slate-400",
                        )}
                      >
                        <p className="text-[15px] font-semibold">{t.months} tháng</p>
                        <p
                          className={cn(
                            "mt-1 text-xs tabular-nums",
                            active ? "text-white/70" : "text-slate-500",
                          )}
                        >
                          {formatCurrency(p.monthlyPayment)}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 text-[11px]",
                            active ? "text-white/50" : "text-slate-400",
                          )}
                        >
                          {t.monthlyRate === 0 ? "0% lãi" : `${t.monthlyRate}%/tháng`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
            {/* ══ hết cột trái ══ */}

            {/* ══ Cột phải: kết quả (dính khi cuộn trên PC) ══ */}
            <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
              {/* ── Kết quả ── */}
              {plan && (
                <div className="rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Trả mỗi tháng
                  </p>
                  <p className="mt-1.5 text-[34px] font-semibold leading-none tracking-tight tabular-nums sm:text-4xl">
                    {formatCurrency(plan.monthlyPayment)}
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    trong {plan.months} tháng
                    {plan.monthlyRate === 0 ? " · lãi suất 0%" : ` · lãi ${plan.monthlyRate}%/tháng`}
                  </p>

                  <div className="mt-5 space-y-2.5 border-t border-white/10 pt-5 text-sm">
                    <Row label="Trả trước" value={formatCurrency(plan.downPayment)} />
                    <Row label="Số tiền trả góp" value={formatCurrency(plan.financedAmount)} />
                    {plan.totalInterest > 0 && (
                      <Row label="Tổng lãi" value={formatCurrency(plan.totalInterest)} />
                    )}
                    {plan.conversionFee > 0 && (
                      <Row label="Phí chuyển đổi" value={formatCurrency(plan.conversionFee)} />
                    )}
                    <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[15px] font-semibold text-white">
                      <span>Tổng phải trả</span>
                      <span className="tabular-nums">{formatCurrency(plan.totalPayable)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Ghi chú tham khảo ── */}
              <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p className="text-[13px] leading-relaxed text-slate-500">
                  Số liệu trên <span className="font-semibold text-slate-700">chỉ mang tính tham
                  khảo</span>, được tính theo lãi suất phẳng. Mức trả góp, lãi suất và phí thực tế do
                  bên tài chính quyết định sau khi duyệt hồ sơ. Vui lòng liên hệ cửa hàng để được tư
                  vấn chính xác.
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/50">{label}</span>
      <span className="tabular-nums text-white/90">{value}</span>
    </div>
  );
}
