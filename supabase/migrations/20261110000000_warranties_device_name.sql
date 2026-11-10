-- =====================================================================
-- Migration: warranties.device_name column
-- Date: 2026-11-10
-- Problem: trang bảo hành tìm kiếm theo tên máy nhưng bảng warranties
--   KHÔNG có cột device_name → service searchColumns rỗng → không tìm thấy
--   bảo hành vừa tạo (device_name chỉ được lưu dưới dạng text trong `note`).
-- Fix: thêm cột device_name (nullable). Route tạo nhanh sẽ populate cột này.
-- =====================================================================

ALTER TABLE warranties
  ADD COLUMN IF NOT EXISTS device_name text;

COMMENT ON COLUMN warranties.device_name IS 'Tên thiết bị — dùng để tìm kiếm nhanh (khi máy ngoài catalog, không có serial_numbers).';