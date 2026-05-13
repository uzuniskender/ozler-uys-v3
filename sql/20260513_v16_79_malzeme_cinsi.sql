-- v16.79 — uys_malzemeler: malzeme_cinsi + yeni HM tipleri
-- Bu migration audit-columns.cjs'in schema okuyabilmesi icin gerekli

ALTER TABLE public.uys_malzemeler
  ADD COLUMN IF NOT EXISTS malzeme_cinsi text DEFAULT NULL;
