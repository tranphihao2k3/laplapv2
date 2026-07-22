-- ============================================================
-- Benchmark Drafts
-- .exe gui ket qua -> tra ve id -> mo trang /result/{id} de xem va Luu
-- ============================================================

CREATE TABLE IF NOT EXISTS benchmark_drafts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  payload jsonb,
  saved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE benchmark_drafts
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 minutes');

CREATE INDEX IF NOT EXISTS idx_benchmark_drafts_expires_at ON benchmark_drafts(expires_at);

-- ============================================================
-- RLS - public cho desktop app + web anon key
-- ============================================================
ALTER TABLE benchmark_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read benchmark_drafts"   ON benchmark_drafts FOR SELECT USING (true);
CREATE POLICY "Allow public insert benchmark_drafts" ON benchmark_drafts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update benchmark_drafts" ON benchmark_drafts FOR UPDATE USING (true);
