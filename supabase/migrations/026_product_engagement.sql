-- Migration 026: Product engagement fields cho ProductCard V2.
--
-- V2 component cần các field tuỳ chọn: rating, reviewCount, soldCount,
-- inStock, isNew, isHot. Tất cả column dưới đây là NULLABLE/DEFAULT 0 nên
-- an toàn với data hiện tại — sản phẩm cũ sẽ hiển thị rating = 0 và sold = 0
-- cho đến khi được fill thủ công hoặc qua flow đánh giá sau này.
--
-- KHÔNG chạy tự động — chờ user apply bằng:
--   supabase db push  (hoặc)  psql -f supabase/migrations/026_product_engagement.sql

-- ===== 1. Engagement columns trên products =====
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(2,1) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hot BOOLEAN DEFAULT false;

-- CHECK constraint để guard rating_avg nằm trong [0, 5].
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_rating_avg_range'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_rating_avg_range
      CHECK (rating_avg IS NULL OR (rating_avg >= 0 AND rating_avg <= 5));
  END IF;
END $$;

-- Index phục vụ sort "bán chạy nhất" / "đánh giá cao nhất" sau này.
CREATE INDEX IF NOT EXISTS products_sold_count_idx ON products (sold_count DESC);
CREATE INDEX IF NOT EXISTS products_rating_avg_idx ON products (rating_avg DESC);

-- ===== 2. product_reviews table — optional, chỉ tạo nếu user thực sự cần =====
-- Lưu review thật để trigger có thể aggregate rating_avg + review_count.
-- Trước mắt V2 vẫn render OK với rating_avg/sold_count default 0, không bắt buộc
-- dùng bảng này. Bật/tắt qua comment.
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_name TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read reviews" ON product_reviews;
CREATE POLICY "Public read reviews" ON product_reviews
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON product_reviews(product_id);