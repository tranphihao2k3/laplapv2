import { organizationsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { organizationCreateSchema } from "@/lib/validators/org";

export const { GET, POST } = makeCollectionHandlers({
  crud: organizationsService,
  createSchema: organizationCreateSchema,
  permissions: { read: "organizations.read", create: "organizations.create" },
});
