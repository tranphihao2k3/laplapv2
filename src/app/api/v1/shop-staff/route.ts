import { shopStaffService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { shopStaffCreateSchema } from "@/lib/validators/org";

export const { GET, POST } = makeCollectionHandlers({
  crud: shopStaffService,
  createSchema: shopStaffCreateSchema,
  permissions: { read: "shop_staff.read", create: "shop_staff.create" },
});
