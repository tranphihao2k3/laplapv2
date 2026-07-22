import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { receivePoSchema } from "@/lib/validators/inventory";
import { inventoryActionsService } from "@/server/services";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("purchase_orders.receive");
    const supabase = await createClient();
    const { id } = await ctx.params;
    const body = receivePoSchema.parse(await req.json().catch(() => ({})));
    const data = await inventoryActionsService.receivePurchaseOrder(supabase, id, body.serials);
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "purchase_orders",
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
