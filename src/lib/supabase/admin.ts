import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerEnv } from "@/lib/env";

/**
 * Admin client với service role key - bypass RLS.
 * CHỈ dùng ở server-side (route handlers, server actions, scripts).
 * KHÔNG BAO GIỜ import file này vào client component.
 */
export function createAdminClient() {
  const serverEnv = getServerEnv();

  // Dev local đôi khi thiếu SERVICE_ROLE — fallback anon (vẫn đọc được catalog
  // public nhờ RLS). Production nên luôn set SERVICE_ROLE_KEY.
  const key =
    serverEnv.SUPABASE_SERVICE_ROLE_KEY ||
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Thiếu SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local",
    );
  }

  return createClient<Database, "public", any>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
