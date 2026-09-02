"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, ArrowRight } from "lucide-react";
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
    if (price < 1000000) {
      setError("Giá sản phẩm phải từ 1.000.000đ trở lên");
      return;
    }
    // Navigate to same page with price param
    window.location.href = `/tra-gop?price=${price}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white mb-4">
            <Calculator className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Tính trả góp</h1>
          <p className="mt-2 text-slate-500">
            Nhập giá sản phẩm để xem các phương án trả góp 0% và lãi suất ưu đãi từ Home Credit, FE Credit, Mirae Asset
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-slate-700 mb-2">
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
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-xl font-semibold tabular-nums text-slate-900 transition-colors placeholder:font-normal placeholder:text-slate-300 focus-visible:border-slate-900 focus-visible:outline-none"
                />
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  đ
                </span>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-500">{error}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-xl h-12 text-base"
            >
              Tính trả góp
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Quick prices */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-3">Hoặc chọn nhanh:</p>
            <div className="grid grid-cols-2 gap-2">
              {[15000000, 20000000, 25000000, 30000000].map((price) => (
                <button
                  key={price}
                  type="button"
                  onClick={() => window.location.href = `/tra-gop?price=${price}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100"
                >
                  {formatCurrency(price)}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl mb-1">🏦</div>
            <p className="text-sm font-medium text-slate-700">Nhiều nhà cung cấp</p>
            <p className="text-xs text-slate-400 mt-0.5">Home Credit, FE Credit, Mirae Asset</p>
          </div>
          <div>
            <div className="text-2xl mb-1">💰</div>
            <p className="text-sm font-medium text-slate-700">0% lãi suất</p>
            <p className="text-xs text-slate-400 mt-0.5">Trả góp 0% với nhiều kỳ hạn</p>
          </div>
          <div>
            <div className="text-2xl mb-1">📋</div>
            <p className="text-sm font-medium text-slate-700">Lịch trình chi tiết</p>
            <p className="text-xs text-slate-400 mt-0.5">Xem chi tiết từng tháng</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalculatorPage() {
  const searchParams = useSearchParams();
  const priceParam = searchParams.get("price");
  const price = priceParam ? parseAmount(priceParam) : 0;

  if (!price || price < 1000000) {
    return <PriceInputForm />;
  }

  return <InstallmentCalculatorContent price={price} />;
}

export default function TraGopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Đang tải...</div>
      </div>
    }>
      <CalculatorPage />
    </Suspense>
  );
}
