import { suppliersService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { supplierUpdateSchema } from "@/lib/validators/sales";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: suppliersService,
  updateSchema: supplierUpdateSchema,
  permissions: { read: "suppliers.read", update: "suppliers.update", remove: "suppliers.delete" },
});
