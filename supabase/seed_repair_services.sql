-- ============================================================
-- Seed data cho bảng repair_services (Bảng giá sửa chữa laptop)
-- Chú ý: Hãy chắc chắn rằng bạn đã chạy file migration tạo bảng trước (017_repair_services.sql)
-- ============================================================

INSERT INTO public.repair_services (category, name, price_type, price_min, price_max, position, is_active, is_featured, unit)
VALUES
  -- 1. Vệ sinh & Nâng cấp (ve-sinh-nang-cap)
  ('ve-sinh-nang-cap', 'Vệ sinh laptop', 'range', 150000, 300000, 1, true, true, '/ máy'),
  ('ve-sinh-nang-cap', 'Vệ sinh PC (Máy bàn)', 'range', 250000, 350000, 2, true, false, '/ máy'),
  ('ve-sinh-nang-cap', 'Nâng cấp ổ cứng SSD 128GB', 'fixed', 600000, null, 3, true, false, '/ ổ'),
  ('ve-sinh-nang-cap', 'Nâng cấp ổ cứng SSD 256GB', 'fixed', 900000, null, 4, true, true, '/ ổ'),
  ('ve-sinh-nang-cap', 'Nâng cấp ổ cứng SSD 512GB', 'fixed', 1700000, null, 5, true, true, '/ ổ'),
  ('ve-sinh-nang-cap', 'Nâng cấp ổ cứng SSD 1TB', 'fixed', 3000000, null, 6, true, false, '/ ổ'),
  ('ve-sinh-nang-cap', 'Nâng cấp RAM 8GB', 'from', 900000, null, 7, true, true, '/ thanh'),
  ('ve-sinh-nang-cap', 'Nâng cấp RAM 16GB', 'from', 1800000, null, 8, true, true, '/ thanh'),

  -- 2. Sửa phần cứng (sua-phan-cung)
  ('sua-phan-cung', 'Kiểm tra tình trạng máy', 'range', 100000, 200000, 1, true, false, '/ lần'),
  ('sua-phan-cung', 'Làm bản lề', 'range', 300000, 400000, 2, true, true, '/ lần'),
  ('sua-phan-cung', 'Sửa nguồn (Mainboard)', 'range', 600000, 1500000, 3, true, true, '/ lần'),

  -- 3. Thay thế linh kiện (thay-linh-kien)
  ('thay-linh-kien', 'Thay bàn phím laptop', 'range', 400000, 1000000, 1, true, true, '/ phím'),
  ('thay-linh-kien', 'Thay màn hình laptop', 'range', 1200000, 5000000, 2, true, true, '/ màn'),
  ('thay-linh-kien', 'Thay loa laptop', 'range', 250000, 350000, 3, true, false, '/ cặp'),
  ('thay-linh-kien', 'Cục sạc (Adapter) các loại', 'range', 350000, 1500000, 4, true, false, '/ cục'),
  ('thay-linh-kien', 'Thay vỏ laptop', 'contact', null, null, 5, true, false, null),

  -- 4. Sửa phần mềm (sua-phan-mem)
  ('sua-phan-mem', 'Cài lại chương trình máy (Win, macOS, phần mềm)', 'fixed', 150000, null, 1, true, true, '/ lần');
