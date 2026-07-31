/**
 * Supabase client dùng Service Role Key — bypass RLS.
 * CHỈ dùng trong server-side code (API routes, Server Actions).
 * KHÔNG import ở client components.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerEnv } from "@/lib/env";

export function createSupabaseServiceClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getServerEnv();

  // Fallback sang anon key nếu service role chưa set (dev local)
  const key = SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return createClient<Database, "public", any>(NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
}
