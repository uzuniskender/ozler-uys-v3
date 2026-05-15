-- ROLLBACK: 20260513_v16_79_malzeme_cinsi.sql
-- ⚠️ DATA LOSS RİSKİ — uys_malzemeler.malzeme_cinsi kolonundaki tüm veriler silinir.
--
-- Bu migration aynı zamanda DB'ye apply_migration ile 6 yeni HM tipi
-- (MIL, ALTK, KARE, UPRF, IH, TPRF) eklemişti. DELETE komutu aşağıda
-- YORUMLU bırakıldı — operatör inceleyip riski anladıktan sonra elle açsın.
--
-- DELETE'i açmadan önce kontrol edilmesi gerekenler:
--   - uys_malzemeler tablosunda bu kod'lara referans veren satır var mı?
--     (DELETE FK ihlali yapabilir veya orphan kayıt bırakır)
--   - Kullanıcı bu tiplere bağlı malzeme/reçete oluşturmuş olabilir.
--
-- Uygulama sırası:
--   1. ÖNCE malzeme_cinsi'ni kullanan frontend kodunu geri al (deploy)
--   2. TEST projesinde rollback'i çalıştır, doğrula
--   3. PROD'a uygulamadan önce TAM backup al
--   4. Sadece açık onayla PROD'da çalıştır (CLAUDE.md operasyonel kural)
--
-- Idempotent: DROP IF EXISTS — daha önce uygulandıysa hata vermez.

ALTER TABLE public.uys_malzemeler DROP COLUMN IF EXISTS malzeme_cinsi;

-- ⚠️ HM tipleri DELETE — KAPALI, operatör manuel açmalı:
--
-- DELETE FROM public.uys_hm_tipleri
--   WHERE kod IN ('MIL', 'ALTK', 'KARE', 'UPRF', 'IH', 'TPRF');
