-- ============================================================
-- System Scan Results
-- Scanner (LapLap-Scanner.bat) gui ket qua kem token -> web poll theo token.
--
-- VI SAO CAN BANG NAY:
-- Truoc day submit/poll dung `global.scanResults` (Map trong RAM). Chay
-- `next dev` mot process thi on, nhung tren Cloudflare Workers moi request co
-- the vao MOT ISOLATE KHAC NHAU -> scanner POST vao isolate A, web poll o
-- isolate B khong thay gi -> scanner bao "DA GUI LEN SERVER" ma web dung o
-- buoc 2 mai. Bo nho isolate cung bi thu hoi bat ky luc nao.
-- Dung bang DB de trang thai chia se duoc giua cac isolate.
--
-- Cung pattern voi 015_benchmark_drafts.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_scan_results (
  token text PRIMARY KEY,
  status text NOT NULL DEFAULT 'scanning',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Ket qua quet chi can song du lau de web poll xong roi luu ranking
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 minutes')
);

CREATE INDEX IF NOT EXISTS idx_system_scan_results_expires_at
  ON system_scan_results(expires_at);

-- ============================================================
-- RLS - scanner chay tren may khach (khong dang nhap) nen can public,
-- giong benchmark_drafts. Token la chuoi ngau nhien, khong doan duoc.
-- ============================================================
ALTER TABLE system_scan_results ENABLE ROW LEVEL SECURITY;

-- DROP truoc CREATE: Postgres khong ho tro CREATE POLICY IF NOT EXISTS, nen
-- chay lai migration lan 2 se bao "policy ... already exists" (42710).
-- Cung cach lam nhu 017_repair_services.sql -> chay bao nhieu lan cung duoc.
DROP POLICY IF EXISTS "Allow public read system_scan_results" ON system_scan_results;
CREATE POLICY "Allow public read system_scan_results"
  ON system_scan_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert system_scan_results" ON system_scan_results;
CREATE POLICY "Allow public insert system_scan_results"
  ON system_scan_results FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update system_scan_results" ON system_scan_results;
CREATE POLICY "Allow public update system_scan_results"
  ON system_scan_results FOR UPDATE USING (true);
