import { returnOrdersService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { returnOrderUpdateSchema } from "@/lib/validators/sales";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: returnOrdersService,
  updateSchema: returnOrderUpdateSchema,
  permissions: {
    read: "returns.read",
    update: "returns.update",
    remove: "returns.delete",
  },
});
