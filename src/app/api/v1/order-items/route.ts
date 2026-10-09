/**
 * GET /v1/order-items — danh sách items kèm thông tin sản phẩm (join sẵn).
 *
 * Hỗ trợ filter:
 *   ?order_id=xxx              → item của 1 đơn
 *   ?order_id__in=id1,id2,id3  → items của nhiều đơn (dùng cho trang lịch sử mua hàng)
 *
 * Trả về kèm `product_variant:product_variants(...)` + `product:products(...)` để UI
 * hiển thị "mua cái gì" mà không cần gọi thêm API.
 *
 * POST giữ nguyên từ factory (tạo item thủ công).
 */
import { NextRequest } from "next/server";
import { orderItemsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { orderItemCreateSchema } from "@/lib/validators/sales";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission } from "@/lib/api/guard";
import { ok, handleError, paginated } from "@/lib/api/response";
import { rangeOf } from "@/lib/api/response";

export const POST = makeCollectionHandlers({
  crud: orderItemsService,
  createSchema: orderItemCreateSchema,
  permissions: { read: "order_items.read", create: "order_items.create" },
}).POST;

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("order_items.read");
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;

    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 100)));
    const { from, to } = rangeOf(page, pageSize);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Select: items + variant + product (1 round-trip join)
    let q = db
      .from("order_items")
      .select(
        "id, order_id, product_variant_id, quantity, unit_price, total_price, product_snapshot, product_variant:product_variants(id, sku, name, product:products(id, name, slug, thumbnail_url))",
        { count: "exact" },
      )
      .range(from, to);

    // Filter order_id (single hoặc __in)
    const orderId = sp.get("order_id");
    const orderIdIn = sp.get("order_id__in");
    if (orderId) {
      q = q.eq("order_id", orderId);
    } else if (orderIdIn) {
      const ids = orderIdIn.split(",").map((s) => s.trim()).filter(Boolean);
      if (ids.length === 1) q = q.eq("order_id", ids[0]);
      else if (ids.length > 1) q = q.in("order_id", ids);
    }

    q = q.order("id", { ascending: true });

    const { data, error, count } = await q;
    if (error) throw error;
    return ok(paginated(data ?? [], count ?? 0, page, pageSize));
  } catch (e) {
    return handleError(e);
  }
}
