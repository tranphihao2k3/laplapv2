/**
 * GET /api/v1/account/warranties
 *   List warranties gắn với orders của customer hiện tại.
 *   RLS sẽ tự lọc; query join orders + serials + product.
 */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { getCurrentCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const me = await getCurrentCustomer();
  if (!me?.customerId) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data, error } = await db
    .from("warranties")
    .select(
      "id, serial_number, product_name, product_sku, order_number, purchase_date, warranty_start, warranty_end, warranty_months, status, note, order_id",
    )
    .order("warranty_end", { ascending: false });

  if (error) return fail("DB_ERROR", error.message, 500);

  // Compute days_left cho từng warranty
  const items = (data ?? []).map(
    (w: { warranty_end: string; status: string }) => {
      const days = Math.ceil(
        (new Date(w.warranty_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      let derivedStatus: "active" | "expiring" | "expired" | "voided" | "claimed" =
        "active";
      if (w.status === "voided") derivedStatus = "voided";
      else if (w.status === "claimed") derivedStatus = "claimed";
      else if (days < 0) derivedStatus = "expired";
      else if (days <= 30) derivedStatus = "expiring";
      return { ...w, days_left: days, derived_status: derivedStatus };
    },
  );

  return ok({ items });
}
