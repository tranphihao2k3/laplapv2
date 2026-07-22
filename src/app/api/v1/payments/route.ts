import { paymentsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { paymentCreateSchema } from "@/lib/validators/sales";

export const { GET, POST } = makeCollectionHandlers({
  crud: paymentsService,
  createSchema: paymentCreateSchema,
  permissions: { read: "payments.read", create: "payments.create" },
});
