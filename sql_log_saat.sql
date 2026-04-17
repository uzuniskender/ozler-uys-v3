-- ═══ v14: uys_logs tablosuna saat kolonu ═══
-- Supabase SQL Editor'da çalıştırın. Idempotent.
-- Log görüntülenirken tarih yanında saat bilgisi gösterilebilsin diye.

ALTER TABLE public.uys_logs
  ADD COLUMN IF NOT EXISTS saat text;

-- Eski kayıtlar boş kalır (bu sorun değil, görüntülemede boşsa yalnız tarih gösterilir).
-- Yeni kayıtlarda OperatorPanel ve ProductionEntry otomatik olarak saat ekler.
