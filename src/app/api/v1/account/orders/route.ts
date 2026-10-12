/**
 * GET /api/v1/account/orders
 *   List orders của customer hiện tại. RLS sẽ tự lọc.
 *   Query: ?status=pending&q=ORD123&page=1&pageSize=20
 */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim();
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize") ?? 20)));

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  let query = db
    .from("orders")
    .select(
      "id, order_number, status, payment_status, fulfillment_status, channel, subtotal, discount_amount, total_amount, created_at, note",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("order_number", `%${q}%`);

  const { data, count, error } = await query;
  if (error) return fail("DB_ERROR", error.message, 500);

  return ok({
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  });
}
