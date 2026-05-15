-- v16.86 — RLS: uys_ie_hazirlama + uys_rapido_bom
-- Okuma: authenticated | Yazma (INSERT/UPDATE/DELETE): admin veya planlama
-- Bağımlılık: public.current_user_role() — v16.0.0 Faz 1.1a ile kuruldu
-- Uygulama sırası: TEST (cowgxwmhlogmswatbltz) → PROD (lmhcobrgrnvtprvmcito)
-- ════════════════════════════════════════════════════════════════════════════
-- NOT: Bu tablolar v16.83'te oluşturuldu; 20261030_grants_all_tables.sql o
--      tarihten önce yazıldığı için GRANT eklenmiyor; tabloların Supabase
--      Data API'ye açık olduğunu varsay (yönetici grant'i tablolar oluşturulunca
--      default olarak verilir). Eğer SELECT çalışmıyorsa aşağıdaki GRANT
--      satırlarının yorumdan çıkarılması gerekir:
--
--  GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_ie_hazirlama TO anon, authenticated;
--  GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_rapido_bom    TO anon, authenticated;
-- ════════════════════════════════════════════════════════════════════════════

-- ── uys_ie_hazirlama ───────────────────────────────────────────────────────

-- Mevcut allow-all policy'yi kaldır
DROP POLICY IF EXISTS ie_haz_all ON public.uys_ie_hazirlama;

-- Okuma: authenticated (anon erişemez)
CREATE POLICY ie_haz_select ON public.uys_ie_hazirlama
  FOR SELECT TO authenticated
  USING (true);

-- Yazma: yalnızca admin veya planlama rolü
CREATE POLICY ie_haz_insert ON public.uys_ie_hazirlama
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'planlama'));

CREATE POLICY ie_haz_update ON public.uys_ie_hazirlama
  FOR UPDATE TO authenticated
  USING      (current_user_role() IN ('admin', 'planlama'))
  WITH CHECK (current_user_role() IN ('admin', 'planlama'));

CREATE POLICY ie_haz_delete ON public.uys_ie_hazirlama
  FOR DELETE TO authenticated
  USING (current_user_role() IN ('admin', 'planlama'));

-- ── uys_rapido_bom ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS rapido_bom_all ON public.uys_rapido_bom;

CREATE POLICY rapido_bom_select ON public.uys_rapido_bom
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY rapido_bom_insert ON public.uys_rapido_bom
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'planlama'));

CREATE POLICY rapido_bom_update ON public.uys_rapido_bom
  FOR UPDATE TO authenticated
  USING      (current_user_role() IN ('admin', 'planlama'))
  WITH CHECK (current_user_role() IN ('admin', 'planlama'));

CREATE POLICY rapido_bom_delete ON public.uys_rapido_bom
  FOR DELETE TO authenticated
  USING (current_user_role() IN ('admin', 'planlama'));

-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE 'v16.86 — RLS policy sonuçları:';
  FOR r IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('uys_ie_hazirlama', 'uys_rapido_bom')
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE '  %-30s | %-6s | %s', r.tablename, r.cmd, r.policyname;
  END LOOP;
  RAISE NOTICE '════════════════════════════════════════════════════';
END$$;
