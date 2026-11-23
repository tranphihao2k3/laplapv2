-- ============================================================
-- Speaker Songs - Bài nhạc dùng để test loa
-- ============================================================

CREATE TABLE IF NOT EXISTS speaker_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255),
  file_url TEXT NOT NULL,
  file_key TEXT NOT NULL,
  file_size_bytes BIGINT,
  duration_seconds INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaker_songs_position ON speaker_songs(position);
CREATE INDEX IF NOT EXISTS idx_speaker_songs_is_active ON speaker_songs(is_active);

ALTER TABLE speaker_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read speaker_songs" ON speaker_songs
  FOR SELECT USING (true);

DROP TRIGGER IF EXISTS update_speaker_songs_updated_at ON speaker_songs;
CREATE TRIGGER update_speaker_songs_updated_at
  BEFORE UPDATE ON speaker_songs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
