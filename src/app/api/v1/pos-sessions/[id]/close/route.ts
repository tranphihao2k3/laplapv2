import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { posSessionActionsService } from "@/server/services";
import { posSessionCloseSchema } from "@/lib/validators/sales";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("pos.close_session");
    const supabase = await createClient();
    const { id } = await ctx.params;
    const body = posSessionCloseSchema.parse(await req.json());
    const data = await posSessionActionsService.close(supabase, id, body.closing_cash);
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "pos_sessions",
      entityId: id,
      action: "action",
      afterData: data,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
