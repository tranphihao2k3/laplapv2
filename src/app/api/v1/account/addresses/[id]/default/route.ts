/**
 * POST /api/v1/account/addresses/[id]/default
 *   Đặt địa chỉ làm mặc định (unset các default cũ).
 */
import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);
  const { id } = await ctx.params;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const now = new Date().toISOString();

  // Unset các default cũ
  await db
    .from("customer_addresses")
    .update({ is_default: false, updated_at: now })
    .eq("customer_id", me.customerId)
    .eq("is_default", true);

  // Set địa chỉ này làm default
  const { data, error } = await db
    .from("customer_addresses")
    .update({ is_default: true, updated_at: now })
    .eq("id", id)
    .eq("customer_id", me.customerId)
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ item: data });
}
