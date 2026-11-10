"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  calcInstallment,
  DEFAULT_FINANCING,
  normalizeFinancing,
  type FinancingSetting,
} from "@/lib/financing";
import { cn } from "@/lib/utils";

function formatMonthlyShort(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0đ";
  const million = amount / 1_000_000;
  if (million >= 1) {
    const rounded = Math.round(million * 10) / 10;
    const text =
      Math.abs(rounded - Math.round(rounded)) < 1e-9
        ? String(Math.round(rounded))
        : String(rounded).replace(".", ",");
    return `${text}tr`;
  }
  const thousand = Math.round(amount / 1_000);
  return `${thousand}k`;
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView]);

  return { ref, inView };
}

export function ProductCardInstallment({
  price,
  className,
}: {
  price: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  const { data } = useQuery<FinancingSetting>({
    queryKey: ["public-financing"],
    queryFn: async () => {
      const res = await fetch("/api/public/financing");
      if (!res.ok) throw new Error("Không tải được cấu hình trả góp");
      return normalizeFinancing(await res.json());
    },
    enabled: inView && price > 0,
    staleTime: 10 * 60 * 1000,
    placeholderData: DEFAULT_FINANCING,
  });

  const best = useMemo(() => {
    if (!inView || price <= 0) return null;
    const config = data ?? DEFAULT_FINANCING;
    if (!config.enabled || price < (config.minPrice ?? 0)) return null;

    let bestPlan: { monthlyPayment: number; months: number } | null = null;
    for (const p of config.providers) {
      const down = Math.round((price * (p.minDownPercent ?? 0)) / 100);
      for (const term of p.terms ?? []) {
        if (term.months !== 12) continue;
        const plan = calcInstallment(price, down, term, p.conversionFeePercent ?? 0);
        if (!bestPlan || plan.monthlyPayment < bestPlan.monthlyPayment) {
          bestPlan = { monthlyPayment: plan.monthlyPayment, months: 12 };
        }
      }
    }
    return bestPlan && bestPlan.monthlyPayment > 0 ? bestPlan : null;
  }, [data, inView, price]);

  if (price <= 0) return null;

  return (
    <div ref={ref} className={cn("min-h-[30px]", className)}>
      {best ? (
        <div className="installment-fire relative flex w-full items-center justify-between gap-2 overflow-hidden rounded-md border border-orange-300/70 bg-gradient-to-r from-orange-50/90 via-amber-50/80 to-rose-50/90 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-[0_0_0_1px_rgba(251,146,60,0.08),0_8px_18px_-14px_rgba(234,88,12,0.55)] dark:border-orange-500/40 dark:from-orange-950/35 dark:via-amber-950/25 dark:to-red-950/35 sm:text-sm">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-2 -left-1 h-6 w-10 rounded-full bg-orange-400/35 blur-md animate-fire-flicker"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-2 left-6 h-5 w-8 rounded-full bg-red-400/25 blur-md animate-fire-flicker-delayed"
          />
          <span className="relative z-10">Trả góp 12 tháng chỉ từ</span>
          <span className="relative z-10 font-semibold text-red-600 dark:text-orange-300">
            {formatMonthlyShort(best.monthlyPayment)}/tháng
          </span>
        </div>
      ) : null}
    </div>
  );
}
