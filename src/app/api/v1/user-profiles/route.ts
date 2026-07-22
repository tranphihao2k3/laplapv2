import { userProfilesService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { userProfileUpdateSchema } from "@/lib/validators/org";

// user_profiles không tạo trực tiếp qua API (sinh ra từ auth signup trigger).
// Cho phép GET list trong org + PATCH self qua [id].
export const { GET } = makeCollectionHandlers({
  crud: userProfilesService,
  createSchema: userProfileUpdateSchema,
  permissions: { read: "user_profiles.read" },
});
