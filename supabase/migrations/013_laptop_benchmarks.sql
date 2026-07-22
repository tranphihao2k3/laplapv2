-- ============================================================
-- Laptop Benchmark System - Database Migration
-- ============================================================

-- Bảng 1: laptops - Lưu thông tin máy tính
CREATE TABLE IF NOT EXISTS laptops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng 2: laptop_specs - Lưu thông số phần cứng
CREATE TABLE IF NOT EXISTS laptop_specs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  laptop_id UUID REFERENCES laptops(id) ON DELETE CASCADE,
  cpu_name VARCHAR(255),
  cpu_cores INTEGER,
  cpu_threads INTEGER,
  cpu_base_ghz NUMERIC(4,2),
  ram_gb INTEGER,
  ram_brand VARCHAR(100),
  ram_speed_mhz INTEGER,
  ram_type VARCHAR(50),
  ram_slots INTEGER,
  storage_brand VARCHAR(255),
  storage_type VARCHAR(50),
  storage_gb INTEGER,
  gpu_name VARCHAR(255),
  gpu_vendor VARCHAR(100),
  gpu_vram_gb INTEGER,
  gpu_power_watts INTEGER,
  battery_design_mwh INTEGER,
  battery_full_mwh INTEGER,
  battery_health NUMERIC(5,1),
  os_name VARCHAR(100),
  os_version VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bảng 3: gpu_benchmarks - Lưu kết quả test GPU
CREATE TABLE IF NOT EXISTS gpu_benchmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  laptop_id UUID REFERENCES laptops(id) ON DELETE CASCADE,
  test_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  gpu_score INTEGER NOT NULL,
  gpu_rank VARCHAR(20),
  test_duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index cho performance
CREATE INDEX IF NOT EXISTS idx_laptops_device_id ON laptops(device_id);
CREATE INDEX IF NOT EXISTS idx_laptop_specs_laptop_id ON laptop_specs(laptop_id);
CREATE INDEX IF NOT EXISTS idx_gpu_benchmarks_laptop_id ON gpu_benchmarks(laptop_id);
CREATE INDEX IF NOT EXISTS idx_gpu_benchmarks_score ON gpu_benchmarks(gpu_score DESC);

-- ============================================================
-- RLS Policies - Cho phép public read/write cho desktop app
-- ============================================================
ALTER TABLE laptops ENABLE ROW LEVEL SECURITY;
ALTER TABLE laptop_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gpu_benchmarks ENABLE ROW LEVEL SECURITY;

-- Policy cho phép mọi người đọc (public read)
CREATE POLICY "Allow public read laptops" ON laptops
  FOR SELECT USING (true);

CREATE POLICY "Allow public read laptop_specs" ON laptop_specs
  FOR SELECT USING (true);

CREATE POLICY "Allow public read gpu_benchmarks" ON gpu_benchmarks
  FOR SELECT USING (true);

-- Policy cho phép mọi người insert/update (public write cho desktop app)
CREATE POLICY "Allow public insert laptops" ON laptops
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update laptops" ON laptops
  FOR UPDATE USING (true);

CREATE POLICY "Allow public insert laptop_specs" ON laptop_specs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update laptop_specs" ON laptop_specs
  FOR UPDATE USING (true);

CREATE POLICY "Allow public insert gpu_benchmarks" ON gpu_benchmarks
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- FUNCTION: Tự động cập nhật updated_at khi có thay đổi
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger cho laptops
DROP TRIGGER IF EXISTS update_laptops_updated_at ON laptops;
CREATE TRIGGER update_laptops_updated_at
  BEFORE UPDATE ON laptops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger cho laptop_specs
DROP TRIGGER IF EXISTS update_laptop_specs_updated_at ON laptop_specs;
CREATE TRIGGER update_laptop_specs_updated_at
  BEFORE UPDATE ON laptop_specs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTION: Tính GPU Rank dựa trên GPU Score
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_gpu_rank(score INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF score >= 8000 THEN
    RETURN 'Excellent';
  ELSIF score >= 6000 THEN
    RETURN 'Good';
  ELSIF score >= 4000 THEN
    RETURN 'Fair';
  ELSE
    RETURN 'Poor';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Tính Percentile cho laptop
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_percentile(laptop_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  my_score INTEGER;
  total_count INTEGER;
  lower_count INTEGER;
  percentile NUMERIC;
BEGIN
  -- Lấy GPU score mới nhất của laptop
  SELECT gpu_score INTO my_score
  FROM gpu_benchmarks
  WHERE laptop_id = laptop_uuid
  ORDER BY test_date DESC
  LIMIT 1;

  IF my_score IS NULL THEN
    RETURN 0;
  END IF;

  -- Đếm tổng số laptop đã test
  SELECT COUNT(DISTINCT laptop_id) INTO total_count
  FROM gpu_benchmarks;

  -- Đếm số laptop có GPU score thấp hơn
  SELECT COUNT(DISTINCT b.laptop_id) INTO lower_count
  FROM gpu_benchmarks b
  WHERE b.gpu_score < my_score;

  -- Tính percentile
  IF total_count <= 1 THEN
    RETURN 100;
  END IF;

  percentile := ROUND((lower_count::NUMERIC / (total_count - 1)) * 100, 1);
  RETURN GREATEST(0, LEAST(100, percentile));
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEW: Bảng xếp hạng laptop
-- ============================================================
CREATE OR REPLACE VIEW laptop_rankings AS
SELECT
  l.id AS laptop_id,
  l.device_name,
  s.cpu_name,
  s.cpu_cores,
  s.ram_gb,
  s.ram_type,
  s.gpu_name,
  s.gpu_vram_gb,
  b.gpu_score,
  b.gpu_rank,
  b.test_date,
  calculate_percentile(l.id) AS percentile
FROM laptops l
LEFT JOIN laptop_specs s ON l.id = s.laptop_id
LEFT JOIN gpu_benchmarks b ON l.id = b.laptop_id
  AND b.test_date = (
    SELECT MAX(test_date)
    FROM gpu_benchmarks
    WHERE laptop_id = l.id
  )
WHERE b.gpu_score IS NOT NULL
ORDER BY b.gpu_score DESC;