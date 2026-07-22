import { repairTicketsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { repairUpdateSchema } from "@/lib/validators/after-sale";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: repairTicketsService,
  updateSchema: repairUpdateSchema,
  permissions: { read: "repair_tickets.read", update: "repair_tickets.update", remove: "repair_tickets.delete" },
});
