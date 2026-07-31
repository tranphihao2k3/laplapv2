"use client";

import { ProductSection } from "./product-section";

export function FeaturedProducts() {
  return (
    <ProductSection
      title="Sản phẩm mới nhất"
      eyebrow="Mới về"
      description="Những mẫu laptop vừa lên kệ, cập nhật liên tục mỗi tuần."
      sort="newest"
      limit={8}
      moreHref="/products?sort=newest"
    />
  );
}
