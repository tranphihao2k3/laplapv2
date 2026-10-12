/**
 * GET  /api/v1/account/notifications
 *   List thông báo của customer (mới nhất trước).
 *
 * PATCH /api/v1/account/notifications
 *   Body: { ids: string[] } — mark as read
 *   Hoặc: { mark_all: true }
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ mark_all: z.literal(true) }),
]);

export async function GET() {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("notifications")
    .select("id, type, title, body, href, is_read, read_at, created_at, data")
    .eq("customer_id", me.customerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ items: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Body phải là JSON", 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return fail("INVALID_BODY", "Dữ liệu không hợp lệ", 422);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const now = new Date().toISOString();

  if ("mark_all" in parsed.data) {
    await db
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("customer_id", me.customerId)
      .eq("is_read", false);
    return ok({ ok: true });
  }

  await db
    .from("notifications")
    .update({ is_read: true, read_at: now })
    .eq("customer_id", me.customerId)
    .in("id", parsed.data.ids);
  return ok({ ok: true });
}
