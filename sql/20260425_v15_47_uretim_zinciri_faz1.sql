-- ════════════════════════════════════════════════════════════════
-- v15.47 — Üretim Zinciri Faz 1: Veri Modeli (2026-04-25)
-- ════════════════════════════════════════════════════════════════
-- İş Emri #3 Faz 1 — autoZincir + MRP modal + Kesim optimizasyon altyapısı.
-- Bu migration sadece DB'yi hazırlar; ilgili UI ve algoritmalar Faz 2-4'te
-- gelecek (v15.48-v15.50).
--
-- Idempotent — birden fazla çalıştırılabilir.
--
-- 3 değişiklik:
--   1. uys_kesim_planlari: 6 yeni kolon (ham_en, ham_kalinlik, tip, fire_kg, artik_malzeme_kod)
--   2. uys_tedarikler: 3 yeni kolon (auto_olusturuldu, mrp_calculation_id) — order_id zaten var
--   3. uys_mrp_calculations: yeni tablo (her MRP run snapshot)

-- ─────────────────────────────────────────────────────────────────
-- 1. uys_kesim_planlari genişletmesi
-- ─────────────────────────────────────────────────────────────────
-- Mevcut kolonlar: id, ham_malkod, ham_malad, ham_boy, kesim_tip, durum, satirlar, tarih, gerekli_adet
-- Yeni eklenecekler:
ALTER TABLE public.uys_kesim_planlari
  ADD COLUMN IF NOT EXISTS ham_en numeric;
ALTER TABLE public.uys_kesim_planlari
  ADD COLUMN IF NOT EXISTS ham_kalinlik numeric;
-- 'tip' kolonu — kesim_tip ZATEN VAR ama 'boy/levha' ayrımını netleştirmek için
-- ikincisi gerekli olabilir. kesim_tip zaten kullanılıyor, dokunmuyoruz.
ALTER TABLE public.uys_kesim_planlari
  ADD COLUMN IF NOT EXISTS fire_kg numeric;
ALTER TABLE public.uys_kesim_planlari
  ADD COLUMN IF NOT EXISTS artik_malzeme_kod text;

-- ─────────────────────────────────────────────────────────────────
-- 2. uys_tedarikler genişletmesi
-- ─────────────────────────────────────────────────────────────────
-- Mevcut: id, malkod, malad, miktar, birim, order_id, siparis_no, durum, geldi,
--         teslim_tarihi, tedarikci_id, tedarikci_ad, not_, tarih
-- order_id ZATEN VAR — auto_olusturuldu ve mrp_calculation_id ekleniyor
ALTER TABLE public.uys_tedarikler
  ADD COLUMN IF NOT EXISTS auto_olusturuldu boolean DEFAULT false;
ALTER TABLE public.uys_tedarikler
  ADD COLUMN IF NOT EXISTS mrp_calculation_id text;

-- ─────────────────────────────────────────────────────────────────
-- 3. uys_mrp_calculations — yeni tablo
-- ─────────────────────────────────────────────────────────────────
-- Her MRP çalıştığında snapshot saklanır.
-- Faz 3'te (v15.49) MRP modal bunu yazacak; üst bar göstergeleri (Faz 5/v15.47)
-- bu tabloyu OKUMAYACAK — sadece orders.mrp_durum'a bakar. Tablo Faz 3 hazır olunca
-- doldurulur.
CREATE TABLE IF NOT EXISTS public.uys_mrp_calculations (
  id            text PRIMARY KEY,
  order_id      text,
  hesaplandi    timestamptz NOT NULL DEFAULT now(),
  hesaplayan    text NOT NULL,
  brut_ihtiyac  jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {malkod: miktar}
  stok_durumu   jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {malkod: stokta}
  acik_tedarik  jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {malkod: acik}
  net_ihtiyac   jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {malkod: alinacak}
  durum         text NOT NULL DEFAULT 'beklemede',     -- beklemede | tamamlandi | iptal
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mrp_calc_order
  ON public.uys_mrp_calculations(order_id, hesaplandi DESC);

-- ─────────────────────────────────────────────────────────────────
-- 4. Doğrulama notice
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  kp_extra integer;
  td_extra integer;
  mrp_count integer;
BEGIN
  -- yeni kolonların var olup olmadığını say
  SELECT count(*) INTO kp_extra FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'uys_kesim_planlari'
     AND column_name IN ('ham_en','ham_kalinlik','fire_kg','artik_malzeme_kod');
  SELECT count(*) INTO td_extra FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'uys_tedarikler'
     AND column_name IN ('auto_olusturuldu','mrp_calculation_id');
  SELECT count(*) INTO mrp_count FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'uys_mrp_calculations';

  RAISE NOTICE '[v15.47] uys_kesim_planlari yeni kolonlar: %/4', kp_extra;
  RAISE NOTICE '[v15.47] uys_tedarikler yeni kolonlar: %/2', td_extra;
  RAISE NOTICE '[v15.47] uys_mrp_calculations tablosu: % (1=var)', mrp_count;
END $$;
