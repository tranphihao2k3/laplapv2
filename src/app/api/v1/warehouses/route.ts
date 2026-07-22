import { warehousesService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { warehouseCreateSchema } from "@/lib/validators/org";

export const { GET, POST } = makeCollectionHandlers({
  crud: warehousesService,
  createSchema: warehouseCreateSchema,
  permissions: { read: "warehouses.read", create: "warehouses.create" },
});
