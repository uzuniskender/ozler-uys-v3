-- ═══════════════════════════════════════════════════════════════════════
-- UYS v3 — v15.34.3: Fire Log ayırt edici kolonları
-- Tarih: 2026-04-24
-- ═══════════════════════════════════════════════════════════════════════
-- Amaç: Parça fire (üretim sırası) ile bar hurda (ham malzeme hurdası)
-- birim olarak farklı: parça 'adet', bar hurda 'mm'. Aynı tabloda
-- karışmasın diye tip ayracı + uzunluk alanı.
--
-- tip = 'parca'     : mevcut parça fire'ı. qty = adet. uzunluk_mm null.
-- tip = 'bar_hurda' : açık bar hurdası. qty = 1 (bar adedi). uzunluk_mm dolu.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.uys_fire_logs
  ADD COLUMN IF NOT EXISTS tip         text DEFAULT 'parca',
  ADD COLUMN IF NOT EXISTS uzunluk_mm  numeric;

-- Eski kayıtları parça olarak işaretle (tip null olabilir migration öncesi)
UPDATE public.uys_fire_logs SET tip='parca' WHERE tip IS NULL;
