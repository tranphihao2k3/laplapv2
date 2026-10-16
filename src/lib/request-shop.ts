/**
 * Helpers lấy thông tin cửa hàng trong server context.
 *
 * Multi-shop đã gỡ: các hàm `*ForRequest` chỉ là thin wrapper gọi thẳng
 * `getStoreInfo()` (đã bỏ tham số shopId). Giữ lại để tương thích với
 * call-site cũ mà không cần sửa từng file.
 */
import { getStoreInfo, getStoreContact, type StoreInfo, type StoreContact } from "@/lib/store-info";
import { getShopInfo, type ShopInfo } from "@/lib/shop-info";
import { getBrandNameAsync, getBrandEmailAsync } from "@/lib/brand";

/**
 * @deprecated Multi-shop removed. Middleware không còn resolve `x-shop-id`.
 *             Trả về null luôn. Giữ hàm để call-site cũ không vỡ.
 */
export async function getShopIdFromRequest(): Promise<string | null> {
  return null;
}

export async function getStoreInfoForRequest(): Promise<StoreInfo> {
  return getStoreInfo();
}

export async function getStoreContactForRequest(): Promise<StoreContact> {
  return getStoreContact();
}

export async function getShopInfoForRequest(): Promise<ShopInfo> {
  return getShopInfo();
}

export async function getBrandNameForRequest(): Promise<string> {
  return getBrandNameAsync();
}

export async function getBrandEmailForRequest(): Promise<string> {
  return getBrandEmailAsync();
}
