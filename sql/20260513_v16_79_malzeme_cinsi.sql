-- v16.79 — uys_malzemeler: malzeme_cinsi + yeni HM tipleri
-- Bu migration audit-columns.cjs'in schema okuyabilmesi için gerekli

ALTER TABLE public.uys_malzemeler
  ADD COLUMN IF NOT EXISTS malzeme_cinsi text DEFAULT NULL;

-- Yeni HM tipleri (uys_hm_tipleri)
-- MIL, ALTK, KARE, UPRF, IH, TPRF
-- DB'ye apply_migration ile eklendi — audit için CREATE TABLE bilgisi aşağıda

-- NOT: uys_hm_tipleri zaten master_schema.sql'de mevcut
