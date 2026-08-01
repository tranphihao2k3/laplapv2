/**
 * Supabase client xác thực bằng `Authorization: Bearer <access_token>`.
 *
 * Dùng cho app desktop (Facebook Publisher) — app không có cookie session của
 * trình duyệt nên không dùng được `createClient()` ở server.ts.
 *
 * NGUYÊN TẮC:
 * - Vẫn dùng ANON KEY, không phải service role. Token của user đi kèm mỗi
 *   request nên RLS theo organization vẫn được Postgres áp dụng như trên web.
 *   KHÔNG cấp SUPABASE_SERVICE_ROLE_KEY cho desktop (xem docs/FB-PUBLISHER-TASKS.md).
 * - Tách hẳn khỏi server.ts để không chạm vào luồng cookie của web.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/** Rút access token từ header `Authorization: Bearer <token>`. */
export function readBearerToken(req: Request): string | null {
  const raw = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!raw) return null;
  // Chỉ nhận đúng scheme "Bearer" (không phân biệt hoa thường), phần còn lại là token.
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Tạo Supabase client mang theo access token của user.
 * Mọi query sau đó chạy dưới danh nghĩa user đó → RLS vẫn áp dụng.
 */
export function createBearerClient(accessToken: string) {
  return createSupabaseClient<Database, "public", any>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      // Client này sống trong một request duy nhất: không lưu/không tự refresh
      // session, tránh ghi lẫn state giữa các request trên cùng isolate.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
