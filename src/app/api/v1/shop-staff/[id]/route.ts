import { shopStaffService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { shopStaffUpdateSchema } from "@/lib/validators/org";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: shopStaffService,
  updateSchema: shopStaffUpdateSchema,
  permissions: { read: "shop_staff.read", update: "shop_staff.update", remove: "shop_staff.delete" },
});
