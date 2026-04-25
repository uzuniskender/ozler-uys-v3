-- ════════════════════════════════════════════════════════════════
-- v15.42 — uys_work_orders.termin kolonu (2026-04-25)
-- ════════════════════════════════════════════════════════════════
-- Sebep: autoChain.ts:64 'termin' alanını yazmaya çalışıyordu ama
-- DB'de kolon yoktu, Supabase silent reject ediyordu. Bilgi Bankası
-- §5.2 "Her İE kendi terminine sahip" hedefi DB seviyesinde yoktu.
--
-- Bu migration:
--   1. uys_work_orders'a 'termin' kolonu ekler (text, nullable)
--   2. Mevcut İE'lerin terminini bağlı oldukları siparişten kopyalar
--      (geriye dönük doldurma — kayıp veri olmayacak)
--
-- Idempotent — birden fazla çalıştırılabilir.

-- 1. Kolon ekle
ALTER TABLE public.uys_work_orders
  ADD COLUMN IF NOT EXISTS termin text;

-- 2. Geriye dönük doldurma — siparişten kopyala
UPDATE public.uys_work_orders wo
   SET termin = o.termin
  FROM public.uys_orders o
 WHERE wo.order_id = o.id
   AND wo.termin IS NULL
   AND o.termin IS NOT NULL;

-- 3. Kontrol — kaç İE backfill edildi
DO $$
DECLARE
  total_wo integer;
  with_termin integer;
BEGIN
  SELECT count(*) INTO total_wo FROM public.uys_work_orders;
  SELECT count(*) INTO with_termin FROM public.uys_work_orders WHERE termin IS NOT NULL;
  RAISE NOTICE '[v15.42] uys_work_orders: % satır, % satırda termin var', total_wo, with_termin;
END $$;
