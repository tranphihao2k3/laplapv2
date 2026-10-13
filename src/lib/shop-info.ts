import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreInfo, type LegalInfo } from "@/lib/store-info";

/**
 * Thông tin liên hệ cửa hàng (gọn nhẹ) — lấy từ bảng `shops`.
 * Dùng cho header, navbar, footer... khi không cần legal info.
 *
 * Khi truyền `shopId`: query chính xác shop đó (kể cả `is_active = false`
 * để admin vẫn thấy thông tin shop của mình trên UI quản trị).
 *
 * Khi KHÔNG truyền: lấy shop `is_active = true` đầu tiên (created_at ASC).
 *
 * Fallback: nếu `shops` rỗng → `getStoreInfo()` (settings table).
 */
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
  name: "LapLap",
  phone: null,
  email: null,
  address: null,
  primary_domain: null,
  allowed_domains: [],
};

export const getShopInfo = cache(
  async (shopId?: string | null): Promise<ShopInfo> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createAdminClient() as any;

      // 1) Truy vấn theo shopId (nếu có)
      if (shopId) {
        const { data: shop } = await supabase
          .from("shops")
          .select("id, name, phone, email, address, primary_domain, allowed_domains")
          .eq("id", shopId)
          .maybeSingle();
        if (shop) {
          return {
            shop_id: shop.id ?? shopId,
            name: shop.name ?? FALLBACK.name,
            phone: shop.phone ?? null,
            email: shop.email ?? null,
            address: shop.address ?? null,
            primary_domain: shop.primary_domain ?? null,
            allowed_domains: Array.isArray(shop.allowed_domains) ? shop.allowed_domains : [],
          };
        }
      }

      // 2) Không có shopId hoặc shopId không match → lấy active đầu tiên
      const { data } = await supabase
        .from("shops")
        .select("id, name, phone, email, address, primary_domain, allowed_domains, is_active, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data) {
        return {
          shop_id: data.id,
          name: data.name ?? FALLBACK.name,
          phone: data.phone ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
          primary_domain: data.primary_domain ?? null,
          allowed_domains: Array.isArray(data.allowed_domains) ? data.allowed_domains : [],
        };
      }
    } catch {
      // rơi xuống fallback settings
    }

    // Fallback: dùng settings (group "store").
    try {
      const store = await getStoreInfo();
      return {
        ...FALLBACK,
        name: store.name,
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
 *
 * LƯU Ý: legal info luôn lấy từ settings table (org-level) — KHÔNG per-shop
 * vì legal thuộc về pháp nhân, không phải chi nhánh.
 */
export async function getLegalInfo(): Promise<LegalInfo> {
  const store = await getStoreInfo();
  return store.legal;
}

// Chuẩn hoá SĐT về dạng dùng cho href="tel:" (bỏ khoảng trắng, dấu chấm...).
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}
