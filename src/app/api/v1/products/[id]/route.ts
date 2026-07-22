import { productsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { productUpdateSchema } from "@/lib/validators/catalog";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: productsService,
  updateSchema: productUpdateSchema,
  permissions: { read: "products.read", update: "products.update", remove: "products.delete" },
});
