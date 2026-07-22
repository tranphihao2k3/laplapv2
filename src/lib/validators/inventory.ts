import { z } from "zod";
import { uuid } from "./common";

// purchase_orders
export const purchaseOrderCreateSchema = z.object({
  supplier_id: uuid.nullable().optional(),
  warehouse_id: uuid.nullable().optional(),
  po_number: z.string().min(1).max(50),
  status: z.enum(["draft", "sent", "partial", "received", "cancelled"]).default("draft"),
  ordered_at: z.string().datetime().nullable().optional(),
  expected_at: z.string().datetime().nullable().optional(),
});
export const purchaseOrderUpdateSchema = purchaseOrderCreateSchema.partial();

// purchase_order_items
export const poiCreateSchema = z.object({
  purchase_order_id: uuid,
  product_variant_id: uuid,
  quantity: z.number().int().min(1),
  unit_cost: z.number().nonnegative(),
});
export const poiUpdateSchema = poiCreateSchema.partial();

// inventory_transactions (adjustment thủ công — sale/purchase auto qua RPC)
export const inventoryAdjustSchema = z.object({
  warehouse_id: uuid,
  product_variant_id: uuid,
  type: z.enum(["adjustment", "damage"]),
  quantity: z.number().int(),
  unit_cost: z.number().nonnegative().default(0),
  note: z.string().nullable().optional(),
});

// stock_levels adjust
export const stockLevelAdjustSchema = z.object({
  warehouse_id: uuid,
  product_variant_id: uuid,
  available_qty: z.number().int().min(0),
});

// transfer RPC payload
export const transferSchema = z.object({
  from_warehouse: uuid,
  to_warehouse: uuid,
  items: z
    .array(
      z.object({ product_variant_id: uuid, quantity: z.number().int().min(1) }),
    )
    .min(1),
  note: z.string().nullable().optional(),
});

// receive PO RPC payload
export const receivePoSchema = z.object({
  serials: z
    .array(
      z.object({
        product_variant_id: uuid,
        serial: z.string().nullable().optional(),
        imei: z.string().nullable().optional(),
      }),
    )
    .optional(),
});
