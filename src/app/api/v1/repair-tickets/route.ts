import { repairTicketsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { repairCreateSchema } from "@/lib/validators/after-sale";

export const { GET, POST } = makeCollectionHandlers({
  crud: repairTicketsService,
  createSchema: repairCreateSchema,
  permissions: { read: "repair_tickets.read", create: "repair_tickets.create" },
});
