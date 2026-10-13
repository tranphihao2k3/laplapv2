import { headers } from "next/headers";
import { getBrandNameAsync, getBrandEmailAsync } from "@/lib/brand";
import { getStoreInfo, getStoreContact } from "@/lib/store-info";
import { getShopInfo } from "@/lib/shop-info";
import type { StoreInfo, StoreContact } from "@/lib/store-info";
import type { ShopInfo } from "@/lib/shop-info";

/**
 * Helper lấy `shop_id` đã được middleware resolve sẵn.
 *
 * Middleware (`src/middleware.ts`) resolve shop từ `Host` header dựa trên
 * `shops.primary_domain` / `shops.allowed_domains`, set:
 *   - `x-shop-id` header (cho server components / API routes)
 *   - `shop_id` cookie (cho client fetch)
 *
 * Dùng trong server context (server component, route handler, server action).
 * Trả về `null` nếu:
 *   - Không có request (vd lúc build static page)
 *   - Host không match shop nào trong DB
 *   - Migration `20261013000000_shop_domains.sql` chưa apply
 *
 * Sử dụng:
 * ```ts
 * const shopId = await getShopIdFromRequest();
 * const brandName = await getBrandNameAsync(shopId);
 * ```
 */
export async function getShopIdFromRequest(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-shop-id") || null;
  } catch {
    // headers() có thể throw trong static context (vd generateMetadata
    // lúc next build). Trả null để caller fallback về global.
    return null;
  }
}

// ===== Convenience wrappers =====
//
// Gom 2 bước (đọc shopId từ request, gọi resolver) thành 1 call để giảm
// boilerplate ở mọi page/layout. Cùng kết quả với việc gọi:
//   const shopId = await getShopIdFromRequest();
//   const info = await getStoreInfo(shopId);
//
// Ví dụ trong generateMetadata:
//   const store = await getStoreInfoForRequest();
//   return { title: `${store.name} - ...` };
//
export async function getStoreInfoForRequest(): Promise<StoreInfo> {
  const shopId = await getShopIdFromRequest();
  return getStoreInfo(shopId);
}

export async function getStoreContactForRequest(): Promise<StoreContact> {
  const shopId = await getShopIdFromRequest();
  return getStoreContact(shopId);
}

export async function getShopInfoForRequest(): Promise<ShopInfo> {
  const shopId = await getShopIdFromRequest();
  return getShopInfo(shopId);
}

export async function getBrandNameForRequest(): Promise<string> {
  const shopId = await getShopIdFromRequest();
  return getBrandNameAsync(shopId);
}

export async function getBrandEmailForRequest(): Promise<string> {
  const shopId = await getShopIdFromRequest();
  return getBrandEmailAsync(shopId);
}
