import { settingsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { settingCreateSchema } from "@/lib/validators/after-sale";

export const { GET, POST } = makeCollectionHandlers({
  crud: settingsService,
  createSchema: settingCreateSchema,
  permissions: { read: "settings.read", create: "settings.create" },
});
