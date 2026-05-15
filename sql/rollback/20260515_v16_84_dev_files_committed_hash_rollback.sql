-- ROLLBACK: 20260515_v16_84_dev_files_committed_hash.sql
-- ⚠️ DATA LOSS RİSKİ — uys_dev_files.committed_hash kolonundaki tüm
-- Git blob SHA-1 değerleri silinir. DevSync sayfası bu kolonu kullanarak
-- "synced" durumu hesaplıyor — kolon kaybedilince tüm dosyalar yeniden
-- senkronize sayılır (kullanıcı tarafında redundant ama veri kaybı yok).
--
-- Uygulama sırası:
--   1. ÖNCE committed_hash kolonunu kullanan frontend kodunu geri al (deploy)
--   2. TEST projesinde rollback'i çalıştır, doğrula
--   3. PROD'a uygulamadan önce TAM backup al
--   4. Sadece açık onayla PROD'da çalıştır (CLAUDE.md operasyonel kural)
--
-- Idempotent: DROP IF EXISTS — daha önce uygulandıysa hata vermez.

ALTER TABLE public.uys_dev_files DROP COLUMN IF EXISTS committed_hash;
