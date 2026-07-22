import { loyaltyTxService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { loyaltyAdjustSchema } from "@/lib/validators/sales";

export const { GET, POST } = makeCollectionHandlers({
  crud: loyaltyTxService,
  createSchema: loyaltyAdjustSchema,
  permissions: { read: "loyalty_transactions.read", create: "loyalty_transactions.create" },
});
