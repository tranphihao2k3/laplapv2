import { suppliersService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { supplierCreateSchema } from "@/lib/validators/sales";

export const { GET, POST } = makeCollectionHandlers({
  crud: suppliersService,
  createSchema: supplierCreateSchema,
  permissions: { read: "suppliers.read", create: "suppliers.create" },
});
