import { brandsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { brandUpdateSchema } from "@/lib/validators/catalog";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: brandsService,
  updateSchema: brandUpdateSchema,
  permissions: { read: "brands.read", update: "brands.update", remove: "brands.delete" },
});
