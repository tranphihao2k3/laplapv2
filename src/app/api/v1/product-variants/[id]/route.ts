import { productVariantsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { productVariantUpdateSchema } from "@/lib/validators/catalog";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: productVariantsService,
  updateSchema: productVariantUpdateSchema,
  permissions: { read: "product_variants.read", update: "product_variants.update", remove: "product_variants.delete" },
});
