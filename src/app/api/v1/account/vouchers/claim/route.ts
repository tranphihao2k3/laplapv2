/**
 * POST /api/v1/account/vouchers/claim
 *   Body: { voucher_id }
 *   Customer claim voucher về kho của mình.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ voucher_id: z.string().uuid() });

export async function POST(req: NextRequest) {
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

  // Kiểm tra voucher còn hiệu lực
  const { data: v, error: vErr } = await db
    .from("vouchers")
    .select("id, is_active, start_at, end_at, total_quantity, used_quantity")
    .eq("id", parsed.data.voucher_id)
    .maybeSingle();
  if (vErr) return fail("DB_ERROR", vErr.message, 500);
  if (!v) return fail("NOT_FOUND", "Voucher không tồn tại", 404);
  if (!v.is_active) return fail("INACTIVE", "Voucher đã ngừng phát hành", 400);
  const now = new Date();
  if (now < new Date(v.start_at)) return fail("NOT_STARTED", "Voucher chưa mở", 400);
  if (now > new Date(v.end_at)) return fail("EXPIRED", "Voucher đã hết hạn", 400);
  if (v.total_quantity && v.used_quantity >= v.total_quantity) {
    return fail("SOLD_OUT", "Voucher đã hết lượt", 400);
  }

  const { data, error } = await db
    .from("voucher_claims")
    .insert({ customer_id: me.customerId, voucher_id: parsed.data.voucher_id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return fail("ALREADY_CLAIMED", "Bạn đã lưu voucher này rồi", 400);
    }
    return fail("DB_ERROR", error.message, 500);
  }
  return ok({ claim: data }, { status: 201 });
}
