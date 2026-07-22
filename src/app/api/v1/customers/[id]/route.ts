import { customersService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { customerUpdateSchema } from "@/lib/validators/sales";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: customersService,
  updateSchema: customerUpdateSchema,
  permissions: { read: "customers.read", update: "customers.update", remove: "customers.delete" },
});
