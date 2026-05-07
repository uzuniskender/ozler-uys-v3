-- v16.48 — Hammadde Tüketim Raporu
-- birim_kg_metre kolonu + v_hammadde_tuketim view

ALTER TABLE public.uys_malzemeler ADD COLUMN IF NOT EXISTS birim_kg_metre numeric;
COMMENT ON COLUMN public.uys_malzemeler.birim_kg_metre IS 'Hammadde için kg/m (örn. NPU 120 = 13.4). Yarı mamul/mamul için NULL.';

CREATE OR REPLACE VIEW public.v_hammadde_tuketim AS
SELECT
  b.tuketim_tarihi::date                                        AS tarih,
  b.ham_malkod                                                  AS malkod,
  b.ham_malad                                                   AS malad,
  COUNT(*)                                                      AS adet,
  ROUND(SUM(b.uzunluk_mm) / 1000.0, 3)                        AS toplam_metre,
  ROUND(SUM(b.uzunluk_mm) / 1000.0 * COALESCE(MAX(m.birim_kg_metre), 0), 2) AS toplam_kg,
  BOOL_OR(m.birim_kg_metre IS NULL)                            AS kg_eksik
FROM public.uys_acik_barlar b
LEFT JOIN public.uys_malzemeler m ON m.kod = b.ham_malkod
WHERE b.durum = 'tuketildi'
  AND b.tuketim_tarihi IS NOT NULL
  AND b.tuketim_tarihi::date >= '2026-05-01'
GROUP BY b.tuketim_tarihi::date, b.ham_malkod, b.ham_malad;
