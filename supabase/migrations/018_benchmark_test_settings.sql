-- ============================================================
-- Luu thiet lap benchmark FurMark de ranking co du lieu ro rang
-- ============================================================

ALTER TABLE gpu_benchmarks
  ADD COLUMN IF NOT EXISTS benchmark_tool VARCHAR(100),
  ADD COLUMN IF NOT EXISTS test_width INTEGER,
  ADD COLUMN IF NOT EXISTS test_height INTEGER,
  ADD COLUMN IF NOT EXISTS test_preset VARCHAR(50);
