/**
 * GET /api/v1/admin/newsletter/subscribers
 *
 * Admin xem danh sach subscribers (co filter search + active/confirmed).
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
    const search = sp.get("search") ?? "";
    const status = sp.get("status"); // 'pending' | 'active' | 'unsubscribed' | undefined
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 30)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = createSupabaseServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("newsletter_subscribers") as any)
      .select("id, email, brand_ids, is_active, confirmed, confirmed_at, unsubscribed_at, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      q = q.ilike("email", `%${search.replace(/[%_]/g, "")}%`);
    }

    // Filter theo status:
    //   pending = chua confirm
    //   active = confirmed + is_active
    //   unsubscribed = !is_active
    if (status === "pending") q = q.eq("confirmed", false).eq("is_active", true);
    else if (status === "active") q = q.eq("confirmed", true).eq("is_active", true);
    else if (status === "unsubscribed") q = q.eq("is_active", false);

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