-- ============================================================================
-- IS EMRI #14 — Faz A — Migration 002 (v2)
-- ============================================================================
-- DUZELTMELER (sandbox kesfi sonrasi):
--   1) uys_receteler -> uys_recipes (gercek tablo adi)
--   2) uys_kesim_planlari row-level -> statement-level (order_id yok, malzeme bazli)
--   3) uys_bom_trees yeni trigger eklendi (recursive BOM traversal MRP'ye girer)
--   4) order_id text (uuid degil — uys_orders.id text)
-- Toplam: 7 trigger (2 row-level + 5 statement-level)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FONKSIYON 1 — Global cache invalidate (statement-level)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invalidate_mrp_global()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    UPDATE public.uys_mrp_state_global
       SET invalidated = true,
           updated_at  = NOW()
     WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'MRP global invalidation failed (table=%, op=%): %',
                  TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.invalidate_mrp_global() IS
  'Global MRP cache invalidate. Statement-level trigger fonksiyonu. Hata yumusak.';


-- ----------------------------------------------------------------------------
-- FONKSIYON 2 — Order bazli + (orders icin global de) (row-level)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invalidate_mrp_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_order_id text;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'uys_orders' THEN
      target_order_id := COALESCE(NEW.id, OLD.id);
      UPDATE public.uys_mrp_state_global
         SET invalidated = true, updated_at = NOW()
       WHERE id = 1;
    ELSE
      target_order_id := COALESCE(NEW.order_id, OLD.order_id);
    END IF;

    IF target_order_id IS NOT NULL THEN
      INSERT INTO public.uys_mrp_state_order (order_id, invalidated)
      VALUES (target_order_id, true)
      ON CONFLICT (order_id) DO UPDATE
        SET invalidated = true, updated_at = NOW();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'MRP order invalidation failed (table=%, op=%, order_id=%): %',
                  TG_TABLE_NAME, TG_OP, target_order_id, SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.invalidate_mrp_order() IS
  'Order bazli MRP cache invalidate. Row-level. orders icin global de bayatlatir. Hata yumusak.';


-- ----------------------------------------------------------------------------
-- TRIGGERS (7 adet)
-- ----------------------------------------------------------------------------

-- 1) uys_orders — row-level (hedefli + global)
DROP TRIGGER IF EXISTS trg_mrp_orders ON public.uys_orders;
CREATE TRIGGER trg_mrp_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.uys_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_mrp_order();

-- 2) uys_work_orders — row-level (sadece hedefli)
DROP TRIGGER IF EXISTS trg_mrp_work_orders ON public.uys_work_orders;
CREATE TRIGGER trg_mrp_work_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.uys_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_mrp_order();

-- 3) uys_kesim_planlari — statement-level (order_id yok, malzeme bazli entity)
DROP TRIGGER IF EXISTS trg_mrp_kesim_planlari ON public.uys_kesim_planlari;
CREATE TRIGGER trg_mrp_kesim_planlari
  AFTER INSERT OR UPDATE OR DELETE ON public.uys_kesim_planlari
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.invalidate_mrp_global();

-- 4) uys_stok_hareketler — statement-level
DROP TRIGGER IF EXISTS trg_mrp_stok_hareketler ON public.uys_stok_hareketler;
CREATE TRIGGER trg_mrp_stok_hareketler
  AFTER INSERT OR UPDATE OR DELETE ON public.uys_stok_hareketler
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.invalidate_mrp_global();

-- 5) uys_tedarikler — statement-level
DROP TRIGGER IF EXISTS trg_mrp_tedarikler ON public.uys_tedarikler;
CREATE TRIGGER trg_mrp_tedarikler
  AFTER INSERT OR UPDATE OR DELETE ON public.uys_tedarikler
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.invalidate_mrp_global();

-- 6) uys_recipes — statement-level
DROP TRIGGER IF EXISTS trg_mrp_recipes ON public.uys_recipes;
CREATE TRIGGER trg_mrp_recipes
  AFTER INSERT OR UPDATE OR DELETE ON public.uys_recipes
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.invalidate_mrp_global();

-- 7) uys_bom_trees — statement-level (BOM degisikligi MRP recursive traversal'i etkiler)
DROP TRIGGER IF EXISTS trg_mrp_bom_trees ON public.uys_bom_trees;
CREATE TRIGGER trg_mrp_bom_trees
  AFTER INSERT OR UPDATE OR DELETE ON public.uys_bom_trees
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.invalidate_mrp_global();


-- Rollback:
--   DROP TRIGGER IF EXISTS trg_mrp_orders          ON public.uys_orders;
--   DROP TRIGGER IF EXISTS trg_mrp_work_orders     ON public.uys_work_orders;
--   DROP TRIGGER IF EXISTS trg_mrp_kesim_planlari  ON public.uys_kesim_planlari;
--   DROP TRIGGER IF EXISTS trg_mrp_stok_hareketler ON public.uys_stok_hareketler;
--   DROP TRIGGER IF EXISTS trg_mrp_tedarikler      ON public.uys_tedarikler;
--   DROP TRIGGER IF EXISTS trg_mrp_recipes         ON public.uys_recipes;
--   DROP TRIGGER IF EXISTS trg_mrp_bom_trees       ON public.uys_bom_trees;
--   DROP FUNCTION IF EXISTS public.invalidate_mrp_order();
--   DROP FUNCTION IF EXISTS public.invalidate_mrp_global();
