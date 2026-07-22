/**
 * Read-only: status logs sinh tự động bởi trigger DB.
 * UI dùng GET ?order_id=... để xem timeline.
 */
import { orderStatusLogsService } from "@/server/services";
import { makeCollectionHandlers } from "@/app/api/v1/_route-factory";
import { z } from "zod";

// schema fake (không dùng POST), để satisfy factory
const fakeCreate = z.object({ order_id: z.string().uuid() });

export const { GET } = makeCollectionHandlers({
  crud: orderStatusLogsService,
  createSchema: fakeCreate,
  permissions: {
    read: "orders.read",
  },
});
