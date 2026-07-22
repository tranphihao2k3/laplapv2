import { repairServicesService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { repairServiceCreateSchema } from "@/lib/validators/after-sale";

export const { GET, POST } = makeCollectionHandlers({
  crud: repairServicesService,
  createSchema: repairServiceCreateSchema,
  permissions: { read: "repair_services.read", create: "repair_services.create" },
});
