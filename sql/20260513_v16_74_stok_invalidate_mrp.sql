-- v16.74 — Stok hareketi gelince ilgili malkod mrp_state_order kayıtlarını invalidate et
CREATE OR REPLACE FUNCTION fn_stok_invalidate_mrp_state()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE uys_mrp_state_order mso
  SET invalidated = true
  WHERE invalidated = false
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(mso.detay->'rows') r
      WHERE r->>'malkod' = NEW.malkod
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stok_invalidate_mrp_state ON uys_stok_hareketler;
CREATE TRIGGER trg_stok_invalidate_mrp_state
AFTER INSERT OR UPDATE ON uys_stok_hareketler
FOR EACH ROW EXECUTE FUNCTION fn_stok_invalidate_mrp_state();
