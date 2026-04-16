-- ═══ B7: Fire → Sipariş Dışı İE (Telafi İE) ═══
-- uys_fire_logs tablosuna telafi_wo_id kolonu ekler
-- Bu kolon, o fire için oluşturulmuş sipariş dışı İE'nin ID'sini tutar

ALTER TABLE public.uys_fire_logs
  ADD COLUMN IF NOT EXISTS telafi_wo_id text;

-- Index: hangi fire'lar telafi edilmiş sorgulaması hızlı olsun
CREATE INDEX IF NOT EXISTS idx_fire_logs_telafi_wo_id
  ON public.uys_fire_logs(telafi_wo_id)
  WHERE telafi_wo_id IS NOT NULL;
