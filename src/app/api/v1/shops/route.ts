import { shopsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { shopCreateSchema } from "@/lib/validators/org";

export const { GET, POST } = makeCollectionHandlers({
  crud: shopsService,
  createSchema: shopCreateSchema,
  permissions: { read: "shops.read", create: "shops.create" },
});
