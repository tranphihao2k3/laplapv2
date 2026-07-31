"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { buildHeroSlide, type HomepageHeroSetting } from "@/lib/homepage-hero";
import { FerrofluidLazy } from "@/components/ui/ferrofluid-lazy";

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
    <section className="relative w-full">
      <div className="relative w-full overflow-hidden bg-[#0a0a0c]">
        {/* Nền ferrofluid động phủ kín banner (WebGL, client-only) */}
        <div className="absolute inset-0 z-0">
          <FerrofluidLazy
            className="h-full w-full"
            colors={["#ffffff", "#ffffff", "#ffffff"]}
            speed={0.5}
            scale={1.4}
            glow={2}
            flowDirection="down"
            mouseInteraction
          />
        </div>

        {/* Lớp phủ tối nhẹ ở giữa để chữ luôn đọc rõ */}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,rgba(10,10,12,0.75)_0%,rgba(10,10,12,0.35)_45%,transparent_75%)]" />

        <div className="relative z-[2] flex min-h-[560px] flex-col items-center justify-center px-5 py-20 text-center sm:min-h-[600px]">
          <div
            className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.06] py-1.5 pl-1.5 pr-3.5 backdrop-blur-md"
            style={{ animation: "fadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-900">
              Mới
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">
              {slide.eyebrow}
            </span>
          </div>

          <h1 className="max-w-4xl">
            {slide.title.map((line, i) => (
              <div key={`title-${i}`} className="overflow-hidden">
                <span
                  className="block text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.02em] text-white sm:text-6xl md:text-7xl"
                  style={{
                    animation: `slideUpIn 0.65s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms both`,
                  }}
                >
                  {line}
                </span>
              </div>
            ))}
          </h1>

          <p
            className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/60 sm:text-base md:text-lg"
            style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.22,1,0.36,1) 200ms both" }}
          >
            {slide.sub}
          </p>

          <div
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:gap-3.5"
            style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.22,1,0.36,1) 300ms both" }}
          >
            <Link
              href={slide.href || "/products"}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 transition-all hover:shadow-[0_8px_30px_-8px_rgba(255,255,255,0.5)] active:scale-[0.98]"
            >
              {slide.cta}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/dich-vu-sua-chua"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-8 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10 active:scale-[0.98]"
            >
              Tìm hiểu thêm
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
