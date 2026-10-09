"use client";

import { useState, useMemo } from "react";
import { HomeProductCard } from "./home-product-card";
import { useHomeProducts, useHomeFilters } from "./use-home-data";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { useAddToCart } from "@/components/client/cart/add-to-cart";
import { cn } from "@/lib/utils";
import {
  Cpu,
  CircuitBoard,
  MemoryStick,
  MonitorPlay,
  HardDrive,
  Disc,
  Zap,
  Server,
  Thermometer,
  Sparkles,
  Laptop,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

const PC_CAT_ICON: Record<string, LucideIcon> = {
  cpu: Cpu,
  mainboard: CircuitBoard,
  ram: MemoryStick,
  vga: MonitorPlay,
  gpu: MonitorPlay,
  ssd: HardDrive,
  hdd: Disc,
  psu: Zap,
  case: Server,
  cooler: Thermometer,
};

function iconForCategory(label: string, slug: string): LucideIcon {
  const s = (label + " " + slug).toLowerCase();
  for (const [key, Icon] of Object.entries(PC_CAT_ICON)) {
    if (s.includes(key)) return Icon;
  }
  return CircuitBoard;
}

export function PCComponentsSection() {
  const { data: filters } = useHomeFilters();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const pcCategories = useMemo(() => {
    const all = filters?.categories ?? [];
    return all
      .filter((c) => c.parentSlug === "pc-parts" && (c.count ?? 0) > 0)
      .slice(0, 8);
  }, [filters]);

  // Mặc định chọn category đầu tiên để hiện sản phẩm ngay khi load xong.
  const effectiveSlug = activeSlug ?? pcCategories[0]?.slug ?? null;

  const { data, isLoading } = useHomeProducts({
    kind: "pc_component",
    category: effectiveSlug ?? undefined,
    sort: "newest",
    limit: 8,
  });
  const products = data?.items ?? [];
  const addToCart = useAddToCart();

  // Nếu không có linh kiện nào trong DB thì ẩn section luôn.
  if (!isLoading && pcCategories.length === 0) return null;

  return (
    <section className="container py-12 sm:py-16">
      <Reveal variant="fade-up" threshold={0.08}>
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/[0.04] p-5 sm:p-8">
          {/* Soft glow accents */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeader
                eyebrow="Linh kiện PC"
                title="Linh kiện PC chính hãng"
                description="CPU, RAM, VGA, SSD, Mainboard, Nguồn, Case… cho dàn PC của bạn."
                className="mb-0 flex-1"
              />
              <Link
                href="/products?kind=pc_component"
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-card/60 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-primary/5"
              >
                Xây dựng PC <Sparkles className="h-3.5 w-3.5 text-primary" />
              </Link>
            </div>

            {/* Category chips */}
            {pcCategories.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {pcCategories.map((cat) => {
                  const Icon = iconForCategory(cat.label, cat.slug ?? "");
                  const isActive = effectiveSlug === cat.slug;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setActiveSlug(cat.slug ?? null)}
                      className={cn(
                        "group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_rgba(var(--primary),0.5)]"
                          : "border-border/60 bg-card/70 text-foreground hover:border-primary/50 hover:text-primary",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cat.label}
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-[10px] font-semibold",
                          isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Product grid */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[320px] animate-pulse rounded-xl bg-muted"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  ))
                : products.slice(0, 8).map((p, i) => (
                    <Reveal key={p.id} variant="fade-up" delay={i * 50} threshold={0.03}>
                      <HomeProductCard product={p} className="h-full" onAddToCart={addToCart} />
                    </Reveal>
                  ))}
            </div>

            {products.length === 0 && !isLoading && (
              <div className="mt-4 rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                Chưa có sản phẩm trong danh mục này.
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
