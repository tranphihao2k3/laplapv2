import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { returnsService } from "@/server/services";
import { returnOrderApproveSchema } from "@/lib/validators/sales";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("returns.approve");
    const supabase = await createClient();
    const { id } = await ctx.params;
    const body = returnOrderApproveSchema.parse(await req.json().catch(() => ({})));
    const data = await returnsService.approve(supabase, id, body.warehouse_id);
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "return_orders",
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
