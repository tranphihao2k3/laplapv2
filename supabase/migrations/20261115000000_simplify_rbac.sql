-- ============================================================
-- Rút gọn RBAC: chỉ còn 2 loại tài khoản
--   - Admin/nhân sự: user_profiles.organization_id IS NOT NULL → toàn quyền
--   - Khách: không có organization_id → bị chặn ở tầng API/RLS
--
-- has_permission() bỏ qua mã quyền, chỉ kiểm tra user có thuộc tổ chức hay không.
-- Nhờ vậy mọi policy RLS hiện có (customers, warranties, serial_numbers,
-- vouchers, ...) không cần cấp từng mã quyền nữa.
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_permission(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.organization_id IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO anon, authenticated;
