import type { MetadataRoute } from "next";
import { getBrandNameAsync } from "@/lib/brand";
import { getShopIdFromRequest } from "@/lib/request-shop";

// Web App Manifest — phục vụ tại /manifest.webmanifest.
// Tên & mô tả lấy từ shop của domain hiện tại (qua middleware x-shop-id),
// fallback về settings (group store, key name) nếu không resolve được shop.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const shopId = await getShopIdFromRequest();
  const brandName = await getBrandNameAsync(shopId);
  return {
    name: `${brandName} - Laptop Cần Thơ`,
    short_name: brandName,
    description: `${brandName} - Cửa hàng laptop uy tín tại Cần Thơ. Giá tốt, bảo hành uy tín.`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "vi",
    // TODO: thêm icon khi có — đặt src/app/icon.png (512x512) và src/app/apple-icon.png,
    // Next sẽ tự nhận. Sau đó khai báo lại ở đây nếu cần PWA install.
    icons: [],
  };
}
