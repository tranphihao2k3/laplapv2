/**
 * GET /api/v1/admin/newsletter/outbox
 *
 * Admin xem hang doi email (pending/sent/failed) + search theo product.
 */
import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/response";
import { requirePermission } from "@/lib/api/guard";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("newsletter.read");

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status"); // 'pending' | 'sent' | 'failed' | 'sending'
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 30)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = createSupabaseServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("newsletter_outbox") as any)
      .select("id, product_id, product_name, product_slug, product_brand_name, product_price, status, attempts, last_error, scheduled_at, sent_at, created_at", { count: "exact" })
      .order("scheduled_at", { ascending: false })
      .range(from, to);

    if (status) q = q.eq("status", status);

    const { data, count, error } = await q;
    if (error) throw error;

    return ok({
      items: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    });
  } catch (e) {
    return handleError(e);
  }
}