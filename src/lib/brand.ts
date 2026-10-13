/**
 * Brand utilities — đọc tên thương hiệu & email mặc định.
 *
 * Resolution order (khi truyền shopId):
 *   1. `shops` table WHERE id = shopId  → name, email
 *   2. `settings` table (group "store", key "name" | "email")
 *   3. process.env.NEXT_PUBLIC_APP_NAME | "LapLap" (fallback cuối)
 *
 * Khi KHÔNG truyền shopId (vd trang admin global, email template):
 *   → dùng `settings` table, fallback env.
 *
 * Mọi nơi hiển thị tên thương hiệu PHẢI truyền shopId (lấy từ
 * `headers().get("x-shop-id")` trong server context). Middleware đã set
 * header này từ `Host` header → mỗi domain có brand riêng.
 */
import { cache } from "react";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const FALLBACK_BRAND = "LapLap";
const FALLBACK_EMAIL = "info@laplap.vn";

function safeEnvName(): string {
  const v = env.NEXT_PUBLIC_APP_NAME?.trim();
  return v && v.length > 0 ? v : FALLBACK_BRAND;
}

/**
 * Đọc tên cửa hàng từ `shops` table theo shopId.
 * Trả về null nếu shopId không tồn tại / không có name.
 */
async function readShopName(shopId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("shops")
      .select("name")
      .eq("id", shopId)
      .maybeSingle();
    const name = data?.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

async function readShopEmail(shopId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("shops")
      .select("email")
      .eq("id", shopId)
      .maybeSingle();
    const email = data?.email;
    return typeof email === "string" && email.trim() ? email.trim() : null;
  } catch {
    return null;
  }
}

async function readSettingsStoreValue(key: "name" | "email"): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("group_name", "store")
      .eq("key", key)
      .maybeSingle();

    const raw = data?.value;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (raw && typeof raw === "object" && "value" in raw) {
      const v = (raw as { value: unknown }).value;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Tên thương hiệu cho domain hiện tại.
 *
 * @param shopId - shopId từ middleware (qua `headers().get("x-shop-id")`).
 *                 Nếu null/undefined → fallback về settings global.
 */
export const getBrandNameAsync = cache(
  async (shopId?: string | null): Promise<string> => {
    if (shopId) {
      const fromShop = await readShopName(shopId);
      if (fromShop) return fromShop;
    }
    const fromSettings = await readSettingsStoreValue("name");
    if (fromSettings) return fromSettings;
    return safeEnvName();
  },
);

/** Sync version for client components — chỉ trả env fallback. */
export function getBrandNameSync(): string {
  return safeEnvName();
}

/**
 * Email liên hệ mặc định cho domain hiện tại.
 *
 * Ưu tiên `shops.email` (per-shop), fallback về `settings.email`, cuối
 * cùng là `info@laplap.vn`.
 */
export const getBrandEmailAsync = cache(
  async (shopId?: string | null): Promise<string> => {
    if (shopId) {
      const fromShop = await readShopEmail(shopId);
      if (fromShop) return fromShop;
    }
    const fromSettings = await readSettingsStoreValue("email");
    if (fromSettings) return fromSettings;
    return FALLBACK_EMAIL;
  },
);
