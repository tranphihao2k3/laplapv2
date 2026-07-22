import { purchaseOrdersService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { purchaseOrderCreateSchema } from "@/lib/validators/inventory";

export const { GET, POST } = makeCollectionHandlers({
  crud: purchaseOrdersService,
  createSchema: purchaseOrderCreateSchema,
  permissions: { read: "purchase_orders.read", create: "purchase_orders.create" },
});
