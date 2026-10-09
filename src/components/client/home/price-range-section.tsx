"use client";

import Link from "next/link";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PRICE_RANGES = [
  { range: "Dưới 10 triệu", desc: "Phù hợp học sinh, sinh viên, văn phòng cơ bản", query: "?priceBucket=duoi-10tr" },
  { range: "10 – 15 triệu", desc: "Hiệu năng ổn, phù hợp công việc văn phòng nâng cao", query: "?priceBucket=10-15tr" },
  { range: "15 – 20 triệu", desc: "Laptop tầm trung cao cấp, đồ hoạ nhẹ và lập trình", query: "?priceBucket=15-20tr" },
  { range: "Trên 20 triệu", desc: "Cao cấp nhất — MacBook, workstation, gaming RTX", query: "?priceBucket=tren-20tr" },
];

export function PriceRangeSection() {
  return (
    <section className="container py-12 sm:py-16">
      <SectionHeader eyebrow="Tìm theo ngân sách" title="Laptop phù hợp túi tiền" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {PRICE_RANGES.map((p, i) => (
          <Reveal key={p.range} variant="fade-up" delay={i * 70} threshold={0.05}>
            <Link
              href={`/products${p.query}`}
              className={cn(
                "group relative flex h-full flex-col justify-between overflow-hidden rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-6",
              )}
            >
              <span className="pointer-events-none absolute -right-3 -top-4 text-6xl font-semibold tabular-nums text-muted opacity-50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="relative">
                <p className="text-lg font-semibold tracking-tight">{p.range}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>
              <div className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
                Xem sản phẩm
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}