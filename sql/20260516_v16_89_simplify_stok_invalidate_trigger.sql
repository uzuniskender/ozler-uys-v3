-- ============================================================================
-- v16.89 — trg_stok_invalidate_mrp_state basitleştirmesi
-- ============================================================================
-- Sorun (v16.74): fn_stok_invalidate_mrp_state() JSONB traversal yapıyordu:
--   EXISTS (SELECT 1 FROM jsonb_array_elements(mso.detay->'rows') r WHERE r->>'malkod' = NEW.malkod)
-- Bu: (a) cache formatına bağlı — MRPRow değişirse sessizce bozulur,
--     (b) her stok INSERT'te tüm uys_mrp_state_order'ı tarar.
--
-- Çözüm: Blanket invalidation — stok değişince tüm order cache'leri bayatla.
-- Granülerlik düşer ama doğruluk ve bakım kolaylığı artar.
-- v16.31 trg_mrp_stok_hareketler (global) ile birlikte: her iki cache de temizlenir.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_stok_invalidate_mrp_state ON uys_stok_hareketler;
--   DROP FUNCTION IF EXISTS fn_stok_invalidate_mrp_state();
--   -- Ardından sql/20260513_v16_74_stok_invalidate_mrp.sql'i yeniden uygula.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_stok_invalidate_mrp_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE uys_mrp_state_order
     SET invalidated = true,
         updated_at  = NOW()
   WHERE invalidated = false;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_stok_invalidate_mrp_state() IS
  'Stok hareketi eklenince/güncellenince tüm order MRP cache satırlarını bayatlatır. '
  'v16.89: v16.74 JSONB traversal yerine blanket invalidation — format bağımsız.';

DROP TRIGGER IF EXISTS trg_stok_invalidate_mrp_state ON uys_stok_hareketler;
CREATE TRIGGER trg_stok_invalidate_mrp_state
AFTER INSERT OR UPDATE ON uys_stok_hareketler
FOR EACH ROW EXECUTE FUNCTION fn_stok_invalidate_mrp_state();
