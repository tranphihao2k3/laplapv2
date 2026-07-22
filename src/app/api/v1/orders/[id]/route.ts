import { ordersService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { orderUpdateSchema } from "@/lib/validators/sales";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: ordersService,
  updateSchema: orderUpdateSchema,
  permissions: {
    read: "orders.read",
    update: "orders.update",
    remove: "orders.delete",
  },
});
