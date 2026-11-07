-- =================================================================
-- Migration: site_page_views_daily + increment_site_page_view RPC
-- Date: 2026-11-07
-- Purpose: Đếm lượt xem trang (page views) theo ngày + path cho báo cáo
--          /quanly/bao-cao/truy-cap. Chỉ service role ghi/đọc qua API.
-- =================================================================

CREATE TABLE IF NOT EXISTS site_page_views_daily (
  day   date NOT NULL,
  path  text NOT NULL,
  views integer NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (day, path)
);

CREATE INDEX IF NOT EXISTS idx_site_page_views_daily_day
  ON site_page_views_daily (day DESC);

CREATE INDEX IF NOT EXISTS idx_site_page_views_daily_path_day
  ON site_page_views_daily (path, day DESC);

ALTER TABLE site_page_views_daily ENABLE ROW LEVEL SECURITY;

-- Không mở policy cho anon/authenticated — chỉ bypass RLS bằng service role.
DROP POLICY IF EXISTS "Deny all site_page_views_daily" ON site_page_views_daily;

/**
 * Cộng +1 view cho path trong ngày hiện tại (timezone VN).
 * path đã được normalize ở API (bắt đầu bằng /, không query string).
 */
CREATE OR REPLACE FUNCTION increment_site_page_view(p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date := (timezone('Asia/Ho_Chi_Minh', now()))::date;
  v_path text := left(trim(p_path), 200);
BEGIN
  IF v_path IS NULL OR v_path = '' OR left(v_path, 1) <> '/' THEN
    RETURN;
  END IF;

  INSERT INTO site_page_views_daily (day, path, views)
  VALUES (v_day, v_path, 1)
  ON CONFLICT (day, path)
  DO UPDATE SET views = site_page_views_daily.views + 1;
END;
$$;

REVOKE ALL ON FUNCTION increment_site_page_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_site_page_view(text) TO service_role;
