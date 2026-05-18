-- Migration: rezerv_et() atomik stok rezervasyon fonksiyonu
-- Mevcut tablo kullanılır: uys_stok_hareketler (tip='rezerv', rezerv_order_id)
-- Not: chk_stok_tip kısıtı 'rezerv' tipini dışlıyordu — bu migration düzeltir.
-- TEST: 2026-05-18 | PROD: 2026-05-18

-- 1. Eski tip kısıtını kaldır ('giris'|'cikis'|'bar_acilis' → 'rezerv' eksikti)
ALTER TABLE uys_stok_hareketler DROP CONSTRAINT IF EXISTS chk_stok_tip;

-- 2. 'rezerv' dahil yeni kısıt
ALTER TABLE uys_stok_hareketler
  ADD CONSTRAINT chk_stok_tip
  CHECK (tip = ANY (ARRAY['giris','cikis','bar_acilis','rezerv']));

-- 3. Atomik rezervasyon fonksiyonu
CREATE OR REPLACE FUNCTION rezerv_et(
  p_malkod      TEXT,
  p_miktar      NUMERIC,
  p_order_id    TEXT,
  p_wo_id       TEXT,
  p_test_run_id TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_musait NUMERIC;
BEGIN
  -- Aynı malkod için eş zamanlı çağrıları serialize et
  PERFORM pg_advisory_xact_lock(hashtext(p_malkod));

  -- Müsait stok = net stok (rezerv dahil düşülmüş)
  SELECT COALESCE(SUM(
    CASE
      WHEN tip = 'giris'                           THEN miktar
      WHEN tip IN ('cikis', 'bar_acilis', 'rezerv') THEN -miktar
      ELSE 0
    END
  ), 0) INTO v_musait
  FROM uys_stok_hareketler
  WHERE malkod = p_malkod
    AND (
      (p_test_run_id IS NULL AND test_run_id IS NULL)
      OR test_run_id = p_test_run_id
    );

  IF v_musait < p_miktar THEN
    RAISE EXCEPTION 'STOK_YETERSIZ:%:musait=%:gerekli=%',
      p_malkod, v_musait, p_miktar;
  END IF;

  INSERT INTO uys_stok_hareketler (
    id,
    malkod,
    miktar,
    tip,
    rezerv_order_id,
    tarih,
    aciklama,
    test_run_id
  ) VALUES (
    'rezerv-' || gen_random_uuid(),
    p_malkod,
    p_miktar,
    'rezerv',
    p_order_id,
    NOW(),
    'autoChain rezerv — WO:' || p_wo_id,
    p_test_run_id
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION rezerv_et(TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
