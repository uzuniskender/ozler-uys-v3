-- ═══════════════════════════════════════════════════════════════════════════
-- v16.88 — RLS: uys_sevkler + uys_tedarikler
-- authenticated → SELECT (okuma)
-- admin + planlama → INSERT/UPDATE/DELETE (yazma)
--
-- Aynı zamanda current_user_role() yardımcı fonksiyonu tanımlanır;
-- bu fonksiyon v16.87 (uys_work_orders, uys_stok_hareketler) tarafından
-- da kullanılacak.
--
-- TEST  uygulandı: 2026-05-15
-- PROD  uygulandı: —
-- ═══════════════════════════════════════════════════════════════════════════

-- Yardımcı fonksiyon: mevcut kullanıcının rolünü döndürür (SECURITY DEFINER).
-- is_admin() ile aynı pattern; rol adını text olarak verir.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT rol
  FROM public.uys_kullanicilar
  WHERE auth_user_id = auth.uid()
    AND aktif = true
  LIMIT 1
$$;

-- ─── uys_sevkler ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS allow_all ON public.uys_sevkler;

CREATE POLICY "authenticated_select"
  ON public.uys_sevkler
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_planlama_write"
  ON public.uys_sevkler
  FOR ALL
  TO authenticated
  USING      (public.current_user_role() IN ('admin', 'planlama'))
  WITH CHECK (public.current_user_role() IN ('admin', 'planlama'));

-- ─── uys_tedarikler ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS allow_all ON public.uys_tedarikler;

CREATE POLICY "authenticated_select"
  ON public.uys_tedarikler
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_planlama_write"
  ON public.uys_tedarikler
  FOR ALL
  TO authenticated
  USING      (public.current_user_role() IN ('admin', 'planlama'))
  WITH CHECK (public.current_user_role() IN ('admin', 'planlama'));
