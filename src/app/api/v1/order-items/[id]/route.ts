import { orderItemsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { orderItemUpdateSchema } from "@/lib/validators/sales";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: orderItemsService,
  updateSchema: orderItemUpdateSchema,
  permissions: { read: "order_items.read", update: "order_items.update", remove: "order_items.delete" },
});
