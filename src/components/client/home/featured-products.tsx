"use client";

import { Sparkles } from "lucide-react";
import { ProductSection } from "./product-section";

export function FeaturedProducts() {
  return (
    <ProductSection
      title="Sản phẩm mới nhất"
      eyebrow="Mới về"
      icon={Sparkles}
      accentColor="bg-blue-600"
      sort="newest"
      limit={8}
      moreHref="/products?sort=newest"
    />
  );
}
