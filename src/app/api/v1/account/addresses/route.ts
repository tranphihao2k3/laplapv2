/**
 * GET  /api/v1/account/addresses       — list customer's addresses
 * POST /api/v1/account/addresses       — create new address
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  label: z.string().max(50).optional().nullable(),
  recipient_name: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  province: z.string().max(80).optional().nullable(),
  district: z.string().max(80).optional().nullable(),
  ward: z.string().max(80).optional().nullable(),
  street: z.string().min(3).max(255),
  is_default: z.boolean().optional(),
  note: z.string().max(255).optional().nullable(),
});

export async function GET() {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", me.customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ items: data ?? [] });
}

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
  if (!parsed.success) {
    return fail("INVALID_BODY", "Dữ liệu không hợp lệ", 422, parsed.error.flatten());
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Nếu set is_default → unset các default cũ trước
  if (parsed.data.is_default) {
    await db
      .from("customer_addresses")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("customer_id", me.customerId)
      .eq("is_default", true);
  }

  const insertPayload: Record<string, unknown> = {
    customer_id: me.customerId,
    label: parsed.data.label || null,
    recipient_name: parsed.data.recipient_name,
    phone: parsed.data.phone,
    province: parsed.data.province || null,
    district: parsed.data.district || null,
    ward: parsed.data.ward || null,
    street: parsed.data.street,
    is_default: parsed.data.is_default ?? false,
    note: parsed.data.note || null,
  };

  const { data, error } = await db
    .from("customer_addresses")
    .insert(insertPayload)
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ item: data }, { status: 201 });
}
