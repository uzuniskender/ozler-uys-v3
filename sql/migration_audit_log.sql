-- Migration: uys_audit_log — v16.51
-- Kim, ne zaman, ne yaptı — tüm kritik olaylar burada

CREATE TABLE IF NOT EXISTS uys_audit_log (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  zaman         timestamptz NOT NULL DEFAULT now(),
  kullanici_id  text,
  kullanici_ad  text,
  olay_tipi     text NOT NULL,
  tablo         text,
  kayit_id      text,
  alan          text,
  eski_deger    text,
  yeni_deger    text,
  aciklama      text,
  ek_veri       jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_zaman     ON uys_audit_log (zaman DESC);
CREATE INDEX IF NOT EXISTS idx_audit_olay      ON uys_audit_log (olay_tipi);
CREATE INDEX IF NOT EXISTS idx_audit_kayit     ON uys_audit_log (kayit_id);
CREATE INDEX IF NOT EXISTS idx_audit_kullanici ON uys_audit_log (kullanici_ad);
CREATE INDEX IF NOT EXISTS idx_audit_tablo     ON uys_audit_log (tablo);

ALTER TABLE uys_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='uys_audit_log' AND policyname='audit_select') THEN
    CREATE POLICY "audit_select" ON uys_audit_log FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='uys_audit_log' AND policyname='audit_insert') THEN
    CREATE POLICY "audit_insert" ON uys_audit_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
