import { categoriesService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { categoryCreateSchema } from "@/lib/validators/catalog";

export const { GET, POST } = makeCollectionHandlers({
  crud: categoriesService,
  createSchema: categoryCreateSchema,
  permissions: { read: "categories.read", create: "categories.create" },
});
