-- v16.0.0 Faz 1.1a — Auth altyapı (kolon + helper fonksiyon)
-- ════════════════════════════════════════════════════════════════════════════
-- AMAÇ:
--   İş Emri #12 Güvenlik Refactoru'nun başlangıç adımı. Bu migration HİÇBİR
--   mevcut RLS policy değiştirmiyor, hiçbir tabloya policy eklemiyor — sadece
--   gelecekte yazılacak RLS policy'leri için altyapıyı kuruyor:
--     1) uys_kullanicilar.auth_user_id kolonu (auth.users ↔ uys_kullanicilar bağı)
--     2) current_user_role() SQL helper'ı (RLS policy'lerinin kullanacağı)
--
-- SAHA ETKİSİ: SIFIR
--   - Hiçbir tabloda RLS değişmiyor, allow_all policy'leri olduğu gibi duruyor
--   - Hiçbir mevcut akış etkilenmiyor (login, operatör, üretim hep aynı çalışır)
--   - Yeni kolon nullable, mevcut satırlar bozulmuyor
--
-- SONRAKİ ADIM (Faz 1.1b):
--   Admin (uzuniskender@gmail.com) için manuel link script'i Buket Supabase
--   Studio'da çalıştıracak. Detay: 12_GuvenlikRefactor.md Görev 1.1 + bu patch
--   teslim mesajı.
--
-- §18.5 KONTROL: Tüm ALTER/CREATE/SELECT'lerde public. prefix kullanıldı ✓
-- §18.2 KONTROL: Yeni kolon (yeni tablo değil) — store mapper güncellemesi gerekmez
--                çünkü uys_kullanicilar zaten store'da var, yeni kolon insert/update
--                payload'ında olmadığı sürece silent reject olmaz.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Kolon: auth.users.id ile uys_kullanicilar arasında bağ
ALTER TABLE public.uys_kullanicilar
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Index — RLS policy'lerinde auth.uid() lookup için (Faz 1.2+ kullanacak)
CREATE INDEX IF NOT EXISTS idx_uys_kullanicilar_auth_user_id
  ON public.uys_kullanicilar(auth_user_id);

-- 2) Helper fonksiyon: aktif kullanıcının rolünü döner
-- SECURITY DEFINER:
--   RLS policy'leri içinde çağrılınca sonsuz döngüye girmez (fonksiyon kendi RLS
--   bypass eder, satırı doğrudan okur). Read-only — STABLE etiketli.
-- Dönüş NULL ise:
--   - Kullanıcı henüz Faz 2'ye geçmemiş (auth_user_id boş)
--   - Veya admin custom login path'inde (ADMIN_EMAILS — useAuth.ts) — bu durumda
--     Faz 1.1b manuel link sonrası NULL olmamalı.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT rol::text
  FROM public.uys_kullanicilar
  WHERE auth_user_id = auth.uid()
    AND aktif = true
  LIMIT 1
$$;

-- Authenticated + anon hepsi çağırabilir (anon için NULL dönecek — sorun yok)
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;

-- 3) Doğrulama notları
DO $$
DECLARE
  fn_exists boolean;
  col_exists boolean;
  idx_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'current_user_role' AND n.nspname = 'public'
  ) INTO fn_exists;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'uys_kullanicilar'
      AND column_name = 'auth_user_id'
  ) INTO col_exists;

  SELECT EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_uys_kullanicilar_auth_user_id'
  ) INTO idx_exists;

  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'v16.0.0 Faz 1.1a — Auth altyapı kuruldu:';
  RAISE NOTICE '  uys_kullanicilar.auth_user_id kolonu: %', CASE WHEN col_exists THEN 'OK' ELSE 'EKSIK' END;
  RAISE NOTICE '  idx_uys_kullanicilar_auth_user_id index: %', CASE WHEN idx_exists THEN 'OK' ELSE 'EKSIK' END;
  RAISE NOTICE '  public.current_user_role() fonksiyonu: %', CASE WHEN fn_exists THEN 'OK' ELSE 'EKSIK' END;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'SONRAKI ADIM: Admin (uzuniskender@gmail.com) icin manuel link';
  RAISE NOTICE '  - Faz 1.1b query Supabase Studio''da calistirilacak';
  RAISE NOTICE '  - Detay: docs/is_emri/12_GuvenlikRefactor.md Gorev 1.1';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END$$;
