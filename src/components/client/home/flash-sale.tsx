"use client";

import { Reveal } from "./reveal";
import { useEffect, useState } from "react";
import { Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useHomeProducts } from "./use-home-data";
import Image from "next/image";
import { cn, formatCurrency } from "@/lib/utils";

// Countdown timer hook
function useCountdown(targetHours = 6) {
  const [time, setTime] = useState({ h: targetHours, m: 0, s: 0 });

  useEffect(() => {
    // Set target to next N hours from now
    const target = Date.now() + targetHours * 60 * 60 * 1000;
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime({ h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetHours]);

  return time;
}

function Pad({ v }: { v: number }) {
  return (
    <span className="tabular-nums font-mono text-xl font-bold text-white sm:text-2xl md:text-3xl">
      {String(v).padStart(2, "0")}
    </span>
  );
}

function SaleProductCard({ product, discount }: { product: { id: string; name: string; slug: string; image?: string; price: number }; discount: number }) {
  const originalPrice = Math.round(product.price / (1 - discount / 100));
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:bg-white/10 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20 text-sm">No image</div>
        )}
        {/* Discount badge */}
        <div className="absolute left-3 top-3 rounded-lg bg-red-500 px-2 py-1 text-xs font-bold text-white shadow">
          -{discount}%
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 text-sm font-semibold text-white/90">{product.name}</p>
        <div className="mt-auto">
          <p className="text-xs text-white/40 line-through">{formatCurrency(originalPrice)}</p>
          <p className="text-base font-bold text-red-400">{formatCurrency(product.price)}</p>
        </div>
      </div>
    </Link>
  );
}

const DISCOUNTS = [15, 12, 18, 10]; // fake discounts for display

export function FlashSale() {
  const { data, isLoading } = useHomeProducts({ sort: "price_desc", limit: 4 });
  const products = data?.items ?? [];
  const { h, m, s } = useCountdown(5);

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="container pt-10 sm:pt-16">
      <Reveal variant="fade-up" threshold={0.08}>
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          {/* Grid pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative p-4 sm:p-6 md:p-8 lg:p-10">
            {/* Header row */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6 sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 ring-1 ring-red-500/30">
                  <Zap className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Flash Sale</span>
                  </div>
                  <h2 className="text-lg font-bold text-white sm:text-xl md:text-2xl">Giá sốc hôm nay</h2>
                </div>
              </div>

              {/* Countdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/50 mr-1">Kết thúc sau:</span>
                <Pad v={h} />
                <span className="text-white/40 font-bold">:</span>
                <Pad v={m} />
                <span className="text-white/40 font-bold">:</span>
                <Pad v={s} />
              </div>
            </div>

            {/* Products */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-60 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {products.map((p, i) => (
                  <SaleProductCard key={p.id} product={p} discount={DISCOUNTS[i % 4]} />
                ))}
              </div>
            )}

            <div className="mt-6 text-center">
              <Link
                href="/products?sort=price_asc"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white"
              >
                Xem tất cả ưu đãi <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
