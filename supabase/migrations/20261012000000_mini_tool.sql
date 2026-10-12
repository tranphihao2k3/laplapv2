-- =================================================================
-- Migration: mini_tool_sessions + mini_tool_uploads + hardware_test_results
-- Date: 2026-10-12
-- Purpose: Bảng cho LapLap Mini Tool — quản lý session token và upload payload
-- Tham chiếu: MINI_TOOL_PLAN.md §4.1
-- =================================================================

-- 1) mini_tool_sessions — session token do web sinh ra
CREATE TABLE IF NOT EXISTS mini_tool_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text UNIQUE NOT NULL,
  created_by   uuid,
  laptop_id    uuid REFERENCES laptops(id) ON DELETE SET NULL,
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  consumed_at  timestamptz,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_tool_sessions_sid    ON mini_tool_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_sessions_expiry ON mini_tool_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_mini_tool_sessions_laptop ON mini_tool_sessions(laptop_id);

ALTER TABLE mini_tool_sessions ENABLE ROW LEVEL SECURITY;

-- public read để tool verify; creation qua service role (admin API)
DROP POLICY IF EXISTS "Allow public read mini_tool_sessions" ON mini_tool_sessions;
CREATE POLICY "Allow public read mini_tool_sessions"
  ON mini_tool_sessions FOR SELECT USING (true);

-- 2) mini_tool_uploads — payload đầy đủ tool gửi lên
CREATE TABLE IF NOT EXISTS mini_tool_uploads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       text REFERENCES mini_tool_sessions(session_id) ON DELETE SET NULL,
  device_id        text NOT NULL,
  device_name      text,
  payload          jsonb NOT NULL,
  payload_version  text NOT NULL DEFAULT 'mini-tool-v1',
  signature        text,
  laptop_id        uuid REFERENCES laptops(id) ON DELETE SET NULL,
  gpu_score        integer,
  status           text NOT NULL DEFAULT 'processed' CHECK (status IN ('pending', 'processed', 'rejected')),
  rejection_reason text,
  os_info          jsonb,
  source_ip        inet,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '60 days')
);

CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_session  ON mini_tool_uploads(session_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_device   ON mini_tool_uploads(device_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_laptop  ON mini_tool_uploads(laptop_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_expires ON mini_tool_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_gpu     ON mini_tool_uploads(gpu_score DESC NULLS LAST);

ALTER TABLE mini_tool_uploads ENABLE ROW LEVEL SECURITY;

-- public read (mirror public read laptop_specs, gpu_benchmarks)
DROP POLICY IF EXISTS "Allow public read mini_tool_uploads" ON mini_tool_uploads;
CREATE POLICY "Allow public read mini_tool_uploads"
  ON mini_tool_uploads FOR SELECT USING (true);

-- 3) hardware_test_results — lưu từng test (pass/fail)
CREATE TABLE IF NOT EXISTS hardware_test_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id   uuid NOT NULL REFERENCES mini_tool_uploads(id) ON DELETE CASCADE,
  laptop_id   uuid REFERENCES laptops(id) ON DELETE SET NULL,
  test_type   text NOT NULL CHECK (test_type IN (
    'speaker', 'mic', 'camera', 'display_deadpixel', 'display_color',
    'keyboard', 'touchpad', 'wifi', 'mouse', 'launcher_test'
  )),
  result      text NOT NULL CHECK (result IN ('pass', 'fail', 'skip', 'inconclusive')),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hw_tests_upload  ON hardware_test_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_hw_tests_type    ON hardware_test_results(test_type);
CREATE INDEX IF NOT EXISTS idx_hw_tests_result ON hardware_test_results(result);

ALTER TABLE hardware_test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read hardware_test_results" ON hardware_test_results;
CREATE POLICY "Allow public read hardware_test_results"
  ON hardware_test_results FOR SELECT USING (true);

-- 4) Cleanup expired sessions (chạy định kỳ)
CREATE OR REPLACE FUNCTION public.cleanup_expired_mini_tool_sessions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM mini_tool_sessions WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 5) Cleanup expired uploads (chạy định kỳ)
CREATE OR REPLACE FUNCTION public.cleanup_expired_mini_tool_uploads()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM mini_tool_uploads WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- 6) Comments
COMMENT ON TABLE mini_tool_sessions IS 'Session token do web sinh ra, gửi cho Mini Tool de upload';
COMMENT ON COLUMN mini_tool_sessions.session_id IS 'UUID 32 chars (random hex), dung de tool verify';
COMMENT ON COLUMN mini_tool_sessions.context IS 'JSONb: redirectAfterUpload, require, source page...';
COMMENT ON COLUMN mini_tool_sessions.consumed_at IS 'Mark da su dung sau khi /upload xu ly xong';
COMMENT ON TABLE mini_tool_uploads IS 'Payload day du tool gui len sau khi scan/benchmark';
COMMENT ON COLUMN mini_tool_uploads.payload_version IS 'Schema version: mini-tool-v1';
COMMENT ON COLUMN mini_tool_uploads.signature IS 'HMAC-SHA256(secret, payload) hex — xac thuc payload';
COMMENT ON TABLE hardware_test_results IS 'Ket qua tung test (speaker, mic, camera...)';
