import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { checkoutService } from "@/server/services";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("orders.cancel");
    const supabase = await createClient();
    const { id } = await ctx.params;
    const data = await checkoutService.cancel(supabase, id);
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "orders",
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
