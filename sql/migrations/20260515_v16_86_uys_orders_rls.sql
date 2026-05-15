-- v16.86 — uys_orders RLS politikası
-- ─────────────────────────────────────────────────────────────────────────
-- Kapsam:
--   - Okuma  : authenticated kullanıcılar (Supabase Auth oturumu olanlar)
--   - Yazma  : sadece admin ve planlama (uys_kullanicilar.rol)
--
-- Mimari notlar:
--   UYS'de roller uygulama seviyesinde (uys_kullanicilar.rol text alanı),
--   Postgres rolleri DEĞİL. app_current_role() SECURITY DEFINER function
--   aracılığıyla RLS policy bu app-role'ünü auth.uid()'den çözer.
--
-- ⚠️ KRITIK UYARI — custom DB login path kullanıcıları:
--   useAuth.ts'de kullanıcı adı/şifre ile login olan (Supabase Auth oturumu
--   AÇMAYAN) planlama/depocu/uretim_sor kullanıcıları bu RLS sonrası
--   uys_orders'a erişemez. Bu kullanıcılar Supabase Auth'a göç edilmeden
--   PROD'a uygulanmamalı.
--
-- Uygulama sırası (CLAUDE.md):
--   1. TEST (cowgxwmhlogmswatbltz Frankfurt) — bu migration ile
--   2. PROD (lmhcobrgrnvtprvmcito)             — ayrı onayla
--
-- Idempotent: CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS.

-- 1) SECURITY DEFINER function: aktif kullanıcının uygulama rolünü döner
CREATE OR REPLACE FUNCTION public.app_current_role() RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT rol::text
    FROM public.uys_kullanicilar
   WHERE auth_user_id = auth.uid()
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.app_current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_current_role() TO anon, authenticated;

COMMENT ON FUNCTION public.app_current_role() IS
  'RLS policy''leri için: oturum açan kullanıcının uys_kullanicilar.rol değerini döner. NULL → kullanıcı uys_kullanicilar tablosunda bulunamadı veya auth.uid() yok.';

-- 2) uys_orders üzerinde RLS aktif et + eski allow_all policy'sini kaldır
ALTER TABLE public.uys_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all ON public.uys_orders;
DROP POLICY IF EXISTS "allow_all" ON public.uys_orders;

-- 3) Read policy — authenticated tüm kullanıcılar
DROP POLICY IF EXISTS orders_read ON public.uys_orders;
CREATE POLICY orders_read ON public.uys_orders
  FOR SELECT
  TO authenticated
  USING (true);

-- 4) Write policy — sadece admin + planlama
-- FOR ALL covers SELECT/INSERT/UPDATE/DELETE; SELECT için orders_read OR
-- birleşimi ile authenticated kullanıcı yine SELECT yapabilir. Yazma
-- operasyonları için app_current_role() kontrolü uygulanır.
DROP POLICY IF EXISTS orders_write ON public.uys_orders;
CREATE POLICY orders_write ON public.uys_orders
  FOR ALL
  TO authenticated
  USING (public.app_current_role() IN ('admin','planlama'))
  WITH CHECK (public.app_current_role() IN ('admin','planlama'));
