"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { HomeProductCard } from "./home-product-card";
import { useHomeProducts } from "./use-home-data";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

export function ProductSection({
  title,
  eyebrow,
  icon: Icon,
  accentColor = "bg-blue-600",
  sort = "newest",
  brand,
  category,
  limit = 8,
  moreHref = "/products",
}: {
  title: string;
  eyebrow?: string;
  icon: LucideIcon;
  accentColor?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc";
  brand?: string;
  category?: string;
  limit?: number;
  moreHref?: string;
}) {
  const { data, isLoading } = useHomeProducts({ sort, brand, category, limit });
  const products = data?.items ?? [];

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="container pt-10 sm:pt-16">
      {/* Header */}
      <Reveal variant="slide-split">
        <div className="mb-5 flex items-end justify-between sm:mb-8">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className={cn("inline-block h-0.5 w-4 rounded-full", accentColor)} />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                {eyebrow ?? "Sản phẩm"}
              </p>
            </div>
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              <Icon className="h-5 w-5 text-slate-500" />
              {title}
            </h2>
          </div>
          <Link
            href={moreHref}
            className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            Xem tất cả
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Reveal>

      {/* Products grid with stagger reveal */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[340px] animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
              />
            ))
          : products.slice(0, limit).map((p, i) => (
              <Reveal
                key={p.id}
                variant={i % 2 === 0 ? "fade-up" : "flip-x"}
                delay={i * 80}
                threshold={0.04}
              >
                <HomeProductCard product={p} className="h-full" />
              </Reveal>
            ))}
      </div>
    </section>
  );
}
