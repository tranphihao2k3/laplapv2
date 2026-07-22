import { brandsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { brandCreateSchema } from "@/lib/validators/catalog";

export const { GET, POST } = makeCollectionHandlers({
  crud: brandsService,
  createSchema: brandCreateSchema,
  permissions: { read: "brands.read", create: "brands.create" },
});
