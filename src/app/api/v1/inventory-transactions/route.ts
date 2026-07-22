import { inventoryTxService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { inventoryAdjustSchema } from "@/lib/validators/inventory";

// Tạo trực tiếp chỉ cho type=adjustment|damage. Các type khác (sale/purchase/transfer) sinh tự động qua RPC.
export const { GET, POST } = makeCollectionHandlers({
  crud: inventoryTxService,
  createSchema: inventoryAdjustSchema,
  permissions: { read: "inventory_transactions.read", create: "inventory_transactions.create" },
});
