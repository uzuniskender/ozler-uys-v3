-- v16.88 — uys_orders RLS konsolidasyonu
-- app_current_role() kaldırıldı, current_user_role() ile birleştirildi.
-- Sebep: app_current_role LOWER() ve aktif filtresi içermiyordu;
--        current_user_role() (v16.87a) her ikisini de sağlıyor.
-- TEST  applied: 2026-05-16
-- PROD  applied: 2026-05-16

-- TEST'te: önce policy kaldır (bağımlılık), sonra fonksiyonu sil
DROP POLICY IF EXISTS orders_write ON public.uys_orders;
DROP FUNCTION IF EXISTS public.app_current_role();

-- PROD'da: allow_all policy'yi kaldır, RLS'i aktif et
ALTER TABLE public.uys_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all    ON public.uys_orders;
DROP POLICY IF EXISTS "allow_all"  ON public.uys_orders;
DROP POLICY IF EXISTS orders_read  ON public.uys_orders;

-- Her iki ortam için ortak politikalar
CREATE POLICY orders_read ON public.uys_orders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY orders_write ON public.uys_orders
  FOR ALL TO authenticated
  USING      (public.current_user_role() IN ('admin', 'planlama'))
  WITH CHECK (public.current_user_role() IN ('admin', 'planlama'));
