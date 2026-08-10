-- ============================================================
-- Seed initial tools (smartctl + common diagnostic tools)
--
-- Admin can upload file that via /quanly/tools page.
-- File vao R2 bucket 'laplap-tools' voi key 'tools/<id>/<version>/<filename>'.
--
-- Neu upload smartctl.exe (Windows binary), tool id='smartctl', extract=false.
-- Scanner PS1 se tu dong download va cache vao %LOCALAPPDATA%\LapLap\Tools\
-- khi chay lan dau. Lan sau dung cache.
-- ============================================================

-- smartctl.exe (smartmontools) - Windows binary
-- Source: https://github.com/smartmontools/smartmontools/releases
-- File thực tế đã upload lên R2 key: tools/smartctl/smartctl.exe (3.37 MB, v7.5)
INSERT INTO tools (id, name, description, category, icon, r2_key, sha256, exec_name, extract, launch_args, requires_admin, size_bytes, version, vendor, status, sort_order)
VALUES (
  'smartctl',
  'smartctl (smartmontools)',
  'Đọc S.M.A.R.T. chi tiết hơn WMI. Cần cho NVMe percentage_used, SSD Wear Leveling, HDD Reallocated sectors. Cần quyền Admin để đọc full SMART data.',
  'diagnostic',
  '📊',
  'tools/smartctl/7.5/smartctl.exe',
  'VERIFY_REQUIRED',
  'smartctl.exe',
  false,
  '[]'::jsonb,
  true,
  3538944,
  '7.5',
  'smartmontools.org',
  'active',
  1
) ON CONFLICT (id) DO UPDATE SET
  r2_key = EXCLUDED.r2_key,
  size_bytes = EXCLUDED.size_bytes,
  version = EXCLUDED.version,
  description = EXCLUDED.description,
  updated_at = NOW();