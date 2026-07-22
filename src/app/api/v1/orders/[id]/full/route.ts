/**
 * GET /v1/orders/[id]/full — trả về toàn bộ thông tin cần cho trang chi tiết đơn:
 * order + items (kèm product info) + payments + status logs + customer + shop.
 * Gom vào 1 request để giảm round-trip cho UI.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    await requirePermission("orders.read").catch(() => {});
    const supabase = await createClient();
    const { id } = await ctx.params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const [orderRes, itemsRes, paymentsRes, logsRes, returnsRes] = await Promise.all([
      db.from("orders").select("*").eq("id", id).single(),
      db
        .from("order_items")
        .select(
          "id, order_id, product_variant_id, quantity, unit_price, total_price, product_snapshot, product_variant:product_variants(id, sku, name, product:products(id, name, slug, thumbnail_url))",
        )
        .eq("order_id", id),
      db.from("payments").select("*").eq("order_id", id).order("paid_at", { ascending: false }),
      db
        .from("order_status_logs")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: false }),
      db.from("return_orders").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    ]);

    if (orderRes.error) throw orderRes.error;
    const order = orderRes.data;
    if (!order) {
      return ok({ order: null });
    }

    // Customer + shop nếu có
    let customer = null;
    let shop = null;
    if (order.customer_id) {
      const c = await db
        .from("customers")
        .select("id, full_name, phone, email, tier")
        .eq("id", order.customer_id)
        .maybeSingle();
      customer = c.data ?? null;
    }
    if (order.shop_id) {
      const s = await db
        .from("shops")
        .select("id, name, code, phone, address")
        .eq("id", order.shop_id)
        .maybeSingle();
      shop = s.data ?? null;
    }

    return ok({
      order,
      items: itemsRes.data ?? [],
      payments: paymentsRes.data ?? [],
      status_logs: logsRes.data ?? [],
      returns: returnsRes.data ?? [],
      customer,
      shop,
    });
  } catch (e) {
    return handleError(e);
  }
}
