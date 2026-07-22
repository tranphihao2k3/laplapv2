"use client";

import Link from "next/link";
import { Reveal } from "./reveal";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Dùng slug priceBucket khớp với bộ lọc /products (src/lib/product-collections.ts).
const PRICE_RANGES = [
  {
    range: "Dưới 10 triệu",
    desc: "Phù hợp học sinh, sinh viên, văn phòng cơ bản",
    query: "?priceBucket=duoi-10tr",
    color: "from-slate-50 to-slate-100/50 border-slate-200",
    badge: "bg-slate-100 text-slate-600",
  },
  {
    range: "10–15 triệu",
    desc: "Hiệu năng ổn, phù hợp công việc văn phòng nâng cao",
    query: "?priceBucket=10-15tr",
    color: "from-blue-50 to-blue-100/50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    range: "15–20 triệu",
    desc: "Laptop tầm trung cao cấp, đồ hoạ nhẹ và lập trình",
    query: "?priceBucket=15-20tr",
    color: "from-violet-50 to-violet-100/50 border-violet-200",
    badge: "bg-violet-100 text-violet-700",
  },
  {
    range: "Trên 20 triệu",
    desc: "Cao cấp nhất — MacBook, workstation, gaming RTX cao cấp",
    query: "?priceBucket=tren-20tr",
    color: "from-amber-50 to-amber-100/50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
  },
];

export function PriceRangeSection() {
  return (
    <section className="container pt-10 sm:pt-16">
      <Reveal variant="fade-left" threshold={0.08}>
        <div className="mb-5 sm:mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Tìm theo ngân sách
          </p>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Laptop phù hợp túi tiền</h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {PRICE_RANGES.map((p, i) => (
          <Reveal key={p.range} variant="fade-up" delay={i * 80} threshold={0.05}>
            <Link
              href={`/products${p.query}`}
              className={cn(
                "group flex h-full flex-col rounded-2xl border bg-gradient-to-br p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-6",
                p.color
              )}
            >
              <span className={cn("mb-3 self-start rounded-full px-3 py-1 text-xs font-bold sm:mb-4", p.badge)}>
                {p.range}
              </span>
              <p className="flex-1 text-xs text-slate-600 leading-relaxed sm:text-sm">{p.desc}</p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-700 transition-colors group-hover:text-slate-900">
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
