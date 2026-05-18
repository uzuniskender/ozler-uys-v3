-- =====================================================================
-- WMS Faz 1 — uys_lokasyonlar + uys_malzemeler.lokasyon_kodu
-- v17.07 — 2026-05-18
-- TEST:  cowgxwmhlogmswatbltz — 2026-05-18
-- PROD:  lmhcobrgrnvtprvmcito — 2026-05-18
-- =====================================================================

-- 1. Lokasyon tanım tablosu
CREATE TABLE IF NOT EXISTS public.uys_lokasyonlar (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kod         VARCHAR(30) UNIQUE NOT NULL,          -- ör. "A-01-03"
  ad          VARCHAR(100),                          -- ör. "Raf A, Sıra 1, Göz 3"
  bolum       VARCHAR(50),                           -- zone, ör. "A Bölgesi"
  tip         VARCHAR(20) NOT NULL DEFAULT 'raf',    -- raf | zemin | dolap | palet
  kapasite    INTEGER,                               -- opsiyonel kapasite
  aktif       BOOLEAN NOT NULL DEFAULT true,
  olusturma   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Malzemelere lokasyon ataması (plain text ref — Faz 1)
ALTER TABLE public.uys_malzemeler
  ADD COLUMN IF NOT EXISTS lokasyon_kodu VARCHAR(30);

-- 3. RLS — diğer tablolarla aynı pattern
ALTER TABLE uys_lokasyonlar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lokasyon_select" ON uys_lokasyonlar;
DROP POLICY IF EXISTS "lokasyon_write"  ON uys_lokasyonlar;

CREATE POLICY "lokasyon_select" ON uys_lokasyonlar
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "lokasyon_write" ON uys_lokasyonlar
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'planlama', 'depocu'))
  WITH CHECK (current_user_role() IN ('admin', 'planlama', 'depocu'));
