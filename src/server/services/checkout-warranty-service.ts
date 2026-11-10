/**
 * Checkout warranty — tạo/cập nhật bảo hành cho sản phẩm bán qua POS checkout.
 *
 * Luồng: khi thanh toán xong (order + payment đã insert), service này kiểm tra
 * `checkout_payload.items[].warranty_months` / `warranty_end_date` và tạo warranty
 * tương ứng (1 warranty / 1 dòng sản phẩm), liên kết với order_id + serial_id
 * (nếu có).
 *
 * Quy tắc:
 *   - Ưu tiên `warranty_end_date` (ngày cụ thể) > `warranty_months` (N tháng).
 *   - Không truyền cả 2 → không tạo BH cho dòng đó.
 *   - `warranty_months = 0` → không tạo BH.
 *   - Tránh tạo trùng: nếu đã có warranty active cùng (order_id, serial_number_id)
 *     thì cập nhật end_date thay vì insert mới.
 *   - start_date = `warranty_start` (nếu có) hoặc order.created_at (ngày bán).
 */
import { addMonthsIso } from "@/lib/warranties/quick-warranty";

type ItemWarranty = {
  product_variant_id: string;
  serial_id?: string | null;
  warranty_months?: number | null;
  warranty_end_date?: string | null;
};

type Args = {
  db: any;
  orderId: string;
  orderCreatedAt: string;
  customerId: string | null;
  items: ItemWarranty[];
  warrantyStart?: string | null;
};

type Result = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

function resolveEndDate(start: string, months: number | null | undefined, explicit: string | null | undefined): string | null {
  if (explicit && /^\d{4}-\d{2}-\d{2}/.test(explicit)) return explicit.slice(0, 10);
  if (months && months > 0) return addMonthsIso(start.slice(0, 10), months);
  return null;
}

export const checkoutWarrantyService = {
  async sync(args: Args): Promise<Result> {
    const { db, orderId, orderCreatedAt, customerId, items, warrantyStart } = args;
    const result: Result = { created: 0, updated: 0, skipped: 0, errors: [] };

    const startDate = (warrantyStart && /^\d{4}-\d{2}-\d{2}/.test(warrantyStart))
      ? warrantyStart.slice(0, 10)
      : orderCreatedAt.slice(0, 10);

    for (const item of items) {
      try {
        const endDate = resolveEndDate(startDate, item.warranty_months, item.warranty_end_date);
        if (!endDate) {
          result.skipped++;
          continue;
        }

        // Kiểm tra đã có warranty active nào liên kết với order/serial này chưa
        let existingQuery = db
          .from("warranties")
          .select("id, end_date")
          .eq("order_id", orderId)
          .eq("warranty_type", "sold")
          .eq("status", "active");

        if (item.serial_id) {
          existingQuery = existingQuery.eq("serial_number_id", item.serial_id);
        } else {
          existingQuery = existingQuery.is("serial_number_id", null);
        }

        const { data: existing, error: findErr } = await existingQuery.limit(1);
        if (findErr) throw findErr;

        const row = {
          customer_id: customerId ?? null,
          serial_number_id: item.serial_id ?? null,
          order_id: orderId,
          warranty_type: "sold",
          start_date: startDate,
          end_date: endDate,
          status: "active",
        };

        if (existing && existing.length > 0) {
          const { error: upErr } = await db
            .from("warranties")
            .update({ end_date: endDate, customer_id: row.customer_id })
            .eq("id", existing[0].id);
          if (upErr) throw upErr;
          result.updated++;
        } else {
          const { error: insErr } = await db.from("warranties").insert(row);
          if (insErr) throw insErr;
          result.created++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Lỗi tạo bảo hành";
        result.errors.push(`${item.product_variant_id}: ${msg}`);
      }
    }

    return result;
  },
};