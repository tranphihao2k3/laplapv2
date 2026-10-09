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
    <section className="container space-y-4 py-12 sm:space-y-5 sm:py-16">
      {/* Mini promo cards */}
      <div className="grid gap-3 sm:gap-5 md:grid-cols-2">
        {MINI_PROMOS.map((p, i) => {
          const Icon = p.icon;
          return (
            <Reveal key={p.href} variant="fade-up" delay={i * 90}>
              <Link
                href={p.href}
                className={cn(
                  "group flex items-center gap-4 rounded-xl border bg-card p-5 transition-all sm:p-6",
                  "hover:-translate-y-0.5 hover:shadow-md",
                )}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {p.label}
                  </p>
                  <p className="mt-1 text-base font-semibold">{p.title}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{p.sub}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            </Reveal>
          );
        })}
      </div>

      {/* Main service banner */}
      <Reveal variant="fade-up" delay={120}>
        <Link
          href="/contact"
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-primary p-6 transition-all hover:shadow-lg sm:p-9 md:p-12"
        >
          {/* Decorative elements */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-[80px]" />

          <div className="relative z-10 max-w-lg text-primary-foreground">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-white">Dịch vụ</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
              Sửa chữa &amp; bảo hành chính hãng
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed opacity-90">
              Bảo hành 1–1, linh kiện chính hãng, trả máy nhanh trong ngày tại Cần Thơ.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary">
              <Wrench className="h-4 w-4" />
              Đặt lịch sửa chữa
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>

          <ShieldCheck className="relative z-10 hidden h-28 w-28 shrink-0 text-white/20 transition-transform group-hover:scale-110 md:block" />
        </Link>
      </Reveal>
    </section>
  );
}