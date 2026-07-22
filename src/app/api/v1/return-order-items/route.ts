/**
 * Read-only collection: return-order-items thường được tạo qua POST /return-orders (RPC).
 * Endpoint này phục vụ list/filter để UI hiển thị chi tiết.
 */
import { returnOrderItemsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { z } from "zod";

// Schema rỗng — POST trực tiếp item bị hạn chế, khuyến khích dùng /return-orders
const itemCreateSchema = z.object({
  return_order_id: z.string().uuid(),
  product_variant_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  unit_price: z.number().nonnegative().default(0),
  total_price: z.number().nonnegative().default(0),
  reason: z.string().nullable().optional(),
  restock: z.boolean().default(true),
  order_item_id: z.string().uuid().nullable().optional(),
});

export const { GET, POST } = makeCollectionHandlers({
  crud: returnOrderItemsService,
  createSchema: itemCreateSchema,
  permissions: {
    read: "returns.read",
    create: "returns.update",
  },
});
