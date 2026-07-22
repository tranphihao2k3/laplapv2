import { productsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { productCreateSchema } from "@/lib/validators/catalog";

export const { GET, POST } = makeCollectionHandlers({
  crud: productsService,
  createSchema: productCreateSchema,
  permissions: { read: "products.read", create: "products.create" },
});
