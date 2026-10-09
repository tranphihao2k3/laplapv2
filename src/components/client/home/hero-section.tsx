"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Zap, Shield, Truck, Package } from "lucide-react";
import { buildHeroSlide, type HomepageHeroSetting } from "@/lib/homepage-hero";

export function HeroSection() {
  const defaultSlide = useMemo(() => buildHeroSlide(), []);
  const heroQuery = useQuery<HomepageHeroSetting>({
    queryKey: ["homepage-hero"],
    queryFn: async () => {
      const res = await fetch("/api/public/homepage-hero");
      if (!res.ok) throw new Error("Không tải được hero banner");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const slide = useMemo(
    () => (heroQuery.data ? buildHeroSlide(heroQuery.data) : defaultSlide),
    [heroQuery.data, defaultSlide],
  );

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Subtle pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      {/* Decorative gradient orbs */}
      <div className="absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-1/4 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[480px] flex-col items-center justify-center py-16 text-center sm:min-h-[520px] sm:py-20">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-primary/10 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-primary">{slide.eyebrow}</span>
          </div>

          {/* Title */}
          <h1 className="max-w-4xl">
            {slide.title.map((line, i) => (
              <div key={`title-${i}`} className="overflow-hidden">
                <span
                  className="block text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl"
                  style={{ animation: `fadeSlideUp 0.6s ease-out ${i * 100}ms both` }}
                >
                  {line}
                </span>
              </div>
            ))}
          </h1>

          {/* Subtitle */}
          <p
            className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg"
            style={{ animation: `fadeSlideUp 0.6s ease-out 200ms both` }}
          >
            {slide.sub}
          </p>

          {/* CTA Buttons */}
          <div
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4"
            style={{ animation: `fadeSlideUp 0.6s ease-out 300ms both` }}
          >
            <Link
              href={slide.href || "/products"}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {slide.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dich-vu-sua-chua"
              className="inline-flex items-center gap-2 rounded-lg border bg-background px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
            >
              Tìm hiểu thêm
            </Link>
          </div>

          {/* Trust Badges */}
          <div
            className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4"
            style={{ animation: `fadeSlideUp 0.6s ease-out 400ms both` }}
          >
            {[
              { icon: Zap, label: "Giao hàng nhanh", sub: "Trong 2h tại Cần Thơ" },
              { icon: Shield, label: "Bảo hành chính hãng", sub: "12-36 tháng" },
              { icon: Package, label: "Sản phẩm chính hãng", sub: "100% authentic" },
              { icon: Truck, label: "Miễn phí vận chuyển", sub: "Đơn từ 500K" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border bg-card p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
