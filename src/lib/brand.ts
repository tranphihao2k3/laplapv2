/**
 * Brand utilities — đọc tên thương hiệu từ settings DB (qua getStoreInfo)
 * với fallback an toàn từ env.NEXT_PUBLIC_APP_NAME.
 *
 * Nguyên tắc:
 *   1. Server-side: getBrandNameAsync() đọc từ Supabase `settings` table.
 *   2. Client-side: useBrandName() hook đọc từ /api/public/store-info.
 *   3. Fallback cuối cùng: process.env.NEXT_PUBLIC_APP_NAME hoặc "LapLap".
 *
 * Mọi nơi hiển thị tên thương hiệu (title, manifest, email, hoá đơn, chính
 * sách) PHẢI dùng các helper này — KHÔNG hard-code "LapLap" trong code.
 */
import { cache } from "react";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const FALLBACK_BRAND = "LapLap";

function safeEnvName(): string {
  const v = env.NEXT_PUBLIC_APP_NAME?.trim();
  return v && v.length > 0 ? v : FALLBACK_BRAND;
}

/** Brand name lấy từ settings (group "store", key "name") với fallback an toàn. */
export const getBrandNameAsync = cache(async (): Promise<string> => {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("group_name", "store")
      .eq("key", "name")
      .maybeSingle();

    const raw = data?.value;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (raw && typeof raw === "object" && "value" in raw) {
      const v = (raw as { value: unknown }).value;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  } catch {
    // ignore — fall through
  }
  return safeEnvName();
});

/** Sync version for client components — chỉ trả env fallback. */
export function getBrandNameSync(): string {
  return safeEnvName();
}

/** Domain email mặc định từ store info (group store, key email). */
export async function getBrandEmailAsync(): Promise<string> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("group_name", "store")
      .eq("key", "email")
      .maybeSingle();

    const raw = data?.value;
    const v = typeof raw === "string" ? raw : (raw as { value?: string } | null)?.value;
    if (typeof v === "string" && v.trim()) return v.trim();
  } catch {
    // ignore
  }
  return "info@laplap.vn";
}
