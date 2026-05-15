-- ROLLBACK: 20260515_v16_83_ie_hazirlama.sql
-- ⚠️ MASSIVE DATA LOSS RİSKİ — İş Emri Hazırlama modülünün TÜM verisi silinir:
--   - uys_rapido_bom            (Rapido BOM verileri)
--   - uys_ie_hazirlama          (İE başlıkları)
--   - uys_ie_hazirlama_kalemler (İE kalemleri)
--   - uys_ie_hazirlama_log      (audit log)
--   - uys_ie_log                (event log)
--
-- DROP TABLE CASCADE: ilgili index, RLS policy, trigger ve constraint'ler
-- otomatik düşer. Foreign key olmadığı için tablolar arası bağımlılık yok.
--
-- Uygulama sırası:
--   1. ÖNCE /ie-hazirlama sayfası ve ilgili tüm kodları geri al (deploy)
--   2. TEST projesinde rollback'i çalıştır, doğrula
--   3. PROD'a uygulamadan önce TAM backup al
--      → uys_yedekler tablosuna ek olarak rapido_bom CSV export'u önerilir
--   4. Sadece açık onayla PROD'da çalıştır (CLAUDE.md operasyonel kural)
--
-- Idempotent: DROP IF EXISTS — daha önce uygulandıysa hata vermez.
-- Sıra: child tablolar önce (log'lar), sonra parent (rapido_bom).

DROP TABLE IF EXISTS public.uys_ie_log CASCADE;
DROP TABLE IF EXISTS public.uys_ie_hazirlama_log CASCADE;
DROP TABLE IF EXISTS public.uys_ie_hazirlama_kalemler CASCADE;
DROP TABLE IF EXISTS public.uys_ie_hazirlama CASCADE;
DROP TABLE IF EXISTS public.uys_rapido_bom CASCADE;
