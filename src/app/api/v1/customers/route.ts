import { customersService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { customerCreateSchema } from "@/lib/validators/sales";

export const { GET, POST } = makeCollectionHandlers({
  crud: customersService,
  createSchema: customerCreateSchema,
  permissions: { read: "customers.read", create: "customers.create" },
});
