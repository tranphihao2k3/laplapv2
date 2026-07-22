import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { posSessionsService, posSessionActionsService } from "@/server/services";
import { posSessionOpenSchema } from "@/lib/validators/sales";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("pos_sessions.read");
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await posSessionsService.list(supabase as any, {
      page: sp.get("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
      filters: Object.fromEntries([...sp.entries()].filter(([k]) => !["page", "pageSize"].includes(k))),
    });
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await requireOrg();
    const supabase = await createClient();
    await requirePermission("pos.open_session");
    const body = posSessionOpenSchema.parse(await req.json());
    const data = await posSessionActionsService.open(supabase, user.id, body);
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "pos_sessions",
      entityId: String((data as { session_id?: string })?.session_id ?? ""),
      action: "action",
      afterData: data,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return ok(data, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
