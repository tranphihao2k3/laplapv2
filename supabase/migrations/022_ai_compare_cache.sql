-- ============================================================
-- AI Compare Cache - cache ket qua "AI phan tich" cua trang /so-sanh
--
-- VI SAO CAN CACHE: moi lan bam "AI phan tich" la 1 lan goi Gemini (ton quota,
-- cham 5-10s). Cung mot bo may + cung specs thi ket qua khong doi -> cache lai.
--
-- CACH TINH cache_key: SHA-256 cua chuoi fingerprint
--   "v<PROMPT_VERSION>::<model>::<id>|<gia>|cpu=..;ram=..::<id>|..."
-- Danh sach may DA SAP XEP theo id -> chon may theo thu tu nao cung ra 1 key.
--
-- TU INVALIDATE: fingerprint chua chinh NOI DUNG specs + gia, nen sua specs
-- hoac doi gia la key doi ngay. KHONG dung products.updated_at vi bang
-- product_variants (noi luu specs) khong co cot updated_at, va
-- products.updated_at khong doi khi admin sua specs cua variant.
-- Doi prompt/thang diem -> tang COMPARE_PROMPT_VERSION trong
-- src/lib/compare/cache-key.ts de invalidate toan bo cache cu.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_compare_cache (
  cache_key text PRIMARY KEY,                     -- SHA-256 hex cua fingerprint
  fingerprint text NOT NULL,                      -- chuoi nguon truoc khi hash (de debug)
  product_ids uuid[] NOT NULL,                    -- danh sach id da sap xep (audit/thong ke)
  model text NOT NULL DEFAULT 'gemini-2.5-flash', -- model da sinh ket qua nay
  prompt_version int NOT NULL DEFAULT 1,          -- khop COMPARE_PROMPT_VERSION
  payload jsonb NOT NULL,                         -- AiCompareResult da validate bang zod
  hit_count int NOT NULL DEFAULT 0,               -- so lan phuc vu tu cache (do hieu qua)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- TTL 30 ngay: het han thi sinh lai (gia thi truong / danh gia co the doi).
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);

-- Doc cache: WHERE cache_key = X AND expires_at > now()
CREATE INDEX IF NOT EXISTS idx_ai_compare_cache_expires ON ai_compare_cache(expires_at);
-- Dem so lan sinh moi trong 1 gio -> dung cho rate limit toan cuc.
CREATE INDEX IF NOT EXISTS idx_ai_compare_cache_created ON ai_compare_cache(created_at DESC);
-- Tim theo bo san pham (vd: admin muon xoa cache cua 1 may sau khi sua specs).
CREATE INDEX IF NOT EXISTS idx_ai_compare_cache_products ON ai_compare_cache USING GIN(product_ids);

-- RLS: bang nay CHI truy cap qua service role (API route). Bat RLS va KHONG tao
-- policy nao -> anon/authenticated khong doc/ghi duoc, service role van bypass.
ALTER TABLE ai_compare_cache ENABLE ROW LEVEL SECURITY;

-- Trigger tu dong cap nhat updated_at (function da tao o migration 013).
DROP TRIGGER IF EXISTS update_ai_compare_cache_updated_at ON ai_compare_cache;
CREATE TRIGGER update_ai_compare_cache_updated_at
  BEFORE UPDATE ON ai_compare_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
