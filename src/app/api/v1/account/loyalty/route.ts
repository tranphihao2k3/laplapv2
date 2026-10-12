/**
 * GET /api/v1/account/loyalty
 *   Tóm tắt: points + tier + 30 giao dịch gần nhất.
 */
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("loyalty_transactions")
    .select("id, points, type, order_id, created_at, order:orders(id, order_number)")
    .eq("customer_id", me.customerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({
    points: me.customer?.loyaltyPoints ?? 0,
    tier: me.customer?.tier ?? "bronze",
    transactions: data ?? [],
  });
}
