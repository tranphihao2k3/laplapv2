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
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { useHomeBrands, useHomeFilters, type HomeBrand, type FilterOption } from "./use-home-data";
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

function BrandCard({ brand, index }: { brand: HomeBrand; index: number }) {
  const Icon = iconFor(brand.name);
  const meta = getBrandMeta(brand.name);

  return (
    <Reveal variant="fade-up" delay={index * 40} threshold={0.05}>
      <Link
        href={`/products?brand=${brand.id}`}
        className={cn(
          "group flex flex-col gap-2.5 rounded-xl border bg-card p-3 transition-all",
          "hover:-translate-y-0.5 hover:shadow-md sm:gap-3 sm:p-5",
        )}
      >
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border bg-muted text-muted-foreground transition-colors sm:h-11 sm:w-11",
              "group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <div>
          <p className="truncate text-xs font-semibold leading-tight sm:text-sm">{meta.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">{meta.sub}</p>
        </div>
      </Link>
    </Reveal>
  );
}

function CategoryChip({ cat, index }: { cat: FilterOption; index: number }) {
  const Icon = iconFor(cat.label);

  return (
    <Reveal variant="fade-up" delay={index * 40} threshold={0.05}>
      <Link
        href={`/products?category=${encodeURIComponent(cat.value)}`}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 transition-all",
          "hover:-translate-y-0.5 hover:shadow-md",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{cat.label}</p>
          <p className="text-[11px] text-muted-foreground">{cat.count} sản phẩm</p>
        </div>

        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </Reveal>
  );
}

export function BrandStrip() {
  const { data: brandsData, isLoading: brandsLoading } = useHomeBrands();
  const { data: filtersData, isLoading: catsLoading }  = useHomeFilters();

  const brands     = brandsData?.items ?? [];
  const categories = filtersData?.categories ?? [];

  return (
    <section className="container py-12 sm:py-16">
      {/* Thương hiệu */}
      <SectionHeader eyebrow="Thương hiệu" title="Chúng tôi phân phối" />

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-8">
        {brandsLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))
          : brands.map((brand, i) => <BrandCard key={brand.id} brand={brand} index={i} />)}
      </div>

      {/* Divider */}
      <div className="my-10 h-px bg-border sm:my-14" />

      {/* Danh mục */}
      <SectionHeader
        eyebrow="Danh mục"
        title="Tìm theo loại sản phẩm"
        action={{ label: "Xem tất cả", href: "/products" }}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
        {catsLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[60px] animate-pulse rounded-lg bg-muted" />
            ))
          : categories.map((cat, i) => <CategoryChip key={cat.value} cat={cat} index={i} />)}
      </div>
    </section>
  );
}