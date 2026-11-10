import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireOrg } from "@/lib/api/guard";
import { ok, handleError, fail } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";
import { checkoutSchema } from "@/lib/validators/sales";
import { checkoutService } from "@/server/services";
import { giftStockService } from "@/server/services/gift-stock-service";
import { checkoutWarrantyService } from "@/server/services/checkout-warranty-service";

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

    // Kiểm tra tồn kho - chỉ bán trong phạm vi tồn của cửa hàng đang chọn
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

    // Trừ tồn quà tặng kèm (RPC chỉ trừ máy chính)
    const orderId = String((data as { order_id?: string })?.order_id ?? "");
    let giftDeduct: Awaited<ReturnType<typeof giftStockService.deductForSoldItems>> | null =
      null;
    if (orderId) {
      try {
        giftDeduct = await giftStockService.deductForSoldItems(supabase, {
          shopId: body.shop_id,
          orderId,
          userId: user.id,
          orgId,
          items: body.items.map((i) => ({
            product_variant_id: i.product_variant_id,
            quantity: i.quantity,
          })),
        });
      } catch (giftErr) {
        console.warn("[checkout] trừ tồn quà tặng thất bại:", giftErr);
      }
    }

    // Đồng bộ bảo hành: tạo/cập nhật warranty cho các dòng có chỉ định
    // warranty_months / warranty_end_date (giống luồng "Tạo nhanh bảo hành").
    let warrantySync: { created: number; updated: number; skipped: number; errors: string[] } | null = null;
    if (orderId) {
      try {
        const orderRow = await supabase
          .from("orders")
          .select("created_at, customer_id")
          .eq("id", orderId)
          .maybeSingle();
        const orderCreatedAt = (orderRow.data?.created_at as string) ?? new Date().toISOString();
        const orderCustomerId = (orderRow.data?.customer_id as string | null) ?? body.customer_id ?? null;

        warrantySync = await checkoutWarrantyService.sync({
          db: supabase,
          orderId,
          orderCreatedAt,
          customerId: orderCustomerId,
          items: body.items.map((i) => ({
            product_variant_id: i.product_variant_id,
            serial_id: i.serial_id ?? null,
            warranty_months: i.warranty_months ?? null,
            warranty_end_date: i.warranty_end_date ?? null,
          })),
          warrantyStart: body.warranty_start ?? null,
        });
      } catch (wErr) {
        console.warn("[checkout] đồng bộ bảo hành thất bại:", wErr);
      }
    }

    const payload = {
      ...(data as object),
      gift_deductions: giftDeduct?.deducted ?? [],
      gift_warnings: giftDeduct?.warnings ?? [],
      warranty_sync: warrantySync,
    };

    await writeAuditLog({
      supabase,
      userId: user.id,
      organizationId: orgId,
      entityType: "orders",
      entityId: orderId,
      action: "action",
      afterData: payload,
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    return ok(payload, { status: 201 });
  } catch (e) {
    const err = e as { code?: string; message?: string; details?: unknown };
    if (err?.code === "INSUFFICIENT_STOCK") {
      return fail("INSUFFICIENT_STOCK", err.message ?? "Không đủ tồn kho", 409, err.details);
    }
    return handleError(e);
  }
}