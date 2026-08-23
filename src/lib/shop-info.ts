import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreInfo, type LegalInfo } from "@/lib/store-info";

/**
 * Thông tin liên hệ cửa hàng (gọn nhẹ) — lấy từ bảng `shops`.
 * Dùng cho header, navbar, footer... khi không cần legal info.
 *
 * Nếu bảng `shops` rỗng (chưa cấu hình trong /quanly/settings) thì
 * fallback về `getStoreInfo()` (settings table) để vẫn có thông tin
 * cơ bản name/phone/email/address cho trang public.
 */
export type ShopInfo = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

const FALLBACK: ShopInfo = {
  name: "LapLap",
  phone: null,
  email: null,
  address: null,
};

export const getShopInfo = cache(async (): Promise<ShopInfo> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    const { data } = await supabase
      .from("shops")
      .select("name, phone, email, address, is_active, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        name: data.name ?? FALLBACK.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
      };
    }
  } catch {
    // rơi xuống fallback settings
  }

  // Fallback: dùng settings (group "store").
  try {
    const store = await getStoreInfo();
    return {
      name: store.name,
      phone: store.phone || null,
      email: store.email || null,
      address: store.address || null,
    };
  } catch {
    return FALLBACK;
  }
});

/**
 * Trả về thông tin pháp lý (NN 52/2013 + 85/2021) — dùng cho footer/trang pháp lý.
 * Re-export từ store-info để caller không phải đụng 2 module.
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