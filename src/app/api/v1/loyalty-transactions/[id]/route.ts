import { loyaltyTxService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { loyaltyAdjustSchema } from "@/lib/validators/sales";

export const { GET } = makeItemHandlers({
  crud: loyaltyTxService,
  updateSchema: loyaltyAdjustSchema.partial(),
  permissions: { read: "loyalty_transactions.read" },
});
