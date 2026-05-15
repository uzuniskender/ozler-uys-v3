-- v16.87a — uys_kullanicilar.rol case normalization + function hardening
-- Sebep: PROD'da rol='Admin' (büyük A) iken stok_write/wo_write politikaları
--        'admin' (küçük) arıyordu → admin yazmaları RLS engeli yiyordu.
-- TEST  applied: 2026-05-15
-- PROD  applied: 2026-05-15

-- rol sütununu küçük harfe normalize et ('Admin' → 'admin' gibi durumlar)
UPDATE public.uys_kullanicilar
SET rol = LOWER(rol)
WHERE rol != LOWER(rol);

-- current_user_role(): LOWER() ile case-insensitive hale getir
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT LOWER(rol) FROM public.uys_kullanicilar
  WHERE auth_user_id = auth.uid() AND aktif = true
  LIMIT 1;
$$;

-- is_admin(): LOWER() ile case-insensitive hale getir
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.uys_kullanicilar
    WHERE auth_user_id = auth.uid()
      AND LOWER(rol) = 'admin'
      AND aktif = true
  );
$$;
