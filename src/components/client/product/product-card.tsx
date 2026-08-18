"use client";

// V1 đã được migrate sang V2 (xem product-card-v2.tsx). Re-export để caller
// cũ (related-products.tsx) vẫn import { ProductCard } hoạt động bình thường.
// Rollback: thay bằng implementation V1 bên dưới.
//
// "use client" ở đây để giữ ranh giới client component khi server component
// (related-products.tsx) import { ProductCard } → Next.js không báo lỗi
// "imports useState without use client" từ V2.
export { ProductCardV2 as ProductCard } from "./product-card-v2";