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
import { parseDeviceName } from "@/lib/warranties/quick-warranty";

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
      id, serial_number_id, customer_id, order_id, repair_ticket_id, warranty_type, note,
      device_name,
      start_date, end_date, status,
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
    const warrantyType = sp.get("warranty_type");
    if (warrantyType) q = q.eq("warranty_type", warrantyType);

    // Search server-side trên device_name + serial + khách + order_number
    if (search) {
      const needle = `%${search.replace(/[%_]/g, "")}%`;
      q = q.or(
        [
          `device_name.ilike.${needle}`,
          `customer.full_name.ilike.${needle}`,
          `customer.phone.ilike.${needle}`,
          `order.order_number.ilike.${needle}`,
          `serial.serial.ilike.${needle}`,
          `serial.imei.ilike.${needle}`,
        ].join(","),
      );
    }

    q = q.order("start_date", { ascending: false }).range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    let items = (data ?? []) as Record<string, unknown>[];
    // Bảo hành tạo nhanh (máy không có trong catalog) lưu tên máy trong `note`
    // theo quy ước "Thiết bị: <tên>" → expose ra field `device_name` cho UI hiển thị
    // (nếu device_name column rỗng, fallback parse từ note).
    items = items.map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any;
      const deviceName =
        (r?.device_name as string | null) ?? parseDeviceName(r?.note ?? null);
      return { ...r, device_name: deviceName };
    });

    return ok(paginated(items, count ?? items.length, page, pageSize));
  } catch (e) {
    return handleError(e);
  }
}
