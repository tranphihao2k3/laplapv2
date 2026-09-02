-- ============================================================
-- Voucher / Coupon System
-- 
-- Tables:
--   - vouchers: voucher definitions with rules and constraints
--   - voucher_usages: track who used which voucher (for order)
--
-- Features:
--   - Multiple voucher types: percent, fixed_amount, free_shipping
--   - Min order amount requirement
--   - Max discount cap for percent vouchers
--   - Product/category restrictions
--   - Per-user usage limits
--   - Quantity limits (total usage)
--   - Date range validity
--   - Active/inactive toggle
-- ============================================================

-- 1) Bang vouchers - dinh nghia voucher/ma giam gia
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Thong tin co ban
  code TEXT NOT NULL UNIQUE,                           -- ma voucher, duy nhat, vd "SUMMER2024"
  name TEXT NOT NULL,                                  -- ten hien thi, vd "Khuyen mai he 2024"
  description TEXT,                                    -- mo ta chi tiet
  
  -- Loai voucher va gia tri
  type TEXT NOT NULL DEFAULT 'percent'
    CHECK (type IN ('percent', 'fixed_amount', 'free_shipping')),
  value NUMERIC NOT NULL CHECK (value > 0),            -- phan tram (%) hoac so tien (VND)
  
  -- Rang buoc
  min_order_amount NUMERIC NOT NULL DEFAULT 0,         -- don hang toi thieu (VND)
  max_discount_amount NUMERIC,                          -- gioi han giam gia toi da (cho percent), NULL = khong gioi han
  
  -- So luong
  quantity_total INT,                                  -- so luong voucher, NULL = khong gioi han
  quantity_used INT NOT NULL DEFAULT 0,                 -- so lan da su dung
  
  -- Thoi gian hieu luc
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  
  -- Trang thai
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Ap dung san pham / danh muc (NULL = tat ca san pham)
  applicable_products UUID[],                          -- danh sach product_id, NULL = tat ca
  applicable_categories UUID[],                         -- danh sach category_id, NULL = tat ca
  
  -- Gioi han su dung
  user_usage_limit INT NOT NULL DEFAULT 1,             -- so lan moi user co the su dung
  
  -- Audit
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_organization ON vouchers(organization_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_active ON vouchers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_vouchers_dates ON vouchers(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_products ON vouchers USING GIN(applicable_products);
CREATE INDEX IF NOT EXISTS idx_vouchers_categories ON vouchers USING GIN(applicable_categories);

-- RLS
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- 2) Bang voucher_usages - theo doi ai da su dung voucher nao
CREATE TABLE IF NOT EXISTS voucher_usages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  
  -- Ai su dung (customer_id NULL = guest checkout)
  user_id UUID,                                        -- UUID = guest session hoac customer id
  user_identifier TEXT,                                 -- email/phone guest neu khong co user_id
  
  -- Don hang nao
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Gia tri khi su dung
  discount_amount NUMERIC NOT NULL,                     -- so tien duoc giam thuc te
  
  -- Audit
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voucher_usages_voucher ON voucher_usages(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_usages_user ON voucher_usages(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_voucher_usages_order ON voucher_usages(order_id);

-- RLS
ALTER TABLE voucher_usages ENABLE ROW LEVEL SECURITY;

-- 3) Function cap nhat updated_at cho vouchers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vouchers_updated_at ON vouchers;
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4) Function tu dong tang quantity_used khi co usage moi
CREATE OR REPLACE FUNCTION increment_voucher_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vouchers
  SET quantity_used = quantity_used + 1
  WHERE id = NEW.voucher_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_voucher_usage ON voucher_usages;
CREATE TRIGGER trg_increment_voucher_usage
  AFTER INSERT ON voucher_usages
  FOR EACH ROW
  EXECUTE FUNCTION increment_voucher_usage();

-- 5) View de lay danh sach voucher con hieu luc (cho client hien thi)
CREATE OR REPLACE VIEW active_vouchers AS
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
FROM vouchers v
WHERE 
  v.is_active = true
  AND now() >= v.start_date
  AND now() <= v.end_date
  AND (v.quantity_total IS NULL OR v.quantity_used < v.quantity_total);

-- 6) Function validate voucher - kiem tra voucher co hop le khong
CREATE OR REPLACE FUNCTION validate_voucher(
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
) AS $$
DECLARE
  v_record RECORD;
  v_usage_count INT;
BEGIN
  -- Tim voucher theo code
  SELECT * INTO v_record
  FROM vouchers
  WHERE code = UPPER(p_code) AND is_active = true;
  
  IF v_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 'Mã voucher không tồn tại hoặc đã bị vô hiệu hóa'::TEXT;
    RETURN;
  END IF;
  
  -- Kiem tra thoi gian
  IF now() < v_record.start_date THEN
    RETURN QUERY SELECT false, v_record.id, NULL::TEXT, v_record.name, NULL::NUMERIC, 'Voucher chưa bắt đầu'::TEXT;
    RETURN;
  END IF;
  
  IF now() > v_record.end_date THEN
    RETURN QUERY SELECT false, v_record.id, NULL::TEXT, v_record.name, NULL::NUMERIC, 'Voucher đã hết hạn'::TEXT;
    RETURN;
  END IF;
  
  -- Kiem tra so luong
  IF v_record.quantity_total IS NOT NULL AND v_record.quantity_used >= v_record.quantity_total THEN
    RETURN QUERY SELECT false, v_record.id, NULL::TEXT, v_record.name, NULL::NUMERIC, 'Voucher đã hết lượt sử dụng'::TEXT;
    RETURN;
  END IF;
  
  -- Kiem tra gioi han user
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_usage_count
    FROM voucher_usages
    WHERE voucher_id = v_record.id AND user_id = p_user_id;
    
    IF v_usage_count >= v_record.user_usage_limit THEN
      RETURN QUERY SELECT false, v_record.id, NULL::TEXT, v_record.name, NULL::NUMERIC, 'Bạn đã sử dụng voucher này rồi'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Kiem tra don hang toi thieu
  IF p_order_amount < v_record.min_order_amount THEN
    RETURN QUERY SELECT false, v_record.id, NULL::TEXT, v_record.name, NULL::NUMERIC, 
      format('Đơn hàng tối thiểu %s để sử dụng voucher này', v_record.min_order_amount)::TEXT;
    RETURN;
  END IF;
  
  -- Kiem tra san pham / danh muc (neu co)
  IF v_record.applicable_products IS NOT NULL AND array_length(v_record.applicable_products, 1) > 0 THEN
    IF p_product_ids IS NULL OR array_length(p_product_ids, 1) IS NULL THEN
      RETURN QUERY SELECT false, v_record.id, NULL::TEXT, v_record.name, NULL::NUMERIC, 
        'Voucher này chỉ áp dụng cho sản phẩm nhất định'::TEXT;
      RETURN;
    END IF;
    -- Kiem tra xem co san pham nao trong gio khong thuoc danh sach
    IF NOT EXISTS (
      SELECT 1 FROM unnest(p_product_ids) AS pid
      WHERE pid = ANY(v_record.applicable_products)
    ) THEN
      RETURN QUERY SELECT false, v_record.id, NULL::TEXT, v_record.name, NULL::NUMERIC, 
        'Giỏ hàng không có sản phẩm nào áp dụng voucher này'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Tinh discount amount
  DECLARE
    v_discount NUMERIC := 0;
  BEGIN
    IF v_record.type = 'percent' THEN
      v_discount := ROUND(p_order_amount * v_record.value / 100);
      -- Ap dung gioi han toi da neu co
      IF v_record.max_discount_amount IS NOT NULL AND v_discount > v_record.max_discount_amount THEN
        v_discount := v_record.max_discount_amount;
      END IF;
    ELSIF v_record.type = 'fixed_amount' THEN
      v_discount := LEAST(v_record.value, p_order_amount);
    ELSIF v_record.type = 'free_shipping' THEN
      v_discount := 0; -- Free shipping xu ly rieng o shipping fee
    END IF;
    
    RETURN QUERY SELECT 
      true, 
      v_record.id, 
      v_record.type, 
      v_record.name, 
      v_discount,
      NULL::TEXT;
  END;
  
END;
$$ LANGUAGE plpgsql;
