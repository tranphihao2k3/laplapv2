"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Calculator } from "lucide-react";
import { InstallmentCalculatorContent } from "@/components/client/product/installment-calculator-content";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function parseAmount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function PriceInputForm() {
  const [priceRaw, setPriceRaw] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseAmount(priceRaw);
    if (price < 1_000_000) {
      setError("Giá sản phẩm phải từ 1.000.000đ trở lên");
      return;
    }
    window.location.href = `/tra-gop?price=${price}`;
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 px-4 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 text-center sm:mb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Calculator className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Tính trả góp</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Nhập giá sản phẩm để xem phương án trả góp 0% & lãi suất ưu đãi.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <label htmlFor="price" className="mb-2 block text-sm font-medium text-slate-700">
            Giá sản phẩm
          </label>
          <div className="relative">
            <input
              id="price"
              type="text"
              inputMode="numeric"
              value={priceRaw}
              onChange={(e) => {
                setPriceRaw(e.target.value);
                setError("");
              }}
              placeholder="VD: 25.000.000"
              className="h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 text-lg font-semibold tabular-nums text-slate-900 transition-colors placeholder:font-normal placeholder:text-slate-300 focus-visible:border-slate-900 focus-visible:outline-none"
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

          <Button type="submit" size="lg" className="mt-4 w-full rounded-xl">
            Xem phương án trả góp
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <div className="mt-4 border-t border-slate-100 pt-4 sm:mt-5">
            <p className="mb-2 text-xs text-slate-400">Hoặc chọn nhanh:</p>
            <div className="grid grid-cols-2 gap-2">
              {[10_000_000, 15_000_000, 20_000_000, 30_000_000].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => (window.location.href = `/tra-gop?price=${p}`)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100"
                >
                  {formatCurrency(p)}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function CalculatorPage() {
  const searchParams = useSearchParams();
  const priceParam = searchParams.get("price");
  const price = priceParam ? parseAmount(priceParam) : 0;

  if (!price || price < 1_000_000) return <PriceInputForm />;
  return <InstallmentCalculatorContent price={price} />;
}

export default function TraGopPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
          Đang tải…
        </div>
      }
    >
      <CalculatorPage />
    </Suspense>
  );
}
