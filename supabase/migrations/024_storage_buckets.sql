-- ═══════════════════════════════════════════════════════════
-- SUPABASE STORAGE BUCKETS — LapLap migration từ Cloudflare R2
-- ═══════════════════════════════════════════════════════════
-- Chạy trong Supabase SQL Editor (hoặc qua supabase CLI).
-- Tạo 2 buckets:
--   - "speaker-audio" (public read) - thay cho AUDIO_BUCKET R2
--   - "tools"  (private)            - thay cho TOOLS_BUCKET R2
--
-- Schema tham chiếu (xem migration 021_tools_catalog.sql):
--   permissions(code, description)
--   roles(id, code, name, ...)
--   role_permissions(role_id, permission_id)
--   user_profiles(id, ...)
--   shop_staff(user_id, role_id, is_active, ...)
--
-- Service-role bypass RLS — admin client dùng trong lib/storage/supabase.ts.
-- Authenticated user có quyền 'admin.manage_tools' (qua role) mới được CRUD.
-- ═══════════════════════════════════════════════════════════

-- 1. Tạo bucket PUBLIC cho audio (ai cũng đọc được)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'speaker-audio',
  'speaker-audio',
  true,
  31457280, -- 30MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/ogg',
        'audio/flac', 'audio/aac', 'audio/x-m4a', 'audio/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Tạo bucket PRIVATE cho tools (chỉ admin)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tools',
  'tools',
  false,
  209715200, -- 200MB
  ARRAY['application/octet-stream', 'application/zip', 'application/x-msdownload',
        'application/x-msdos-program', 'application/x-exe']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Policies cho speaker-audio (public READ, authenticated WRITE cho admin)
--    Public đọc không cần policy đặc biệt vì bucket public = ON.
--    Nhưng để chặt chẽ, ta khai báo policy SELECT cho mọi role.

DROP POLICY IF EXISTS "speaker-audio public read" ON storage.objects;
CREATE POLICY "speaker-audio public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'speaker-audio');

--    INSERT/UPDATE/DELETE: chỉ admin có quyền admin.manage_speakers (hoặc admin.*)
--    Tạm thời giữ đơn giản: cho tất cả authenticated users (service-role xử lý chính).
DROP POLICY IF EXISTS "speaker-audio authenticated insert" ON storage.objects;
CREATE POLICY "speaker-audio authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'speaker-audio');

DROP POLICY IF EXISTS "speaker-audio authenticated update" ON storage.objects;
CREATE POLICY "speaker-audio authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'speaker-audio');

DROP POLICY IF EXISTS "speaker-audio authenticated delete" ON storage.objects;
CREATE POLICY "speaker-audio authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'speaker-audio');

-- 4. Policies cho tools (admin only — admin.manage_tools permission)
--    Dùng schema chuẩn của project: shop_staff → roles → role_permissions → permissions

DROP POLICY IF EXISTS "tools admin read" ON storage.objects;
CREATE POLICY "tools admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tools'
    AND EXISTS (
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

DROP POLICY IF EXISTS "tools admin insert" ON storage.objects;
CREATE POLICY "tools admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tools'
    AND EXISTS (
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

DROP POLICY IF EXISTS "tools admin update" ON storage.objects;
CREATE POLICY "tools admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tools'
    AND EXISTS (
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

DROP POLICY IF EXISTS "tools admin delete" ON storage.objects;
CREATE POLICY "tools admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tools'
    AND EXISTS (
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

-- 5. Verify
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('speaker-audio', 'tools');
