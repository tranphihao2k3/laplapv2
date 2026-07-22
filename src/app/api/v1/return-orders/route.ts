/**
 * Return orders collection.
 * POST không dùng factory vì cần gọi RPC create_return_order (atomic insert + items + stock).
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, requirePermission, requireUser } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { returnOrderCreateSchema } from "@/lib/validators/sales";
import { returnsService, returnOrdersService } from "@/server/services";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("returns.read");
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    const data = await returnOrdersService.list(supabase, {
      search: sp.get("search") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
      sort: sp.get("sort") ?? undefined,
      filters: Object.fromEntries(
        [...sp.entries()].filter(([k]) => !["search", "page", "pageSize", "sort"].includes(k)),
      ),
    });
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("returns.create");
    const supabase = await createClient();
    const body = returnOrderCreateSchema.parse(await req.json());
    const data = await returnsService.create(supabase, body);
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "return_orders",
      entityId: String((data as { id?: string })?.id ?? ""),
      action: "create",
      afterData: data,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return ok(data, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
