/**
 * GET /api/v1/account/orders/[id]
 *   Order detail với items + status logs + payments + returns.
 *   RLS scope sẽ tự giới hạn vào order của customer hiện tại.
 */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);
  const { id } = await ctx.params;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [orderRes, itemsRes, paymentsRes, logsRes, returnsRes] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, order_number, status, payment_status, fulfillment_status, channel, subtotal, discount_amount, total_amount, note, created_at, customer_id, shop_id",
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("order_items")
      .select(
        "id, product_variant_id, quantity, unit_price, total_price, product_snapshot, product_variant:product_variants(id, sku, name, product:products(id, name, slug, thumbnail_url))",
      )
      .eq("order_id", id),
    db
      .from("payments")
      .select("id, amount, method, status, paid_at")
      .eq("order_id", id)
      .order("paid_at", { ascending: false }),
    db
      .from("order_status_logs")
      .select("id, status, note, created_at, actor")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("return_orders")
      .select("id, status, reason, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (orderRes.error) return fail("DB_ERROR", orderRes.error.message, 500);
  if (!orderRes.data) {
    return fail("NOT_FOUND", "Không tìm thấy đơn hàng", 404);
  }
  // RLS check double — bảo vệ trường hợp race condition
  if (orderRes.data.customer_id !== me.customerId) {
    return fail("FORBIDDEN", "Bạn không có quyền truy cập đơn này", 403);
  }

  return ok({
    order: orderRes.data,
    items: itemsRes.data ?? [],
    payments: paymentsRes.data ?? [],
    statusLogs: logsRes.data ?? [],
    returns: returnsRes.data ?? [],
  });
}
