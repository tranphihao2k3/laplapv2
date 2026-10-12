/**
 * POST /api/v1/account/orders/[id]/reorder
 *   Trả về danh sách items có thể mua lại (còn tồn kho + chưa ngừng bán).
 *   Client sẽ add vào cart-store.
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

  const { data: order } = await db
    .from("orders")
    .select("id, customer_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!order) return fail("NOT_FOUND", "Không tìm thấy đơn hàng", 404);
  if (order.customer_id !== me.customerId) {
    return fail("FORBIDDEN", "Bạn không có quyền", 403);
  }

  const { data: items } = await db
    .from("order_items")
    .select("id, product_variant_id, quantity, product_variant:product_variants(id, name, sku, price, is_active, product:products(id, name, slug, thumbnail_url, is_active))")
    .eq("order_id", id);

  if (!items) return ok({ items: [], addedCount: 0 });

  // Chỉ trả về items còn active
  const reorderable = items
    .filter((it: { product_variant: { is_active: boolean | null; product: { is_active: boolean | null } } | null }) => {
      const pv = it.product_variant;
      return pv?.is_active && pv.product?.is_active;
    })
    .map((it: {
      product_variant_id: string;
      quantity: number;
      product_variant: { name: string; price: number; product: { name: string; slug: string; thumbnail_url: string | null } };
    }) => ({
      variantId: it.product_variant_id,
      quantity: it.quantity,
      name: it.product_variant.product.name + (it.product_variant.name ? ` — ${it.product_variant.name}` : ""),
      slug: it.product_variant.product.slug,
      image: it.product_variant.product.thumbnail_url ?? null,
      price: it.product_variant.price,
    }));

  return ok({
    items: reorderable,
    skipped: items.length - reorderable.length,
  });
}
