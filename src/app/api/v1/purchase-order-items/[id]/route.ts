import { purchaseOrderItemsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { poiUpdateSchema } from "@/lib/validators/inventory";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: purchaseOrderItemsService,
  updateSchema: poiUpdateSchema,
  permissions: { read: "purchase_order_items.read", update: "purchase_order_items.update", remove: "purchase_order_items.delete" },
});
