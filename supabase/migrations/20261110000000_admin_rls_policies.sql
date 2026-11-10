-- =====================================================================
-- Migration: RLS policies for admin/server-side inserts on
--   customers, serial_numbers, warranties.
-- Date: 2026-11-10
-- Problem: route "Tạo nhanh bảo hành" (POST /v1/warranties/quick) insert
--   customers + serial_numbers + warranties nhưng 3 bảng này chỉ có
--   policy SELECT/UPDATE cho chính user (auth_user_id = auth.uid()),
--   KHÔNG có INSERT → error:
--   "new row violates row-level security policy for table serial_numbers".
-- Fix: thêm policy INSERT/UPDATE/DELETE cho authenticated user có permission
--   tương ứng (admin/manager). Dùng helper has_permission().
-- =====================================================================

-- ── customers ──────────────────────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- SELECT: chính user hoặc admin/manager có permission customers.read
DROP POLICY IF EXISTS customers_self_select ON customers;
CREATE POLICY customers_self_select ON customers
  FOR SELECT USING (
    (auth_user_id = auth.uid() AND deleted_at IS NULL)
    OR public.has_permission('customers.read')
  );

-- UPDATE: chính user hoặc admin/manager
DROP POLICY IF EXISTS customers_self_update ON customers;
CREATE POLICY customers_self_update ON customers
  FOR UPDATE USING (
    (auth_user_id = auth.uid() AND deleted_at IS NULL)
    OR public.has_permission('customers.update')
  );

-- INSERT: admin/manager tạo customer mới (khi khách lẻ chưa có auth account)
DROP POLICY IF EXISTS customers_admin_insert ON customers;
CREATE POLICY customers_admin_insert ON customers
  FOR INSERT WITH CHECK (
    public.has_permission('customers.create')
  );

-- ── warranties ─────────────────────────────────────────────────────────
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;

-- SELECT: chính customer hoặc admin/manager
DROP POLICY IF EXISTS warranties_self_select ON warranties;
CREATE POLICY warranties_self_select ON warranties
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
    OR public.has_permission('warranties.read')
  );

-- INSERT: admin/manager tạo bảo hành (POS, tạo nhanh, hoàn tất phiếu sửa)
DROP POLICY IF EXISTS warranties_admin_insert ON warranties;
CREATE POLICY warranties_admin_insert ON warranties
  FOR INSERT WITH CHECK (
    public.has_permission('warranties.create')
  );

-- UPDATE: admin/manager cập nhật BH (void, extend, claim...)
DROP POLICY IF EXISTS warranties_admin_update ON warranties;
CREATE POLICY warranties_admin_update ON warranties
  FOR UPDATE USING (
    public.has_permission('warranties.update')
  );

-- DELETE: admin
DROP POLICY IF EXISTS warranties_admin_delete ON warranties;
CREATE POLICY warranties_admin_delete ON warranties
  FOR DELETE USING (
    public.has_permission('warranties.delete')
  );

-- ── serial_numbers ─────────────────────────────────────────────────────
ALTER TABLE serial_numbers ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/manager/staff_warehouse
DROP POLICY IF EXISTS serial_numbers_tenant_select ON serial_numbers;
CREATE POLICY serial_numbers_tenant_select ON serial_numbers
  FOR SELECT USING (
    public.has_permission('serial_numbers.read')
  );

-- INSERT: admin/manager/staff_warehouse tạo serial (tạo nhanh BH, nhập lô)
DROP POLICY IF EXISTS serial_numbers_tenant_insert ON serial_numbers;
CREATE POLICY serial_numbers_tenant_insert ON serial_numbers
  FOR INSERT WITH CHECK (
    public.has_permission('serial_numbers.create')
  );

-- UPDATE: admin/manager/staff_warehouse
DROP POLICY IF EXISTS serial_numbers_tenant_update ON serial_numbers;
CREATE POLICY serial_numbers_tenant_update ON serial_numbers
  FOR UPDATE USING (
    public.has_permission('serial_numbers.update')
  );

-- DELETE: admin
DROP POLICY IF EXISTS serial_numbers_tenant_delete ON serial_numbers;
CREATE POLICY serial_numbers_tenant_delete ON serial_numbers
  FOR DELETE USING (
    public.has_permission('serial_numbers.delete')
  );