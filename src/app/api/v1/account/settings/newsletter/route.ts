/**
 * GET  /api/v1/account/settings/newsletter
 *   Trả về trạng thái newsletter của user (dựa theo email auth).
 *
 * POST /api/v1/account/settings/newsletter
 *   Body: { subscribed: boolean, brandIds?: string[] }
 *   Bật/tắt đăng ký nhận tin.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  subscribed: z.boolean(),
  brandIds: z.array(z.string().uuid()).max(50).optional(),
});

function randomToken(n = 32): string {
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export async function GET() {
  const me = await getCurrentCustomer();
  if (!me?.email) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data } = await db
    .from("newsletter_subscribers")
    .select("id, is_active, confirmed, brand_ids")
    .eq("email", me.email.toLowerCase())
    .maybeSingle();

  return ok({
    subscribed: !!(data?.is_active && data?.confirmed),
    confirmed: !!data?.confirmed,
    brandIds: data?.brand_ids ?? [],
  });
}

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
    return fail("INVALID_BODY", "Dữ liệu không hợp lệ", 422, parsed.error.flatten());
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const email = me.email.toLowerCase();
  const now = new Date().toISOString();

  if (parsed.data.subscribed) {
    // Subscribe (hoặc re-subscribe): upsert với is_active=true
    const { data, error } = await db
      .from("newsletter_subscribers")
      .upsert(
        {
          email,
          brand_ids: parsed.data.brandIds ?? [],
          is_active: true,
          confirmed: true, // authenticated user → auto-confirm
          confirm_token: null,
          unsubscribed_at: null,
          updated_at: now,
        },
        { onConflict: "email" },
      )
      .select()
      .single();
    if (error) return fail("DB_ERROR", error.message, 500);
    return ok({ item: data });
  } else {
    // Unsubscribe
    const { error } = await db
      .from("newsletter_subscribers")
      .update({ is_active: false, unsubscribed_at: now, updated_at: now })
      .eq("email", email);
    if (error) return fail("DB_ERROR", error.message, 500);
    return ok({ ok: true });
  }
}
