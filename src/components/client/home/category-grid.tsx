"use client";

import Link from "next/link";
import {
  Laptop,
  Gamepad2,
  Apple,
  Feather,
  Briefcase,
  Monitor,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { useHomeFilters, type FilterOption } from "./use-home-data";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

function iconFor(label: string): LucideIcon {
  const s = label.toLowerCase();
  if (s.includes("macbook") || s.includes("apple")) return Apple;
  if (s.includes("gaming")) return Gamepad2;
  if (s.includes("ultrabook")) return Feather;
  if (s.includes("văn phòng") || s.includes("office")) return Briefcase;
  if (s.includes("màn")) return Monitor;
  return Laptop;
}

// Subtle accent colors per category type
const ACCENT_MAP: Record<string, { bg: string; text: string; dot: string }> = {
  default: { bg: "hover:bg-slate-50", text: "text-slate-700", dot: "bg-slate-400" },
  apple:   { bg: "hover:bg-zinc-50",  text: "text-zinc-700",  dot: "bg-zinc-600" },
  gaming:  { bg: "hover:bg-red-50",   text: "text-red-700",   dot: "bg-red-500" },
  ultra:   { bg: "hover:bg-sky-50",   text: "text-sky-700",   dot: "bg-sky-500" },
  office:  { bg: "hover:bg-blue-50",  text: "text-blue-700",  dot: "bg-blue-500" },
};

function getAccent(label: string) {
  const s = label.toLowerCase();
  if (s.includes("macbook") || s.includes("apple")) return ACCENT_MAP.apple;
  if (s.includes("gaming")) return ACCENT_MAP.gaming;
  if (s.includes("ultrabook")) return ACCENT_MAP.ultra;
  if (s.includes("văn phòng")) return ACCENT_MAP.office;
  return ACCENT_MAP.default;
}

function CategoryCard({ cat, index }: { cat: FilterOption; index: number }) {
  const Icon = iconFor(cat.label);
  const accent = getAccent(cat.label);

  return (
    <Reveal variant="fade-up" delay={index * 60} threshold={0.05}>
      <Link
        href={`/products?category=${cat.value}`}
        className={cn(
          "group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 transition-all duration-300 sm:gap-3 sm:p-5",
          "hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-slate-300",
          accent.bg
        )}
      >
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 transition-all duration-300 sm:h-11 sm:w-11",
              "group-hover:scale-110 group-hover:border-slate-200 group-hover:bg-white group-hover:shadow-sm"
            )}
          >
            <Icon className={cn("h-5 w-5", accent.text)} />
          </div>
          <ArrowUpRight
            className={cn(
              "h-4 w-4 text-slate-300 opacity-0 transition-all duration-300 group-hover:opacity-100",
              accent.text
            )}
          />
        </div>

        <div>
          <p className="truncate text-xs font-semibold text-slate-800 leading-tight sm:text-sm">
            {cat.label}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">{cat.count} sản phẩm</p>
        </div>

        {/* Bottom accent bar */}
        <div className="h-0.5 w-0 rounded-full transition-all duration-500 group-hover:w-full">
          <div className={cn("h-full w-full rounded-full", accent.dot)} />
        </div>
      </Link>
    </Reveal>
  );
}

export function CategoryGrid() {
  const { data, isLoading } = useHomeFilters();
  const categories = data?.categories ?? [];

  return (
    <section className="container pt-10 sm:pt-16">
      <Reveal variant="clip-up">
        <div className="mb-5 flex items-end justify-between sm:mb-8">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Danh mục
            </p>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Tìm theo loại sản phẩm
            </h2>
          </div>
          <Link
            href="/products"
            className="group flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            Xem tất cả
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
              />
            ))
          : categories.map((cat, i) => (
              <CategoryCard key={cat.value} cat={cat} index={i} />
            ))}
      </div>
    </section>
  );
}
