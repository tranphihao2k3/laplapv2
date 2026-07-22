import { purchaseOrderItemsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { poiCreateSchema } from "@/lib/validators/inventory";

export const { GET, POST } = makeCollectionHandlers({
  crud: purchaseOrderItemsService,
  createSchema: poiCreateSchema,
  permissions: { read: "purchase_order_items.read", create: "purchase_order_items.create" },
});
