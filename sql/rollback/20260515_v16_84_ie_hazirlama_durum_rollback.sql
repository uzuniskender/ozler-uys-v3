-- ROLLBACK: 20260515_v16_84_ie_hazirlama_durum.sql
-- ⚠️ DATA LOSS RİSKİ — uys_ie_hazirlama tablosundaki iptal/tamamlandi
-- bilgileri (neden, tarih, kullanıcı) tüm satırlar için silinir.
--
-- Uygulama sırası:
--   1. ÖNCE durum geçişlerini kullanan frontend kodunu geri al (deploy)
--   2. TEST projesinde rollback'i çalıştır, doğrula
--   3. PROD'a uygulamadan önce TAM backup al
--   4. Sadece açık onayla PROD'da çalıştır (CLAUDE.md operasyonel kural)
--
-- Idempotent: DROP IF EXISTS — daha önce uygulandıysa hata vermez.

ALTER TABLE public.uys_ie_hazirlama
  DROP COLUMN IF EXISTS iptal_neden,
  DROP COLUMN IF EXISTS iptal_at,
  DROP COLUMN IF EXISTS iptal_by,
  DROP COLUMN IF EXISTS tamamlandi_at,
  DROP COLUMN IF EXISTS tamamlandi_by;
