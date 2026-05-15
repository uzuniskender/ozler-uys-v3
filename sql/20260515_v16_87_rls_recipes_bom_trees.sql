-- v16.87 — RLS: uys_recipes + uys_bom_trees
-- Okuma: authenticated | Yazma (INSERT/UPDATE/DELETE): admin veya planlama
-- Bağımlılık: public.current_user_role() — v16.0.0 Faz 1.1a ile kuruldu
-- Uygulama sırası: TEST (cowgxwmhlogmswatbltz) → PROD (lmhcobrgrnvtprvmcito)

-- ── uys_recipes ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS allow_all ON public.uys_recipes;

CREATE POLICY recipes_select ON public.uys_recipes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY recipes_insert ON public.uys_recipes
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'planlama'));

CREATE POLICY recipes_update ON public.uys_recipes
  FOR UPDATE TO authenticated
  USING      (current_user_role() IN ('admin', 'planlama'))
  WITH CHECK (current_user_role() IN ('admin', 'planlama'));

CREATE POLICY recipes_delete ON public.uys_recipes
  FOR DELETE TO authenticated
  USING (current_user_role() IN ('admin', 'planlama'));

-- ── uys_bom_trees ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS allow_all ON public.uys_bom_trees;

CREATE POLICY bom_trees_select ON public.uys_bom_trees
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY bom_trees_insert ON public.uys_bom_trees
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'planlama'));

CREATE POLICY bom_trees_update ON public.uys_bom_trees
  FOR UPDATE TO authenticated
  USING      (current_user_role() IN ('admin', 'planlama'))
  WITH CHECK (current_user_role() IN ('admin', 'planlama'));

CREATE POLICY bom_trees_delete ON public.uys_bom_trees
  FOR DELETE TO authenticated
  USING (current_user_role() IN ('admin', 'planlama'));

-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════';
  RAISE NOTICE 'v16.87 — RLS policy sonuçları:';
  FOR r IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('uys_recipes', 'uys_bom_trees')
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE '  %-20s | %-6s | %s', r.tablename, r.cmd, r.policyname;
  END LOOP;
  RAISE NOTICE '════════════════════════════════════════════════════';
END$$;
