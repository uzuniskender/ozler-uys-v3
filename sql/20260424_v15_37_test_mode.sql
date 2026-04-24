-- ═══════════════════════════════════════════════════════════════════════
-- UYS v3 — v15.37: Test Modu Altyapısı
-- Tarih: 2026-04-24
-- ═══════════════════════════════════════════════════════════════════════
-- Amaç: Test sırasında oluşan tüm kayıtları tek bir etiketle işaretle,
-- test bitiminde cascade delete ile temizle. Canlı veri dokunulmaz.
--
-- test_run_id = 'TEST_<YYYYMMDD_NN>' (ör. TEST_20260424_01)
-- durum       = 'aktif' | 'tamamlandi' | 'iptal'
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Test run'ları takip tablosu
CREATE TABLE IF NOT EXISTS public.uys_test_runs (
  id              text PRIMARY KEY,
  baslangic       timestamp DEFAULT now(),
  bitis           timestamp,
  durum           text DEFAULT 'aktif',
  user_id         text,
  user_ad         text,
  aciklama        text,
  temizlenen_kayit_sayisi jsonb DEFAULT '{}'::jsonb,
  not_            text
);

CREATE INDEX IF NOT EXISTS idx_test_runs_durum ON public.uys_test_runs (durum);

-- 2. Tüm ana işlem tablolarına test_run_id kolonu
-- Bu kolonlar aktif bir test run'ında oluşturulan kayıtları işaretler
ALTER TABLE public.uys_orders            ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_work_orders       ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_logs              ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_stok_hareketler   ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_kesim_planlari    ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_tedarikler        ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_mrp_rezerve       ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_sevkler           ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_fire_logs         ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_acik_barlar       ADD COLUMN IF NOT EXISTS test_run_id text;
ALTER TABLE public.uys_active_work       ADD COLUMN IF NOT EXISTS test_run_id text;

-- 3. Index'ler — cleanup sırasında hızlı silme
CREATE INDEX IF NOT EXISTS idx_orders_test_run ON public.uys_orders (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wo_test_run     ON public.uys_work_orders (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_logs_test_run   ON public.uys_logs (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stok_test_run   ON public.uys_stok_hareketler (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kesim_test_run  ON public.uys_kesim_planlari (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ted_test_run    ON public.uys_tedarikler (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rez_test_run    ON public.uys_mrp_rezerve (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sevk_test_run   ON public.uys_sevkler (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fire_test_run   ON public.uys_fire_logs (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acikbar_test_run ON public.uys_acik_barlar (test_run_id) WHERE test_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_active_test_run ON public.uys_active_work (test_run_id) WHERE test_run_id IS NOT NULL;

-- PostgREST cache yenileme
ALTER TABLE public.uys_test_runs ADD COLUMN IF NOT EXISTS _tmp_rc int;
ALTER TABLE public.uys_test_runs DROP COLUMN IF EXISTS _tmp_rc;
ALTER TABLE public.uys_orders ADD COLUMN IF NOT EXISTS _tmp_rc int;
ALTER TABLE public.uys_orders DROP COLUMN IF EXISTS _tmp_rc;
