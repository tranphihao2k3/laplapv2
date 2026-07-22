import { rolesService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { roleCreateSchema } from "@/lib/validators/org";

export const { GET, POST } = makeCollectionHandlers({
  crud: rolesService,
  createSchema: roleCreateSchema,
  permissions: { read: "roles.read", create: "roles.create" },
});
