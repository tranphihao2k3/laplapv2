import { tradeInService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { tradeInCreateSchema } from "@/lib/validators/after-sale";

export const { GET, POST } = makeCollectionHandlers({
  crud: tradeInService,
  createSchema: tradeInCreateSchema,
  permissions: { read: "trade_in_requests.read", create: "trade_in_requests.create" },
});
