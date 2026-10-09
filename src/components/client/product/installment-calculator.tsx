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

export function InstallmentCalculator({ price }: { price: number }) {
  const { data } = useFinancing();
  const config = data ?? DEFAULT_FINANCING;

  if (!config.enabled || price < (config.minPrice ?? 0)) return null;

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
      className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md sm:p-5"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground sm:h-12 sm:w-12">
        <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold sm:text-base">Mua trả góp</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {teaser ? (
            <>
              Chỉ từ{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(teaser.monthlyPayment)}
              </span>
              /tháng · {teaser.months} tháng
            </>
          ) : (
            "Xem các phương án trả góp"
          )}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
        Tính thử
      </span>
    </Link>
  );
}