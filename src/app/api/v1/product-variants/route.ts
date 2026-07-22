import { productVariantsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { productVariantCreateSchema } from "@/lib/validators/catalog";

export const { GET, POST } = makeCollectionHandlers({
  crud: productVariantsService,
  createSchema: productVariantCreateSchema,
  permissions: { read: "product_variants.read", create: "product_variants.create" },
});
