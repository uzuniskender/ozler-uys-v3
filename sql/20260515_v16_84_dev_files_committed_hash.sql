-- v16.84 — DevSync: uys_dev_files.committed_hash kolonu
-- Git blob SHA-1 of claude-edited content; DevSync açılınca hesaplanır.
-- GitHub sha ile eşleşirse dosya commit edilmiş sayılır → otomatik synced yapılır.
--
-- TEST:  cowgxwmhlogmswatbltz — 2026-05-15
-- PROD:  lmhcobrgrnvtprvmcito — bekliyor

ALTER TABLE public.uys_dev_files
  ADD COLUMN IF NOT EXISTS committed_hash text;

COMMENT ON COLUMN public.uys_dev_files.committed_hash IS
  'Git blob SHA-1 of claude-edited content; DevSync açılınca hesaplanır. GitHub sha ile eşleşirse otomatik synced yapılır.';
