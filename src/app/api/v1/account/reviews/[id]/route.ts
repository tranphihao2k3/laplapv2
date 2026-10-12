/**
 * PATCH  /api/v1/account/reviews/[id]
 *   Sửa review của chính customer.
 *
 * DELETE /api/v1/account/reviews/[id]
 *   Xoá review.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);
  const { id } = await ctx.params;

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
  const { data, error } = await db
    .from("product_reviews")
    .update({
      ...parsed.data,
      // Sau khi sửa → quay lại trạng thái chờ duyệt
      status: "pending",
    })
    .eq("id", id)
    .eq("customer_id", me.customerId)
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Không tìm thấy đánh giá", 404);
  return ok({ item: data });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);
  const { id } = await ctx.params;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db
    .from("product_reviews")
    .delete()
    .eq("id", id)
    .eq("customer_id", me.customerId);

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ ok: true });
}
