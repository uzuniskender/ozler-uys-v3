-- ROLLBACK: 20260515_v16_85_operator_bolumler.sql
-- ⚠️ DATA LOSS RİSKİ — uys_operators.bolumler kolonundaki tüm veriler silinir.
--
-- Uygulama sırası:
--   1. ÖNCE bolumler kolonunu kullanan frontend kodunu geri al (deploy)
--   2. TEST projesinde rollback'i çalıştır, doğrula
--   3. PROD'a uygulamadan önce TAM backup al
--   4. Sadece açık onayla PROD'da çalıştır (CLAUDE.md operasyonel kural)
--
-- Idempotent: DROP IF EXISTS — daha önce uygulandıysa hata vermez.

ALTER TABLE public.uys_operators DROP COLUMN IF EXISTS bolumler;
