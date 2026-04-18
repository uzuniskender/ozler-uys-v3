-- ═══ Problem Takip — basit problem/aksiyon takibi ═══
-- UYS v3 Supabase'inde çalıştırılacak. Idempotent (tekrar çalıştırılabilir).

-- 1) Ana tablo
CREATE TABLE IF NOT EXISTS public.pt_problemler (
  id                text PRIMARY KEY,
  problem           text NOT NULL,
  termin            date,
  sorumlu           text,
  durum             text NOT NULL DEFAULT 'Açık',  -- 'Açık' | 'Devam' | 'Kapandı'
  yapilanlar        text,                           -- Kim ne yaptı tarihçesi (tek text, stamp'lı append)
  notlar            text,
  olusturan         text,
  olusturma         timestamptz DEFAULT now(),
  son_degistiren    text,
  son_degistirme    timestamptz,
  kapatma_tarihi    date,                           -- Durum='Kapandı' yapıldığında otomatik set
  __client          text                            -- realtime echo filtreleme için
);

-- 2) Faydalı indexler
CREATE INDEX IF NOT EXISTS idx_pt_problemler_durum ON public.pt_problemler(durum);
CREATE INDEX IF NOT EXISTS idx_pt_problemler_termin ON public.pt_problemler(termin);
CREATE INDEX IF NOT EXISTS idx_pt_problemler_son_degistirme ON public.pt_problemler(son_degistirme DESC);

-- 3) RLS + yetkiler (UYS standardıyla aynı — allow_all)
ALTER TABLE public.pt_problemler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.pt_problemler;
CREATE POLICY "allow_all" ON public.pt_problemler USING (true) WITH CHECK (true);
GRANT ALL ON public.pt_problemler TO anon, authenticated;

-- 4) Realtime publication'a ekle (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pt_problemler;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
