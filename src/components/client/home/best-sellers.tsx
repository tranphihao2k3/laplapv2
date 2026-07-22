"use client";

import { Award } from "lucide-react";
import { ProductSection } from "./product-section";
import { useHomeFilters } from "./use-home-data";

export function BestSellers() {
  const { data } = useHomeFilters();
  const topBrand = data?.brands?.[0];
  if (!topBrand) return null;

  return (
    <ProductSection
      title={`Nổi bật từ ${topBrand.label}`}
      eyebrow="Thương hiệu hàng đầu"
      icon={Award}
      accentColor="bg-amber-500"
      sort="newest"
      brand={topBrand.value}
      limit={4}
      moreHref={`/products?brand=${topBrand.value}`}
    />
  );
}
