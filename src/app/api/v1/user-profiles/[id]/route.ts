import { userProfilesService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { userProfileUpdateSchema } from "@/lib/validators/org";

export const { GET, PATCH } = makeItemHandlers({
  crud: userProfilesService,
  updateSchema: userProfileUpdateSchema,
  permissions: { read: "user_profiles.read", update: "user_profiles.update" },
});
