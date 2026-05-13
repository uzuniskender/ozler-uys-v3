-- v16.79 — uys_malzemeler: malzeme_cinsi + yeni HM tipleri
-- Bu migration audit-columns.cjs'in schema okuyabilmesi icin gerekli

ALTER TABLE public.uys_malzemeler
  ADD COLUMN IF NOT EXISTS malzeme_cinsi text DEFAULT NULL;

-- v16.79.3 — Tie-Rod HM tipi eklendi
INSERT INTO public.uys_hm_tipleri (id, kod, ad, varsayilan_birim, sira, aktif)
VALUES (gen_random_uuid(), 'TIEROD', 'Tie-Rod', 'metre', 10, true)
ON CONFLICT (kod) DO NOTHING;
