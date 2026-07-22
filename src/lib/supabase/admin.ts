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

  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY chưa được set trong .env.local");
  }

  return createClient<Database, "public", any>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
