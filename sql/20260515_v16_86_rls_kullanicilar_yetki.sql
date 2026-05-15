-- ═══════════════════════════════════════════════════════════════════════════
-- v16.86 — RLS: uys_kullanicilar + uys_yetki_ayarlari
-- authenticated → SELECT (okuma)
-- admin (rol='admin' in uys_kullanicilar) → INSERT/UPDATE/DELETE (yazma)
--
-- uys_kullanicilar kolonları: id, ad, kullanici_ad, sifre, rol, aktif,
--   auth_user_id (uuid — auth.uid() ile eşleşir), ...
-- Admin kontrolü: auth_user_id = auth.uid() AND rol = 'admin'
--
-- TEST  uygulandı: 2026-05-15
-- PROD  uygulandı: —
-- ═══════════════════════════════════════════════════════════════════════════

-- Yardımcı fonksiyon: SECURITY DEFINER ile RLS bypass ederek admin kontrolü.
-- is_admin() uys_kullanicilar kendi politikasını tetiklemeden okur.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.uys_kullanicilar
    WHERE auth_user_id = auth.uid()
      AND rol = 'admin'
      AND aktif = true
  )
$$;

-- ─── uys_kullanicilar ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_only" ON public.uys_kullanicilar;

CREATE POLICY "authenticated_select"
  ON public.uys_kullanicilar
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_write"
  ON public.uys_kullanicilar
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── uys_yetki_ayarlari ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_only" ON public.uys_yetki_ayarlari;

CREATE POLICY "authenticated_select"
  ON public.uys_yetki_ayarlari
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_write"
  ON public.uys_yetki_ayarlari
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
