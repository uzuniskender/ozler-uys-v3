-- v16.88 — uys_malzemeler RLS politikaları
-- TEST  applied: 2026-05-15
-- PROD  applied: —

DROP POLICY IF EXISTS allow_all ON public.uys_malzemeler;

-- Okuma: tüm authenticated kullanıcılar
CREATE POLICY mal_select ON public.uys_malzemeler
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

-- Yazma (INSERT/UPDATE/DELETE): admin, planlama, uretim_sor
CREATE POLICY mal_write ON public.uys_malzemeler
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (current_user_role() IN ('admin', 'planlama', 'uretim_sor'))
  WITH CHECK (current_user_role() IN ('admin', 'planlama', 'uretim_sor'));
