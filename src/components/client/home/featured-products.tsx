"use client";

import { ProductSection } from "./product-section";
import { Laptop } from "lucide-react";

export function FeaturedProducts() {
  return (
    <ProductSection
      title="Laptop mới về"
      eyebrow="Laptop"
      description="Những mẫu laptop vừa lên kệ — cập nhật liên tục mỗi tuần."
      kind="laptop"
      sort="newest"
      limit={8}
      moreHref="/products?kind=laptop&sort=newest"
    />
  );
}
