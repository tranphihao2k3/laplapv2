"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildHeroSlide, type HomepageHeroSetting } from "@/lib/homepage-hero";

type Slide = {
  id: number;
  eyebrow: string;
  title: string[];
  sub: string;
  cta: string;
  href: string;
  accent: string;
  bg: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  image?: string;
};

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

  const HeroIcon = typeof slide.Icon === "function" ? slide.Icon : ArrowRight;

  return (
    <section className="container pt-4 md:pt-6">
      <div className={cn("relative overflow-hidden rounded-3xl transition-colors duration-700", slide.bg)}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(to right,#000 1px,transparent 1px),linear-gradient(to bottom,#000 1px,transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative grid gap-8 px-5 py-10 sm:gap-10 sm:px-8 sm:py-14 md:px-16 md:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:px-20 lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 sm:mb-5 animate-[fadeSlideUp_0.5s_cubic-bezier(0.22,1,0.36,1)_both]">
              <span className={cn("inline-block h-1.5 w-6 rounded-full", slide.accent)} />
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                {slide.eyebrow}
              </span>
            </div>

            <h1 className="space-y-1">
              {slide.title.map((line, i) => (
                <div key={`title-${i}`} className="overflow-hidden">
                  <span
                    className="block text-3xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-4xl md:text-5xl lg:text-6xl"
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
              className="mt-4 max-w-md text-sm text-slate-500 sm:mt-6 sm:text-base md:text-lg"
              style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.22,1,0.36,1) 200ms both" }}
            >
              {slide.sub}
            </p>

            <div style={{ animation: "fadeSlideUp 0.7s cubic-bezier(0.22,1,0.36,1) 300ms both" }}>
              <Link
                href={slide.href || "/products"}
                className="group mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-700 hover:shadow-md active:scale-[0.98] sm:mt-8"
              >
                {slide.cta}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          <div className="relative hidden h-[420px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-100/70 shadow-xl shadow-slate-900/5 lg:block">
            {slide.image ? (
              <img
                src={slide.image}
                alt={slide.title.join(" ")}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <HeroIcon className="h-72 w-72 text-slate-900/10" />
              </div>
            )}
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
