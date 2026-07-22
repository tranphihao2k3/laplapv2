import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("customers.read");
    
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    
    const search = sp.get("search") || "";
    const page = parseInt(sp.get("page") || "1");
    const pageSize = parseInt(sp.get("pageSize") || "20");
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("customers")
      .select("id, full_name, phone, email, tier, loyalty_points", { count: "exact" });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    query = query.order("loyalty_points", { ascending: false, nullsFirst: false })
      .range(from, to);

    const { data, error, count } = await query;

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
