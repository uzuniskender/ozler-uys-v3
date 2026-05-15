-- v16.84 — İş Emri Hazırlama durum geçişleri (2026-05-15)
-- TEST: cowgxwmhlogmswatbltz ✅ 2026-05-15
-- PROD: lmhcobrgrnvtprvmcito ⬜

ALTER TABLE uys_ie_hazirlama
  ADD COLUMN IF NOT EXISTS iptal_neden   TEXT,
  ADD COLUMN IF NOT EXISTS iptal_at      TEXT,
  ADD COLUMN IF NOT EXISTS iptal_by      TEXT,
  ADD COLUMN IF NOT EXISTS tamamlandi_at TEXT,
  ADD COLUMN IF NOT EXISTS tamamlandi_by TEXT;
