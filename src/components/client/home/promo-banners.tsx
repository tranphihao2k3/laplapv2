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
  },
  {
    icon: RefreshCw,
    href: "/products?promo=thu-cu",
    label: "Thu cũ đổi mới",
    title: "Tặng thêm 2 triệu",
    sub: "Khi đổi máy cũ lấy máy mới",
  },
] as const;

export function PromoBanners() {
  return (
    <section className="container space-y-4 pt-14 sm:space-y-5 sm:pt-24">
      {/* Mini promo cards */}
      <div className="grid gap-3 sm:gap-5 md:grid-cols-2">
        {MINI_PROMOS.map((p, i) => {
          const Icon = p.icon;
          return (
            <Reveal key={p.href} variant="fade-up" delay={i * 90}>
              <Link
                href={p.href}
                className={cn(
                  "group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 sm:p-6",
                  "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_40px_-24px_rgba(15,23,42,0.4)]",
                )}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-700 transition-colors duration-300 group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                    {p.label}
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{p.title}</p>
                  <p className="mt-0.5 truncate text-[13px] text-slate-500">{p.sub}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-900" />
              </Link>
            </Reveal>
          );
        })}
      </div>

      {/* Main service banner */}
      <Reveal variant="fade-up" delay={120}>
        <Link
          href="/contact"
          className="group relative flex items-center justify-between overflow-hidden rounded-3xl bg-slate-950 p-6 transition-all duration-300 hover:shadow-[0_30px_60px_-30px_rgba(15,23,42,0.6)] sm:p-9 md:p-12"
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
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/[0.04] blur-[80px]" />

          <div className="relative z-10 max-w-lg">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" />
              <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/60">Dịch vụ</span>
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl md:text-[26px]">
              Sửa chữa &amp; bảo hành chính hãng
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-white/55">
              Bảo hành 1–1, linh kiện chính hãng, trả máy nhanh trong ngày tại Cần Thơ.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-all group-hover:shadow-[0_8px_30px_-8px_rgba(255,255,255,0.4)]">
              <Wrench className="h-4 w-4" />
              Đặt lịch sửa chữa
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </div>
          </div>

          <ShieldCheck className="relative z-10 hidden h-28 w-28 shrink-0 text-white/[0.07] transition-transform duration-500 group-hover:scale-110 md:block" />
        </Link>
      </Reveal>
    </section>
  );
}
