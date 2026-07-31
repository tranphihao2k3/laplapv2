"use client";

import Link from "next/link";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { ArrowRight, Clock } from "lucide-react";

const TIPS = [
  {
    category: "Tư vấn chọn máy",
    title: "Cách chọn laptop phù hợp nhu cầu làm việc năm 2026",
    desc: "Từ chip, RAM đến màn hình — những tiêu chí quan trọng giúp bạn không mua nhầm.",
    time: "5 phút đọc",
    href: "/products",
  },
  {
    category: "Gaming",
    title: "TOP 5 laptop gaming tầm giá 20-30 triệu hot nhất hiện nay",
    desc: "So sánh ASUS ROG, MSI Raider, Lenovo Legion — ai mạnh nhất trong tầm giá?",
    time: "7 phút đọc",
    href: "/products",
  },
  {
    category: "MacBook",
    title: "MacBook Air M3 vs MacBook Pro M3 — Nên mua cái nào?",
    desc: "Phân tích chi tiết hiệu năng, pin, giá thành. Đáp án phụ thuộc vào nhu cầu của bạn.",
    time: "6 phút đọc",
    href: "/products",
  },
];

export function BlogTips() {
  return (
    <section className="container pt-14 sm:pt-24">
      <SectionHeader
        eyebrow="Kiến thức & Tư vấn"
        title="Bài viết hữu ích"
        action={{ label: "Xem thêm", href: "/products" }}
      />

      <div className="grid gap-3 sm:gap-5 md:grid-cols-3">
        {TIPS.map((t, i) => (
          <Reveal key={t.title} variant="fade-up" delay={i * 80} threshold={0.05}>
            <Link
              href={t.href}
              className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_20px_50px_-28px_rgba(15,23,42,0.4)] sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {t.category}
                </span>
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="h-3 w-3" />
                  {t.time}
                </div>
              </div>
              <h3 className="text-[15px] font-semibold leading-snug text-slate-900">
                {t.title}
              </h3>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-slate-500">{t.desc}</p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-400 transition-colors group-hover:text-slate-900">
                Đọc tiếp <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
