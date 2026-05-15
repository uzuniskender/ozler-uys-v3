-- v16.86 — uys_orders RLS politikası
-- ─────────────────────────────────────────────────────────────────────────
-- Kapsam:
--   - Okuma  : authenticated kullanıcılar (Supabase Auth oturumu olanlar)
--   - Yazma  : sadece admin ve planlama (uys_kullanicilar.rol)
--
-- Mimari notlar:
--   current_user_role() SECURITY DEFINER fonksiyonu (v16.87a ile LOWER() eklendi)
--   auth.uid() → uys_kullanicilar.rol çözümlemesi yapar.
--   app_current_role() v16.88'de kaldırıldı, current_user_role() ile birleştirildi.
--
-- Uygulama sırası (CLAUDE.md):
--   1. TEST (cowgxwmhlogmswatbltz Frankfurt) — uygulandı
--   2. PROD (lmhcobrgrnvtprvmcito)           — v16.88 ile uygulandı
--
-- TEST  applied: 2026-05-15
-- PROD  applied: 2026-05-16 (v16.88 üzerinden — app_current_role yerine current_user_role)

ALTER TABLE public.uys_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all    ON public.uys_orders;
DROP POLICY IF EXISTS "allow_all"  ON public.uys_orders;
DROP POLICY IF EXISTS orders_read  ON public.uys_orders;
DROP POLICY IF EXISTS orders_write ON public.uys_orders;

-- Okuma: tüm authenticated kullanıcılar
CREATE POLICY orders_read ON public.uys_orders
  FOR SELECT TO authenticated
  USING (true);

-- Yazma: admin + planlama (current_user_role v16.87a ile LOWER+aktif içeriyor)
CREATE POLICY orders_write ON public.uys_orders
  FOR ALL TO authenticated
  USING      (public.current_user_role() IN ('admin', 'planlama'))
  WITH CHECK (public.current_user_role() IN ('admin', 'planlama'));
