import { paymentsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { paymentUpdateSchema } from "@/lib/validators/sales";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: paymentsService,
  updateSchema: paymentUpdateSchema,
  permissions: { read: "payments.read", update: "payments.update", remove: "payments.delete" },
});
