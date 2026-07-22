"use client";

import Link from "next/link";
import { Reveal } from "./reveal";
import { ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const TIPS = [
  {
    category: "Tư vấn chọn máy",
    title: "Cách chọn laptop phù hợp nhu cầu làm việc năm 2026",
    desc: "Từ chip, RAM đến màn hình — những tiêu chí quan trọng giúp bạn không mua nhầm.",
    time: "5 phút đọc",
    color: "hover:border-blue-200 hover:bg-blue-50/30",
    catColor: "text-blue-600 bg-blue-50",
    href: "/products",
  },
  {
    category: "Gaming",
    title: "TOP 5 laptop gaming tầm giá 20-30 triệu hot nhất hiện nay",
    desc: "So sánh ASUS ROG, MSI Raider, Lenovo Legion — ai mạnh nhất trong tầm giá?",
    time: "7 phút đọc",
    color: "hover:border-red-200 hover:bg-red-50/30",
    catColor: "text-red-600 bg-red-50",
    href: "/products",
  },
  {
    category: "MacBook",
    title: "MacBook Air M3 vs MacBook Pro M3 — Nên mua cái nào?",
    desc: "Phân tích chi tiết hiệu năng, pin, giá thành. Đáp án phụ thuộc vào nhu cầu của bạn.",
    time: "6 phút đọc",
    color: "hover:border-zinc-200 hover:bg-zinc-50/30",
    catColor: "text-zinc-700 bg-zinc-100",
    href: "/products",
  },
];

export function BlogTips() {
  return (
    <section className="container pt-10 sm:pt-16">
      <Reveal variant="fade-right" threshold={0.08}>
        <div className="mb-5 flex items-end justify-between sm:mb-8">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Kiến thức &amp; Tư vấn
            </p>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Bài viết hữu ích</h2>
          </div>
          <Link
            href="/products"
            className="group hidden items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 md:flex"
          >
            Xem thêm <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Reveal>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        {TIPS.map((t, i) => (
          <Reveal key={t.title} variant="fade-up" delay={i * 100} threshold={0.05}>
            <Link
              href={t.href}
              className={cn(
                "group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-6",
                t.color
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", t.catColor)}>
                  {t.category}
                </span>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" />
                  {t.time}
                </div>
              </div>
              <h3 className="text-sm font-bold text-slate-800 leading-snug transition-colors group-hover:text-slate-900">
                {t.title}
              </h3>
              <p className="mt-2 flex-1 text-xs text-slate-500 leading-relaxed">{t.desc}</p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-600 transition-colors group-hover:text-slate-900">
                Đọc tiếp <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
