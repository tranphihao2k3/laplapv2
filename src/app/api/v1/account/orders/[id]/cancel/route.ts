/**
 * POST /api/v1/account/orders/[id]/cancel
 *   Customer-initiated cancel — chỉ cho phép khi status ∈ {draft, pending}
 *   và còn trong 24h kể từ khi tạo.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  reason: z.string().min(2).max(500).optional(),
});

const CANCELLABLE = new Set(["draft", "pending"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);
  const { id } = await ctx.params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return fail("INVALID_BODY", "Dữ liệu không hợp lệ", 422, parsed.error.flatten());
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Verify order belongs to current customer
  const { data: order, error: orderErr } = await db
    .from("orders")
    .select("id, status, customer_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (orderErr) return fail("DB_ERROR", orderErr.message, 500);
  if (!order) return fail("NOT_FOUND", "Không tìm thấy đơn hàng", 404);
  if (order.customer_id !== me.customerId) {
    return fail("FORBIDDEN", "Bạn không có quyền huỷ đơn này", 403);
  }

  if (!CANCELLABLE.has(order.status ?? "")) {
    return fail(
      "CANNOT_CANCEL",
      `Đơn đang ở trạng thái "${order.status}" — không thể tự huỷ. Liên hệ CSKH nếu cần.`,
      400,
    );
  }

  const ageMs = Date.now() - new Date(order.created_at).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) {
    return fail(
      "CANCEL_WINDOW_CLOSED",
      "Đã quá thời hạn 24h để tự huỷ. Liên hệ CSKH.",
      400,
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("orders")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", id)
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);

  // Log status change
  await db.from("order_status_logs").insert({
    order_id: id,
    status: "cancelled",
    note: parsed.data.reason
      ? `Khách tự huỷ: ${parsed.data.reason}`
      : "Khách tự huỷ đơn",
    actor: "customer",
  });

  return ok({ order: data });
}
