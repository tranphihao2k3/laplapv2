import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { stockLevelAdjustSchema } from "@/lib/validators/inventory";

export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("stock_levels.update");
    const supabase = await createClient();
    const body = stockLevelAdjustSchema.parse(await req.json());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("stock_levels") as any)
      .upsert(
        {
          warehouse_id: body.warehouse_id,
          product_variant_id: body.product_variant_id,
          available_qty: body.available_qty,
        },
        { onConflict: "warehouse_id,product_variant_id" },
      )
      .select()
      .single();

    if (error) throw error;

    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "stock_levels",
      action: "update",
      afterData: data,
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
