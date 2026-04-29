-- v15.90 -- Madde 15 Onay Sistemi P1 (Veri Modeli)
-- Saha modeli §25: Mamul rezerv/serbest + bildirim merkezi + manuel mudahale audit
-- §18.5 -- public. prefix kuraline uygun, idempotent

-- A) uys_stok_hareketler.rezerv_order_id -- mamul rezerv/serbest ayrimi
ALTER TABLE public.uys_stok_hareketler
  ADD COLUMN IF NOT EXISTS rezerv_order_id text;

CREATE INDEX IF NOT EXISTS idx_stok_hareket_rezerv
  ON public.uys_stok_hareketler(rezerv_order_id)
  WHERE rezerv_order_id IS NOT NULL;

-- B) uys_bildirimler -- bildirim merkezi
CREATE TABLE IF NOT EXISTS public.uys_bildirimler (
  id text PRIMARY KEY,
  tip text NOT NULL,
  kategori text,
  baslik text NOT NULL,
  mesaj text NOT NULL,
  hedef_kullanici_id text,
  ref_id text,
  ref_tip text,
  okundu boolean NOT NULL DEFAULT false,
  okundu_tarih timestamptz,
  olusturma timestamptz NOT NULL DEFAULT now(),
  olusturan text,
  __client text,
  test_run_id text
);

CREATE INDEX IF NOT EXISTS idx_bildirimler_okundu
  ON public.uys_bildirimler(okundu, olusturma DESC)
  WHERE okundu = false;

CREATE INDEX IF NOT EXISTS idx_bildirimler_test_run
  ON public.uys_bildirimler(test_run_id)
  WHERE test_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bildirimler_olusturma
  ON public.uys_bildirimler(olusturma DESC);

ALTER TABLE public.uys_bildirimler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.uys_bildirimler;
CREATE POLICY "allow_all" ON public.uys_bildirimler
  FOR ALL USING (true) WITH CHECK (true);

-- C) uys_manuel_mudahale_log -- manuel mudahale audit trail
CREATE TABLE IF NOT EXISTS public.uys_manuel_mudahale_log (
  id text PRIMARY KEY,
  tarih timestamptz NOT NULL DEFAULT now(),
  kullanici_id text NOT NULL,
  kullanici_ad text,
  islem_tipi text NOT NULL,
  malkod text NOT NULL,
  malad text,
  miktar numeric NOT NULL,
  birim text,
  rezerv_order_id text,
  rezerv_siparis_no text,
  sebep text NOT NULL,
  aciklama text NOT NULL,
  stok_hareket_id text,
  __client text,
  test_run_id text
);

CREATE INDEX IF NOT EXISTS idx_mudahale_tarih
  ON public.uys_manuel_mudahale_log(tarih DESC);

CREATE INDEX IF NOT EXISTS idx_mudahale_test_run
  ON public.uys_manuel_mudahale_log(test_run_id)
  WHERE test_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mudahale_kullanici
  ON public.uys_manuel_mudahale_log(kullanici_id, tarih DESC);

ALTER TABLE public.uys_manuel_mudahale_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.uys_manuel_mudahale_log;
CREATE POLICY "allow_all" ON public.uys_manuel_mudahale_log
  FOR ALL USING (true) WITH CHECK (true);

-- D) PostgREST cache yenileme
ALTER TABLE public.uys_stok_hareketler ADD COLUMN IF NOT EXISTS _cache_bust_v15_90 boolean;
ALTER TABLE public.uys_stok_hareketler DROP COLUMN IF EXISTS _cache_bust_v15_90;
ALTER TABLE public.uys_bildirimler ADD COLUMN IF NOT EXISTS _cache_bust_v15_90 boolean;
ALTER TABLE public.uys_bildirimler DROP COLUMN IF EXISTS _cache_bust_v15_90;
ALTER TABLE public.uys_manuel_mudahale_log ADD COLUMN IF NOT EXISTS _cache_bust_v15_90 boolean;
ALTER TABLE public.uys_manuel_mudahale_log DROP COLUMN IF EXISTS _cache_bust_v15_90;
