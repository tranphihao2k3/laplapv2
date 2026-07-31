"use client";

import Link from "next/link";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
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
    tag: "Nhanh · Uy tín",
  },
  {
    icon: RefreshCw,
    title: "Thu cũ – Đổi mới",
    desc: "Định giá laptop cũ minh bạch, đổi máy mới tặng thêm 2 triệu ưu đãi ngay hôm nay.",
    cta: "Định giá ngay",
    href: "/contact",
    tag: "Tặng 2 triệu",
  },
  {
    icon: CreditCard,
    title: "Trả góp 0% lãi suất",
    desc: "Hỗ trợ trả góp qua 12 tháng không lãi suất, duyệt nhanh trong 30 phút.",
    cta: "Xem điều kiện",
    href: "/products",
    tag: "12 tháng",
  },
  {
    icon: ShieldCheck,
    title: "Bảo hành chính hãng",
    desc: "Bảo hành 1–1 đổi máy mới, không sửa trả tiền, theo dõi trạng thái online.",
    cta: "Tra cứu bảo hành",
    href: "/tra-cuu-bao-hanh",
    tag: "1-1 đổi máy",
  },
];

export function ServiceCards() {
  return (
    <section className="container pt-14 sm:pt-24">
      <SectionHeader
        eyebrow="Dịch vụ"
        title="Toàn diện — từ mua đến sau bán hàng"
        description="Chúng tôi không chỉ bán laptop. Mọi nhu cầu về sửa chữa, bảo hành, đổi trả đều được hỗ trợ tận tình."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {SERVICES.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal key={s.title} variant="fade-up" delay={i * 70} threshold={0.05}>
              <div
                className={cn(
                  "group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 sm:p-6",
                  "hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_20px_50px_-28px_rgba(15,23,42,0.4)]",
                )}
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-700 transition-colors duration-300 group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    {s.tag}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
                <Link
                  href={s.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900"
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
