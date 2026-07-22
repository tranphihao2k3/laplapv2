import { z } from "zod";

export const uuid = z.string().uuid("ID không hợp lệ");
export const phoneVN = z
  .string()
  .regex(/^(\+?84|0)\d{9,10}$/, "Số điện thoại không hợp lệ")
  .nullable()
  .optional();
export const email = z.string().email("Email không hợp lệ").nullable().optional();
export const slug = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Slug chỉ chứa chữ thường, số và dấu gạch ngang")
  .nullable()
  .optional();
export const positiveInt = z.number().int().nonnegative();
export const positiveNumber = z.number().nonnegative();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Ngày sai định dạng");
export const jsonish = z.unknown();

export const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
});
export type ListQueryInput = z.infer<typeof listQuerySchema>;
