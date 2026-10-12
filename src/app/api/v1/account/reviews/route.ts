/**
 * GET  /api/v1/account/reviews
 *   List review của customer hiện tại + review đã duyệt.
 *
 * POST /api/v1/account/reviews
 *   Body: { product_id, rating, comment? }
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  product_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope") ?? "mine";

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  let query = db
    .from("product_reviews")
    .select(
      "id, product_id, rating, comment, status, created_at, product:products(id, name, slug, thumbnail_url)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (scope === "mine") {
    query = query.eq("customer_id", me.customerId);
  }

  const { data, error } = await query;
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

  // Lấy tên từ customers để hiển thị khi approved
  const { data: customer } = await db
    .from("customers")
    .select("full_name")
    .eq("id", me.customerId)
    .maybeSingle();

  const { data, error } = await db
    .from("product_reviews")
    .insert({
      customer_id: me.customerId,
      product_id: parsed.data.product_id,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
      user_name: customer?.full_name ?? null,
      status: "pending",
    })
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok(
    { item: data, message: "Đánh giá sẽ hiển thị sau khi CSKH duyệt" },
    { status: 201 },
  );
}
