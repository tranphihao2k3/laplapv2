"use client";

// V1 đã được migrate sang V2 (xem product-card-v2.tsx). Re-export để caller
// cũ (product-section, product-listing) vẫn import { HomeProductCard } hoạt
// động bình thường mà không cần đổi call site. Lưu ý: V2 không có panel specs
// trượt lên + CompareToggle như V1 — nhưng theo yêu cầu "migrate toàn bộ" thì
// UI mới đã đẹp hơn (rating/sold row, badge Hot/Mới về, wishlist).
// Rollback: thay bằng implementation V1 bên dưới.
//
// "use client" ở đây để V2 (dùng useState) được coi là client component khi
// các caller server-side import vào.
export { ProductCardV2 as HomeProductCard } from "@/components/client/product/product-card-v2";