import { categoriesService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { categoryUpdateSchema } from "@/lib/validators/catalog";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: categoriesService,
  updateSchema: categoryUpdateSchema,
  permissions: { read: "categories.read", update: "categories.update", remove: "categories.delete" },
});
