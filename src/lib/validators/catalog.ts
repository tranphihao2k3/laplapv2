import { z } from "zod";
import { uuid, slug } from "./common";

// brands
export const brandCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slug,
  logo_url: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  show_on_homepage: z.boolean().default(false).optional(),
  organization_id: uuid.optional(),
});
export const brandUpdateSchema = brandCreateSchema.partial();

// categories
export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slug,
  parent_id: uuid.nullable().optional(),
  position: z.number().int().optional(),
  organization_id: uuid.optional(),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

// spec_templates
export const specTemplateCreateSchema = z.object({
  name: z.string().min(1).max(200),
  category_id: uuid.nullable().optional(),
  fields: z.unknown(),
  organization_id: uuid.optional(),
});
export const specTemplateUpdateSchema = specTemplateCreateSchema.partial();

// products
export const productCreateSchema = z.object({
  name: z.string().min(1).max(300),
  slug: slug,
  category_id: uuid.nullable().optional(),
  brand_id: uuid.nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  images: z.array(z.string().url()).nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  tags: z.array(z.string()).nullable().optional(),
  gift_product_ids: z.array(uuid).max(30).optional(),
  organization_id: uuid.optional(),
});
export const productUpdateSchema = productCreateSchema.partial();

// product_variants
export const productVariantCreateSchema = z.object({
  product_id: uuid,
  sku: z.string().min(1).max(100),
  barcode: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  attributes: z.unknown().optional(),
  specs: z.unknown().optional(),
  cost_price: z.number().nonnegative().default(0),
  selling_price: z.number().nonnegative().default(0),
  weight: z.number().nonnegative().nullable().optional(),
  is_active: z.boolean().default(true),
});
export const productVariantUpdateSchema = productVariantCreateSchema.partial();

// serial_numbers
export const serialCreateSchema = z.object({
  product_variant_id: uuid,
  warehouse_id: uuid.nullable().optional(),
  serial: z.string().nullable().optional(),
  imei: z.string().nullable().optional(),
  status: z
    .enum(["in_stock", "reserved", "sold", "returned", "damaged", "in_repair"])
    .default("in_stock"),
});
export const serialUpdateSchema = serialCreateSchema.partial();
export const serialBulkSchema = z.object({
  product_variant_id: uuid,
  warehouse_id: uuid,
  items: z
    .array(
      z.object({
        serial: z.string().nullable().optional(),
        imei: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

// product_gifts
export const productGiftCreateSchema = z.object({
  product_id: uuid,
  gift_product_id: uuid,
});
