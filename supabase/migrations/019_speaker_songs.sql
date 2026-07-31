-- ============================================================
-- Speaker Songs - Bài nhạc dùng để test loa
-- ============================================================

CREATE TABLE IF NOT EXISTS speaker_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,              -- Tên hiển thị
  artist VARCHAR(255),                       -- Tên nghệ sĩ (tuỳ chọn)
  file_url TEXT NOT NULL,                   -- URL công khai trên R2
  file_key TEXT NOT NULL,                   -- Key trong R2 bucket (để xoá)
  file_size_bytes BIGINT,                   -- Dung lượng file
  duration_seconds INTEGER,                 -- Thời lượng (giây)
  position INTEGER NOT NULL DEFAULT 0,      -- Thứ tự hiển thị
  is_active BOOLEAN NOT NULL DEFAULT true,  -- Hiển thị hay ẩn
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaker_songs_position ON speaker_songs(position);
CREATE INDEX IF NOT EXISTS idx_speaker_songs_is_active ON speaker_songs(is_active);

-- RLS: public read, admin write (thông qua service role key)
ALTER TABLE speaker_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read speaker_songs" ON speaker_songs
  FOR SELECT USING (true);

-- insert/update/delete chỉ qua service role (API routes dùng service role key)
-- Client không có quyền ghi trực tiếp

-- Trigger tự động cập nhật updated_at
DROP TRIGGER IF EXISTS update_speaker_songs_updated_at ON speaker_songs;
CREATE TRIGGER update_speaker_songs_updated_at
  BEFORE UPDATE ON speaker_songs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
