-- v16.87 — uys_work_orders ve uys_stok_hareketler RLS politikaları
-- TEST  applied: 2026-05-15
-- PROD  applied: —

-- ─── uys_work_orders ────────────────────────────────────────────────────────
-- Mevcut "allow_all" politikasını kaldır
DROP POLICY IF EXISTS allow_all ON public.uys_work_orders;

-- Okuma: tüm authenticated kullanıcılar
CREATE POLICY wo_select ON public.uys_work_orders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

-- Yazma (INSERT/UPDATE/DELETE): admin, planlama, uretim_sor
CREATE POLICY wo_write ON public.uys_work_orders
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (current_user_role() IN ('admin', 'planlama', 'uretim_sor'))
  WITH CHECK (current_user_role() IN ('admin', 'planlama', 'uretim_sor'));

-- ─── uys_stok_hareketler ────────────────────────────────────────────────────
-- Mevcut "allow_all" politikasını kaldır
DROP POLICY IF EXISTS allow_all ON public.uys_stok_hareketler;

-- Okuma: tüm authenticated kullanıcılar
CREATE POLICY stok_select ON public.uys_stok_hareketler
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

-- Yazma (INSERT/UPDATE/DELETE): admin, uretim_sor
CREATE POLICY stok_write ON public.uys_stok_hareketler
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (current_user_role() IN ('admin', 'uretim_sor'))
  WITH CHECK (current_user_role() IN ('admin', 'uretim_sor'));
