import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError, fail } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { checkoutSchema } from "@/lib/validators/sales";
import { checkoutService } from "@/server/services";

export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await requireOrg();
    await requirePermission("orders.create");
    const supabase = await createClient();
    const body = checkoutSchema.parse(await req.json());

    // Shop's warehouse(s)
    const { data: warehouses } = await supabase
      .from("warehouses")
      .select("id, name, type")
      .eq("shop_id", body.shop_id)
      .eq("is_active", true);

    const shopWarehouses = (warehouses ?? []) as Array<{ id: string; name: string | null; type: string | null }>;
    if (shopWarehouses.length === 0) {
      return fail("NO_WAREHOUSE", "Cửa hàng chưa có kho. Vui lòng liên hệ quản trị.", 400);
    }

    const shopWarehouseIds = shopWarehouses.map((w) => w.id);

    // Kiểm tra tồn kho — chỉ bán trong phạm vi tồn của cửa hàng đang chọn
    for (const item of body.items) {
      const qty_needed = item.quantity;

      const { data: shopStocks } = await supabase
        .from("stock_levels")
        .select("warehouse_id, available_qty")
        .eq("product_variant_id", item.product_variant_id)
        .in("warehouse_id", shopWarehouseIds);

      const stockRows = (shopStocks ?? []) as Array<{ warehouse_id: string; available_qty: number | null }>;
      const shopAvailable = stockRows.reduce((sum, s) => sum + (s.available_qty ?? 0), 0);
      if (shopAvailable < qty_needed) {
        return fail(
          "INSUFFICIENT_STOCK",
          `Không đủ tồn kho tại cửa hàng: variant=${item.product_variant_id} qty=${qty_needed} have=${shopAvailable}`,
          409,
          { variant_id: item.product_variant_id, requested_qty: qty_needed, available_qty: shopAvailable },
        );
      }
    }

    // Gọi RPC checkout
    const data = await checkoutService.checkout(supabase, body);

    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "orders",
      entityId: String((data as { order_id?: string })?.order_id ?? ""),
      action: "action",
      afterData: data,
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    return ok(data, { status: 201 });
  } catch (e) {
    const err = e as { code?: string; message?: string; details?: unknown };
    if (err?.code === "INSUFFICIENT_STOCK") {
      return fail("INSUFFICIENT_STOCK", err.message ?? "Không đủ tồn kho", 409, err.details);
    }
    return handleError(e);
  }
}
