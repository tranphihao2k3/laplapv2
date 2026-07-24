import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type ShopInfo = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

// Giá trị mặc định khi chưa cấu hình cửa hàng trong /quanly/settings.
const FALLBACK: ShopInfo = {
  name: "LapLap",
  phone: null,
  email: null,
  address: null,
};

/**
 * Thông tin liên hệ cửa hàng, lấy từ bảng `shops` (chỉnh ở tab
 * "Thông tin cửa hàng" của /quanly/settings). Dùng cho footer, trang sản phẩm...
 *
 * `cache()` để nhiều component trong cùng 1 request chỉ query 1 lần.
 * Bọc try/catch để không làm sập trang public nếu DB / env chưa sẵn sàng.
 */
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

    if (!data) return FALLBACK;
    return {
      name: data.name ?? FALLBACK.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
    };
  } catch {
    return FALLBACK;
  }
});

// Chuẩn hoá SĐT về dạng dùng cho href="tel:" (bỏ khoảng trắng, dấu chấm...).
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}
