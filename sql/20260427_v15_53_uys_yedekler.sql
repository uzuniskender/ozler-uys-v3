-- v15.53 Adım 1 — Yedekleme altyapısı: uys_yedekler tablosu + RLS
-- ════════════════════════════════════════════════════════════════════════════
-- AMAÇ:
--   UYS v3 verisinin günlük snapshot'larını saklayan tablo. Faz 2'de eklenecek
--   /backup sayfası bu tablodan okur, "Şimdi Yedekle" butonu buraya yazar.
--   Manuel yedek + otomatik yedek (Faz 4'te eklenecek cron) aynı tabloda.
--
-- §18.2 — TIP D (backend-only, büyük JSONB blob)
--   BACKUP: hayır (backup tablosunun kendisi yedeklenmez — recursion engellenir)
--   STORE:  hayır (frontend store mapper'a girmez, backup.ts kendi fetch eder)
--   Karar matrisi: Tip D → STORE_WHITELIST + DATA_MGMT_WHITELIST güncellenmesi gerekmez
--
-- §18.5 — Tüm ALTER/CREATE/DO blok SELECT'lerde public. prefix kullanıldı ✓
--
-- §20 ile İlişki:
--   RLS policy şu an allow_all (mevcut UYS v3 deseni). Sıkılaştırma İş Emri #12'de
--   (Yaklaşım A — Supabase Auth + role-based RLS) yapılacak. Yedek tablosu hassas
--   olduğu için Faz 1.3+ pilot policy'lerinde öncelikli olabilir.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.uys_yedekler (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alindi_tarih  date NOT NULL,                               -- günlük gruplama (filtre için)
  alindi_saat   timestamptz NOT NULL DEFAULT now(),          -- tam zaman damgası
  alan_kisi     text NOT NULL,                               -- yedek alan kullanıcı
  tip           text NOT NULL DEFAULT 'manuel'
                  CHECK (tip IN ('otomatik', 'manuel')),     -- iki olası değer
  boyut_kb      integer,                                     -- snapshot boyutu (UI'da göster)
  veri          jsonb NOT NULL,                              -- snapshot blob
  notlar        text                                         -- manuel yedek için etiket (örn. "v15.18 öncesi")
);

-- Index: tarih + saat DESC (en yeni yedek listede üstte)
CREATE INDEX IF NOT EXISTS idx_uys_yedekler_tarih
  ON public.uys_yedekler(alindi_tarih DESC, alindi_saat DESC);

-- RLS — şu an allow_all (mevcut UYS v3 deseniyle uyumlu).
-- Sıkılaştırma İş Emri #12'de yapılacak.
ALTER TABLE public.uys_yedekler ENABLE ROW LEVEL SECURITY;

-- Idempotent policy oluşturma (DROP + CREATE)
DROP POLICY IF EXISTS allow_all ON public.uys_yedekler;
CREATE POLICY allow_all ON public.uys_yedekler
  FOR ALL
  USING (true)
  WITH CHECK (true);

DO $$
DECLARE
  table_exists boolean;
  policy_exists boolean;
  index_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'uys_yedekler'
  ) INTO table_exists;

  SELECT EXISTS(
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'uys_yedekler' AND policyname = 'allow_all'
  ) INTO policy_exists;

  SELECT EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_uys_yedekler_tarih'
  ) INTO index_exists;

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'v15.53 Adım 1 — Yedekleme altyapısı:';
  RAISE NOTICE '  uys_yedekler tablosu: %', CASE WHEN table_exists THEN 'OK' ELSE 'EKSIK' END;
  RAISE NOTICE '  idx_uys_yedekler_tarih index: %', CASE WHEN index_exists THEN 'OK' ELSE 'EKSIK' END;
  RAISE NOTICE '  allow_all RLS policy: %', CASE WHEN policy_exists THEN 'OK' ELSE 'EKSIK' END;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'SONRAKI ADIM: Faz 2 (Backup.tsx UI) — sonraki oturumda';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END$$;
