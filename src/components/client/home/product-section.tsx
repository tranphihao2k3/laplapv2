"use client";

import { HomeProductCard } from "./home-product-card";
import { useHomeProducts } from "./use-home-data";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";
import { useAddToCart } from "@/components/client/cart/add-to-cart";

export function ProductSection({
  title,
  eyebrow,
  description,
  sort = "newest",
  brand,
  category,
  limit = 8,
  moreHref = "/products",
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc";
  brand?: string;
  category?: string;
  limit?: number;
  moreHref?: string;
}) {
  const { data, isLoading } = useHomeProducts({ sort, brand, category, limit });
  const products = data?.items ?? [];
  const addToCart = useAddToCart();

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="container pt-14 sm:pt-24">
      <SectionHeader
        eyebrow={eyebrow ?? "Sản phẩm"}
        title={title}
        description={description}
        action={{ label: "Xem tất cả", href: moreHref }}
      />

      {/* Products grid with stagger reveal */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[320px] animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
              />
            ))
          : products.slice(0, limit).map((p, i) => (
              <Reveal key={p.id} variant="fade-up" delay={i * 70} threshold={0.04}>
                <HomeProductCard product={p} className="h-full" onAddToCart={addToCart} />
              </Reveal>
            ))}
      </div>
    </section>
  );
}
