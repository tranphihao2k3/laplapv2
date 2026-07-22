import { purchaseOrdersService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { purchaseOrderUpdateSchema } from "@/lib/validators/inventory";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: purchaseOrdersService,
  updateSchema: purchaseOrderUpdateSchema,
  permissions: { read: "purchase_orders.read", update: "purchase_orders.update", remove: "purchase_orders.delete" },
});
