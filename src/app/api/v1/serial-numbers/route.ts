import { serialNumbersService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { serialCreateSchema } from "@/lib/validators/catalog";

export const { GET, POST } = makeCollectionHandlers({
  crud: serialNumbersService,
  createSchema: serialCreateSchema,
  permissions: { read: "serial_numbers.read", create: "serial_numbers.create" },
});
