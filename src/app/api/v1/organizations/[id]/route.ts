import { organizationsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { organizationUpdateSchema } from "@/lib/validators/org";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: organizationsService,
  updateSchema: organizationUpdateSchema,
  permissions: { read: "organizations.read", update: "organizations.update", remove: "organizations.delete" },
});
