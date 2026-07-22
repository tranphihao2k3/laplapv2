import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { orderStatusService } from "@/server/services";
import { orderStatusChangeSchema } from "@/lib/validators/sales";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("orders.update").catch(() => {});
    const supabase = await createClient();
    const { id } = await ctx.params;
    const body = orderStatusChangeSchema.parse(await req.json());
    const data = await orderStatusService.change(supabase, id, body);
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "orders",
      entityId: id,
      action: "update",
      afterData: data,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
