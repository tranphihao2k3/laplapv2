import { z } from "zod";

export const emailSchema = z.string().email("Email không hợp lệ");
export const passwordSchema = z
  .string()
  .min(6, "Mật khẩu tối thiểu 6 ký tự")
  .max(72, "Mật khẩu tối đa 72 ký tự");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Họ tên tối thiểu 2 ký tự").max(100),
});

export const profileUpdateSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^(\+?84|0)\d{9,10}$/, "Số điện thoại không hợp lệ")
    .optional()
    .nullable(),
  avatar_url: z.string().url().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
