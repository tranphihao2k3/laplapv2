"use client";

import Link from "next/link";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Dùng slug priceBucket khớp với bộ lọc /products (src/lib/product-collections.ts).
const PRICE_RANGES = [
  {
    range: "Dưới 10 triệu",
    desc: "Phù hợp học sinh, sinh viên, văn phòng cơ bản",
    query: "?priceBucket=duoi-10tr",
  },
  {
    range: "10 – 15 triệu",
    desc: "Hiệu năng ổn, phù hợp công việc văn phòng nâng cao",
    query: "?priceBucket=10-15tr",
  },
  {
    range: "15 – 20 triệu",
    desc: "Laptop tầm trung cao cấp, đồ hoạ nhẹ và lập trình",
    query: "?priceBucket=15-20tr",
  },
  {
    range: "Trên 20 triệu",
    desc: "Cao cấp nhất — MacBook, workstation, gaming RTX cao cấp",
    query: "?priceBucket=tren-20tr",
  },
];

export function PriceRangeSection() {
  return (
    <section className="container pt-14 sm:pt-24">
      <SectionHeader eyebrow="Tìm theo ngân sách" title="Laptop phù hợp túi tiền" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {PRICE_RANGES.map((p, i) => (
          <Reveal key={p.range} variant="fade-up" delay={i * 70} threshold={0.05}>
            <Link
              href={`/products${p.query}`}
              className={cn(
                "group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 sm:p-6",
                "hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_20px_50px_-28px_rgba(15,23,42,0.4)]",
              )}
            >
              <span className="pointer-events-none absolute -right-3 -top-4 text-6xl font-semibold tabular-nums text-slate-100 transition-colors group-hover:text-slate-200">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="relative">
                <p className="text-lg font-semibold tracking-tight text-slate-900">{p.range}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{p.desc}</p>
              </div>
              <div className="relative mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-400 transition-colors group-hover:text-slate-900">
                Xem sản phẩm
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
