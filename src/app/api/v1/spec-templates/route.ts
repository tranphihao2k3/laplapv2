import { specTemplatesService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { specTemplateCreateSchema } from "@/lib/validators/catalog";

export const { GET, POST } = makeCollectionHandlers({
  crud: specTemplatesService,
  createSchema: specTemplateCreateSchema,
  permissions: { read: "spec_templates.read", create: "spec_templates.create" },
});
