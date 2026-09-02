/**
 * Voucher validators using Zod
 */
import { z } from "zod";
import { uuid } from "./common";

// Voucher type enum
export const voucherTypeSchema = z.enum(["percent", "fixed_amount", "free_shipping"]);

// Create voucher schema
export const voucherCreateSchema = z.object({
  code: z
    .string()
    .min(1, "Mã voucher là bắt buộc")
    .max(50, "Mã voucher tối đa 50 ký tự")
    .regex(/^[A-Za-z0-9_-]+$/, "Mã voucher chỉ chứa chữ cái, số, gạch dưới và gạch ngang"),
  name: z
    .string()
    .min(1, "Tên voucher là bắt buộc")
    .max(200, "Tên voucher tối đa 200 ký tự"),
  description: z.string().max(1000).nullable().optional(),
  type: voucherTypeSchema,
  value: z
    .number()
    .positive("Giá trị phải lớn hơn 0")
    .max(1000000000, "Giá trị không thể lớn hơn 1 tỷ"),
  min_order_amount: z.number().nonnegative().default(0),
  max_discount_amount: z.number().positive().nullable().nullish(),
  quantity_total: z.number().int().positive().nullable().nullish(),
  start_date: z.string().datetime().or(z.date()),
  end_date: z.string().datetime().or(z.date()),
  is_active: z.boolean().default(true),
  applicable_products: z.array(uuid).nullable().nullish(),
  applicable_categories: z.array(uuid).nullable().nullish(),
  user_usage_limit: z.number().int().positive().default(1),
});

// Refine validation for percent type (max 100)
export const voucherPercentValueSchema = z.object({
  type: z.literal("percent"),
  value: z.number().min(1).max(100),
});

// Refine validation for fixed_amount type
export const voucherFixedAmountValueSchema = z.object({
  type: z.literal("fixed_amount"),
  value: z.number().min(1000).max(1000000000), // 1k - 1B VND
});

// Refine validation for free_shipping type
export const voucherFreeShippingSchema = z.object({
  type: z.literal("free_shipping"),
  value: z.number().min(0).max(0).default(0),
});

// Update voucher schema (all fields optional)
export const voucherUpdateSchema = voucherCreateSchema.partial();

// Validate voucher input
export const validateVoucherSchema = z.object({
  code: z.string().min(1),
  order_amount: z.number().nonnegative(),
  user_id: uuid.nullish(),
  product_ids: z.array(uuid).nullable().optional(),
  category_ids: z.array(uuid).nullable().optional(),
});

// List vouchers query schema
export const voucherListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  sort: z.string().optional(),
  is_active: z.enum(["true", "false"]).optional(),
  type: voucherTypeSchema.optional(),
});
