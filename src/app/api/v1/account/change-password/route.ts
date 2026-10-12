/**
 * POST /api/v1/account/change-password
 *   Body: { current_password, new_password }
 *
 * Supabase Auth API không cho re-auth từ cookie — ta gọi
 * signInWithPassword với current_password trước, nếu OK thì updateUser.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";
import { isAuthError } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  current_password: z.string().min(6).max(72),
  new_password: z
    .string()
    .min(8, "Mật khẩu mới tối thiểu 8 ký tự")
    .max(72),
});

export async function POST(req: NextRequest) {
  const me = await getCurrentCustomer();
  if (!me?.email) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Body phải là JSON", 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return fail("INVALID_BODY", "Mật khẩu không hợp lệ", 422, parsed.error.flatten());
  }

  if (parsed.data.current_password === parsed.data.new_password) {
    return fail("SAME_PASSWORD", "Mật khẩu mới phải khác mật khẩu hiện tại", 400);
  }

  const supabase = await createClient();
  // Verify current password bằng cách sign-in (dùng anon client)
  const { createClient: createBrowserClient } = await import("@supabase/supabase-js");
  const { env } = await import("@/lib/env");
  const anon = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { error: signErr } = await anon.auth.signInWithPassword({
    email: me.email,
    password: parsed.data.current_password,
  });
  if (signErr) {
    return fail("INVALID_PASSWORD", "Mật khẩu hiện tại không đúng", 400);
  }

  // Update password on the real (cookie-aware) client
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) {
    if (isAuthError(error)) {
      return fail(error.code ?? "UPDATE_FAILED", error.message, 400);
    }
    return fail("UPDATE_FAILED", (error as { message?: string }).message ?? "Đổi mật khẩu thất bại", 500);
  }

  return ok({ ok: true });
}
