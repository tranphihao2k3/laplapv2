import { z } from "zod";
import { uuid, phoneVN, email } from "./common";

// organizations
export const organizationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(50).nullable().optional(),
  tax_code: z.string().max(50).nullable().optional(),
  tax_id: z.string().max(50).nullable().optional(),
  phone: phoneVN,
  email: email,
  address: z.string().nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  website: z.string().url().nullable().optional(),
  is_active: z.boolean().default(true),
  parent_id: uuid.nullable().optional(),
  settings: z.record(z.unknown()).nullable().optional(),
});
export const organizationUpdateSchema = organizationCreateSchema.partial();

// shops
export const shopCreateSchema = z.object({
  organization_id: uuid.optional(),
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  phone: phoneVN,
  email: email,
  address: z.string().nullable().optional(),
  timezone: z.string().default("Asia/Ho_Chi_Minh"),
  is_active: z.boolean().default(true),
});
export const shopUpdateSchema = shopCreateSchema.partial();

// warehouses
export const warehouseCreateSchema = z.object({
  organization_id: uuid.optional(),
  shop_id: uuid.nullable().optional(),
  name: z.string().min(1).max(200),
  code: z.string().max(50).nullable().optional(),
  type: z.enum(["store", "central", "online", "transit"]).default("store"),
  address: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  manager_name: z.string().max(200).nullable().optional(),
  phone: phoneVN,
});
export const warehouseUpdateSchema = warehouseCreateSchema.partial();

// user_profiles
export const userProfileUpdateSchema = z.object({
  full_name: z.string().min(1).max(200).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  phone: phoneVN,
});

// roles
export const roleCreateSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  organization_id: uuid.optional(),
});
export const roleUpdateSchema = roleCreateSchema.partial();

// permissions
export const permissionCreateSchema = z.object({
  code: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
});
export const permissionUpdateSchema = permissionCreateSchema.partial();

// role_permissions bulk
export const rolePermissionAssignSchema = z.object({
  role_id: uuid,
  permission_ids: z.array(uuid).min(1),
});

// shop_staff
export const shopStaffCreateSchema = z.object({
  shop_id: uuid,
  user_id: uuid,
  role_id: uuid.nullable().optional(),
  is_active: z.boolean().default(true),
});
export const shopStaffUpdateSchema = shopStaffCreateSchema.partial();
