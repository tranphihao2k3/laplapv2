/**
 * GET /api/v1/account/vouchers
 *   List voucher user có thể dùng + voucher đã claim + đã dùng.
 *   - vouchers table: active public vouchers
 *   - voucher_claims table: của customer này
 */
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const now = new Date().toISOString();

  // Lấy claims trước
  const { data: claims } = await db
    .from("voucher_claims")
    .select(
      "id, voucher_id, claimed_at, used_at, order_id, voucher:vouchers(id, code, name, type, value, min_order_amount, max_discount_amount, start_date, end_date, quantity_total, quantity_used, description, is_active)",
    )
    .eq("customer_id", me.customerId)
    .order("claimed_at", { ascending: false });

  // Lấy vouchers active public mà chưa claim
  const { data: publicActive } = await db
    .from("vouchers")
    .select("id, code, name, type, value, min_order_amount, max_discount_amount, start_date, end_date, quantity_total, quantity_used, description, is_active")
    .eq("is_active", true)
    .lte("start_date", now)
    .gte("end_date", now)
    .order("end_date", { ascending: true });

  const claimedIds = new Set((claims ?? []).map((c: { voucher_id: string }) => c.voucher_id));
  const available = (publicActive ?? []).filter(
    (v: { id: string }) => !claimedIds.has(v.id),
  );

  return ok({
    available,
    claimed: claims ?? [],
  });
}
