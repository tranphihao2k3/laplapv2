"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Info,
  Loader2,
  Wallet,
} from "lucide-react";
import {
  calcInstallment,
  DEFAULT_FINANCING,
  normalizeFinancing,
  type FinancingProvider,
  type FinancingSetting,
  type FinancingTerm,
} from "@/lib/financing";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// Provider meta (label + tone). Tách khỏi data runtime để dễ tuỳ biến.
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { tone: string; icon: string }> = {
  "credit-card": { tone: "emerald", icon: "💳" },
  "home-credit": { tone: "blue", icon: "🏠" },
  "fe-credit": { tone: "violet", icon: "💰" },
  "mirae-asset": { tone: "amber", icon: "🏦" },
};

const REFERENCE_RATE = 3; // %/tháng, dùng để so sánh với gói 0%

// Tài liệu cần chuẩn bị — gom theo id provider
const PROVIDER_DOCS: Record<string, { required: string[]; optional: string[] }> = {
  "credit-card": {
    required: ["CMND/CCCD còn hạn", "Thẻ tín dụng ngân hàng liên kết"],
    optional: ["Sao kê lương 1 tháng gần nhất"],
  },
  "home-credit": {
    required: ["CMND/CCCD còn hạn", "Sổ hộ khẩu hoặc KT3"],
    optional: ["Bằng lái xe", "Hóa đơn sinh hoạt"],
  },
  "fe-credit": {
    required: ["CMND/CCCD còn hạn", "Giấy tờ xác minh thu nhập"],
    optional: ["Sao kê ngân hàng 3 tháng"],
  },
  "mirae-asset": {
    required: ["CMND/CCCD còn hạn", "Sổ hộ khẩu hoặc KT3"],
    optional: ["Sao kê lương 1 tháng", "Hợp đồng lao động"],
  },
};

const PROVIDER_ELIGIBILITY: Record<string, string> = {
  "credit-card": "Thu nhập từ 5 triệu/tháng · 22–60 tuổi · Có lịch sử tín dụng tốt",
  "home-credit": "Thu nhập từ 3 triệu/tháng · 21–60 tuổi · Không yêu cầu lịch sử tín dụng",
  "fe-credit": "Thu nhập từ 4 triệu/tháng · 20–60 tuổi · Xét duyệt hồ sơ tín dụng",
  "mirae-asset": "Thu nhập từ 5 triệu/tháng · 20–58 tuổi · Hỗ trợ cả khách hàng mới",
};

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </h2>
  );
}

function formatDownInput(value: number) {
  if (!value) return "";
  return value.toLocaleString("vi-VN");
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ProviderPicker({
  providers,
  selected,
  onSelect,
}: {
  providers: FinancingProvider[];
  selected: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="space-y-2">
      {providers.map((p, idx) => {
        const meta = PROVIDER_META[p.id] ?? { tone: "slate", icon: "💳" };
        const active = idx === selected;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(idx)}
            className={cn(
              "flex w-full min-w-0 items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all sm:gap-3 sm:px-3.5 sm:py-3",
              active
                ? "border-slate-900 bg-slate-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-400",
            )}
          >
            <span className="text-lg sm:text-xl shrink-0">{meta.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
              {p.note && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{p.note}</p>
              )}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:text-[11px]",
                active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {p.minDownPercent}%
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TermPicker({
  terms,
  price,
  downPayment,
  conversionFee,
  selected,
  onSelect,
}: {
  terms: FinancingTerm[];
  price: number;
  downPayment: number;
  conversionFee: number;
  selected: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {terms.map((t, idx) => {
        const plan = calcInstallment(price, downPayment, t, conversionFee);
        const active = idx === selected;
        const zero = t.monthlyRate === 0;
        return (
          <button
            key={t.months}
            type="button"
            onClick={() => onSelect(idx)}
            className={cn(
              "relative min-w-0 rounded-xl border-2 px-1.5 py-2 text-center transition-all sm:px-2 sm:py-2.5",
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:border-slate-400",
            )}
          >
            {zero && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                0%
              </span>
            )}
            <p className="truncate text-[11px] font-medium sm:text-[12px]">{t.months} tháng</p>
            <p
              className={cn(
                "mt-0.5 truncate text-[12px] font-bold tabular-nums sm:text-[13px]",
                active ? "text-white" : "text-slate-900",
              )}
            >
              {formatCurrency(plan.monthlyPayment)}
            </p>
            <p
              className={cn(
                "text-[9px] sm:text-[10px]",
                active ? "text-white/60" : "text-slate-400",
              )}
            >
              {t.monthlyRate === 0 ? "0% lãi" : `${t.monthlyRate}%/th`}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function ResultCard({
  price,
  downPayment,
  months,
  monthlyRate,
  monthlyPayment,
  financedAmount,
  totalInterest,
  conversionFee,
  totalPayable,
  providerName,
}: {
  price: number;
  downPayment: number;
  months: number;
  monthlyRate: number;
  monthlyPayment: number;
  financedAmount: number;
  totalInterest: number;
  conversionFee: number;
  totalPayable: number;
  providerName: string;
}) {
  const zero = monthlyRate === 0;
  const interestGap = totalInterest; // thực tế trả thêm so với tiền mặt
  return (
    <div className="rounded-2xl bg-slate-900 p-4 text-white shadow-xl sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
          Trả mỗi tháng
        </p>
        {zero && (
          <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
            0% LÃI
          </span>
        )}
      </div>
      <p className="mt-1 text-[28px] font-bold leading-none tracking-tight tabular-nums sm:text-4xl">
        {formatCurrency(monthlyPayment)}
      </p>
      <p className="mt-1 truncate text-xs text-slate-400">
        {months} tháng · {providerName}
        {!zero && ` · ${monthlyRate}%/tháng`}
      </p>

      <dl className="mt-3.5 space-y-1.5 border-t border-white/10 pt-3 text-sm sm:mt-4 sm:space-y-2 sm:pt-3">
        <Row label="Giá sản phẩm" value={formatCurrency(price)} />
        <Row label="Trả trước" value={formatCurrency(downPayment)} />
        <Row label="Số tiền vay" value={formatCurrency(financedAmount)} />
        {conversionFee > 0 && (
          <Row label="Phí chuyển đổi" value={formatCurrency(conversionFee)} muted />
        )}
        {totalInterest > 0 && (
          <Row label="Tổng lãi" value={formatCurrency(totalInterest)} tone="amber" />
        )}
        <div className="!mt-2 flex items-center justify-between border-t border-white/15 pt-2.5 text-sm font-bold sm:!mt-3 sm:pt-3 sm:text-base">
          <dt>Tổng phải trả</dt>
          <dd className="tabular-nums">{formatCurrency(totalPayable)}</dd>
        </div>
      </dl>

      {!zero && interestGap > 0 && (
        <div className="mt-2.5 rounded-lg bg-white/5 p-2.5 text-[12px] text-slate-300">
          So với trả tiền mặt ({formatCurrency(price)}), bạn trả thêm{" "}
          <span className="font-semibold text-amber-300">{formatCurrency(interestGap)}</span> tiền lãi.
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone = "default",
  muted = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "amber";
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className={cn("truncate", muted ? "text-slate-500" : "text-slate-400")}>{label}</dt>
      <dd
        className={cn(
          "shrink-0 font-medium tabular-nums",
          tone === "amber" ? "text-amber-300" : "text-white",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center justify-between gap-2 px-3.5 py-2.5 text-left sm:px-4 sm:py-3"
      >
        <span className="min-w-0 text-sm font-medium text-slate-900">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>
      {open && (
        <p className="border-t border-slate-100 px-3.5 py-2.5 text-sm text-slate-600 sm:px-4 sm:py-3">
          {a}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function InstallmentCalculatorContent({ price }: { price: number }) {
  const { data, isLoading } = useFinancing();
  const config = data ?? DEFAULT_FINANCING;
  const providers = config.providers;

  const [providerIdx, setProviderIdx] = useState(0);
  const [termIdx, setTermIdx] = useState(0);
  const [downRaw, setDownRaw] = useState<string | null>(null);
  const [showDown, setShowDown] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  const provider = providers[Math.min(providerIdx, providers.length - 1)];
  const term = provider?.terms[Math.min(termIdx, provider.terms.length - 1)];

  const minDown = useMemo(
    () => Math.round((price * (provider?.minDownPercent ?? 0)) / 100),
    [price, provider?.minDownPercent],
  );

  const downPayment = downRaw === null ? minDown : Math.min(Number(downRaw.replace(/[^\d]/g, "")) || 0, price);

  const plan = useMemo(
    () =>
      term
        ? calcInstallment(price, downPayment, term, provider?.conversionFeePercent ?? 0)
        : null,
    [price, downPayment, term, provider?.conversionFeePercent],
  );

  if (!config.enabled || price < (config.minPrice ?? 0) || providers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <Calculator className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">Tính năng trả góp hiện không khả dụng.</p>
      </div>
    );
  }

  const belowMin = downPayment < minDown;

  const docs = provider ? PROVIDER_DOCS[provider.id] : null;
  const eligibility = provider ? PROVIDER_ELIGIBILITY[provider.id] : null;

  const selectProvider = (idx: number) => {
    setProviderIdx(idx);
    setTermIdx(0);
    setDownRaw(null);
  };

  const downQuickPercents = [provider?.minDownPercent ?? 0, 20, 30, 50].filter(
    (v, i, arr) => v > 0 && arr.indexOf(v) === i,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="container flex h-14 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}
            className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Quay lại"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Calculator className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">Tính trả góp</h1>
            <p className="truncate text-xs text-slate-500">
              Sản phẩm <span className="font-semibold text-slate-700">{formatCurrency(price)}</span>
            </p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="container flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải phương án trả góp…
        </div>
      ) : (
        <>
          {/* Compact sticky summary — mobile only, pin dưới header */}
          {plan && provider && (
            <div
              className="sticky top-14 z-30 border-b border-slate-200 bg-slate-900 text-white shadow-md lg:hidden"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="container flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Trả mỗi tháng
                  </p>
                  <p className="truncate text-lg font-extrabold tabular-nums">
                    {formatCurrency(plan.monthlyPayment)}
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      · {plan.months} tháng
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {provider.name}
                  </p>
                  <p className="text-xs font-medium text-slate-200">
                    {plan.monthlyRate === 0 ? "0% lãi" : `${plan.monthlyRate}%/th`}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="container max-w-full py-4 sm:py-6">
            <div className="grid gap-4 lg:gap-5 lg:grid-cols-[1fr_360px]">
              {/* Left: các bước chọn */}
              <div className="min-w-0 space-y-4 sm:space-y-5">
                {/* Bước 1: Provider */}
                <section className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5">
                  <SectionTitle>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      1
                    </span>
                    Chọn nhà cung cấp
                  </SectionTitle>
                  <div className="mt-3">
                    <ProviderPicker
                      providers={providers}
                      selected={providerIdx}
                      onSelect={selectProvider}
                    />
                  </div>
                </section>

                {/* Bước 2: Kỳ hạn */}
                <section className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-5">
                  <SectionTitle>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                      2
                    </span>
                    Chọn kỳ hạn
                  </SectionTitle>
                  <div className="mt-3">
                    {provider && (
                      <TermPicker
                        terms={provider.terms}
                        price={price}
                        downPayment={downPayment}
                        conversionFee={provider.conversionFeePercent ?? 0}
                        selected={termIdx}
                        onSelect={setTermIdx}
                      />
                    )}
                  </div>
                </section>

                {/* Bước 3: Trả trước — collapsed by default để mobile gọn */}
                <section className="rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setShowDown((v) => !v)}
                    className="flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl px-3.5 py-3 text-left sm:px-5 sm:py-3.5"
                  >
                    <SectionTitle>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                        3
                      </span>
                      Số tiền trả trước (tuỳ chọn)
                    </SectionTitle>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 tabular-nums">
                        {formatCurrency(downPayment)}
                      </span>
                      {showDown ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                  {showDown && (
                    <div className="space-y-3 border-t border-slate-100 px-3.5 pb-4 pt-3 sm:px-5">
                      <div className="relative">
                        <Wallet className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatDownInput(downPayment)}
                          onChange={(e) => setDownRaw(e.target.value)}
                          placeholder="0"
                          aria-label="Số tiền trả trước"
                          className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-base font-semibold tabular-nums text-slate-900 transition-colors placeholder:font-normal placeholder:text-slate-300 focus-visible:border-slate-900 focus-visible:outline-none"
                        />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                          đ
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={price}
                        step={500_000}
                        value={downPayment}
                        onChange={(e) => setDownRaw(e.target.value)}
                        aria-label="Kéo chọn số tiền trả trước"
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {downQuickPercents.map((pct) => {
                          const value = Math.round((price * pct) / 100);
                          const active = downPayment === value;
                          return (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setDownRaw(String(value))}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                                active
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400",
                              )}
                            >
                              {pct}%
                            </button>
                          );
                        })}
                      </div>
                      {belowMin ? (
                        <p className="flex items-center gap-1.5 text-[12px] text-amber-600">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          Tối thiểu {provider?.minDownPercent}% · {formatCurrency(minDown)}
                        </p>
                      ) : downPayment > 0 ? (
                        <p className="text-[12px] text-slate-500">
                          Còn lại vay:{" "}
                          <span className="font-semibold text-slate-700">
                            {formatCurrency(price - downPayment)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  )}
                </section>

                {/* Bước 4: Hồ sơ cần chuẩn bị — collapsed by default */}
                {docs && (
                  <section className="rounded-2xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setShowDocs((v) => !v)}
                      className="flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl px-3.5 py-3 text-left sm:px-5 sm:py-3.5"
                    >
                      <SectionTitle>
                        <FileText className="h-3.5 w-3.5" />
                        Hồ sơ & điều kiện
                      </SectionTitle>
                      {showDocs ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                    </button>
                    {showDocs && (
                      <div className="space-y-3 border-t border-slate-100 px-3.5 pb-4 pt-3 sm:px-5">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Bắt buộc
                            </p>
                            <ul className="space-y-1.5">
                              {docs.required.map((d) => (
                                <li key={d} className="flex items-start gap-2 text-sm text-slate-700">
                                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                  <span>{d}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          {docs.optional.length > 0 && (
                            <div>
                              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Bổ sung
                              </p>
                              <ul className="space-y-1.5">
                                {docs.optional.map((d) => (
                                  <li
                                    key={d}
                                    className="flex items-start gap-2 text-sm text-slate-500"
                                  >
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                                    <span>{d}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        {eligibility && (
                          <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">Điều kiện:</span> {eligibility}
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </div>

              {/* Right: Sticky result */}
              <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
                <div className="space-y-3">
                  {plan && provider && (
                    <ResultCard
                      price={price}
                      downPayment={plan.downPayment}
                      months={plan.months}
                      monthlyRate={plan.monthlyRate}
                      monthlyPayment={plan.monthlyPayment}
                      financedAmount={plan.financedAmount}
                      totalInterest={plan.totalInterest}
                      conversionFee={plan.conversionFee}
                      totalPayable={plan.totalPayable}
                      providerName={provider.name}
                    />
                  )}

                  <Button asChild className="h-12 w-full rounded-xl text-base font-bold">
                    <a href="tel:0000000000">
                      <CreditCard className="mr-2 h-5 w-5" />
                      Liên hệ tư vấn
                    </a>
                  </Button>

                  <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-500">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <p>
                      Số liệu chỉ mang tính tham khảo. Lãi suất & phí thực tế do bên tài chính quyết định sau khi duyệt hồ sơ.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
