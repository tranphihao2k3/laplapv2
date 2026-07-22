import { inventoryTxService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { inventoryAdjustSchema } from "@/lib/validators/inventory";

export const { GET } = makeItemHandlers({
  crud: inventoryTxService,
  updateSchema: inventoryAdjustSchema.partial(),
  permissions: { read: "inventory_transactions.read" },
});
