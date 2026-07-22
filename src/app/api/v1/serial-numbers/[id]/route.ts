import { serialNumbersService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { serialUpdateSchema } from "@/lib/validators/catalog";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: serialNumbersService,
  updateSchema: serialUpdateSchema,
  permissions: { read: "serial_numbers.read", update: "serial_numbers.update", remove: "serial_numbers.delete" },
});
