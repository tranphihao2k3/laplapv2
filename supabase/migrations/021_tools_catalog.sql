-- ============================================================
-- Tools Catalog (admin-managed)
--
-- Thay the hardcoded TOOL_CATALOG trong src/lib/tools/catalog.ts.
-- Admin upload file tool (.exe / .zip) len R2 (bucket 'laplap-tools'),
-- luu metadata vao bang nay. Client GET /api/v1/tools lay danh sach,
-- POST /api/v1/system-scan/command?token=X de scanner PS1 download tu
-- R2 (thong qua server proxy /api/v1/tools/download) launch tool.
--
-- LUONG SU DUNG:
-- 1. Admin POST /api/v1/admin/tools (upload form: file + metadata)
--    -> server upload file len R2 key 'tools/<id>/<version>/<file>'
--    -> insert row vao bang nay.
-- 2. User GET /api/v1/tools -> list (id, name, icon, size, sha256, ...)
-- 3. User nhan nut "Mo tool" -> POST /api/v1/system-scan/command?token=X
--    -> server queue command (toolId, r2Key, sha256, exec, args, extract).
-- 4. Scanner PS1 poll command-poll, nhan command, GET /api/v1/tools/download
--    -> server stream file tu R2 -> scanner save local -> extract ->
--    launch .exe -> POST progress ve server.
-- ============================================================

CREATE TABLE IF NOT EXISTS tools (
  id text PRIMARY KEY,
  -- Ten hien thi tren UI.
  name text NOT NULL,
  -- Mo ta ngan.
  description text NOT NULL DEFAULT '',
  -- Phan loai: diagnostic, stress, benchmark, utility.
  category text NOT NULL DEFAULT 'utility',
  -- Icon emoji UI.
  icon text NOT NULL DEFAULT '🔧',
  -- R2 key (vi du: "tools/cpu-z/2.20.2/cpu-z_2.20.2-en.zip").
  -- File thuc te o R2 bucket 'laplap-tools'.
  r2_key text NOT NULL UNIQUE,
  -- SHA256 cua file de verify sau khi tai.
  -- Co the placeholder 'VERIFY_REQUIRED' (khong biet hash goc).
  sha256 text NOT NULL DEFAULT 'VERIFY_REQUIRED',
  -- Ten file exe chinh sau extract (hoac chinh file tai ve neu khong zip).
  exec_name text NOT NULL,
  -- Co phai zip can extract khong? (true) hay exe chay truc tiep (false).
  extract boolean NOT NULL DEFAULT true,
  -- JSONB array strings: args mac dinh khi launch.
  launch_args jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Co can quyen admin tren may user khong?
  requires_admin boolean NOT NULL DEFAULT false,
  -- Dung luong bytes (de hien thi UI).
  size_bytes bigint NOT NULL DEFAULT 0,
  -- Phien ban (semver tu do, optional).
  version text,
  -- Ten goi (vi du "TechPowerUp" cho GPU-Z).
  vendor text,
  -- Trang thai:
  --  - 'active': hien thi binh thuong
  --  - 'hidden': admin an tam thoi
  --  - 'disabled': ngung ho tro, khong cho download
  status text NOT NULL DEFAULT 'active',
  -- Sap xep (so nho len truoc).
  sort_order int NOT NULL DEFAULT 100,
  -- Audit.
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index cho list (active + sort).
CREATE INDEX IF NOT EXISTS idx_tools_status_sort
  ON tools(status, sort_order, name);

-- RLS: admin moi co the ghi, ai cung co the doc (de scanner PS1 cung co the
-- download file thong qua public endpoint, nhung download qua route co
-- token nhan dien).
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

-- Public read (user can xem catalog).
DROP POLICY IF EXISTS "Allow public read tools" ON tools;
CREATE POLICY "Allow public read tools"
  ON tools FOR SELECT USING (true);

-- Chi admin moi duoc insert/update/delete.
DROP POLICY IF EXISTS "Allow admin manage tools" ON tools;
CREATE POLICY "Allow admin manage tools"
  ON tools FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN shop_staff ss ON ss.user_id = up.id
      JOIN roles r ON r.id = ss.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE up.id = auth.uid()
        AND ss.is_active = true
        AND p.code = 'admin.manage_tools'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM user_profiles up
      JOIN shop_staff ss ON ss.user_id = up.id
      JOIN roles r ON r.id = ss.role_id
      JOIN role_permissions rp ON rp.role_id = r.id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE up.id = auth.uid()
        AND ss.is_active = true
        AND p.code = 'admin.manage_tools'
    )
  );

-- ============================================================
-- Permission: 'admin.manage_tools'
-- ============================================================
INSERT INTO permissions (code, name, description)
VALUES ('admin.manage_tools', 'Quản lý công cụ kiểm tra', 'Upload/edit/delete tools trong R2 + catalog')
ON CONFLICT (code) DO NOTHING;
