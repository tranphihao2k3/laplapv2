-- ============================================================
-- Bo sung cot con thieu cho gpu_benchmarks + laptop_specs
-- (endpoint /api/v1/laptops/submit ghi cac cot nay nhung migration 013 chua co)
-- ============================================================

ALTER TABLE gpu_benchmarks
  ADD COLUMN IF NOT EXISTS fps_avg    NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS fps_min    NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS fps_max    NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS note       TEXT,
  ADD COLUMN IF NOT EXISTS condition  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tech_name  VARCHAR(255);

ALTER TABLE laptop_specs
  ADD COLUMN IF NOT EXISTS mainboard      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS battery_cycles INTEGER;
