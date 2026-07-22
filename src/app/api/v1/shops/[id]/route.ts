import { shopsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { shopUpdateSchema } from "@/lib/validators/org";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: shopsService,
  updateSchema: shopUpdateSchema,
  permissions: { read: "shops.read", update: "shops.update", remove: "shops.delete" },
});
