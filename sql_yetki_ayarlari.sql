-- ═══ UYS RBAC — Yetki Ayarları Tablosu ═══
-- Supabase SQL Editor'da çalıştırın

CREATE TABLE IF NOT EXISTS uys_yetki_ayarlari (
  id text PRIMARY KEY DEFAULT 'rbac',
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE uys_yetki_ayarlari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON uys_yetki_ayarlari;
CREATE POLICY "allow_all" ON uys_yetki_ayarlari USING (true) WITH CHECK (true);
GRANT ALL ON uys_yetki_ayarlari TO anon, authenticated;
