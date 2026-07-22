import { z } from "zod";
import { uuid, phoneVN, email, isoDate } from "./common";

// customers
export const customerCreateSchema = z.object({
  full_name: z.string().min(1).max(200).nullable().optional(),
  phone: phoneVN,
  email: email,
  birthday: isoDate.nullable().optional(),
  tier: z.enum(["bronze", "silver", "gold", "platinum"]).default("bronze"),
  organization_id: uuid.optional(),
});
export const customerUpdateSchema = customerCreateSchema.partial();

// suppliers
export const supplierCreateSchema = z.object({
  company_name: z.string().min(1).max(300),
  tax_code: z.string().nullable().optional(),
  phone: phoneVN,
  email: email,
  address: z.string().nullable().optional(),
  organization_id: uuid.optional(),
});
export const supplierUpdateSchema = supplierCreateSchema.partial();

// orders (draft create — checkout dùng RPC riêng)
export const orderCreateSchema = z.object({
  shop_id: uuid.nullable().optional(),
  customer_id: uuid.nullable().optional(),
  order_number: z.string().min(1).max(50),
  channel: z.enum(["pos", "online", "marketplace", "wholesale"]).default("pos"),
  status: z
    .enum(["draft", "pending", "confirmed", "fulfilled", "completed", "cancelled"])
    .default("draft"),
  note: z.string().nullable().optional(),
  organization_id: uuid.optional(),
});
export const orderUpdateSchema = orderCreateSchema.partial();

// order_items
export const orderItemCreateSchema = z.object({
  order_id: uuid,
  product_variant_id: uuid,
  quantity: z.number().int().min(1),
  unit_price: z.number().nonnegative(),
  total_price: z.number().nonnegative(),
  product_snapshot: z.unknown().nullable().optional(),
});
export const orderItemUpdateSchema = orderItemCreateSchema.partial();

// payments
export const paymentCreateSchema = z.object({
  order_id: uuid,
  method: z.enum(["cash", "card", "transfer", "ewallet", "cod", "credit"]),
  amount: z.number().nonnegative(),
  status: z.enum(["unpaid", "partial", "paid", "refunded"]).default("paid"),
  transaction_code: z.string().nullable().optional(),
  paid_at: z.string().datetime().nullable().optional(),
});
export const paymentUpdateSchema = paymentCreateSchema.partial();

// pos_sessions
export const posSessionOpenSchema = z.object({
  shop_id: uuid,
  opening_cash: z.number().nonnegative().default(0),
});
export const posSessionCloseSchema = z.object({
  closing_cash: z.number().nonnegative(),
});

// loyalty_transactions (đa số auto-gen, schema cho phép adjust thủ công)
export const loyaltyAdjustSchema = z.object({
  customer_id: uuid,
  order_id: uuid.nullable().optional(),
  points: z.number().int(),
  type: z.enum(["earn", "redeem", "expire", "adjust"]).default("adjust"),
});

// ====== CHECKOUT — RPC payload ======
export const checkoutSchema = z.object({
  shop_id: uuid,
  customer_id: uuid.nullable().optional(),
  channel: z.enum(["pos", "online", "marketplace", "wholesale"]).default("pos"),
  items: z
    .array(
      z.object({
        product_variant_id: uuid,
        quantity: z.number().int().min(1),
        unit_price: z.number().nonnegative().optional(),
        serial_id: uuid.nullable().optional(),
      }),
    )
    .min(1),
  discount_amount: z.number().nonnegative().default(0),
  payment: z.object({
    method: z.enum(["cash", "card", "transfer", "ewallet", "cod", "credit"]),
    amount: z.number().nonnegative(),
    transaction_code: z.string().nullable().optional(),
  }),
  note: z.string().nullable().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ====== REPAIR CHECKOUT — tính tiền phí sửa (hóa đơn riêng) ======
export const repairCheckoutSchema = z.object({
  payment: z.object({
    method: z.enum(["cash", "card", "transfer", "ewallet", "cod", "credit"]),
    amount: z.number().nonnegative(),
    transaction_code: z.string().nullable().optional(),
  }),
  // Cho phép chỉnh phí sửa trực tiếp ở màn POS; sẽ ghi đè actual_cost của phiếu.
  actual_cost: z.number().nonnegative().optional(),
  note: z.string().nullable().optional(),
});
export type RepairCheckoutInput = z.infer<typeof repairCheckoutSchema>;

// ====== ORDER STATUS CHANGE — đổi trạng thái thủ công ======
const orderStatusEnum = z.enum([
  "draft",
  "pending",
  "confirmed",
  "processing",
  "shipping",
  "fulfilled",
  "completed",
  "cancelled",
]);
const paymentStatusEnum = z.enum(["unpaid", "partial", "paid", "refunded"]);
const fulfillmentStatusEnum = z.enum(["unfulfilled", "partial", "fulfilled", "returned"]);

export const orderStatusChangeSchema = z
  .object({
    to_status: orderStatusEnum.optional(),
    to_payment_status: paymentStatusEnum.optional(),
    to_fulfillment_status: fulfillmentStatusEnum.optional(),
    note: z.string().max(500).optional(),
  })
  .refine(
    (v) => v.to_status || v.to_payment_status || v.to_fulfillment_status,
    { message: "Phải chọn ít nhất một loại trạng thái để đổi" },
  );
export type OrderStatusChangeInput = z.infer<typeof orderStatusChangeSchema>;

// ====== RETURN ORDERS ======
export const returnOrderItemInputSchema = z.object({
  order_item_id: uuid.nullable().optional(),
  product_variant_id: uuid,
  quantity: z.number().int().min(1),
  unit_price: z.number().nonnegative().default(0),
  reason: z.string().max(300).nullable().optional(),
  restock: z.boolean().default(true),
});

export const returnOrderCreateSchema = z.object({
  order_id: uuid,
  reason: z.string().max(500).nullable().optional(),
  refund_amount: z.number().nonnegative().optional(),
  refund_method: z
    .enum(["cash", "card", "transfer", "ewallet", "credit", "store_credit"])
    .nullable()
    .optional(),
  note: z.string().max(500).nullable().optional(),
  items: z.array(returnOrderItemInputSchema).min(1, "Phải có ít nhất 1 món trả"),
});
export type ReturnOrderCreateInput = z.infer<typeof returnOrderCreateSchema>;

export const returnOrderUpdateSchema = z.object({
  status: z
    .enum(["pending", "approved", "rejected", "refunded", "completed", "cancelled"])
    .optional(),
  refund_amount: z.number().nonnegative().optional(),
  refund_method: z
    .enum(["cash", "card", "transfer", "ewallet", "credit", "store_credit"])
    .nullable()
    .optional(),
  refund_status: z.enum(["unpaid", "partial", "paid"]).optional(),
  reason: z.string().max(500).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const returnOrderApproveSchema = z.object({
  warehouse_id: uuid.optional(),
});

// ====== REVENUE REPORT QUERY ======
export const revenueQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  shop_id: uuid.optional(),
  group_by: z.enum(["day", "week", "month"]).default("day"),
});
export type RevenueQueryInput = z.infer<typeof revenueQuerySchema>;
