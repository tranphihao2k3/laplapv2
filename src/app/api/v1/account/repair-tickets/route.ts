/**
 * GET  /api/v1/account/repair-tickets
 *   List phiếu sửa của customer hiện tại.
 *
 * POST /api/v1/account/repair-tickets
 *   Body: { device_name, issue_description, condition_description?, serial_number?, images? }
 *   Tạo phiếu sửa mới với status="open".
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  device_name: z.string().min(2).max(255),
  issue_description: z.string().min(10).max(2000),
  condition_description: z.string().max(2000).optional().nullable(),
  serial_number: z.string().max(120).optional().nullable(),
  images: z.array(z.string().url()).max(10).optional(),
});

function randomTicketCode(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`;
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RMA-${ymd}-${r}`;
}

export async function GET() {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("repair_tickets")
    .select(
      "id, ticket_code, device_name, issue_description, serial_number, status, created_at, completed_at, delivered_at, estimated_cost, actual_cost, shop:shops(id, name)",
    )
    .eq("customer_id", me.customerId)
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

  const { data, error } = await db
    .from("repair_tickets")
    .insert({
      customer_id: me.customerId,
      ticket_code: randomTicketCode(),
      device_name: parsed.data.device_name,
      issue_description: parsed.data.issue_description,
      condition_description: parsed.data.condition_description || null,
      serial_number: parsed.data.serial_number || null,
      images: parsed.data.images || null,
      status: "open",
    })
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ item: data }, { status: 201 });
}
