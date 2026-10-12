/**
 * PATCH  /api/v1/account/addresses/[id] — update address
 * DELETE /api/v1/account/addresses/[id] — delete address
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PatchBody = z.object({
  label: z.string().max(50).optional().nullable(),
  recipient_name: z.string().min(2).max(120).optional(),
  phone: z.string().min(8).max(20).optional(),
  province: z.string().max(80).optional().nullable(),
  district: z.string().max(80).optional().nullable(),
  ward: z.string().max(80).optional().nullable(),
  street: z.string().min(3).max(255).optional(),
  is_default: z.boolean().optional(),
  note: z.string().max(255).optional().nullable(),
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
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return fail("INVALID_BODY", "Dữ liệu không hợp lệ", 422, parsed.error.flatten());
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  if (parsed.data.is_default) {
    await db
      .from("customer_addresses")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("customer_id", me.customerId)
      .eq("is_default", true)
      .neq("id", id);
  }

  const { data, error } = await db
    .from("customer_addresses")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("customer_id", me.customerId)
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
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

  // Không cho xoá địa chỉ mặc định nếu còn địa chỉ khác
  const { data: addr } = await db
    .from("customer_addresses")
    .select("is_default")
    .eq("id", id)
    .single();

  if (addr?.is_default) {
    const { count } = await db
      .from("customer_addresses")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", me.customerId)
      .neq("id", id);
    if ((count ?? 0) > 0) {
      return fail(
        "DEFAULT_PROTECTED",
        "Vui lòng đặt địa chỉ khác làm mặc định trước khi xoá.",
        400,
      );
    }
  }

  const { error } = await db
    .from("customer_addresses")
    .delete()
    .eq("id", id)
    .eq("customer_id", me.customerId);

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ ok: true });
}
