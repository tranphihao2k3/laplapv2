/**
 * Brand utilities — đọc tên thương hiệu & email mặc định.
 *
 * Hành vi hiện tại: dùng MỘT brand name duy nhất cho mọi shop/domain.
 * Tham số `shopId` được giữ để tương thích ngược với call-site cũ nhưng bị bỏ
 * qua. Resolution order:
 *   1. `settings` table (group "store", key "name" | "email")
 *   2. process.env.NEXT_PUBLIC_APP_NAME | "LapLap" (fallback cuối)
 *
 * (Trước đây từng lookup `shops.name` / `shops.email` theo shopId để mỗi
 * domain có brand riêng. Tính năng này đã được tắt vì không ổn định trong triển
 * khai thực tế. Cột `shops.primary_domain` / `shops.allowed_domains` vẫn còn
 * trong DB để có thể bật lại sau nếu cần.)
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
 * Tên thương hiệu dùng chung (một brand name cho mọi shop/domain).
 *
 * @param _shopId - Giữ tham số để tương thích ngược với call-site cũ. Bị bỏ qua.
 */
export const getBrandNameAsync = cache(
  async (_shopId?: string | null): Promise<string> => {
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
 * Email liên hệ mặc định dùng chung.
 *
 * @param _shopId - Giữ tham số để tương thích ngược. Bị bỏ qua.
 */
export const getBrandEmailAsync = cache(
  async (_shopId?: string | null): Promise<string> => {
    const fromSettings = await readSettingsStoreValue("email");
    if (fromSettings) return fromSettings;
    return FALLBACK_EMAIL;
  },
);
