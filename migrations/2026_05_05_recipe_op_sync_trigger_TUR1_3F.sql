-- v16.45 — TUR1-3F: Reçete satır UPDATE → açık iş emirleri op/ist/süre senkronu
-- TEST: cowgxwmhlogmswatbltz (uygulandı 5 May 2026)
-- PROD: lmhcobrgrnvtprvmcito (uygulandı 5 May 2026)
--
-- Saha kanıtı (5 May 2026 PROD): YMH100346 reçete op_id 023→027 değişti,
-- IE-S26A_03150-15 (durum=bekliyor) eski 023'te kaldı. Bu trigger eksik halkayı kapatır.
--
-- Eşleme: rc_id + kirno (sira değil — sira incremental woIdx, kirno reçete satır kirno'su)
-- mpm: senkron edilmez (kaynak yok, planlamacının değeri korunur)
-- istId boş: dokunma (autoChain açılış default-resolve'unu ezme)

CREATE INDEX IF NOT EXISTS uys_wo_rc_id_kirno_durum_idx 
  ON public.uys_work_orders(rc_id, kirno, durum);

CREATE OR REPLACE FUNCTION public.fn_recipe_op_sync()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
  satir       JSONB;
  v_opid      TEXT;
  v_opkod     TEXT;
  v_opad      TEXT;
  v_istid     TEXT;
  v_istkod    TEXT;
  v_istad     TEXT;
  v_islems    NUMERIC;
  v_hazs      NUMERIC;
  v_kirno     TEXT;
  v_updated   INTEGER := 0;
BEGIN
  IF OLD.satirlar IS NOT DISTINCT FROM NEW.satirlar THEN
    RETURN NEW;
  END IF;

  FOR satir IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.satirlar, '[]'::jsonb))
  LOOP
    v_opid  := satir->>'opId';
    v_kirno := satir->>'kirno';
    
    IF v_opid IS NULL OR v_opid = '' THEN
      CONTINUE;
    END IF;
    IF v_kirno IS NULL OR v_kirno = '' THEN
      CONTINUE;
    END IF;

    v_istid  := satir->>'istId';
    v_islems := COALESCE((satir->>'islemSure')::NUMERIC, 0);
    v_hazs   := COALESCE((satir->>'hazirlikSure')::NUMERIC, 0);

    v_opkod := NULL; v_opad := NULL;
    SELECT kod, ad INTO v_opkod, v_opad
      FROM public.uys_operations 
      WHERE id = v_opid
      LIMIT 1;

    v_istkod := NULL; v_istad := NULL;
    IF v_istid IS NOT NULL AND v_istid <> '' THEN
      SELECT kod, ad INTO v_istkod, v_istad
        FROM public.uys_stations 
        WHERE id = v_istid
        LIMIT 1;
    END IF;

    UPDATE public.uys_work_orders SET
      op_id  = v_opid,
      op_kod = COALESCE(v_opkod, op_kod),
      op_ad  = COALESCE(v_opad, op_ad),
      ist_id = COALESCE(NULLIF(v_istid, ''), ist_id),
      ist_kod = COALESCE(v_istkod, ist_kod),
      ist_ad  = COALESCE(v_istad, ist_ad),
      islem_sure    = v_islems,
      hazirlik_sure = v_hazs,
      updated_at = NOW()
    WHERE rc_id = NEW.id
      AND kirno = v_kirno
      AND durum NOT IN ('tamamlandi','iptal');
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recipe_op_sync ON public.uys_recipes;

CREATE TRIGGER trg_recipe_op_sync
AFTER UPDATE OF satirlar ON public.uys_recipes
FOR EACH ROW
EXECUTE FUNCTION public.fn_recipe_op_sync();
