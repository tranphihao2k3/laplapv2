-- ============================================================
-- Voucher / Coupon System (canonical schema)
--
-- Bảng:
--   - vouchers        : định nghĩa voucher + điều kiện áp dụng
--   - voucher_usages  : lịch sử sử dụng (ai, đơn nào, giảm bao nhiêu)
--   - active_vouchers : view voucher còn hiệu lực cho client
--
-- Lưu ý: schema này khớp với src/types/voucher.ts,
-- admin page /quanly/vouchers và API /api/v1/vouchers.
-- ============================================================

-- 1) vouchers -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'percent'
    CHECK (type IN ('percent', 'fixed_amount', 'free_shipping')),
  value NUMERIC NOT NULL CHECK (value > 0),
  min_order_amount NUMERIC NOT NULL DEFAULT 0,
  max_discount_amount NUMERIC,
  quantity_total INT,
  quantity_used INT NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  applicable_products UUID[],
  applicable_categories UUID[],
  user_usage_limit INT NOT NULL DEFAULT 1,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_organization ON public.vouchers(organization_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_active ON public.vouchers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vouchers_dates ON public.vouchers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_products ON public.vouchers USING GIN(applicable_products);
CREATE INDEX IF NOT EXISTS idx_vouchers_categories ON public.vouchers USING GIN(applicable_categories);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_vouchers_updated_at ON public.vouchers;
CREATE TRIGGER trg_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) voucher_usages -------------------------------------------
CREATE TABLE IF NOT EXISTS public.voucher_usages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id UUID,
  user_identifier TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount NUMERIC NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voucher_usages_voucher ON public.voucher_usages(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_usages_user ON public.voucher_usages(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voucher_usages_order ON public.voucher_usages(order_id);

ALTER TABLE public.voucher_usages ENABLE ROW LEVEL SECURITY;

-- Tự tăng quantity_used khi ghi nhận usage (idempotent nếu insert 1 lần/đơn).
CREATE OR REPLACE FUNCTION public.increment_voucher_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vouchers
     SET quantity_used = quantity_used + 1
   WHERE id = NEW.voucher_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_voucher_usage ON public.voucher_usages;
CREATE TRIGGER trg_increment_voucher_usage
  AFTER INSERT ON public.voucher_usages
  FOR EACH ROW EXECUTE FUNCTION public.increment_voucher_usage();

-- 3) Nối voucher_claims với vouchers (nếu chưa có FK) ---------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'voucher_claims_voucher_id_fkey'
  ) THEN
    ALTER TABLE public.voucher_claims
      ADD CONSTRAINT voucher_claims_voucher_id_fkey
      FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4) Lưu voucher trên đơn hàng (phục vụ báo cáo) ---------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voucher_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voucher_discount NUMERIC NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_voucher_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_voucher_id_fkey
      FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5) View voucher còn hiệu lực cho client ----------------------
CREATE OR REPLACE VIEW public.active_vouchers AS
SELECT
  v.id,
  v.code,
  v.name,
  v.description,
  v.type,
  v.value,
  v.min_order_amount,
  v.max_discount_amount,
  v.start_date,
  v.end_date,
  v.is_active,
  v.applicable_products,
  v.applicable_categories,
  v.user_usage_limit,
  v.quantity_total,
  v.quantity_used,
  CASE
    WHEN v.quantity_total IS NOT NULL THEN v.quantity_total - v.quantity_used
    ELSE NULL
  END AS quantity_remaining
FROM public.vouchers v
WHERE v.is_active = true
  AND now() >= v.start_date
  AND now() <= v.end_date
  AND (v.quantity_total IS NULL OR v.quantity_used < v.quantity_total);

-- 6) Validate voucher -----------------------------------------
DROP FUNCTION IF EXISTS public.validate_voucher(TEXT, NUMERIC, UUID, UUID[], UUID[]);

CREATE FUNCTION public.validate_voucher(
  p_code TEXT,
  p_order_amount NUMERIC,
  p_user_id UUID DEFAULT NULL,
  p_product_ids UUID[] DEFAULT '{}',
  p_category_ids UUID[] DEFAULT '{}'
)
RETURNS TABLE (
  valid BOOLEAN,
  voucher_id UUID,
  voucher_type TEXT,
  voucher_name TEXT,
  discount_amount NUMERIC,
  error_message TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.vouchers%ROWTYPE;
  v_usage_count INT;
  v_discount NUMERIC := 0;
BEGIN
  SELECT * INTO v_record
  FROM public.vouchers
  WHERE code = UPPER(trim(p_code)) AND is_active = true;

  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC,
      'Mã voucher không tồn tại hoặc đã bị vô hiệu hóa'::TEXT;
    RETURN;
  END IF;

  IF now() < v_record.start_date THEN
    RETURN QUERY SELECT false, v_record.id, v_record.type, v_record.name, NULL::NUMERIC,
      'Voucher chưa bắt đầu'::TEXT;
    RETURN;
  END IF;

  IF now() > v_record.end_date THEN
    RETURN QUERY SELECT false, v_record.id, v_record.type, v_record.name, NULL::NUMERIC,
      'Voucher đã hết hạn'::TEXT;
    RETURN;
  END IF;

  IF v_record.quantity_total IS NOT NULL AND v_record.quantity_used >= v_record.quantity_total THEN
    RETURN QUERY SELECT false, v_record.id, v_record.type, v_record.name, NULL::NUMERIC,
      'Voucher đã hết lượt sử dụng'::TEXT;
    RETURN;
  END IF;

  IF p_user_id IS NOT NULL THEN
    -- Alias bắt buộc: OUT param voucher_id trùng tên cột → nếu không qualify
    -- PostgreSQL báo "column reference voucher_id is ambiguous".
    SELECT COUNT(*) INTO v_usage_count
    FROM public.voucher_usages vu
    WHERE vu.voucher_id = v_record.id AND vu.user_id = p_user_id;

    IF v_usage_count >= v_record.user_usage_limit THEN
      RETURN QUERY SELECT false, v_record.id, v_record.type, v_record.name, NULL::NUMERIC,
        'Bạn đã sử dụng voucher này rồi'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF p_order_amount < v_record.min_order_amount THEN
    RETURN QUERY SELECT false, v_record.id, v_record.type, v_record.name, NULL::NUMERIC,
      format('Đơn hàng tối thiểu %s để sử dụng voucher này', v_record.min_order_amount)::TEXT;
    RETURN;
  END IF;

  IF v_record.applicable_products IS NOT NULL
     AND cardinality(v_record.applicable_products) > 0 THEN
    IF p_product_ids IS NULL OR cardinality(p_product_ids) = 0 THEN
      RETURN QUERY SELECT false, v_record.id, v_record.type, v_record.name, NULL::NUMERIC,
        'Voucher này chỉ áp dụng cho sản phẩm nhất định'::TEXT;
      RETURN;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM unnest(p_product_ids) AS pid
      WHERE pid = ANY(v_record.applicable_products)
    ) THEN
      RETURN QUERY SELECT false, v_record.id, v_record.type, v_record.name, NULL::NUMERIC,
        'Giỏ hàng không có sản phẩm nào áp dụng voucher này'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF v_record.applicable_categories IS NOT NULL
     AND cardinality(v_record.applicable_categories) > 0 THEN
    IF p_category_ids IS NULL OR cardinality(p_category_ids) = 0 THEN
      RETURN QUERY SELECT false, v_record.id, v_record.type, v_record.name, NULL::NUMERIC,
        'Voucher này chỉ áp dụng cho danh mục sản phẩm nhất định'::TEXT;
      RETURN;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM unnest(p_category_ids) AS cid
      WHERE cid = ANY(v_record.applicable_categories)
    ) THEN
      RETURN QUERY SELECT false, v_record.id, v_record.type, v_record.name, NULL::NUMERIC,
        'Giỏ hàng không có sản phẩm thuộc danh mục áp dụng voucher này'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF v_record.type = 'percent' THEN
    v_discount := ROUND(p_order_amount * v_record.value / 100);
    IF v_record.max_discount_amount IS NOT NULL AND v_discount > v_record.max_discount_amount THEN
      v_discount := v_record.max_discount_amount;
    END IF;
  ELSIF v_record.type = 'fixed_amount' THEN
    v_discount := LEAST(v_record.value, p_order_amount);
  ELSE
    v_discount := 0;
  END IF;

  RETURN QUERY SELECT true, v_record.id, v_record.type, v_record.name, v_discount, NULL::TEXT;
END;
$$;

-- 7) RLS policies ---------------------------------------------
DROP POLICY IF EXISTS vouchers_select_public_active ON public.vouchers;
CREATE POLICY vouchers_select_public_active ON public.vouchers
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS vouchers_select_admin ON public.vouchers;
CREATE POLICY vouchers_select_admin ON public.vouchers
  FOR SELECT TO authenticated
  USING (public.has_permission('vouchers.read'));

DROP POLICY IF EXISTS vouchers_insert_admin ON public.vouchers;
CREATE POLICY vouchers_insert_admin ON public.vouchers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('vouchers.create'));

DROP POLICY IF EXISTS vouchers_update_admin ON public.vouchers;
CREATE POLICY vouchers_update_admin ON public.vouchers
  FOR UPDATE TO authenticated
  USING (public.has_permission('vouchers.update'))
  WITH CHECK (public.has_permission('vouchers.update'));

DROP POLICY IF EXISTS vouchers_delete_admin ON public.vouchers;
CREATE POLICY vouchers_delete_admin ON public.vouchers
  FOR DELETE TO authenticated
  USING (public.has_permission('vouchers.delete'));

DROP POLICY IF EXISTS voucher_usages_select ON public.voucher_usages;
CREATE POLICY voucher_usages_select ON public.voucher_usages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission('vouchers.read'));

-- 8) Quyền + gán cho role admin/manager ------------------------
INSERT INTO public.permissions (code, description)
SELECT v.code, v.description
FROM (VALUES
  ('vouchers.read',   'Xem danh sách voucher'),
  ('vouchers.create', 'Tạo voucher'),
  ('vouchers.update', 'Cập nhật voucher'),
  ('vouchers.delete', 'Xoá voucher')
) AS v(code, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.code = v.code
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'vouchers.read', 'vouchers.create', 'vouchers.update', 'vouchers.delete'
)
WHERE r.code IN ('admin', 'manager')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 9) Quyền truy cập DB ---------------------------------------
GRANT SELECT ON public.active_vouchers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vouchers TO authenticated;
GRANT SELECT ON public.voucher_usages TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_voucher(TEXT, NUMERIC, UUID, UUID[], UUID[]) TO anon, authenticated;
