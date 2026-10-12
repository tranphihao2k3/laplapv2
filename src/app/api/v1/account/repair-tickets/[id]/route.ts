/**
 * GET /api/v1/account/repair-tickets/[id]
 *   Chi tiết phiếu sửa của customer hiện tại.
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

  const { data, error } = await db
    .from("repair_tickets")
    .select(
      "id, ticket_code, device_name, issue_description, condition_description, serial_number, status, created_at, completed_at, delivered_at, estimated_cost, actual_cost, repair_solution, images, shop:shops(id, name, phone, address)",
    )
    .eq("id", id)
    .eq("customer_id", me.customerId)
    .maybeSingle();

  if (error) return fail("DB_ERROR", error.message, 500);
  if (!data) return fail("NOT_FOUND", "Không tìm thấy phiếu sửa", 404);
  return ok({ item: data });
}
