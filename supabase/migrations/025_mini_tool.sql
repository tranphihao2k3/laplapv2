-- ═══════════════════════════════════════════════════════════
-- LapLap Mini Tool — DDL only (DO NOT RUN YET)
-- ═══════════════════════════════════════════════════════════
-- Migration:  025_mini_tool.sql
-- Mục đích:  Hạ tầng database cho "LapLap Mini Tool" (desktop tool portable).
--             Web sinh session token → tool paste → tool gửi payload + HMAC
--             lên web → web verify, upsert laptop + specs + benchmark + lưu
--             raw payload + test results.
--
-- Liên quan:  MINI_TOOL_PLAN.md §4 (database schema) + §5 (API endpoints).
--             API routes tương ứng ở src/app/api/v1/mini-tool/*.
--
-- ⚠ DDL ONLY — DO NOT RUN YET.
-- Sau khi review, copy nguyên block dưới đây vào Supabase SQL Editor
-- (hoặc dùng supabase CLI) và chạy thủ công. Migration này CHƯA được apply
-- lên bất kỳ môi trường nào.
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) mini_tool_sessions — session token do web cấp cho tool
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mini_tool_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text UNIQUE NOT NULL,                  -- 32 hex chars (gửi cho tool)
  created_by   uuid,                                  -- optional: user nếu đăng nhập
  laptop_id    uuid REFERENCES laptops(id) ON DELETE SET NULL,
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  consumed_at  timestamptz,                           -- set sau khi /upload xử lý xong
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_tool_sessions_sid    ON mini_tool_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_sessions_expiry ON mini_tool_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_mini_tool_sessions_laptop ON mini_tool_sessions(laptop_id);

ALTER TABLE mini_tool_sessions ENABLE ROW LEVEL SECURITY;

-- public read (tool verify sid); write/insert chỉ qua service role (API route)
DROP POLICY IF EXISTS "Allow public read mini_tool_sessions" ON mini_tool_sessions;
CREATE POLICY "Allow public read mini_tool_sessions"
  ON mini_tool_sessions FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- 2) mini_tool_uploads — payload đầy đủ tool gửi lên
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mini_tool_uploads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       text REFERENCES mini_tool_sessions(session_id) ON DELETE SET NULL,
  device_id        text NOT NULL,
  device_name      text,
  payload          jsonb NOT NULL,                     -- raw payload (audit / re-parse)
  payload_version  text NOT NULL DEFAULT 'mini-tool-v1',
  signature        text,                               -- HMAC-SHA256 hex
  laptop_id        uuid REFERENCES laptops(id) ON DELETE SET NULL,
  gpu_score        integer,
  status           text NOT NULL DEFAULT 'processed',
  rejection_reason text,
  os_info          jsonb,
  source_ip        inet,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '60 days')
);

CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_session ON mini_tool_uploads(session_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_device  ON mini_tool_uploads(device_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_laptop  ON mini_tool_uploads(laptop_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_expires ON mini_tool_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_gpu     ON mini_tool_uploads(gpu_score DESC NULLS LAST);

ALTER TABLE mini_tool_uploads ENABLE ROW LEVEL SECURITY;

-- Public read (mirror public-read pattern của laptops/laptop_specs/gpu_benchmarks).
-- INSERT/UPDATE/DELETE chỉ qua service role (API route) — không có policy cho anon.
DROP POLICY IF EXISTS "Allow public read mini_tool_uploads" ON mini_tool_uploads;
CREATE POLICY "Allow public read mini_tool_uploads"
  ON mini_tool_uploads FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- 3) hardware_test_results — từng test pass/fail
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hardware_test_results (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id  uuid NOT NULL REFERENCES mini_tool_uploads(id) ON DELETE CASCADE,
  laptop_id  uuid REFERENCES laptops(id) ON DELETE SET NULL,
  -- 'speaker' | 'mic' | 'camera' | 'display_deadpixel' | 'display_color' |
  -- 'keyboard' | 'touchpad' | 'wifi' | 'mouse' | 'launcher_test'
  test_type  text NOT NULL,
  -- 'pass' | 'fail' | 'skip' | 'inconclusive'
  result     text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hw_tests_upload ON hardware_test_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_hw_tests_type   ON hardware_test_results(test_type);
CREATE INDEX IF NOT EXISTS idx_hw_tests_result ON hardware_test_results(result);
CREATE INDEX IF NOT EXISTS idx_hw_tests_laptop ON hardware_test_results(laptop_id);

ALTER TABLE hardware_test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read hardware_test_results" ON hardware_test_results;
CREATE POLICY "Allow public read hardware_test_results"
  ON hardware_test_results FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- 4) laptop_specs — bổ sung các cột còn thiếu
-- ─────────────────────────────────────────────────────────────
-- Migration 016 đã có `mainboard` và `battery_cycles`. ADD COLUMN IF NOT EXISTS
-- nên chạy idempotent — không phá migration cũ.
ALTER TABLE laptop_specs
  ADD COLUMN IF NOT EXISTS mainboard             varchar(255),
  ADD COLUMN IF NOT EXISTS battery_cycles        integer,
  ADD COLUMN IF NOT EXISTS bios_version          varchar(64),
  ADD COLUMN IF NOT EXISTS bios_serial           text,
  ADD COLUMN IF NOT EXISTS motherboard_serial    text,
  ADD COLUMN IF NOT EXISTS product_sku           varchar(128),
  ADD COLUMN IF NOT EXISTS os_edition            varchar(64),
  ADD COLUMN IF NOT EXISTS os_build              varchar(32),
  ADD COLUMN IF NOT EXISTS os_arch               varchar(16),
  ADD COLUMN IF NOT EXISTS os_activated          boolean,
  ADD COLUMN IF NOT EXISTS network_macs          jsonb,
  ADD COLUMN IF NOT EXISTS wifi_adapter          varchar(255),
  ADD COLUMN IF NOT EXISTS storage_drives        jsonb,
  ADD COLUMN IF NOT EXISTS ram_slots_detail      jsonb,
  ADD COLUMN IF NOT EXISTS storage_health_pct    integer,
  ADD COLUMN IF NOT EXISTS gpu_driver_version    varchar(64);

-- ═══════════════════════════════════════════════════════════
-- REMINDER (DBA): file này là DDL ONLY.
-- Chưa chạy trên bất kỳ môi trường nào.
-- Reviewer: xác nhận indexes + RLS policies đầy đủ trước khi apply.
-- Sau khi apply, đối chiếu type ở src/types/database.ts (mini_tool_*) và
-- regenerate bằng:
--   npx supabase gen types typescript --project-id <ref> --schema public \
--     > src/types/database.ts
-- ═══════════════════════════════════════════════════════════