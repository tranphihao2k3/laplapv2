/**
 * POST /v1/products/ensure-combo-gifts
 * Tạo nhanh 4 SP quà combo (Chuột, Lót chuột, Balo, Túi chống sốc) + tồn kho.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePermissionFromRequest } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { comboGiftsService } from "@/server/services/combo-gifts-service";
import { DEFAULT_COMBO_GIFT_STOCK } from "@/lib/products/combo-gifts";

const bodySchema = z.object({
  stock_qty: z.number().int().min(0).max(1_000_000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { supabase, user, orgId } = await requirePermissionFromRequest(
      req,
      "products.create",
    );

    const raw = await req.json().catch(() => ({}));
    const body = bodySchema.parse(raw ?? {});
    const stockQty = body.stock_qty ?? DEFAULT_COMBO_GIFT_STOCK;

    const result = await comboGiftsService.ensure(supabase, orgId, stockQty);

    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "products",
      entityId: "",
      action: "create",
      afterData: { mode: "ensure-combo-gifts", ...result },
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    return ok(result, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
