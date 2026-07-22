import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { transferSchema } from "@/lib/validators/inventory";
import { inventoryActionsService } from "@/server/services";

export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("inventory.transfer");
    const supabase = await createClient();
    const body = transferSchema.parse(await req.json());
    const data = await inventoryActionsService.transfer(supabase, body);
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "inventory_transfer",
      action: "action",
      afterData: data,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
