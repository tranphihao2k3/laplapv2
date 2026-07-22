/**
 * GET /v1/warranties: list có embed serial_number, customer, order, product_variant + product
 *   → trả về cấu trúc giàu thông tin để trang /quanly/warranties render đầy đủ:
 *     tên sản phẩm, serial, khách hàng, ngày mua (start_date), ngày hết bảo hành
 *     (end_date), tổng số tháng, số ngày còn lại.
 * POST /v1/warranties: dùng lại factory chung (tạo mới thủ công khi cần).
 */
import { NextRequest } from "next/server";
import { warrantiesService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { warrantyCreateSchema } from "@/lib/validators/after-sale";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission } from "@/lib/api/guard";
import { ok, handleError, paginated, rangeOf } from "@/lib/api/response";

const factory = makeCollectionHandlers({
  crud: warrantiesService,
  createSchema: warrantyCreateSchema,
  permissions: { read: "warranties.read", create: "warranties.create" },
});

export const POST = factory.POST;

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("warranties.read");
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 20)));
    const search = (sp.get("search") ?? "").trim();
    const status = sp.get("status");
    const { from, to } = rangeOf(page, pageSize);

    // Supabase nested select: lấy customer, order, serial_number + product_variant + product
    const selectExpr = `
      id, serial_number_id, customer_id, order_id, start_date, end_date, status,
      customer:customers ( id, full_name, phone ),
      order:orders (
        id, order_number, created_at, total_amount,
        order_items (
          id, quantity, unit_price,
          product_variant:product_variants ( id, sku, name,
            product:products ( id, name )
          )
        )
      ),
      serial:serial_numbers (
        id, serial, imei,
        product_variant:product_variants ( id, sku, name,
          product:products ( id, name )
        )
      )
    `.replace(/\s+/g, " ");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (supabase as any).from("warranties").select(selectExpr, { count: "exact" });

    if (status) q = q.eq("status", status);
    q = q.order("start_date", { ascending: false }).range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    // Search client-side trong page hiện tại (không có cột text dễ search trong warranties)
    let items = (data ?? []) as Record<string, unknown>[];
    if (search) {
      const needle = search.toLowerCase();
      items = items.filter((row) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any;
        const orderItems: any[] = Array.isArray(r?.order?.order_items) ? r.order.order_items : [];
        const productNamesFromOrder = orderItems
          .map((oi) =>
            [oi?.product_variant?.product?.name, oi?.product_variant?.name].filter(Boolean).join(" "),
          )
          .join(" ")
          .toLowerCase();
        return (
          String(r?.customer?.full_name ?? "").toLowerCase().includes(needle) ||
          String(r?.customer?.phone ?? "").toLowerCase().includes(needle) ||
          String(r?.order?.order_number ?? "").toLowerCase().includes(needle) ||
          String(r?.serial?.product_variant?.name ?? "").toLowerCase().includes(needle) ||
          String(r?.serial?.product_variant?.product?.name ?? "").toLowerCase().includes(needle) ||
          productNamesFromOrder.includes(needle)
        );
      });
    }

    return ok(paginated(items, count ?? items.length, page, pageSize));
  } catch (e) {
    return handleError(e);
  }
}
