-- Phase 1: Performance indexes for admin UI optimization
-- Run via Supabase Dashboard SQL editor for production

-- Multi-tenant organization_id indexes (most queried)
CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_brands_org_id ON public.brands(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_org_id ON public.categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_shop_id ON public.warehouses(shop_id);
CREATE INDEX IF NOT EXISTS idx_spec_templates_org_id ON public.spec_templates(organization_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_products_org_status ON public.products(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON public.product_variants(product_id, is_active);