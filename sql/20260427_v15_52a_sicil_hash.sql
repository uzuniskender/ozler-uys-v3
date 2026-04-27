-- v15.52a — Operatör sicil/şifre hash kolonu (lazy migration)
-- ════════════════════════════════════════════════════════════════════════════
-- AMAÇ:
--   uys_operators.sifre kolonu plain text saklıyordu (Login.tsx karşılaştırması).
--   Bu, DB dump senaryosunda tüm operatör şifrelerinin okunmasına yol açıyor.
--
-- STRATEJİ — LAZY MIGRATION:
--   1) Bu migration sicil_hash text kolonunu ekler (boş başlar)
--   2) Login.tsx (v15.52a) her başarılı girişte:
--        - Eğer sicil_hash boşsa: plain karşılaştırma + arka planda hash + sifre=null
--        - Eğer sicil_hash doluysa: hash karşılaştırması
--   3) 1-2 hafta sonra (tüm aktif operatörler login olduktan sonra) ayrı bir
--      patch ile sifre kolonu DROP edilir (v15.52b veya v15.55).
--
-- HASH FORMATI:
--   'cyrb53:HEX' (14 karakter hex, 53-bit). bcrypt değil — operatör paneli için
--   yeterli çünkü tehdit modeli "DB dump'ı okunabilir olmasın", brute force değil.
--   Format prefix'i sayesinde gelecekte bcrypt/SHA-256'ya geçiş kolay.
--
-- §18.2 NOT:
--   Yeni KOLON, yeni TABLO değil. Tip C/D karar matrisi gerektirmez.
--   Store mapper (src/store/index.ts) sicil_hash'i pull etmez (Login.tsx kendi fetch ediyor).
--   audit-schema.cjs whitelist güncellenmesi gerekmez.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE uys_operators ADD COLUMN IF NOT EXISTS sicil_hash text;

DO $$
DECLARE
  total int;
  with_pass int;
BEGIN
  SELECT count(*) INTO total FROM uys_operators WHERE aktif IS NOT FALSE;
  SELECT count(*) INTO with_pass FROM uys_operators WHERE aktif IS NOT FALSE AND sifre IS NOT NULL AND sifre <> '';
  RAISE NOTICE 'v15.52a: uys_operators.sicil_hash kolonu eklendi.';
  RAISE NOTICE '  Aktif operatör: %', total;
  RAISE NOTICE '  Plain sifre olan: % (lazy migration ile dönüşecek)', with_pass;
END$$;
