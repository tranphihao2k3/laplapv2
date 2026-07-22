import { specTemplatesService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { specTemplateUpdateSchema } from "@/lib/validators/catalog";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: specTemplatesService,
  updateSchema: specTemplateUpdateSchema,
  permissions: { read: "spec_templates.read", update: "spec_templates.update", remove: "spec_templates.delete" },
});
