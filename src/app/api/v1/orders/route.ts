import { ordersService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { orderCreateSchema } from "@/lib/validators/sales";

// POST tạo draft. Để checkout đầy đủ (trừ stock, payment, loyalty) dùng /api/v1/checkout.
export const { GET, POST } = makeCollectionHandlers({
  crud: ordersService,
  createSchema: orderCreateSchema,
  permissions: {
    read: "orders.read",
    create: "orders.create",
  },
});
