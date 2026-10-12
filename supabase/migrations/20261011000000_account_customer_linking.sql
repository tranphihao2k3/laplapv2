-- =====================================================================
-- Migration: /account customer linking + RLS  (FIXED v3 — reorder)
-- Date: 2026-10-11
-- Fix: tạo function set_updated_at() TRƯỚC khi tạo trigger sử dụng nó.
-- =====================================================================

-- 0) Hàm set_updated_at dùng chung (tạo trước tiên)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- 1) customers: thêm cột liên kết + soft delete + profile mở rộng
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other')),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_customers_set_updated_at ON customers;
CREATE TRIGGER trg_customers_set_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_auth_user_id
  ON customers(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;

-- 2) user_profiles: link sang customer + updated_at
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_user_profiles_set_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_set_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_customer_id
  ON user_profiles(customer_id) WHERE customer_id IS NOT NULL;

-- 3) Function: tạo customer + user_profile cho một auth user (gọi từ app signup).
--    KHÔNG tạo trigger trên auth.users (yêu cầu supabase_auth_admin role).
--    App sẽ gọi public.ensure_customer_for_auth_user() ngay sau khi signup thành công.
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cust_id uuid;
  v_full_name text;
BEGIN
  v_full_name := NEW.raw_user_meta_data ->> 'full_name';
  IF v_full_name IS NULL OR length(trim(v_full_name)) = 0 THEN
    v_full_name := split_part(NEW.email, '@', 1);
  END IF;

  -- Tránh tạo duplicate nếu email đã tồn tại customer cũ (guest checkout)
  SELECT id INTO v_cust_id
    FROM customers
    WHERE lower(email) = lower(NEW.email)
      AND deleted_at IS NULL
    LIMIT 1;

  IF v_cust_id IS NULL THEN
    INSERT INTO customers (auth_user_id, full_name, email, tier, loyalty_points, updated_at)
    VALUES (NEW.id, v_full_name, NEW.email, 'bronze', 0, now())
    RETURNING id INTO v_cust_id;
  ELSE
    UPDATE customers
      SET auth_user_id = NEW.id, updated_at = now()
      WHERE id = v_cust_id;
  END IF;

  INSERT INTO user_profiles (id, customer_id, full_name, phone, avatar_url, updated_at)
  VALUES (
    NEW.id,
    v_cust_id,
    v_full_name,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'avatar_url',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    full_name   = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    phone       = COALESCE(EXCLUDED.phone, user_profiles.phone),
    updated_at  = EXCLUDED.updated_at;

  RETURN NEW;
END $$;

-- 3b) Wrapper idempotent để app gọi từ client / server an toàn.
--     Trả về customer_id (tạo mới hoặc link existing).
CREATE OR REPLACE FUNCTION public.ensure_customer_for_auth_user(
  p_auth_user_id uuid,
  p_email text,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cust_id uuid;
  v_name text;
BEGIN
  v_name := COALESCE(NULLIF(trim(p_full_name), ''), split_part(p_email, '@', 1));

  -- Nếu đã có customer link với auth_user_id này → dùng luôn
  SELECT id INTO v_cust_id
    FROM customers
    WHERE auth_user_id = p_auth_user_id
    LIMIT 1;
  IF v_cust_id IS NOT NULL THEN
    RETURN v_cust_id;
  END IF;

  -- Nếu đã có customer cũ với email này (guest checkout) → link lại
  SELECT id INTO v_cust_id
    FROM customers
    WHERE lower(email) = lower(p_email) AND deleted_at IS NULL
    LIMIT 1;
  IF v_cust_id IS NOT NULL THEN
    UPDATE customers
      SET auth_user_id = p_auth_user_id, updated_at = now()
      WHERE id = v_cust_id;
  ELSE
    INSERT INTO customers (auth_user_id, full_name, email, tier, loyalty_points, updated_at)
    VALUES (p_auth_user_id, v_name, p_email, 'bronze', 0, now())
    RETURNING id INTO v_cust_id;
  END IF;

  -- Upsert user_profiles
  INSERT INTO user_profiles (id, customer_id, full_name, phone, avatar_url, updated_at)
  VALUES (p_auth_user_id, v_cust_id, v_name, p_phone, p_avatar_url, now())
  ON CONFLICT (id) DO UPDATE SET
    customer_id = EXCLUDED.customer_id,
    full_name   = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    phone       = COALESCE(EXCLUDED.phone, user_profiles.phone),
    updated_at  = EXCLUDED.updated_at;

  RETURN v_cust_id;
END $$;

-- 3c) Backfill helper: gọi 1 lần sau khi deploy để link các auth user đã tồn tại.
--     Trả về số customer đã link.
CREATE OR REPLACE FUNCTION public.backfill_customers_from_auth()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT id, email, raw_user_meta_data
    FROM auth.users
    WHERE email IS NOT NULL
  LOOP
    PERFORM public.ensure_customer_for_auth_user(
      v_rec.id,
      v_rec.email,
      v_rec.raw_user_meta_data ->> 'full_name',
      v_rec.raw_user_meta_data ->> 'phone',
      v_rec.raw_user_meta_data ->> 'avatar_url'
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- 4) RLS: customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_self_select ON customers;
CREATE POLICY customers_self_select ON customers
  FOR SELECT USING (auth_user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS customers_self_update ON customers;
CREATE POLICY customers_self_update ON customers
  FOR UPDATE USING (auth_user_id = auth.uid() AND deleted_at IS NULL);

-- 5) RLS: orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_self_select ON orders;
CREATE POLICY orders_self_select ON orders
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- 6) RLS: order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_self_select ON order_items;
CREATE POLICY order_items_self_select ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- 7) RLS: order_status_logs
ALTER TABLE order_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_status_logs_self_select ON order_status_logs;
CREATE POLICY order_status_logs_self_select ON order_status_logs
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- 8) RLS: payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_self_select ON payments;
CREATE POLICY payments_self_select ON payments
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- 9) RLS: warranties
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warranties_self_select ON warranties;
CREATE POLICY warranties_self_select ON warranties
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- 10) RLS: repair_tickets
ALTER TABLE repair_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repair_tickets_self_select ON repair_tickets;
CREATE POLICY repair_tickets_self_select ON repair_tickets
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS repair_tickets_self_insert ON repair_tickets;
CREATE POLICY repair_tickets_self_insert ON repair_tickets
  FOR INSERT WITH CHECK (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- 11) RLS: loyalty_transactions
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_self_select ON loyalty_transactions;
CREATE POLICY loyalty_self_select ON loyalty_transactions
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- 12) RLS: product_reviews
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_product_reviews_set_updated_at ON product_reviews;
CREATE TRIGGER trg_product_reviews_set_updated_at
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_reviews_customer
  ON product_reviews(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product
  ON product_reviews(product_id, status);

DROP POLICY IF EXISTS reviews_self_select ON product_reviews;
CREATE POLICY reviews_self_select ON product_reviews
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
    OR status = 'approved'
  );

DROP POLICY IF EXISTS reviews_self_insert ON product_reviews;
CREATE POLICY reviews_self_insert ON product_reviews
  FOR INSERT WITH CHECK (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS reviews_self_update ON product_reviews;
CREATE POLICY reviews_self_update ON product_reviews
  FOR UPDATE USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS reviews_self_delete ON product_reviews;
CREATE POLICY reviews_self_delete ON product_reviews
  FOR DELETE USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- 13) RLS: return_orders
ALTER TABLE return_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS returns_self_select ON return_orders;
CREATE POLICY returns_self_select ON return_orders
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- 14) Bảng notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_notifications_set_updated_at ON notifications;
CREATE TRIGGER trg_notifications_set_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_notifications_customer
  ON notifications(customer_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_self_select ON notifications;
CREATE POLICY notifications_self_select ON notifications
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS notifications_self_update ON notifications;
CREATE POLICY notifications_self_update ON notifications
  FOR UPDATE USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- 15) Bảng customer_addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text,
  recipient_name text NOT NULL,
  phone text NOT NULL,
  province text,
  district text,
  ward text,
  street text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_customer_addresses_set_updated_at ON customer_addresses;
CREATE TRIGGER trg_customer_addresses_set_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer
  ON customer_addresses(customer_id);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS addresses_self_crud ON customer_addresses;
CREATE POLICY addresses_self_crud ON customer_addresses
  FOR ALL USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  ) WITH CHECK (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- 16) voucher_claims
CREATE TABLE IF NOT EXISTS voucher_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  voucher_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, voucher_id)
);

DROP TRIGGER IF EXISTS trg_voucher_claims_set_updated_at ON voucher_claims;
CREATE TRIGGER trg_voucher_claims_set_updated_at
  BEFORE UPDATE ON voucher_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_voucher_claims_customer
  ON voucher_claims(customer_id);

ALTER TABLE voucher_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS voucher_claims_self_crud ON voucher_claims;
CREATE POLICY voucher_claims_self_crud ON voucher_claims
  FOR ALL USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  ) WITH CHECK (
    customer_id IN (
      SELECT id FROM customers
      WHERE auth_user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- 17) Backfill auth_user_id cho customer cũ (chỉ những email đã tồn tại trong auth.users)
UPDATE customers c
SET auth_user_id = u.id
FROM auth.users u
WHERE lower(c.email) = lower(u.email)
  AND c.auth_user_id IS NULL
  AND c.deleted_at IS NULL;

-- 17b) Đảm bảo mọi auth user đều có customer + user_profile (idempotent, an toàn chạy nhiều lần)
DO $$
DECLARE
  v_backfilled integer;
BEGIN
  SELECT public.backfill_customers_from_auth() INTO v_backfilled;
  RAISE NOTICE 'Backfilled % auth users to customers', v_backfilled;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'backfill_customers_from_auth skipped: %', SQLERRM;
END $$;

-- 18) Comments
COMMENT ON COLUMN customers.auth_user_id IS 'Liên kết customer với auth.users.id (Supabase auth)';
COMMENT ON COLUMN customers.deleted_at IS 'Soft-delete: khi user xoá tài khoản';
COMMENT ON COLUMN customers.preferences IS 'JSON tuỳ chọn: notification preferences, locale, theme...';
COMMENT ON FUNCTION public.ensure_customer_for_auth_user IS 'Gọi từ app sau signup: tạo customer + user_profile hoặc link customer cũ theo email';
COMMENT ON FUNCTION public.backfill_customers_from_auth IS 'Một lần sau deploy: link tất cả auth.users hiện có sang customers';
-- Lưu ý: KHÔNG còn trigger trên auth.users (cần supabase_auth_admin). App phải gọi
-- public.ensure_customer_for_auth_user() ngay sau khi Supabase auth signup thành công.
