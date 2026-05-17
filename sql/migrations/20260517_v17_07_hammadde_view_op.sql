-- v_hammadde_tuketim: operasyon bilgisi + hammadde_tipi + sabit tarih filtresi kaldırıldı — v17.07
-- TEST: 2026-05-17 | PROD: —
--
-- Değişiklikler:
--   + hammadde_tipi (uys_malzemeler) — Malzeme Grubu filtresinin doğru çalışması için
--   + op_kod / op_ad (uys_logs → uys_work_orders join) — operasyon bazlı gruplama
--   + GROUP BY: hammadde_tipi, op_kod, op_ad eklendi
--   - Sabit '2026-05-01' tarih filtresi kaldırıldı (filtre sorgu katmanında)
-- NOT: Yeni kolonlar sona eklendi (CREATE OR REPLACE VIEW kolon sırası değiştirilemiyor)

CREATE OR REPLACE VIEW public.v_hammadde_tuketim AS
SELECT
  b.tuketim_tarihi::date                                        AS tarih,
  b.ham_malkod                                                  AS malkod,
  b.ham_malad                                                   AS malad,
  COUNT(*)                                                      AS adet,
  ROUND(SUM(b.uzunluk_mm) / 1000.0, 3)                        AS toplam_metre,
  ROUND(SUM(b.uzunluk_mm) / 1000.0
        * COALESCE(MAX(m.birim_kg_metre), 0), 2)              AS toplam_kg,
  BOOL_OR(m.birim_kg_metre IS NULL)                            AS kg_eksik,
  m.hammadde_tipi                                               AS hammadde_tipi,
  COALESCE(wo.op_kod, '')                                       AS op_kod,
  COALESCE(wo.op_ad, '')                                        AS op_ad
FROM public.uys_acik_barlar b
LEFT JOIN public.uys_malzemeler  m  ON m.kod  = b.ham_malkod
LEFT JOIN public.uys_logs        lg ON lg.id  = b.tuketim_log_id
LEFT JOIN public.uys_work_orders wo ON wo.id  = lg.wo_id
WHERE b.durum = 'tuketildi'
  AND b.tuketim_tarihi IS NOT NULL
GROUP BY
  b.tuketim_tarihi::date,
  b.ham_malkod,
  b.ham_malad,
  m.hammadde_tipi,
  wo.op_kod,
  wo.op_ad;
