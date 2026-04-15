-- ═══ UYS RBAC — Kullanıcılar Tablosu ═══
-- Supabase SQL Editor'da çalıştırın

CREATE TABLE IF NOT EXISTS uys_kullanicilar (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ad text NOT NULL,
  kullanici_ad text UNIQUE NOT NULL,
  sifre text NOT NULL,
  rol text NOT NULL DEFAULT 'planlama' CHECK (rol IN ('admin', 'uretim_sor', 'planlama', 'depocu')),
  aktif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- RLS policy
ALTER TABLE uys_kullanicilar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON uys_kullanicilar;
CREATE POLICY "allow_all" ON uys_kullanicilar USING (true) WITH CHECK (true);
GRANT ALL ON uys_kullanicilar TO anon, authenticated;

-- Varsayılan admin kullanıcı (isteğe bağlı — eski şifre sistemi yine çalışır)
-- INSERT INTO uys_kullanicilar (ad, kullanici_ad, sifre, rol) VALUES ('Admin', 'admin', 'admin123', 'admin');
