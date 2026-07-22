import { rolesService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { roleUpdateSchema } from "@/lib/validators/org";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: rolesService,
  updateSchema: roleUpdateSchema,
  permissions: { read: "roles.read", update: "roles.update", remove: "roles.delete" },
});
