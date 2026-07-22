import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

// Read-only view. Filter qua ?warehouse_id=&product_variant_id=
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("stock_levels.read");
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    let q = supabase.from("stock_levels").select("*", { count: "exact" });
    const w = sp.get("warehouse_id");
    const v = sp.get("product_variant_id");
    if (w) q = q.eq("warehouse_id", w);
    if (v) q = q.eq("product_variant_id", v);
    const { data, error, count } = await q.limit(200);
    if (error) throw error;
    return ok({ items: data ?? [], total: count ?? 0 });
  } catch (e) {
    return handleError(e);
  }
}
