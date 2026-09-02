"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  calcInstallment,
  DEFAULT_FINANCING,
  normalizeFinancing,
  type FinancingSetting,
} from "@/lib/financing";
import { formatCurrency } from "@/lib/utils";

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

/**
 * Installment calculator button that links to the standalone /tra-gop page.
 * Usage: <InstallmentCalculator price={25000000} />
 */
export function InstallmentCalculator({ price }: { price: number }) {
  const { data } = useFinancing();
  const config = data ?? DEFAULT_FINANCING;

  if (!config.enabled || price < (config.minPrice ?? 0)) return null;

  // Calculate teaser: lowest monthly payment from first provider, longest term
  const teaser = (() => {
    const p = config.providers[0];
    const longest = p?.terms[p.terms.length - 1];
    if (!longest) return null;
    return calcInstallment(
      price,
      Math.round((price * (p.minDownPercent ?? 0)) / 100),
      longest,
      p.conversionFeePercent ?? 0,
    );
  })();

  return (
    <Link
      href={`/tra-gop?price=${price}`}
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
    </Link>
  );
}
