import { warehousesService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { warehouseUpdateSchema } from "@/lib/validators/org";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: warehousesService,
  updateSchema: warehouseUpdateSchema,
  permissions: { read: "warehouses.read", update: "warehouses.update", remove: "warehouses.delete" },
});
