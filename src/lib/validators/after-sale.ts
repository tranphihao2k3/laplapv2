import { z } from "zod";
import { uuid, isoDate } from "./common";
import { REPAIR_SERVICE_CATEGORY_SLUGS } from "@/lib/repair-services";

// warranties
export const warrantyCreateSchema = z.object({
  serial_number_id: uuid.nullable().optional(),
  customer_id: uuid.nullable().optional(),
  order_id: uuid.nullable().optional(),
  start_date: isoDate.nullable().optional(),
  end_date: isoDate.nullable().optional(),
  status: z.enum(["active", "expired", "voided", "claimed"]).default("active"),
});
export const warrantyUpdateSchema = warrantyCreateSchema.partial();

// repair_tickets
export const repairCreateSchema = z.object({
  shop_id: uuid,
  customer_id: uuid.nullable().optional(),
  device_name: z.string().min(1).max(200),
  serial_number: z.string().nullable().optional(),
  issue_description: z.string().min(1).max(2000),
  condition_description: z.string().nullable().optional(),
  images: z.unknown().optional(),
  status: z
    .enum([
      "received",
      "diagnosing",
      "quoted",
      "approved",
      "repairing",
      "done",
      "delivered",
      "cancelled",
    ])
    .default("received"),
  estimated_cost: z.number().nonnegative().nullable().optional(),
  actual_cost: z.number().nonnegative().nullable().optional(),
  assigned_to: uuid.nullable().optional(),
});
export const repairUpdateSchema = repairCreateSchema.partial();

// trade_in_requests
export const tradeInCreateSchema = z.object({
  customer_id: uuid.nullable().optional(),
  device_name: z.string().min(1).max(200),
  serial_number: z.string().nullable().optional(),
  condition_note: z.string().nullable().optional(),
  images: z.unknown().optional(),
  offered_price: z.number().nonnegative().nullable().optional(),
  status: z
    .enum(["pending", "evaluating", "approved", "rejected", "completed"])
    .default("pending"),
});
export const tradeInUpdateSchema = tradeInCreateSchema.partial();

// repair_services — bảng giá dịch vụ sửa chữa
export const repairServiceCreateSchema = z.object({
  category: z
    .enum(REPAIR_SERVICE_CATEGORY_SLUGS as [string, ...string[]])
    .default("thay-linh-kien"),
  name: z.string().min(1).max(200),
  slug: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  price_type: z.enum(["fixed", "from", "range", "contact"]).default("from"),
  price_min: z.number().nonnegative().nullable().optional(),
  price_max: z.number().nonnegative().nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  warranty_text: z.string().max(200).nullable().optional(),
  position: z.number().int().optional(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  organization_id: uuid.optional(),
});
export const repairServiceUpdateSchema = repairServiceCreateSchema.partial();

// settings
export const settingCreateSchema = z.object({
  organization_id: uuid.nullable().optional(),
  shop_id: uuid.nullable().optional(),
  group_name: z.string().nullable().optional(),
  key: z.string().min(1).max(200),
  value: z.unknown(),
});
export const settingUpdateSchema = settingCreateSchema.partial();
