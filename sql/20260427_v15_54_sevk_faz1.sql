-- v15.54 Adım 1 — İş Emri #5 Sevkiyat Faz 1: Veri Modeli + Altyapı
-- ════════════════════════════════════════════════════════════════════════════
-- AMAÇ:
--   Sevkiyat oluşturma formu (Faz 2'de UI gelecek) için DB altyapısı:
--     1) uys_sevkler tablosuna 7 yeni kolon (sevk_no UNIQUE, tip, müşteri kod, taşıyıcı, plaka, oluşturan, oluşturma)
--     2) Yeni tablo uys_sevk_satirlari (normalize edilmiş sevk kalemleri)
--     3) RLS allow_all (UYS v3 deseni)
--
-- §18.2 — uys_sevk_satirlari TIP A:
--   Veri kritik (sevk kalemleri, denetim için), frontend kullanır.
--   Faz 2'de store mapper + DataManagement + backup.ts BACKUP_TABLES'a eklenecek.
--   Şu an audit-schema whitelist'e geçici eklenir (bu patch'in 4. dosyası).
--
-- §18.5 — Tüm ALTER/CREATE'lerde public. prefix ✓
--
-- MEVCUT KOLONLARLA UYUMLU TASARIM:
--   - tarih (text)        → DOKUNMA, sevk_tarihi yerine kullan
--   - musteri (text)      → DOKUNMA, musteri_ad yerine kullan
--   - not_ (text)         → DOKUNMA, aciklama yerine kullan
--   - kalemler (jsonb)    → DOKUNMA — eski sevkler için geriye uyum
--   - updated_at, test_run_id → mevcut, korunur
--
-- SAHA ETKİSİ: SIFIR
--   - Yeni kolonlar nullable, mevcut satırlar bozulmadı
--   - Yeni tablo boş, hiç kullanılmıyor
--   - View YOK (Faz 2'de kod tarafında hesaplanacak)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1.1) uys_sevkler genişletme ───
ALTER TABLE public.uys_sevkler ADD COLUMN IF NOT EXISTS sevk_no text;
ALTER TABLE public.uys_sevkler ADD COLUMN IF NOT EXISTS tip text DEFAULT 'siparis';
ALTER TABLE public.uys_sevkler ADD COLUMN IF NOT EXISTS musteri_kod text;
ALTER TABLE public.uys_sevkler ADD COLUMN IF NOT EXISTS tasiyici text;
ALTER TABLE public.uys_sevkler ADD COLUMN IF NOT EXISTS plaka text;
ALTER TABLE public.uys_sevkler ADD COLUMN IF NOT EXISTS olusturan text;
ALTER TABLE public.uys_sevkler ADD COLUMN IF NOT EXISTS olusturma timestamptz DEFAULT now();

-- tip kolonu için CHECK constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uys_sevkler_tip_check' AND conrelid = 'public.uys_sevkler'::regclass
  ) THEN
    ALTER TABLE public.uys_sevkler ADD CONSTRAINT uys_sevkler_tip_check
      CHECK (tip IS NULL OR tip IN ('siparis', 'siparissiz', 'iptal'));
  END IF;
END$$;

-- sevk_no için partial UNIQUE index (NULL hariç — eski kayıtlar boş olabilir)
CREATE UNIQUE INDEX IF NOT EXISTS idx_uys_sevkler_sevk_no_unique
  ON public.uys_sevkler(sevk_no)
  WHERE sevk_no IS NOT NULL;

-- ─── 1.2) uys_sevk_satirlari yeni tablo ───
CREATE TABLE IF NOT EXISTS public.uys_sevk_satirlari (
  id              text PRIMARY KEY,
  sevk_id         text NOT NULL REFERENCES public.uys_sevkler(id) ON DELETE CASCADE,
  order_id        text REFERENCES public.uys_orders(id) ON DELETE SET NULL,
  order_satir_idx integer,                                          -- sipariş içindeki kalem index (urunler array)
  malkod          text NOT NULL,
  malad           text NOT NULL,
  miktar          numeric NOT NULL CHECK (miktar > 0),
  birim           text DEFAULT 'adet',
  not_            text,
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uys_sevk_satirlari_sevk
  ON public.uys_sevk_satirlari(sevk_id);
CREATE INDEX IF NOT EXISTS idx_uys_sevk_satirlari_order
  ON public.uys_sevk_satirlari(order_id);
CREATE INDEX IF NOT EXISTS idx_uys_sevk_satirlari_malkod
  ON public.uys_sevk_satirlari(malkod);

-- RLS allow_all (UYS v3 deseni)
ALTER TABLE public.uys_sevk_satirlari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all ON public.uys_sevk_satirlari;
CREATE POLICY allow_all ON public.uys_sevk_satirlari
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Doğrulama ───
DO $$
DECLARE
  sevkler_yeni_cols int;
  satirlar_exists boolean;
  unique_idx_exists boolean;
BEGIN
  SELECT count(*) INTO sevkler_yeni_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'uys_sevkler'
    AND column_name IN ('sevk_no', 'tip', 'musteri_kod', 'tasiyici', 'plaka', 'olusturan', 'olusturma');

  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'uys_sevk_satirlari'
  ) INTO satirlar_exists;

  SELECT EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_uys_sevkler_sevk_no_unique'
  ) INTO unique_idx_exists;

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'v15.54 Adım 1 — Sevkiyat Faz 1 altyapı:';
  RAISE NOTICE '  uys_sevkler 7 yeni kolon (eklenen: %)', sevkler_yeni_cols;
  RAISE NOTICE '  uys_sevk_satirlari tablo: %', CASE WHEN satirlar_exists THEN 'OK' ELSE 'EKSIK' END;
  RAISE NOTICE '  sevk_no UNIQUE index: %', CASE WHEN unique_idx_exists THEN 'OK' ELSE 'EKSIK' END;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'SONRAKI ADIM: Faz 2 (Sevkiyat Modal UI) — sonraki oturumda';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END$$;
