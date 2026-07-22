import { orderItemsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { orderItemCreateSchema } from "@/lib/validators/sales";

export const { GET, POST } = makeCollectionHandlers({
  crud: orderItemsService,
  createSchema: orderItemCreateSchema,
  permissions: { read: "order_items.read", create: "order_items.create" },
});
