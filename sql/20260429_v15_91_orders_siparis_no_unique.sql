-- v15.91 -- uys_orders.siparis_no UNIQUE constraint
-- 29 Nis 2026 saha tespiti: ayni siparis_no ile 2 kez sipariş acilabiliyordu
-- (S26A_03151 hem 28 hem 29 Nis kayitlari -> 4 IE duplicate ie_no'ya yol acti)
-- DB seviyesinde sert koruma, UI tarafi v15.91 patch'inde zarif uyari ile destekli.

-- ONEMLI: Bu constraint mevcut duplicate'leri reddeder.
-- Eger DB'de zaten duplicate siparis_no varsa, ALTER basarisiz olur.
-- 29 Nis manuel temizlik yapildi (S26A_03151 birlestirildi), bu yuzden artik gecerli.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'uys_orders_siparis_no_unique'
      AND table_name = 'uys_orders'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.uys_orders
      ADD CONSTRAINT uys_orders_siparis_no_unique UNIQUE (siparis_no);
  END IF;
END $$;
