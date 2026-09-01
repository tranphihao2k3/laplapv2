-- ============================================================
-- Newsletter - Đăng ký nhận thông báo sản phẩm mới qua email
--
-- 2 mode đăng ký:
--   (A) Subscribe all  - nhận mọi sản phẩm mới (brand_ids = [])
--   (B) Subscribe by brand - chỉ nhận sản phẩm của brand đã chọn
--       (vd: chỉ muốn nhận Dell, ko quan tâm hãng khác)
--
-- Double opt-in: user nhập email -> gửi email xác nhận -> bấm link
-- -> confirmed = true. Trong thời gian chờ, không gửi thông báo.
--
-- Trigger products → INSERT: tự queue email thông báo.
-- Dùng bảng newsletter_outbox làm buffer (lưu trong DB) + 1 endpoint
-- internal /api/v1/newsletter/dispatch mà DB trigger gọi qua pg_net.
-- Mục đích: trigger chỉ INSERT 1 dòng vào outbox (transaction an toàn),
-- service xử lý gửi email (có retry, idempotency, rate-limit riêng).
-- ============================================================

-- 1) Bang subscribers (nguoi dang ky)
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,                        -- email cua user (lowercase)
  brand_ids UUID[] NOT NULL DEFAULT '{}',             -- {} = nhan moi san pham; co list = loc theo brand
  is_active BOOLEAN NOT NULL DEFAULT true,           -- user co the unsubscribe -> false
  confirmed BOOLEAN NOT NULL DEFAULT false,           -- double opt-in
  confirm_token TEXT,                                 -- token gui trong email confirm (unique)
  unsubscribe_token TEXT NOT NULL,                    -- token gui trong moi email de unsubscribe (unique)
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  ip_address INET,                                    -- audit: ai dang ky (limit spam)
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subs_active_confirmed
  ON newsletter_subscribers(is_active, confirmed)
  WHERE is_active = true AND confirmed = true;
-- Index trên: query "lay tat ca subscriber da confirm + con active" khi dispatch.
-- Partial index: chi index nhung row can thiet -> nho hon full index.

CREATE INDEX IF NOT EXISTS idx_newsletter_subs_brand_ids
  ON newsletter_subscribers USING GIN(brand_ids);
-- Index trên: query "lay subscriber dang theo doi brand X" (brand_ids @> ARRAY[X]).
-- GIN phu hop cho array contains.

-- Unique token de URL confirm/unsubscribe khong bi doan/guess.
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subs_confirm_token
  ON newsletter_subscribers(confirm_token)
  WHERE confirm_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subs_unsub_token
  ON newsletter_subscribers(unsubscribe_token);

-- RLS: chi service role (API) duoc phep. Anon/auth KHONG read.
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
-- Khong tao policy nao -> anon/authenticated bi block, service role bypass RLS.


-- 2) Bang outbox - hang doi thong bao can gui
-- Trigger products INSERT/UPDATE se chen 1 dong vao day.
-- API dispatch scan outbox.status = 'pending' va goi Resend.
CREATE TABLE IF NOT EXISTS newsletter_outbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,                          -- FK den products (logical, khong FK constraint de tranh block khi product bi xoa)
  product_name TEXT NOT NULL,
  product_slug TEXT,
  product_brand_id UUID,
  product_brand_name TEXT,
  product_price NUMERIC,                              -- gia ban (VND)
  product_url TEXT NOT NULL,                          -- URL trang chi tiet san pham
  -- Status: pending -> sent -> (delivered neu Resend webhook)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,                   -- so lan da thu (de debug + rate-limit)
  last_error TEXT,                                    -- loi cuoi neu failed
  -- Dedupe: (product_id) -> moi product chi tao 1 outbox row (khi 1 san pham moi).
  -- Tranh truong hop admin sua nhieu lan trong ngay -> gui spam.
  dedupe_key TEXT GENERATED ALWAYS AS (product_id::text) STORED,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),    -- khi nao nen gui (co the delay)
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_outbox_dedupe
  ON newsletter_outbox(dedupe_key);
-- Moi product_id chi co 1 outbox row -> re-trigger (UPDATE) se update NOT INSERT.

CREATE INDEX IF NOT EXISTS idx_newsletter_outbox_status_pending
  ON newsletter_outbox(scheduled_at)
  WHERE status = 'pending';
-- Worker query: WHERE status='pending' AND scheduled_at <= now() ORDER BY scheduled_at.


-- 3) Bang audit: log moi email da gui (phuc vu debug + GDPR)
CREATE TABLE IF NOT EXISTS newsletter_send_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  outbox_id UUID NOT NULL REFERENCES newsletter_outbox(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,                                -- copy de audit (subscriber co the xoa sau)
  resend_message_id TEXT,                             -- Resend message ID (de track bounce/delivery)
  status TEXT NOT NULL,                               -- 'sent', 'failed', 'bounced'
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_log_subscriber
  ON newsletter_send_log(subscriber_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_log_outbox
  ON newsletter_send_log(outbox_id);

ALTER TABLE newsletter_send_log ENABLE ROW LEVEL SECURITY;


-- 4) Trigger updated_at cho subscribers (function da co o migration 013)
DROP TRIGGER IF EXISTS update_newsletter_subscribers_updated_at ON newsletter_subscribers;
CREATE TRIGGER update_newsletter_subscribers_updated_at
  BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- 5) Trigger tu dong tao outbox khi products INSERT/UPDATE thanh "active"
-- Logic:
--   - Chi trigger khi status -> 'active' (san pham duoc publish)
--   - INSERT/UPDATE 1 lan moi product_id (ON CONFLICT do nothing)
--   - Chi insert neu outbox chua ton tai (idempotent)
--   - Thu thap thong tin can thiet de gom email (name, slug, brand, price, url)
CREATE OR REPLACE FUNCTION notify_new_product()
RETURNS TRIGGER AS $$
DECLARE
  v_brand_name TEXT;
  v_min_price NUMERIC;
BEGIN
  -- Chi trigger khi san pham "active". San pham draft/archived khong thong bao.
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  -- Lay brand name neu co.
  IF NEW.brand_id IS NOT NULL THEN
    SELECT name INTO v_brand_name FROM brands WHERE id = NEW.brand_id;
  END IF;

  -- Lay gia thap nhat tu variants (gia co the NULL neu chua set).
  -- JOIN product_variants de biet gia - min(selling_price) hoac NULL.
  SELECT MIN(selling_price) INTO v_min_price
  FROM product_variants
  WHERE product_id = NEW.id AND is_active = true;

  -- INSERT outbox. ON CONFLICT (dedupe_key) DO NOTHING: re-trigger se khong tao them row.
  INSERT INTO newsletter_outbox (
    product_id, product_name, product_slug,
    product_brand_id, product_brand_name,
    product_price, product_url
  )
  VALUES (
    NEW.id, NEW.name, NEW.slug,
    NEW.brand_id, v_brand_name,
    v_min_price,
    -- URL tuyet doi: https://laplapcantho.store/products/<slug>
    -- Su dung current_setting voi fallback de test local va production deu OK.
    COALESCE(
      current_setting('app.public_url', true),
      'http://localhost:3000'
    ) || '/products/' || COALESCE(NEW.slug, NEW.id::text)
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger 2 loai:
--   - INSERT: san pham moi duoc tao
--   - UPDATE: san pham dang draft duoc activate
-- Trigger AFTER: chi can outbox, khong can sua NEW row.
DROP TRIGGER IF EXISTS trg_notify_new_product_ins ON products;
CREATE TRIGGER trg_notify_new_product_ins
  AFTER INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_product();

DROP TRIGGER IF EXISTS trg_notify_new_product_upd ON products;
CREATE TRIGGER trg_notify_new_product_upd
  AFTER UPDATE OF status ON products
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_new_product();


-- newsletter_outbox: no policy = all denied. Add INSERT so product trigger works.
CREATE POLICY "Allow authenticated inserts on newsletter_outbox"
  ON newsletter_outbox FOR INSERT
  TO authenticated
  WITH CHECK (true);
