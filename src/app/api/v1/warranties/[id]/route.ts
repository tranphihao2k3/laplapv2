import { warrantiesService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { warrantyUpdateSchema } from "@/lib/validators/after-sale";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: warrantiesService,
  updateSchema: warrantyUpdateSchema,
  permissions: { read: "warranties.read", update: "warranties.update", remove: "warranties.delete" },
});
