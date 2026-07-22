import { returnOrderItemsService } from "@/server/services";
import { makeItemHandlers } from "@/app/api/v1/_route-factory";
import { z } from "zod";

const itemUpdateSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  unit_price: z.number().nonnegative().optional(),
  total_price: z.number().nonnegative().optional(),
  reason: z.string().nullable().optional(),
  restock: z.boolean().optional(),
});

export const { GET, PATCH, DELETE } = makeItemHandlers({
  crud: returnOrderItemsService,
  updateSchema: itemUpdateSchema,
  permissions: {
    read: "returns.read",
    update: "returns.update",
    remove: "returns.delete",
  },
});
