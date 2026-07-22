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
  Tag,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./reveal";
import { useHomeBrands, useHomeFilters, type HomeBrand, type FilterOption } from "./use-home-data";
import { cn } from "@/lib/utils";

// ─── Icon helpers ────────────────────────────────────────────────────────────

function iconFor(label: string): LucideIcon {
  const s = label.toLowerCase();
  if (s.includes("macbook") || s.includes("apple")) return Apple;
  if (s.includes("gaming")) return Gamepad2;
  if (s.includes("ultrabook")) return Feather;
  if (s.includes("văn phòng") || s.includes("office")) return Briefcase;
  if (s.includes("màn")) return Monitor;
  return Laptop;
}

// ─── Accent colors ────────────────────────────────────────────────────────────

const ACCENT_MAP: Record<string, { bg: string; text: string; dot: string; iconBg: string }> = {
  default: { bg: "hover:bg-slate-50",  text: "text-slate-700",  dot: "bg-slate-400",  iconBg: "bg-slate-100" },
  apple:   { bg: "hover:bg-zinc-50",   text: "text-zinc-700",   dot: "bg-zinc-600",   iconBg: "bg-zinc-100" },
  gaming:  { bg: "hover:bg-red-50",    text: "text-red-700",    dot: "bg-red-500",    iconBg: "bg-red-100" },
  ultra:   { bg: "hover:bg-sky-50",    text: "text-sky-700",    dot: "bg-sky-500",    iconBg: "bg-sky-100" },
  office:  { bg: "hover:bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500",   iconBg: "bg-blue-100" },
  macbook: { bg: "hover:bg-zinc-50",   text: "text-zinc-700",   dot: "bg-zinc-500",   iconBg: "bg-zinc-100" },
};

function getAccent(label: string) {
  const s = label.toLowerCase();
  if (s.includes("macbook"))                               return ACCENT_MAP.macbook;
  if (s.includes("apple"))                                 return ACCENT_MAP.apple;
  if (s.includes("gaming"))                                return ACCENT_MAP.gaming;
  if (s.includes("ultrabook"))                             return ACCENT_MAP.ultra;
  if (s.includes("văn phòng") || s.includes("office"))    return ACCENT_MAP.office;
  return ACCENT_MAP.default;
}

// ─── Brand meta ───────────────────────────────────────────────────────────────

function getBrandMeta(label: string) {
  const l = label.toLowerCase();
  const sub =
    l.includes("apple")  ? "MacBook Pro/Air" :
    l.includes("dell")   ? "XPS · Inspiron"  :
    l.includes("asus")   ? "ZenBook · ROG"   :
    l.includes("lenovo") ? "ThinkPad · IdeaPad" :
    l.includes("hp")     ? "Spectre · Pavilion" :
    l.includes("msi")    ? "Raider · Creator" :
    l.includes("acer")   ? "Swift · Nitro"   :
    l.includes("lg")     ? "Gram · UltraPC"  :
    "Sản phẩm chính hãng";
  return { name: label, sub };
}

// ─── Brand Card ───────────────────────────────────────────────────────────────

function BrandCard({ brand, index }: { brand: HomeBrand; index: number }) {
  const Icon   = iconFor(brand.name);
  const accent = getAccent(brand.name);
  const meta   = getBrandMeta(brand.name);

  return (
    <Reveal variant="scale-up" delay={index * 50} threshold={0.05}>
      <Link
        href={`/products?brand=${brand.id}`}
        className={cn(
          "group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 transition-all duration-300 sm:gap-3 sm:p-5",
          "hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-slate-300",
          accent.bg,
        )}
      >
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 transition-all duration-300 sm:h-11 sm:w-11",
              "group-hover:scale-110 group-hover:border-slate-200 group-hover:bg-white group-hover:shadow-sm",
            )}
          >
            <Icon className={cn("h-5 w-5", accent.text)} />
          </div>
          <ArrowUpRight
            className={cn(
              "h-4 w-4 text-slate-300 opacity-0 transition-all duration-300 group-hover:opacity-100",
              accent.text,
            )}
          />
        </div>

        <div>
          <p className="truncate text-xs font-semibold text-slate-800 leading-tight sm:text-sm">{meta.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400 sm:text-xs">{meta.sub}</p>
        </div>

        <div className="h-0.5 w-0 rounded-full transition-all duration-500 group-hover:w-full">
          <div className={cn("h-full w-full rounded-full", accent.dot)} />
        </div>
      </Link>
    </Reveal>
  );
}

// ─── Category Row Item ────────────────────────────────────────────────────────

function CategoryChip({ cat, index }: { cat: FilterOption; index: number }) {
  const Icon   = iconFor(cat.label);
  const accent = getAccent(cat.label);

  return (
    <Reveal variant="fade-up" delay={index * 40} threshold={0.05}>
      <Link
        href={`/products?category=${encodeURIComponent(cat.value)}`}
        className={cn(
          "group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300",
          accent.bg,
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 transition-all duration-200",
            "group-hover:scale-110 group-hover:shadow-sm",
            accent.iconBg,
          )}
        >
          <Icon className={cn("h-4 w-4", accent.text)} />
        </div>

        {/* Label + count */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800 leading-tight">{cat.label}</p>
          <p className="text-[11px] text-slate-400">{cat.count} sản phẩm</p>
        </div>

        {/* Arrow */}
        <ArrowUpRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition-all duration-200 group-hover:opacity-100",
            accent.text,
          )}
        />
      </Link>
    </Reveal>
  );
}

// ─── Main combined section ────────────────────────────────────────────────────

export function BrandStrip() {
  const { data: brandsData, isLoading: brandsLoading } = useHomeBrands();
  const { data: filtersData, isLoading: catsLoading }  = useHomeFilters();

  const brands     = brandsData?.items ?? [];
  const categories = filtersData?.categories ?? [];

  return (
    <section className="container pt-8 sm:pt-14">

      {/* ── Thương hiệu ── */}
      <Reveal variant="clip-up" threshold={0.05}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Thương hiệu</p>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Chúng tôi phân phối</h2>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-8">
        {brandsLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Reveal key={i} variant="scale-up" delay={i * 50} threshold={0.05}>
                <div className="h-24 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
              </Reveal>
            ))
          : brands.map((brand, i) => <BrandCard key={brand.id} brand={brand} index={i} />)}
      </div>

      {/* ── Divider ── */}
      <div className="my-8 sm:my-12">
        <div className="relative flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
            <Tag className="h-3 w-3 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Danh mục</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>
      </div>

      {/* ── Danh mục ── */}
      <Reveal variant="clip-up" threshold={0.05}>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Tìm theo loại sản phẩm
            </h2>
          </div>
          <Link
            href="/products"
            className="group flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            Xem tất cả
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
        {catsLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[60px] animate-pulse rounded-xl border border-slate-100 bg-slate-50"
              />
            ))
          : categories.map((cat, i) => <CategoryChip key={cat.value} cat={cat} index={i} />)}
      </div>

    </section>
  );
}
