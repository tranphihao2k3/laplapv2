import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { serialBulkSchema } from "@/lib/validators/catalog";

export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("serial_numbers.bulk_create");
    const supabase = await createClient();
    const body = serialBulkSchema.parse(await req.json());
    const rows = body.items.map((it) => ({
      product_variant_id: body.product_variant_id,
      warehouse_id: body.warehouse_id,
      serial: it.serial ?? null,
      imei: it.imei ?? null,
      status: "in_stock" as const,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("serial_numbers") as any).insert(rows).select();
    if (error) throw error;
    const payload = { inserted: data?.length ?? 0, items: data };
    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "serial_numbers",
      action: "action",
      afterData: payload,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
    return ok(payload, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
