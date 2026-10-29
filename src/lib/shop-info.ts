/**
 * Thông tin liên hệ cửa hàng (gọn nhẹ) — single-shop mode.
 *
 * Multi-shop đã bị gỡ bỏ. Hàm giữ tham số `shopId` để tương thích ngược với
 * call-site cũ, nhưng bị bỏ qua. Toàn bộ thông tin brand đọc từ
 * `getStoreInfo()` (settings table group "store").
 */
import { cache } from "react";
import { getStoreInfo, type LegalInfo } from "@/lib/store-info";

/** Thông tin cửa hàng rút gọn cho header/navbar/footer. */
export type ShopInfo = {
  shop_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  primary_domain: string | null;
  allowed_domains: string[];
};

const FALLBACK: ShopInfo = {
  shop_id: null,
  name: "Laptop Thành Võ",
  phone: null,
  email: null,
  address: null,
  primary_domain: null,
  allowed_domains: [],
};

/**
 * Trả thông tin liên hệ. Tham số `shopId` bị bỏ qua (legacy).
 */
export const getShopInfo = cache(
  async (_shopId?: string | null): Promise<ShopInfo> => {
    try {
      const store = await getStoreInfo();
      return {
        ...FALLBACK,
        name: store.name || FALLBACK.name,
        phone: store.phone || null,
        email: store.email || null,
        address: store.address || null,
      };
    } catch {
      return FALLBACK;
    }
  },
);

/**
 * Trả về thông tin pháp lý (NN 52/2013 + 85/2021) — dùng cho footer/trang pháp lý.
 * Re-export từ store-info để caller không phải đụng 2 module.
 */
export async function getLegalInfo(): Promise<LegalInfo> {
  const store = await getStoreInfo();
  return store.legal;
}

/** Chuẩn hoá SĐT về dạng dùng cho href="tel:" (bỏ khoảng trắng, dấu chấm...). */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}
