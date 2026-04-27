-- v15.75 Aşama 1 — uys_activity_log tablosu (İş Emri #13 madde 14)
-- ════════════════════════════════════════════════════════════════════════════
-- AMAÇ:
--   Mevcut activityLog.ts localStorage'da log tutuyor → max 200 kayıt + cihaz-bazlı.
--   Server-wide, paylaşılan, kalıcı log için DB tablosu.
--
-- §18.5 — public. prefix ✓
-- §18.2 Tip A — Frontend store'a girer (DataManagement + backup), audit-schema whitelist gerekmez.
--
-- SAHA ETKİSİ: SIFIR (yeni boş tablo, mevcut akışlar dokunulmadı)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.uys_activity_log (
  id              text PRIMARY KEY,
  ts              timestamptz NOT NULL DEFAULT now(),
  kullanici       text NOT NULL,
  aksiyon         text NOT NULL,
  detay           text,
  -- Hangi kayıtla ilgili — opsiyonel referanslar (filtreleme için)
  order_id        text,
  wo_id           text,
  malkod          text,
  modul           text,         -- 'siparis', 'ie', 'kesim', 'mrp', 'tedarik', 'stok', 'sevk', 'sistem' vb.
  ip_kontrolu     text,         -- gelecekte client IP eklemek için (şimdilik boş)
  test_run_id     text          -- §22 test_run_id konvansiyonu
);

-- Index'ler — sayfa filtreleri için
CREATE INDEX IF NOT EXISTS idx_uys_activity_log_ts ON public.uys_activity_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_uys_activity_log_kullanici ON public.uys_activity_log(kullanici);
CREATE INDEX IF NOT EXISTS idx_uys_activity_log_modul ON public.uys_activity_log(modul);
CREATE INDEX IF NOT EXISTS idx_uys_activity_log_order ON public.uys_activity_log(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uys_activity_log_wo ON public.uys_activity_log(wo_id) WHERE wo_id IS NOT NULL;

-- RLS — UYS v3 deseni (allow_all)
ALTER TABLE public.uys_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all ON public.uys_activity_log;
CREATE POLICY allow_all ON public.uys_activity_log FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE 'v15.75 Aşama 1 — uys_activity_log hazır.';
  RAISE NOTICE '  Index 5 adet, RLS allow_all ✓';
  RAISE NOTICE 'SONRAKI: activityLog.ts DB write + Logs.tsx UI';
  RAISE NOTICE '════════════════════════════════════════════════';
END$$;
