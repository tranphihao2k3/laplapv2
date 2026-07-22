"use client";

import Link from "next/link";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";
import {
  Wrench,
  RefreshCw,
  CreditCard,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

const SERVICES = [
  {
    icon: Wrench,
    title: "Sửa chữa chuyên nghiệp",
    desc: "Kỹ thuật viên lành nghề, linh kiện chính hãng, bảo hành sau sửa chữa 3 tháng.",
    cta: "Đặt lịch",
    href: "/contact",
    accent: "border-blue-100 bg-blue-50/50",
    iconBg: "bg-blue-100 text-blue-700",
    ctaColor: "text-blue-700 hover:text-blue-900",
    tag: "Nhanh · Uy tín",
    tagColor: "bg-blue-100 text-blue-600",
  },
  {
    icon: RefreshCw,
    title: "Thu cũ – Đổi mới",
    desc: "Định giá laptop cũ minh bạch, đổi máy mới tặng thêm 2 triệu ưu đãi ngay hôm nay.",
    cta: "Định giá ngay",
    href: "/contact",
    accent: "border-emerald-100 bg-emerald-50/50",
    iconBg: "bg-emerald-100 text-emerald-700",
    ctaColor: "text-emerald-700 hover:text-emerald-900",
    tag: "Tặng 2 triệu",
    tagColor: "bg-emerald-100 text-emerald-600",
  },
  {
    icon: CreditCard,
    title: "Trả góp 0% lãi suất",
    desc: "Hỗ trợ trả góp qua 12 tháng không lãi suất, duyệt nhanh trong 30 phút.",
    cta: "Xem điều kiện",
    href: "/products",
    accent: "border-violet-100 bg-violet-50/50",
    iconBg: "bg-violet-100 text-violet-700",
    ctaColor: "text-violet-700 hover:text-violet-900",
    tag: "12 tháng",
    tagColor: "bg-violet-100 text-violet-600",
  },
  {
    icon: ShieldCheck,
    title: "Bảo hành chính hãng",
    desc: "Bảo hành 1–1 đổi máy mới, không sửa trả tiền, theo dõi trạng thái online.",
    cta: "Tra cứu bảo hành",
    href: "/tra-cuu-bao-hanh",
    accent: "border-amber-100 bg-amber-50/50",
    iconBg: "bg-amber-100 text-amber-700",
    ctaColor: "text-amber-700 hover:text-amber-900",
    tag: "1-1 đổi máy",
    tagColor: "bg-amber-100 text-amber-600",
  },
];

export function ServiceCards() {
  return (
    <section className="container pt-10 sm:pt-16">
      <Reveal variant="slide-split" threshold={0.08}>
        <div className="mb-5 sm:mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Dịch vụ
          </p>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Toàn diện — từ mua đến sau bán hàng
          </h2>
          <p className="mt-2 max-w-lg text-sm text-slate-500">
            Chúng tôi không chỉ bán laptop. Mọi nhu cầu về sửa chữa, bảo hành, đổi trả đều được hỗ trợ tận tình.
          </p>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {SERVICES.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal key={s.title} variant={i % 2 === 0 ? "fade-up" : "flip-x"} delay={i * 90} threshold={0.05}>
              <div
                className={cn(
                  "group flex h-full flex-col rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:p-6",
                  s.accent
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11", s.iconBg)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", s.tagColor)}>
                    {s.tag}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-800">{s.title}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-500">{s.desc}</p>
                <Link
                  href={s.href}
                  className={cn(
                    "mt-4 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors",
                    s.ctaColor
                  )}
                >
                  {s.cta}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
