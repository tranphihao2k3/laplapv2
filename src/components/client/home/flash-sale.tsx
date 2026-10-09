"use client";

import { Reveal } from "./reveal";
import { useEffect, useState } from "react";
import { Zap, ArrowRight, Clock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useHomeProducts } from "./use-home-data";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils";

function useCountdown(targetHours = 6) {
  const [time, setTime] = useState({ h: targetHours, m: 0, s: 0 });

  useEffect(() => {
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

function Pad({ v, pulse }: { v: number; pulse?: boolean }) {
  return (
    <span
      className={`relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-destructive to-orange-500 font-mono text-sm font-bold text-white shadow-[0_0_18px_-2px_rgba(239,68,68,0.7)] sm:h-11 sm:w-11 sm:text-base ${
        pulse ? "animate-[pad-flip_0.4s_ease-out]" : ""
      }`}
    >
      {/* shimmer overlay */}
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-[.flash]:[animation:shimmer_2.5s_infinite]" />
      {String(v).padStart(2, "0")}
    </span>
  );
}

function SaleProductCard({
  product,
  discount,
  index,
}: {
  product: { id: string; name: string; slug: string; image?: string; price: number };
  discount: number;
  index: number;
}) {
  const originalPrice = Math.round(product.price / (1 - discount / 100));

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flash relative flex flex-col overflow-hidden rounded-xl border border-destructive/20 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-destructive/60 hover:shadow-[0_18px_40px_-12px_rgba(239,68,68,0.45)]"
      style={{
        animation: `card-in 0.5s ease-out ${index * 80}ms both`,
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/30">
        {/* gradient backdrop on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/0 via-orange-500/0 to-amber-500/0 transition-all duration-500 group-hover:from-destructive/10 group-hover:via-orange-500/10 group-hover:to-amber-500/10" />

        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-4 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-1"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}

        {/* Discount badge — pulse + shine */}
        <div className="absolute left-2 top-2 overflow-hidden rounded-full bg-gradient-to-r from-destructive to-orange-500 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white shadow-[0_4px_12px_rgba(239,68,68,0.5)]">
          <span className="relative z-10">-{discount}%</span>
          <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shine_2.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>

        {/* Hot badge */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300 backdrop-blur">
          <span className="h-1 w-1 animate-pulse rounded-full bg-amber-400" />
          Hot
        </div>

        {/* Lightning corner flash on hover */}
        <Zap
          className="absolute -bottom-2 -right-2 h-16 w-16 -rotate-12 text-amber-400/0 transition-all duration-500 group-hover:text-amber-400/30"
          strokeWidth={1.5}
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 text-sm font-medium transition-colors group-hover:text-destructive">
          {product.name}
        </p>
        <div className="mt-auto space-y-0.5">
          <p className="text-xs text-muted-foreground line-through">
            {formatCurrency(originalPrice)}
          </p>
          <p className="flex items-baseline gap-1.5 text-base font-extrabold text-destructive">
            {formatCurrency(product.price)}
            <span className="text-[10px] font-medium text-orange-500">-{discount}%</span>
          </p>
        </div>
      </div>

      {/* Bottom gradient bar on hover */}
      <div className="h-0.5 w-full origin-left scale-x-0 bg-gradient-to-r from-destructive via-orange-500 to-amber-500 transition-transform duration-500 group-hover:scale-x-100" />
    </Link>
  );
}

const DISCOUNTS = [15, 12, 18, 10];

export function FlashSale() {
  const { data, isLoading } = useHomeProducts({ sort: "price_desc", limit: 4 });
  const products = data?.items ?? [];
  const { h, m, s } = useCountdown(5);
  const [tick, setTick] = useState(0);
  const [pulseSec, setPulseSec] = useState(false);

  useEffect(() => {
    setTick((t) => t + 1);
    setPulseSec(true);
    const id = setTimeout(() => setPulseSec(false), 400);
    return () => clearTimeout(id);
  }, [s]);

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="container py-12 sm:py-16">
      <style>{`
        @keyframes pad-flip {
          0% { transform: rotateX(0deg); }
          50% { transform: rotateX(90deg); opacity: 0.4; }
          100% { transform: rotateX(0deg); }
        }
        @keyframes shine {
          0% { transform: translateX(-120%); }
          60% { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aurora {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.55), 0 0 0 0 rgba(249,115,22,0.35); }
          50%      { box-shadow: 0 0 0 8px rgba(239,68,68,0), 0 0 0 16px rgba(249,115,22,0); }
        }
        @keyframes ring-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes float-up {
          0%   { transform: translateY(0) scale(0.6); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-160px) scale(1); opacity: 0; }
        }
        @keyframes zigzag {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
        @keyframes badge-bounce {
          0%, 100% { transform: scale(1) rotate(-6deg); }
          50%      { transform: scale(1.06) rotate(-6deg); }
        }
        @keyframes text-shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>

      <Reveal variant="fade-up" threshold={0.08}>
        <div className="flash group relative overflow-hidden rounded-2xl border-2 border-destructive/30 bg-card shadow-[0_20px_60px_-20px_rgba(239,68,68,0.45)]">
          {/* Aurora gradient background */}
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              backgroundImage:
                "linear-gradient(125deg, #fef2f2 0%, #fff7ed 25%, #fefce8 50%, #fff7ed 75%, #fef2f2 100%)",
              backgroundSize: "300% 300%",
              animation: "aurora 9s ease-in-out infinite",
            }}
          />

          {/* Diagonal animated stripes (low opacity) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, #ef4444 0 12px, transparent 12px 28px)",
              animation: "zigzag 4s linear infinite",
            }}
          />

          {/* Floating particles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <span
                key={`particle-${tick}-${i}`}
                className="absolute h-1.5 w-1.5 rounded-full bg-gradient-to-br from-destructive to-amber-400"
                style={{
                  left: `${10 + (i * 11) % 80}%`,
                  bottom: "-10px",
                  opacity: 0,
                  animation: `float-up ${6 + (i % 3)}s ease-out ${i * 0.4}s infinite`,
                  filter: "drop-shadow(0 0 6px rgba(239,68,68,0.6))",
                }}
              />
            ))}
          </div>

          {/* Header */}
          <div className="relative border-b border-destructive/15 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Glowing zap badge with rotating ring */}
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-xl"
                    style={{ animation: "ring-spin 6s linear infinite" }}
                  >
                    <div
                      className="h-full w-full rounded-xl"
                      style={{
                        background:
                          "conic-gradient(from 0deg, transparent 0%, rgba(239,68,68,0.55) 25%, transparent 50%, rgba(249,115,22,0.55) 75%, transparent 100%)",
                      }}
                    />
                  </div>
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-destructive to-orange-500 shadow-[0_8px_24px_-4px_rgba(239,68,68,0.6)] sm:h-14 sm:w-14">
                    <Zap
                      className="h-6 w-6 text-white drop-shadow"
                      fill="currentColor"
                      style={{ animation: "badge-bounce 1.8s ease-in-out infinite" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    {/* Pulsing live dot + ring */}
                    <span className="relative flex h-2.5 w-2.5">
                      <span
                        className="absolute inset-0 rounded-full bg-destructive"
                        style={{ animation: "glow-pulse 1.6s ease-out infinite" }}
                      />
                      <span className="relative h-2.5 w-2.5 rounded-full bg-destructive" />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-destructive">
                      Đang diễn ra
                    </span>
                  </div>

                  {/* Shimmer title */}
                  <h2
                    className="bg-gradient-to-r from-destructive via-orange-500 to-amber-500 bg-clip-text text-lg font-black uppercase italic tracking-tight text-transparent sm:text-2xl"
                    style={{
                      backgroundSize: "200% auto",
                      animation: "text-shimmer 4s linear infinite",
                    }}
                  >
                    Flash Sale · Giá sốc hôm nay
                  </h2>
                </div>
              </div>

              {/* Countdown */}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 animate-pulse text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Kết thúc sau:</span>
                <div className="flex items-center gap-1.5">
                  <Pad v={h} />
                  <span className="font-extrabold text-destructive/70">:</span>
                  <Pad v={m} />
                  <span className="font-extrabold text-destructive/70">:</span>
                  <Pad v={s} pulse={pulseSec} />
                </div>
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="relative p-4 sm:p-6">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-64 animate-pulse rounded-xl bg-muted"
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {products.map((p, i) => (
                  <SaleProductCard
                    key={p.id}
                    product={p}
                    discount={DISCOUNTS[i % 4]}
                    index={i}
                  />
                ))}
              </div>
            )}

            <div className="mt-6 flex flex-col items-center gap-2">
              <Link
                href="/products?sort=price_asc"
                className="group/btn relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-destructive to-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(239,68,68,0.6)] transition-all hover:scale-105 hover:shadow-[0_12px_32px_-6px_rgba(239,68,68,0.75)]"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
                <Sparkles className="h-4 w-4" />
                Xem tất cả ưu đãi
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </Link>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
                Số lượng có hạn · Giá chỉ áp dụng hôm nay
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
