import { settingsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { settingUpdateSchema } from "@/lib/validators/after-sale";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: settingsService,
  updateSchema: settingUpdateSchema,
  permissions: { read: "settings.read", update: "settings.update", remove: "settings.delete" },
});
