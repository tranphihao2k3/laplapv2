import { tradeInService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { tradeInUpdateSchema } from "@/lib/validators/after-sale";

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: tradeInService,
  updateSchema: tradeInUpdateSchema,
  permissions: { read: "trade_in_requests.read", update: "trade_in_requests.update", remove: "trade_in_requests.delete" },
});
