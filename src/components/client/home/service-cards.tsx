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
    <section className="container py-12 sm:py-16">
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
                  "group flex h-full flex-col rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-6",
                )}
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    {s.tag}
                  </span>
                </div>
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                <Link
                  href={s.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
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