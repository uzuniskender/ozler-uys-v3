-- v16.50: v_stok_anlik view + dup_guard trigger fix
-- PROD ve TEST'e uygulandı: 2026-05-06

CREATE OR REPLACE VIEW v_stok_anlik AS
SELECT
  malkod,
  COALESCE(SUM(CASE WHEN tip = 'giris'      THEN miktar ELSE 0 END), 0) AS giris_toplam,
  COALESCE(SUM(CASE WHEN tip = 'cikis'      THEN miktar ELSE 0 END), 0) AS cikis_toplam,
  COALESCE(SUM(CASE WHEN tip = 'bar_acilis' THEN miktar ELSE 0 END), 0) AS bar_acilis_toplam,
  COALESCE(SUM(CASE WHEN tip = 'giris' THEN miktar ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN tip IN (''cikis'',''bar_acilis'') THEN miktar ELSE 0 END), 0) AS stok
FROM uys_stok_hareketler
GROUP BY malkod;

CREATE OR REPLACE FUNCTION fn_stok_hareket_dup_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.wo_id IS NOT NULL OR NEW.log_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.tedarik_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.uys_stok_hareketler WHERE tedarik_id = NEW.tedarik_id AND id <> NEW.id) THEN
      RAISE NOTICE ''Tedarik % icin stok hareket zaten var, skip'', NEW.tedarik_id;
      RETURN NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.uys_stok_hareketler
    WHERE malkod = NEW.malkod AND tip = NEW.tip AND miktar = NEW.miktar
      AND id <> NEW.id AND updated_at > NOW() - INTERVAL ''5 seconds''
  ) THEN
    RAISE NOTICE ''Dup guard: % % % skip (5sn pencere)'', NEW.malkod, NEW.tip, NEW.miktar;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;