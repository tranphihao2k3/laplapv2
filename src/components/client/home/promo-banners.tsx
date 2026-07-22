"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, RefreshCw, Wrench, ShieldCheck } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const MINI_PROMOS = [
  {
    icon: CreditCard,
    href: "/products?promo=tra-gop",
    label: "Ưu đãi",
    title: "Trả góp 0%",
    sub: "Lên đến 12 tháng không lãi",
    accent: "border-blue-100 hover:border-blue-200 hover:bg-blue-50/50",
    iconBg: "bg-blue-50 text-blue-600",
    dot: "bg-blue-600",
  },
  {
    icon: RefreshCw,
    href: "/products?promo=thu-cu",
    label: "Thu cũ đổi mới",
    title: "Tặng thêm 2 triệu",
    sub: "Khi đổi máy cũ lấy máy mới",
    accent: "border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50/50",
    iconBg: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-600",
  },
] as const;

export function PromoBanners() {
  return (
    <section className="container pt-10 space-y-4 sm:pt-16">
      {/* Mini promo cards */}
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        {MINI_PROMOS.map((p, i) => {
          const Icon = p.icon;
          return (
            <Reveal
              key={p.href}
              variant={i === 0 ? "fade-left" : "fade-right"}
              delay={i * 100}
            >
              <Link
                href={p.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl border bg-white p-4 transition-all duration-300 sm:gap-4 sm:p-6",
                  "hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)]",
                  p.accent
                )}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                    p.iconBg
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {p.label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900 sm:text-base">{p.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">{p.sub}</p>
                </div>
                <div className="flex items-center gap-2 text-slate-300 group-hover:text-slate-600 transition-colors">
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>

      {/* Main service banner */}
      <Reveal variant="clip-up" delay={150}>
        <Link
          href="/contact"
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-5 transition-all duration-300 hover:shadow-[0_16px_48px_rgba(0,0,0,0.2)] sm:p-8 md:p-10"
        >
          {/* Subtle grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          <div className="relative z-10 max-w-lg">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-white/70">Dịch vụ</span>
            </div>
            <h3 className="text-lg font-bold text-white sm:text-xl md:text-2xl">
              Sửa chữa &amp; bảo hành chính hãng
            </h3>
            <p className="mt-2 text-sm text-white/60">
              Bảo hành 1–1, linh kiện chính hãng, trả máy nhanh trong ngày tại Cần Thơ.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all group-hover:bg-slate-100 group-hover:shadow-md">
              <Wrench className="h-4 w-4" />
              Đặt lịch sửa chữa
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </div>
          </div>

          <ShieldCheck className="relative z-10 hidden h-28 w-28 shrink-0 text-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:text-white/15 md:block" />
        </Link>
      </Reveal>
    </section>
  );
}
