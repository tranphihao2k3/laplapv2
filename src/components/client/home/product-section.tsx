"use client";

import { HomeProductCard } from "./home-product-card";
import { useHomeProducts } from "./use-home-data";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { useAddToCart } from "@/components/client/cart/add-to-cart";
import { cn } from "@/lib/utils";
import type { ProductKind } from "@/lib/product-kind";

export function ProductSection({
  title,
  eyebrow,
  description,
  sort = "newest",
  brand,
  category,
  kind,
  limit = 8,
  moreHref = "/products",
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc";
  brand?: string;
  category?: string;
  /** Lọc theo phân loại sản phẩm — "laptop" hoặc "pc_component". */
  kind?: ProductKind;
  limit?: number;
  moreHref?: string;
  className?: string;
}) {
  const { data, isLoading } = useHomeProducts({ sort, brand, category, kind, limit });
  const products = data?.items ?? [];
  const addToCart = useAddToCart();

  if (!isLoading && products.length === 0) return null;

  return (
    <section className={cn("container py-12 sm:py-16", className)}>
      <SectionHeader
        eyebrow={eyebrow ?? "Sản phẩm"}
        title={title}
        description={description}
        action={{ label: "Xem tất cả", href: moreHref }}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[320px] animate-pulse rounded-xl bg-muted" />
            ))
          : products.slice(0, limit).map((p, i) => (
              <Reveal key={p.id} variant="fade-up" delay={i * 60} threshold={0.03}>
                <HomeProductCard product={p} className="h-full" onAddToCart={addToCart} />
              </Reveal>
            ))}
      </div>
    </section>
  );
}
