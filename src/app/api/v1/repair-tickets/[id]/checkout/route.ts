import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { repairCheckoutSchema } from "@/lib/validators/sales";
import { repairCheckoutService } from "@/server/services";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("orders.create");
    const supabase = await createClient();
    const { id } = await ctx.params;

    // Body tùy chọn: nút trong trang repair có thể gọi không kèm payment.
    let raw: unknown = {};
    try {
      raw = await req.json();
    } catch {
      raw = {};
    }
    const parsed = repairCheckoutSchema.partial().parse(raw ?? {});

    const result = await repairCheckoutService.checkout(supabase, {
      ticketId: id,
      userId: user.id,
      orgId,
      payment: parsed.payment ?? { method: "cash", amount: 0 },
      actual_cost: parsed.actual_cost,
      note: parsed.note ?? null,
    });

    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "repair_tickets",
      entityId: id,
      action: "action",
      afterData: { order_id: result.order_id, status: "delivered" },
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    return ok(result, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
