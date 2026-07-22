-- ============================================================
-- Repair services — bảng giá dịch vụ sửa chữa laptop
-- Admin CRUD ở /quanly/repair-services, client xem ở /dich-vu-sua-chua
--
-- Giá LINH HOẠT theo price_type:
--   'fixed'   → dùng price_min (VD 350.000đ)
--   'from'    → "Từ" price_min (VD Từ 350.000đ)
--   'range'   → price_min – price_max (VD 1.200.000 – 3.500.000đ)
--   'contact' → "Liên hệ" (không hiện số)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.repair_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,

  -- Nhóm dịch vụ (slug cố định — khớp REPAIR_SERVICE_CATEGORIES ở code):
  --   'thay-linh-kien' | 'sua-phan-cung' | 'sua-phan-mem' | 've-sinh-nang-cap'
  category text NOT NULL DEFAULT 'thay-linh-kien',

  name text NOT NULL,
  slug text,
  description text,

  price_type text NOT NULL DEFAULT 'from'
    CHECK (price_type IN ('fixed', 'from', 'range', 'contact')),
  price_min numeric(12, 0),
  price_max numeric(12, 0),
  unit text,                    -- đơn vị tuỳ chọn: "/ lần", "/ máy"...
  warranty_text text,           -- VD "Bảo hành 6 tháng"

  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_services_org ON public.repair_services(organization_id);
CREATE INDEX IF NOT EXISTS idx_repair_services_category ON public.repair_services(category);
CREATE INDEX IF NOT EXISTS idx_repair_services_active ON public.repair_services(is_active);
CREATE INDEX IF NOT EXISTS idx_repair_services_position ON public.repair_services(position);

-- Tự cập nhật updated_at (nếu chưa có function dùng chung thì tạo).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_repair_services_updated_at ON public.repair_services;
CREATE TRIGGER trg_repair_services_updated_at
  BEFORE UPDATE ON public.repair_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS: đọc công khai (client bảng giá), ghi cần đăng nhập.
-- API public dùng service-role nên vẫn đọc được; policy public read
-- cho phép hiển thị qua anon key nếu cần.
-- ============================================================
ALTER TABLE public.repair_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repair_services_public_read ON public.repair_services;
CREATE POLICY repair_services_public_read ON public.repair_services
  FOR SELECT USING (true);

DROP POLICY IF EXISTS repair_services_write ON public.repair_services;
CREATE POLICY repair_services_write ON public.repair_services
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
