import { repairServicesService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { repairServiceUpdateSchema } from "@/lib/validators/after-sale";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: repairServicesService,
  updateSchema: repairServiceUpdateSchema,
  permissions: {
    read: "repair_services.read",
    update: "repair_services.update",
    remove: "repair_services.delete",
  },
});
