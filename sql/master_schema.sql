-- ════════════════════════════════════════════════════════════════
-- ÖZLER UYS v3 — MASTER SQL ŞEMASI (2026-05-17)
-- ════════════════════════════════════════════════════════════════
-- Yeni Supabase projesine uygulanacak tek dosya.
-- Sadece public schema UYS tabloları, fonksiyonlar, triggerlar ve RLS.
-- Kaynak: backups/2026-05-17/schema.sql (pg_dump 17.10 çıktısı).

-- ════ 0. ÖN AYARLAR ════

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET row_security = off;

-- ════ 1. CUSTOM TYPE ════

CREATE TYPE public.order_state AS ENUM (
    'yeni',
    'recete_yok',
    'plan_bekliyor',
    'tedarik_bekliyor',
    'uretilebilir',
    'uretiliyor',
    'tamamlandi',
    'kapanma_bekliyor',
    'kapali',
    'iptal'
);

-- ════ 2. FONKSIYONLAR ════

-- 2.1 set_updated_at — tüm updated_at triggerlarında kullanılır
CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- 2.2 current_user_role — RLS policy'lerinde kullanılır
CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT LOWER(rol) FROM public.uys_kullanicilar
  WHERE auth_user_id = auth.uid() AND aktif = true LIMIT 1;
$$;

-- 2.3 is_admin — admin RLS helper
CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.uys_kullanicilar
    WHERE auth_user_id = auth.uid()
      AND LOWER(rol) = 'admin' AND aktif = true
  );
$$;

-- 2.4 compute_order_state — sipariş durumu hesaplama (IE #14 Faz B)
CREATE FUNCTION public.compute_order_state(p_order_id text) RETURNS public.order_state
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order        public.uys_orders%ROWTYPE;
  v_wo_count     int;
  v_wo_done      int;
  v_wo_active    int;
  v_wo_iptal     int;
  v_acik_tedarik int;
  v_eksik_var    boolean;
BEGIN
  SELECT * INTO v_order FROM public.uys_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN 'yeni'; END IF;

  IF v_order.durum = 'iptal' THEN RETURN 'iptal'; END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE durum = 'tamamlandi'),
    count(*) FILTER (WHERE durum IN ('uretimde')),
    count(*) FILTER (WHERE durum = 'iptal')
  INTO v_wo_count, v_wo_done, v_wo_active, v_wo_iptal
  FROM public.uys_work_orders WHERE order_id = p_order_id;

  IF v_wo_count > 0 AND (v_wo_done + v_wo_iptal) = v_wo_count THEN
    IF v_order.sevk_durum = 'tam' THEN RETURN 'kapali'; END IF;
    IF v_order.sevk_durum IN ('kismi', 'kismi_sevk') THEN RETURN 'kapanma_bekliyor'; END IF;
    RETURN 'tamamlandi';
  END IF;

  IF v_wo_active > 0 THEN RETURN 'uretiliyor'; END IF;

  SELECT count(*) INTO v_acik_tedarik FROM public.uys_tedarikler
  WHERE order_id = p_order_id AND COALESCE(geldi, false) = false AND COALESCE(durum, '') <> 'iptal';

  SELECT EXISTS (
    SELECT 1 FROM public.uys_mrp_state_order
    WHERE order_id = p_order_id AND invalidated = false
      AND detay->'rows' IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(detay->'rows') r
        WHERE COALESCE((r->>'net')::numeric, 0) > 0
      )
  ) INTO v_eksik_var;

  IF v_acik_tedarik > 0 THEN RETURN 'tedarik_bekliyor'; END IF;
  IF v_eksik_var THEN RETURN 'plan_bekliyor'; END IF;
  IF v_wo_count > 0 THEN RETURN 'uretilebilir'; END IF;
  IF v_order.recete_id IS NULL OR v_order.recete_id = '' THEN RETURN 'recete_yok'; END IF;
  RETURN 'yeni';
END;
$$;

COMMENT ON FUNCTION public.compute_order_state(p_order_id text) IS 'IE #14 Faz B - Auto-state hesabi.';

-- 2.5 refresh_order_state — order.state sütununu günceller
CREATE FUNCTION public.refresh_order_state(p_order_id text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE v_new order_state; v_old order_state;
BEGIN
  IF p_order_id IS NULL THEN RETURN; END IF;
  SELECT state INTO v_old FROM public.uys_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_new := public.compute_order_state(p_order_id);
  IF v_new IS DISTINCT FROM v_old THEN
    UPDATE public.uys_orders SET state = v_new WHERE id = p_order_id;
  END IF;
END;
$$;

-- 2.6 tg_refresh_order_state — trigger fonksiyonu
CREATE FUNCTION public.tg_refresh_order_state() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE target_order_id text;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'uys_orders' THEN
      target_order_id := COALESCE(NEW.id, OLD.id);
    ELSE
      target_order_id := COALESCE(NEW.order_id, OLD.order_id);
    END IF;
    PERFORM public.refresh_order_state(target_order_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_order_state failed (table=%, op=%, order_id=%): %',
                  TG_TABLE_NAME, TG_OP, target_order_id, SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2.7 invalidate_mrp_global — global MRP cache bayatlatma
CREATE FUNCTION public.invalidate_mrp_global() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  BEGIN
    UPDATE public.uys_mrp_state_global
       SET invalidated = true,
           updated_at  = NOW()
     WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'MRP global invalidation failed (table=%, op=%): %',
                  TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.invalidate_mrp_global() IS 'Global MRP cache invalidate. Statement-level trigger fonksiyonu. Hata yumusak.';

-- 2.8 invalidate_mrp_order — order bazlı MRP cache bayatlatma
CREATE FUNCTION public.invalidate_mrp_order() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  target_order_id text;
  is_mrp_relevant boolean := true;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'uys_orders' THEN
      is_mrp_relevant := (
           OLD.termin     IS DISTINCT FROM NEW.termin
        OR OLD.urunler    IS DISTINCT FROM NEW.urunler
        OR OLD.mamul_kod  IS DISTINCT FROM NEW.mamul_kod
        OR OLD.adet       IS DISTINCT FROM NEW.adet
        OR OLD.recete_id  IS DISTINCT FROM NEW.recete_id
        OR OLD.durum      IS DISTINCT FROM NEW.durum
      );
    ELSIF TG_TABLE_NAME = 'uys_work_orders' THEN
      is_mrp_relevant := (
           OLD.order_id     IS DISTINCT FROM NEW.order_id
        OR OLD.malkod       IS DISTINCT FROM NEW.malkod
        OR OLD.hedef        IS DISTINCT FROM NEW.hedef
        OR OLD.hm           IS DISTINCT FROM NEW.hm
        OR OLD.durum        IS DISTINCT FROM NEW.durum
        OR OLD.bagimsiz     IS DISTINCT FROM NEW.bagimsiz
        OR OLD.siparis_disi IS DISTINCT FROM NEW.siparis_disi
        OR OLD.mamul_kod    IS DISTINCT FROM NEW.mamul_kod
        OR OLD.termin       IS DISTINCT FROM NEW.termin
      );
    END IF;
    IF NOT is_mrp_relevant THEN
      RETURN NEW;
    END IF;
  END IF;

  BEGIN
    IF TG_TABLE_NAME = 'uys_orders' THEN
      target_order_id := COALESCE(NEW.id, OLD.id);
      UPDATE public.uys_mrp_state_global SET invalidated = true, updated_at = NOW() WHERE id = 1;
    ELSE
      target_order_id := COALESCE(NEW.order_id, OLD.order_id);
    END IF;
    IF target_order_id IS NOT NULL THEN
      INSERT INTO public.uys_mrp_state_order (order_id, invalidated)
      VALUES (target_order_id, true)
      ON CONFLICT (order_id) DO UPDATE SET invalidated = true, updated_at = NOW();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'MRP order invalidation failed (table=%, op=%, order_id=%): %',
                  TG_TABLE_NAME, TG_OP, target_order_id, SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.invalidate_mrp_order() IS 'Order bazli MRP cache invalidate. Row-level. orders icin global de bayatlatir. Hata yumusak.';

-- 2.9 fn_mrp_state_refresh_order
CREATE FUNCTION public.fn_mrp_state_refresh_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM refresh_order_state(NEW.order_id);
  RETURN NEW;
END;
$$;

-- 2.10 fn_mrp_durum_check_on_wo
CREATE FUNCTION public.fn_mrp_durum_check_on_wo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_order_id TEXT;
  v_bekleyen INT;
BEGIN
  IF NEW.durum = 'tamamlandi' AND NEW.order_id IS NOT NULL THEN
    v_order_id := NEW.order_id;
    SELECT COUNT(*) INTO v_bekleyen
    FROM uys_work_orders
    WHERE order_id = v_order_id
      AND durum NOT IN ('tamamlandi', 'iptal');
    IF v_bekleyen = 0 THEN
      UPDATE uys_orders
      SET mrp_durum = 'tamam'
      WHERE id = v_order_id AND mrp_durum != 'tamam';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2.11 fn_mrp_durum_on_order_close
CREATE FUNCTION public.fn_mrp_durum_on_order_close() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.durum = 'kapalı' AND (OLD.durum IS NULL OR OLD.durum != 'kapalı') THEN
    NEW.mrp_durum := 'tamam';
  END IF;
  RETURN NEW;
END;
$$;

-- 2.12 fn_stok_invalidate_mrp_state
CREATE FUNCTION public.fn_stok_invalidate_mrp_state() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.uys_mrp_state_order
     SET invalidated = true, updated_at = NOW()
   WHERE invalidated = false;
  RETURN NEW;
END;
$$;

-- 2.13 fn_stok_reset_mrp_durum
CREATE FUNCTION public.fn_stok_reset_mrp_durum() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE uys_orders o
  SET mrp_durum = 'bekliyor'
  WHERE mrp_durum = 'eksik'
    AND state NOT IN ('tamamlandi','kapali','iptal')
    AND EXISTS (
      SELECT 1 FROM uys_work_orders w
      JOIN jsonb_array_elements(w.hm) h ON true
      WHERE w.order_id = o.id
        AND h->>'malkod' = NEW.malkod
    );
  RETURN NEW;
END;
$$;

-- 2.14 fn_stok_hareket_dup_guard — duplicate stok hareketi engeli
CREATE FUNCTION public.fn_stok_hareket_dup_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.wo_id IS NOT NULL OR NEW.log_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.tedarik_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.uys_stok_hareketler
      WHERE tedarik_id = NEW.tedarik_id AND id <> NEW.id
    ) THEN
      RAISE NOTICE 'Tedarik % icin stok hareket zaten var, skip', NEW.tedarik_id;
      RETURN NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.uys_stok_hareketler
    WHERE malkod  = NEW.malkod
      AND tip     = NEW.tip
      AND miktar  = NEW.miktar
      AND id      <> NEW.id
      AND updated_at > NOW() - INTERVAL '5 seconds'
  ) THEN
    RAISE NOTICE 'Dup guard: % % % skip (5sn pencere)', NEW.malkod, NEW.tip, NEW.miktar;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 2.15 fn_stok_hareket_refresh_order
CREATE FUNCTION public.fn_stok_hareket_refresh_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_order_id text;
BEGIN
  IF COALESCE(NEW.wo_id, '') <> '' THEN
    SELECT order_id INTO v_order_id
    FROM uys_work_orders WHERE id = NEW.wo_id;
    IF v_order_id IS NOT NULL THEN
      PERFORM refresh_order_state(v_order_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- 2.16 cascade_malzeme_kod_update
CREATE FUNCTION public.cascade_malzeme_kod_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.kod IS DISTINCT FROM NEW.kod THEN
    UPDATE uys_recipes
    SET satirlar = (
      SELECT jsonb_agg(
        CASE
          WHEN satir->>'malkod' = OLD.kod
          THEN satir || jsonb_build_object('malkod', NEW.kod)
          ELSE satir
        END
      )
      FROM jsonb_array_elements(satirlar) AS satir
    )
    WHERE satirlar::text LIKE '%' || OLD.kod || '%';
    UPDATE uys_work_orders
    SET malkod = NEW.kod
    WHERE malkod = OLD.kod AND durum NOT IN ('tamamlandi', 'iptal');
    RAISE NOTICE 'Malzeme kodu cascade: % → %', OLD.kod, NEW.kod;
  END IF;
  RETURN NEW;
END;
$$;

-- 2.17 fn_malkod_cascade_update
CREATE FUNCTION public.fn_malkod_cascade_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.kod IS DISTINCT FROM OLD.kod THEN
    UPDATE uys_stok_hareketler
    SET malkod = NEW.kod,
        malad  = CASE WHEN malad = OLD.ad THEN NEW.ad ELSE malad END
    WHERE malkod = OLD.kod;
    UPDATE uys_work_orders
    SET malkod = NEW.kod,
        malad  = CASE WHEN malad = OLD.ad THEN NEW.ad ELSE malad END
    WHERE malkod = OLD.kod;
    UPDATE uys_work_orders
    SET hm = (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'malkod' = OLD.kod
          THEN jsonb_set(elem, '{malkod}', to_jsonb(NEW.kod))
          ELSE elem
        END
      )
      FROM jsonb_array_elements(hm) AS elem
    )
    WHERE hm IS NOT NULL
      AND hm @> jsonb_build_array(jsonb_build_object('malkod', OLD.kod));
    UPDATE uys_logs
    SET malkod = NEW.kod
    WHERE malkod = OLD.kod;
    UPDATE uys_kesim_planlari
    SET ham_malkod = NEW.kod,
        ham_malad  = CASE WHEN ham_malad = OLD.ad THEN NEW.ad ELSE ham_malad END
    WHERE ham_malkod = OLD.kod;
  END IF;
  RETURN NEW;
END;
$$;

-- 2.18 tg_clear_bekleyen_kesim_planlari
CREATE FUNCTION public.tg_clear_bekleyen_kesim_planlari() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.adet IS DISTINCT FROM OLD.adet
     OR NEW.urunler IS DISTINCT FROM OLD.urunler THEN
    DELETE FROM uys_kesim_planlari WHERE durum = 'bekliyor';
  END IF;
  RETURN NEW;
END;
$$;

-- 2.19 fn_pending_flow_set_order_id
CREATE FUNCTION public.fn_pending_flow_set_order_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.order_id IS NULL AND NEW.state_data->>'orderId' IS NOT NULL THEN
    NEW.order_id := NEW.state_data->>'orderId';
  END IF;
  RETURN NEW;
END;
$$;

-- 2.20 fn_recete_sure_cascade
CREATE FUNCTION public.fn_recete_sure_cascade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_mamul_kod text;
  v_kok_satir jsonb;
BEGIN
  v_mamul_kod := NEW.mamul_kod;
  SELECT s INTO v_kok_satir FROM jsonb_array_elements(NEW.satirlar) AS s WHERE s->>'kirno' = '1' LIMIT 1;
  IF v_kok_satir IS NULL THEN RETURN NEW; END IF;
  IF (v_kok_satir->>'opId' IS NULL OR v_kok_satir->>'opId' = '')
     AND ((v_kok_satir->>'islemSure')::numeric = 0) THEN RETURN NEW; END IF;

  UPDATE uys_recipes r
  SET satirlar = (
    SELECT jsonb_agg(
      CASE
        WHEN s->>'malkod' = v_mamul_kod
          AND s->>'tip' IN ('YarıMamul','Mamul')
          AND ((s->>'islemSure')::numeric = 0 OR s->>'islemSure' IS NULL)
        THEN s
          || CASE WHEN v_kok_satir->>'opId' IS NOT NULL AND v_kok_satir->>'opId' != ''
                  THEN jsonb_build_object('opId', v_kok_satir->>'opId') ELSE '{}'::jsonb END
          || CASE WHEN (v_kok_satir->>'islemSure')::numeric > 0
                  THEN jsonb_build_object('islemSure', (v_kok_satir->>'islemSure')::numeric,
                                          'sureBirim', COALESCE(v_kok_satir->>'sureBirim','sn'))
                  ELSE '{}'::jsonb END
          || CASE WHEN (v_kok_satir->>'hazirlikSure')::numeric > 0
                  THEN jsonb_build_object('hazirlikSure', (v_kok_satir->>'hazirlikSure')::numeric)
                  ELSE '{}'::jsonb END
        ELSE s
      END
    )
    FROM jsonb_array_elements(r.satirlar) AS s
  )
  WHERE r.id != NEW.id
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(r.satirlar) AS s
      WHERE s->>'malkod' = v_mamul_kod AND s->>'tip' IN ('YarıMamul','Mamul')
        AND ((s->>'islemSure')::numeric = 0 OR s->>'islemSure' IS NULL)
    );
  RETURN NEW;
END;
$$;

-- 2.21 fn_recipe_op_sync
CREATE FUNCTION public.fn_recipe_op_sync() RETURNS trigger
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
    IF v_opid IS NULL OR v_opid = '' THEN CONTINUE; END IF;
    IF v_kirno IS NULL OR v_kirno = '' THEN CONTINUE; END IF;
    v_istid  := satir->>'istId';
    v_islems := COALESCE((satir->>'islemSure')::NUMERIC, 0);
    v_hazs   := COALESCE((satir->>'hazirlikSure')::NUMERIC, 0);
    v_opkod := NULL; v_opad := NULL;
    SELECT kod, ad INTO v_opkod, v_opad FROM public.uys_operations WHERE id = v_opid LIMIT 1;
    v_istkod := NULL; v_istad := NULL;
    IF v_istid IS NOT NULL AND v_istid <> '' THEN
      SELECT kod, ad INTO v_istkod, v_istad FROM public.uys_stations WHERE id = v_istid LIMIT 1;
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

-- 2.22 admin_update_user_password
CREATE FUNCTION public.admin_update_user_password(target_user_id uuid, new_password text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  caller_role text;
  target_auth_user_id uuid;
BEGIN
  caller_role := public.current_user_role();
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Yetersiz yetki: sadece admin şifre güncelleyebilir';
  END IF;
  SELECT auth_user_id INTO target_auth_user_id
  FROM public.uys_kullanicilar WHERE id = target_user_id::text;
  IF target_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Bu kullanıcının Auth hesabı yok';
  END IF;
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_auth_user_id;
END;
$$;

-- ════ 3. TABLOLAR ════

-- 3.1 Müşteriler
CREATE TABLE public.uys_customers (
    id text NOT NULL,
    ad text,
    kod text,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.2 Malzemeler
CREATE TABLE public.uys_malzemeler (
    id text NOT NULL,
    kod text,
    ad text,
    tip text,
    hammadde_tipi text,
    birim text DEFAULT 'Adet'::text,
    boy numeric DEFAULT 0,
    en numeric DEFAULT 0,
    kalinlik numeric DEFAULT 0,
    uzunluk numeric DEFAULT 0,
    cap numeric DEFAULT 0,
    ic_cap numeric DEFAULT 0,
    min_stok numeric DEFAULT 0,
    op_id text,
    op_kod text,
    revizyon integer DEFAULT 0,
    revizyon_tarihi text,
    onceki_id text,
    aktif boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    birim_kg_metre numeric,
    malzeme_cinsi text
);

COMMENT ON COLUMN public.uys_malzemeler.birim_kg_metre IS 'Hammadde için kg/m (örn. NPU 120 = 13.4). Yarı mamul/mamul için NULL.';

-- 3.3 HM Tipleri (v16.79 — uuid PK, varsayilan_birim CHECK)
CREATE TABLE public.uys_hm_tipleri (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kod text NOT NULL,
    ad text NOT NULL,
    aciklama text,
    varsayilan_birim text DEFAULT 'adet'::text NOT NULL,
    sira integer DEFAULT 0 NOT NULL,
    aktif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    updated_by text,
    CONSTRAINT uys_hm_tipleri_varsayilan_birim_check CHECK ((varsayilan_birim = ANY (ARRAY['kg'::text, 'metre'::text, 'adet'::text, 'm2'::text, 'litre'::text])))
);

COMMENT ON TABLE public.uys_hm_tipleri IS 'Hammadde sınıflandırma tipleri (Profil, Boru, Sac vb.)';
COMMENT ON COLUMN public.uys_hm_tipleri.kod IS 'Kısa kod, BÜYÜK harf (PRF, BOR, SAC)';
COMMENT ON COLUMN public.uys_hm_tipleri.ad IS 'UI''da görünen isim';
COMMENT ON COLUMN public.uys_hm_tipleri.aciklama IS 'Opsiyonel açıklama / alt tip bilgisi';
COMMENT ON COLUMN public.uys_hm_tipleri.varsayilan_birim IS 'Stok/reçetede dropdown seçildiğinde auto-fill birim';
COMMENT ON COLUMN public.uys_hm_tipleri.sira IS 'UI sırası (küçük değer üstte)';
COMMENT ON COLUMN public.uys_hm_tipleri.aktif IS 'Pasif tipler dropdown listelerinde görünmez';

-- 3.4 Operasyonlar
CREATE TABLE public.uys_operations (
    id text NOT NULL,
    kod text,
    ad text,
    bolum text,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.5 İstasyonlar
CREATE TABLE public.uys_stations (
    id text NOT NULL,
    kod text,
    ad text,
    op_ids jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.6 Operatörler
CREATE TABLE public.uys_operators (
    id text NOT NULL,
    kod text,
    ad text,
    bolum text,
    aktif boolean DEFAULT true,
    sifre text,
    updated_at timestamp with time zone DEFAULT now(),
    sicil_hash text,
    auth_user_id uuid,
    aktif_oturum_id uuid,
    aktif_oturum_cihaz text,
    aktif_oturum_son timestamp with time zone,
    bolumler text[]
);

COMMENT ON COLUMN public.uys_operators.auth_user_id IS 'Supabase Auth user UUID. NULL = henuz Auth migrate edilmedi (Asama 3 hedefi). 30 Nis 2026 v16.22.';
COMMENT ON COLUMN public.uys_operators.aktif_oturum_id IS 'Aktif oturum UUID. Login sırasında üretilir, başka cihaz girince değiştirilir, eski cihaz Realtime ile fark eder.';
COMMENT ON COLUMN public.uys_operators.aktif_oturum_cihaz IS 'Aktif oturum cihaz tanımı. Uyarı UIsinde kullanılır.';
COMMENT ON COLUMN public.uys_operators.aktif_oturum_son IS 'Son aktivite timestamp. Stale session detection için.';
COMMENT ON COLUMN public.uys_operators.bolumler IS 'Ek bölüm atamaları. Dolu ise bolum alanının önüne geçer.';

-- 3.7 Duruş Kodları
CREATE TABLE public.uys_durus_kodlari (
    id text NOT NULL,
    kod text,
    ad text,
    kategori text,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.8 Tedarikçiler
CREATE TABLE public.uys_tedarikciler (
    id text NOT NULL,
    kod text,
    ad text,
    adres text,
    tel text,
    email text,
    not_ text,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.9 BOM Ağaçları
CREATE TABLE public.uys_bom_trees (
    id text NOT NULL,
    mamul_kod text,
    mamul_ad text,
    ad text,
    rows jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.10 Reçeteler
CREATE TABLE public.uys_recipes (
    id text NOT NULL,
    rc_kod text,
    ad text,
    bom_id text,
    mamul_kod text,
    mamul_ad text,
    satirlar jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.11 Siparişler
CREATE TABLE public.uys_orders (
    id text NOT NULL,
    siparis_no text,
    musteri text,
    tarih text,
    termin text,
    not_ text,
    urunler jsonb DEFAULT '[]'::jsonb,
    mamul_kod text,
    mamul_ad text,
    adet integer DEFAULT 1,
    recete_id text,
    mrp_durum text DEFAULT 'bekliyor'::text,
    durum text DEFAULT ''::text,
    sevk_durum text DEFAULT 'sevk_yok'::text,
    oncelik integer DEFAULT 0,
    olusturma text,
    updated_at timestamp with time zone DEFAULT now(),
    test_run_id text,
    state public.order_state DEFAULT 'yeni'::public.order_state NOT NULL
);

COMMENT ON COLUMN public.uys_orders.state IS 'IE #14 Faz B - Otomatik hesaplanan siparis state. compute_order_state() ile guncellenir.';

-- 3.12 İş Emirleri
CREATE TABLE public.uys_work_orders (
    id text NOT NULL,
    order_id text,
    rc_id text,
    sira integer DEFAULT 0,
    kirno text,
    op_id text,
    op_kod text,
    op_ad text,
    ist_id text,
    ist_kod text,
    ist_ad text,
    malkod text,
    malad text,
    hedef numeric DEFAULT 0,
    mpm numeric DEFAULT 1,
    hm jsonb DEFAULT '[]'::jsonb,
    ie_no text,
    wh_alloc numeric DEFAULT 0,
    hazirlik_sure numeric DEFAULT 0,
    islem_sure numeric DEFAULT 0,
    durum text DEFAULT 'bekliyor'::text,
    bagimsiz boolean DEFAULT false,
    siparis_disi boolean DEFAULT false,
    mamul_kod text,
    mamul_ad text,
    mamul_auto boolean DEFAULT false,
    operator_id text,
    not_ text,
    olusturma text,
    updated_at timestamp with time zone DEFAULT now(),
    termin text,
    test_run_id text
);

-- 3.13 Üretim Logları
CREATE TABLE public.uys_logs (
    id text NOT NULL,
    wo_id text,
    tarih text,
    saat text,
    qty numeric DEFAULT 0,
    fire numeric DEFAULT 0,
    operatorlar jsonb DEFAULT '[]'::jsonb,
    duruslar jsonb DEFAULT '[]'::jsonb,
    not_ text,
    malkod text,
    ie_no text,
    operator_id text,
    vardiya text,
    updated_at timestamp with time zone DEFAULT now(),
    test_run_id text
);

-- 3.14 Stok Hareketleri
CREATE TABLE public.uys_stok_hareketler (
    id text NOT NULL,
    tarih text,
    malkod text,
    malad text,
    miktar numeric DEFAULT 0,
    tip text DEFAULT 'giris'::text,
    log_id text,
    wo_id text,
    aciklama text,
    updated_at timestamp with time zone DEFAULT now(),
    test_run_id text,
    rezerv_order_id text,
    tedarik_id text,
    CONSTRAINT chk_stok_log_id_not_empty CHECK (((log_id IS NULL) OR (log_id <> ''::text))),
    CONSTRAINT chk_stok_tip CHECK ((tip = ANY (ARRAY['giris'::text, 'cikis'::text, 'bar_acilis'::text]))),
    CONSTRAINT chk_stok_wo_id_not_empty CHECK (((wo_id IS NULL) OR (wo_id <> ''::text)))
);

-- 3.14.1 Açık Bar Havuzu (v15.31)
CREATE TABLE public.uys_acik_barlar (
    id text NOT NULL,
    ham_malkod text NOT NULL,
    ham_malad text,
    uzunluk_mm numeric DEFAULT 0 NOT NULL,
    kaynak_plan_id text,
    kaynak_satir_id text,
    bar_index integer DEFAULT 0,
    olusma_tarihi text,
    durum text DEFAULT 'acik'::text NOT NULL,
    tuketim_log_id text,
    tuketim_tarihi text,
    not_ text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hurda_tarihi timestamp without time zone,
    hurda_sebep text,
    hurda_kullanici_id text,
    hurda_kullanici_ad text,
    test_run_id text
);

-- 3.15 Kesim Planları
CREATE TABLE public.uys_kesim_planlari (
    id text NOT NULL,
    ham_malkod text,
    ham_malad text,
    ham_boy numeric DEFAULT 0,
    ham_en numeric DEFAULT 0,
    kesim_tip text,
    durum text DEFAULT 'bekliyor'::text,
    satirlar jsonb DEFAULT '[]'::jsonb,
    tarih text,
    gerekli_adet numeric DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    test_run_id text,
    ham_kalinlik numeric,
    fire_kg numeric,
    artik_malzeme_kod text
);

-- 3.16 Tedarikler
CREATE TABLE public.uys_tedarikler (
    id text NOT NULL,
    malkod text,
    malad text,
    miktar numeric DEFAULT 0,
    birim text DEFAULT 'Adet'::text,
    order_id text,
    siparis_no text,
    durum text DEFAULT 'bekliyor'::text,
    geldi boolean DEFAULT false,
    teslim_tarihi text,
    tedarikci_id text,
    tedarikci_ad text,
    not_ text,
    tarih text,
    updated_at timestamp with time zone DEFAULT now(),
    test_run_id text,
    auto_olusturuldu boolean DEFAULT false,
    mrp_calculation_id text
);

-- 3.17 Sevkler
CREATE TABLE public.uys_sevkler (
    id text NOT NULL,
    order_id text,
    siparis_no text,
    musteri text,
    tarih text,
    kalemler jsonb DEFAULT '[]'::jsonb,
    not_ text,
    updated_at timestamp with time zone DEFAULT now(),
    test_run_id text,
    sevk_no text,
    tip text DEFAULT 'siparis'::text,
    musteri_kod text,
    tasiyici text,
    plaka text,
    olusturan text,
    olusturma timestamp with time zone DEFAULT now(),
    durum text DEFAULT 'gerceklesti'::text NOT NULL,
    CONSTRAINT uys_sevkler_tip_check CHECK (((tip IS NULL) OR (tip = ANY (ARRAY['siparis'::text, 'siparissiz'::text, 'iptal'::text]))))
);

-- 3.17.1 Sevk Satırları
CREATE TABLE public.uys_sevk_satirlari (
    id text NOT NULL,
    sevk_id text NOT NULL,
    order_id text,
    order_satir_idx integer,
    malkod text NOT NULL,
    malad text NOT NULL,
    miktar numeric NOT NULL,
    birim text DEFAULT 'adet'::text,
    not_ text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT uys_sevk_satirlari_miktar_check CHECK ((miktar > (0)::numeric))
);

-- 3.18 Operatör Notları
CREATE TABLE public.uys_operator_notes (
    id text NOT NULL,
    op_id text,
    op_ad text,
    tarih text,
    saat text,
    mesaj text,
    okundu boolean DEFAULT false,
    cevap text,
    cevaplayan text,
    cevap_tarih text,
    updated_at timestamp with time zone DEFAULT now(),
    kategori text,
    oncelik text DEFAULT 'Normal'::text
);

-- 3.19 Aktif Çalışmalar
CREATE TABLE public.uys_active_work (
    id text NOT NULL,
    op_id text,
    op_ad text,
    wo_id text,
    wo_ad text,
    baslangic text,
    tarih text,
    updated_at timestamp with time zone DEFAULT now(),
    test_run_id text
);

-- 3.20 Fire Logları
CREATE TABLE public.uys_fire_logs (
    id text NOT NULL,
    log_id text,
    wo_id text,
    tarih text,
    malkod text,
    malad text,
    qty numeric DEFAULT 0,
    ie_no text,
    op_ad text,
    operatorlar jsonb DEFAULT '[]'::jsonb,
    not_ text,
    telafi_wo_id text,
    updated_at timestamp with time zone DEFAULT now(),
    tip text DEFAULT 'parca'::text,
    uzunluk_mm numeric,
    test_run_id text
);

-- 3.21 Checklist
CREATE TABLE public.uys_checklist (
    id text NOT NULL,
    tip text DEFAULT 'gorev'::text,
    baslik text,
    aciklama text,
    atanan text,
    oncelik text DEFAULT 'normal'::text,
    durum text DEFAULT 'bekliyor'::text,
    tarih text,
    termin text,
    kategori text,
    resimler jsonb DEFAULT '[]'::jsonb,
    tamamlanma text,
    olusturan text,
    notlar text,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.22 İzinler
CREATE TABLE public.uys_izinler (
    id text NOT NULL,
    op_id text,
    op_ad text,
    baslangic text,
    bitis text,
    tip text DEFAULT 'yıllık'::text,
    durum text DEFAULT 'bekliyor'::text,
    saat_baslangic text,
    saat_bitis text,
    onaylayan text,
    onay_tarihi text,
    not_ text,
    olusturan text DEFAULT 'admin'::text,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.23 Kullanıcılar
CREATE TABLE public.uys_kullanicilar (
    id text NOT NULL,
    ad text,
    kullanici_ad text,
    sifre text,
    rol text DEFAULT 'planlama'::text,
    aktif boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    auth_user_id uuid,
    aktif_oturum_id uuid,
    aktif_oturum_cihaz text,
    aktif_oturum_son timestamp with time zone
);

COMMENT ON COLUMN public.uys_kullanicilar.aktif_oturum_id IS 'Aktif oturum UUID. Login sırasında üretilir, başka cihaz girince değiştirilir, eski cihaz Realtime ile fark eder.';
COMMENT ON COLUMN public.uys_kullanicilar.aktif_oturum_cihaz IS 'Aktif oturum cihaz tanımı (örn: "iPad — Safari"). Uyarı UIsinde kullanılır.';
COMMENT ON COLUMN public.uys_kullanicilar.aktif_oturum_son IS 'Son aktivite timestamp. Stale session detection için.';

-- 3.24 Yetki Ayarları (RBAC)
CREATE TABLE public.uys_yetki_ayarlari (
    id text NOT NULL,
    rol text,
    aksiyon text,
    izin boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    data jsonb
);

-- 3.25 Ekip Notları
CREATE TABLE public.uys_notes (
    id text NOT NULL,
    sayfa text NOT NULL,
    baslik text,
    icerik text NOT NULL,
    yazan text,
    etiketler jsonb DEFAULT '[]'::jsonb,
    tarih text NOT NULL,
    saat text,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.26 Bildirimler
CREATE TABLE public.uys_bildirimler (
    id text NOT NULL,
    tip text NOT NULL,
    kategori text,
    baslik text NOT NULL,
    mesaj text NOT NULL,
    hedef_kullanici_id text,
    ref_id text,
    ref_tip text,
    okundu boolean DEFAULT false NOT NULL,
    okundu_tarih timestamp with time zone,
    olusturma timestamp with time zone DEFAULT now() NOT NULL,
    olusturan text,
    __client text,
    test_run_id text
);

-- 3.27 MRP Hesaplamaları
CREATE TABLE public.uys_mrp_calculations (
    id text NOT NULL,
    order_id text,
    hesaplandi timestamp with time zone DEFAULT now() NOT NULL,
    hesaplayan text NOT NULL,
    brut_ihtiyac jsonb DEFAULT '{}'::jsonb NOT NULL,
    stok_durumu jsonb DEFAULT '{}'::jsonb NOT NULL,
    acik_tedarik jsonb DEFAULT '{}'::jsonb NOT NULL,
    net_ihtiyac jsonb DEFAULT '{}'::jsonb NOT NULL,
    durum text DEFAULT 'beklemede'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    test_run_id text
);

-- 3.28 MRP Rezerve
CREATE TABLE public.uys_mrp_rezerve (
    id text NOT NULL,
    order_id text NOT NULL,
    malkod text NOT NULL,
    malad text,
    miktar numeric DEFAULT 0 NOT NULL,
    birim text,
    mrp_run_id text,
    tarih text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    test_run_id text
);

-- 3.29 MRP State Global (Singleton, id=1)
CREATE TABLE public.uys_mrp_state_global (
    id smallint DEFAULT 1 NOT NULL,
    brut_ihtiyac jsonb DEFAULT '{}'::jsonb NOT NULL,
    net_eksik jsonb DEFAULT '{}'::jsonb NOT NULL,
    detay jsonb,
    invalidated boolean DEFAULT true NOT NULL,
    hesaplandi timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT uys_mrp_state_global_id_check CHECK ((id = 1))
);

COMMENT ON TABLE public.uys_mrp_state_global IS 'Global MRP cache (sirket geneli brut ihtiyac + net eksik). Singleton, id=1.';

-- 3.30 MRP State Order
CREATE TABLE public.uys_mrp_state_order (
    order_id text NOT NULL,
    brut_ihtiyac jsonb DEFAULT '{}'::jsonb NOT NULL,
    net_eksik jsonb DEFAULT '{}'::jsonb NOT NULL,
    detay jsonb,
    invalidated boolean DEFAULT true NOT NULL,
    hesaplandi timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.uys_mrp_state_order IS 'Order bazli MRP cache. CASCADE delete: order silinince cache otomatik temizlenir.';

-- 3.31 Pending Flows
CREATE TABLE public.uys_pending_flows (
    id text NOT NULL,
    flow_type text NOT NULL,
    current_step text NOT NULL,
    state_data jsonb DEFAULT '{}'::jsonb,
    user_id text,
    user_ad text,
    baslangic timestamp without time zone DEFAULT now(),
    son_aktivite timestamp without time zone DEFAULT now(),
    durum text DEFAULT 'aktif'::text,
    not_ text,
    order_id text
);

-- 3.32 IE Hazırlama (v16.83)
CREATE TABLE public.uys_ie_hazirlama (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    siparis_no text NOT NULL,
    musteri text,
    siparis_tarihi text,
    teslim_tarihi text,
    olusturan text,
    durum text DEFAULT 'hazirlaniyor'::text,
    ie_verildi_at text,
    ie_verildi_by text,
    not_ text,
    olusturma text DEFAULT (CURRENT_DATE)::text,
    iptal_neden text,
    iptal_at text,
    iptal_by text,
    tamamlandi_at text,
    tamamlandi_by text
);

-- 3.33 IE Hazırlama Kalemleri
CREATE TABLE public.uys_ie_hazirlama_kalemler (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    ie_id text NOT NULL,
    urun_kodu text NOT NULL,
    urun_adi text,
    siparis_adeti numeric DEFAULT 1 NOT NULL,
    durum text DEFAULT 'aktif'::text,
    iptal_neden text,
    iptal_at text,
    iptal_by text,
    uys_siparis_no text,
    siparis_acildi boolean DEFAULT false,
    siparis_acildi_at text,
    olusturma text DEFAULT (CURRENT_DATE)::text
);

-- 3.34 IE Hazırlama Log
CREATE TABLE public.uys_ie_hazirlama_log (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    ie_id text NOT NULL,
    kalem_id text,
    tip text NOT NULL,
    aciklama text,
    siparis_no text,
    urun_kodu text,
    kullanici text,
    tarih text DEFAULT (CURRENT_DATE)::text,
    saat text DEFAULT to_char(now(), 'HH24:MI'::text)
);

-- 3.35 IE Log
CREATE TABLE public.uys_ie_log (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    ie_id text NOT NULL,
    kalem_id text,
    event text NOT NULL,
    aciklama text DEFAULT ''::text,
    uys_siparis_id text DEFAULT ''::text,
    tarih timestamp with time zone DEFAULT now(),
    kullanici text DEFAULT ''::text,
    CONSTRAINT uys_ie_log_event_check CHECK ((event = ANY (ARRAY['ie_olusturuldu'::text, 'ie_verildi'::text, 'ie_iptal'::text, 'kalem_eklendi'::text, 'kalem_iptal'::text, 'siparis_acildi'::text, 'uyari'::text])))
);

-- 3.36 Rapido BOM
CREATE TABLE public.uys_rapido_bom (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    urun_kodu text NOT NULL,
    urun_adi text NOT NULL,
    is_istasyonu text,
    hammadde_kodu text,
    hammadde_adi text,
    kesim_olc_mm numeric,
    birim_adet numeric,
    hm_uzunluk_mm numeric,
    aciklama text,
    olusturma text DEFAULT (CURRENT_DATE)::text,
    guncelleme text DEFAULT (CURRENT_DATE)::text,
    aktif boolean DEFAULT true
);

-- 3.37 Yedekler
CREATE TABLE public.uys_yedekler (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alindi_tarih date NOT NULL,
    alindi_saat timestamp with time zone DEFAULT now() NOT NULL,
    alan_kisi text NOT NULL,
    tip text DEFAULT 'manuel'::text NOT NULL,
    boyut_kb integer,
    veri jsonb NOT NULL,
    notlar text,
    CONSTRAINT uys_yedekler_tip_check CHECK ((tip = ANY (ARRAY['otomatik'::text, 'manuel'::text])))
);

-- 3.38 Activity Log
CREATE TABLE public.uys_activity_log (
    id text NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    kullanici text NOT NULL,
    aksiyon text NOT NULL,
    detay text,
    order_id text,
    wo_id text,
    malkod text,
    modul text,
    ip_kontrolu text,
    test_run_id text
);

-- 3.39 Audit Log
CREATE TABLE public.uys_audit_log (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    zaman timestamp with time zone DEFAULT now() NOT NULL,
    kullanici_id text,
    kullanici_ad text,
    olay_tipi text NOT NULL,
    tablo text,
    kayit_id text,
    alan text,
    eski_deger text,
    yeni_deger text,
    aciklama text,
    ek_veri jsonb
);

-- 3.40 Manuel Müdahale Log
CREATE TABLE public.uys_manuel_mudahale_log (
    id text NOT NULL,
    tarih timestamp with time zone DEFAULT now() NOT NULL,
    kullanici_id text NOT NULL,
    kullanici_ad text,
    islem_tipi text NOT NULL,
    malkod text NOT NULL,
    malad text,
    miktar numeric NOT NULL,
    birim text,
    rezerv_order_id text,
    rezerv_siparis_no text,
    sebep text NOT NULL,
    aciklama text NOT NULL,
    stok_hareket_id text,
    __client text,
    test_run_id text
);

-- 3.41 Test Runs
CREATE TABLE public.uys_test_runs (
    id text NOT NULL,
    baslangic timestamp without time zone DEFAULT now(),
    bitis timestamp without time zone,
    durum text DEFAULT 'aktif'::text,
    user_id text,
    user_ad text,
    aciklama text,
    temizlenen_kayit_sayisi jsonb DEFAULT '{}'::jsonb,
    not_ text
);

-- 3.42 Dev Files (DevSync)
CREATE TABLE public.uys_dev_files (
    path text NOT NULL,
    content text NOT NULL,
    sha text,
    size_bytes integer,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by text DEFAULT 'claude'::text,
    committed_hash text
);

COMMENT ON TABLE public.uys_dev_files IS 'DevSync — repo dosyaları Claude erişimi için';

-- 3.43 Session Memory
CREATE TABLE public.uys_session_memory (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.44 Chat — Kanallar
CREATE TABLE public.uys_chat_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    type text NOT NULL,
    description text,
    created_by text,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT uys_chat_channels_type_check CHECK ((type = ANY (ARRAY['dm'::text, 'group'::text])))
);

-- 3.45 Chat — Üyeler
CREATE TABLE public.uys_chat_members (
    channel_id uuid NOT NULL,
    user_id text NOT NULL,
    role text DEFAULT 'member'::text,
    muted boolean DEFAULT false,
    last_read_at timestamp with time zone,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT uys_chat_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
);

-- 3.46 Chat — Mesajlar
CREATE TABLE public.uys_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel_id uuid NOT NULL,
    user_id text NOT NULL,
    body text NOT NULL,
    reply_to_id uuid,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- 3.47 Chat — Ekler
CREATE TABLE public.uys_chat_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    storage_path text NOT NULL,
    mime_type text,
    file_name text,
    size_bytes bigint,
    created_at timestamp with time zone DEFAULT now()
);

-- 3.48 Chat — Mentions
CREATE TABLE public.uys_chat_mentions (
    message_id uuid NOT NULL,
    user_id text NOT NULL,
    read_at timestamp with time zone
);

-- 3.49 Chat — Reactions
CREATE TABLE public.uys_chat_reactions (
    message_id uuid NOT NULL,
    user_id text NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 3.50 v15.31 Silinen Hareketler (migration artifact — geçici arşiv)
CREATE TABLE public.uys_v15_31_silinen_hareketler (
    id text,
    tarih text,
    malkod text,
    malad text,
    miktar numeric,
    tip text,
    log_id text,
    wo_id text,
    aciklama text,
    updated_at timestamp with time zone
);

-- ════ 4. PRIMARY KEY / UNIQUE CONSTRAINT ════

ALTER TABLE ONLY public.uys_acik_barlar ADD CONSTRAINT uys_acik_barlar_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_active_work ADD CONSTRAINT uys_active_work_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_activity_log ADD CONSTRAINT uys_activity_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_audit_log ADD CONSTRAINT uys_audit_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_bildirimler ADD CONSTRAINT uys_bildirimler_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_bom_trees ADD CONSTRAINT uys_bom_trees_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_chat_attachments ADD CONSTRAINT uys_chat_attachments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_chat_channels ADD CONSTRAINT uys_chat_channels_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_chat_members ADD CONSTRAINT uys_chat_members_pkey PRIMARY KEY (channel_id, user_id);
ALTER TABLE ONLY public.uys_chat_mentions ADD CONSTRAINT uys_chat_mentions_pkey PRIMARY KEY (message_id, user_id);
ALTER TABLE ONLY public.uys_chat_messages ADD CONSTRAINT uys_chat_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_chat_reactions ADD CONSTRAINT uys_chat_reactions_pkey PRIMARY KEY (message_id, user_id, emoji);
ALTER TABLE ONLY public.uys_checklist ADD CONSTRAINT uys_checklist_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_customers ADD CONSTRAINT uys_customers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_dev_files ADD CONSTRAINT uys_dev_files_pkey PRIMARY KEY (path);
ALTER TABLE ONLY public.uys_durus_kodlari ADD CONSTRAINT uys_durus_kodlari_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_fire_logs ADD CONSTRAINT uys_fire_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_hm_tipleri ADD CONSTRAINT uys_hm_tipleri_kod_key UNIQUE (kod);
ALTER TABLE ONLY public.uys_hm_tipleri ADD CONSTRAINT uys_hm_tipleri_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_ie_hazirlama_kalemler ADD CONSTRAINT uys_ie_hazirlama_kalemler_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_ie_hazirlama_log ADD CONSTRAINT uys_ie_hazirlama_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_ie_hazirlama ADD CONSTRAINT uys_ie_hazirlama_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_ie_log ADD CONSTRAINT uys_ie_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_izinler ADD CONSTRAINT uys_izinler_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_kesim_planlari ADD CONSTRAINT uys_kesim_planlari_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_kullanicilar ADD CONSTRAINT uys_kullanicilar_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_logs ADD CONSTRAINT uys_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_malzemeler ADD CONSTRAINT uys_malzemeler_kod_key UNIQUE (kod);
ALTER TABLE ONLY public.uys_malzemeler ADD CONSTRAINT uys_malzemeler_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_manuel_mudahale_log ADD CONSTRAINT uys_manuel_mudahale_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_mrp_calculations ADD CONSTRAINT uys_mrp_calculations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_mrp_rezerve ADD CONSTRAINT uys_mrp_rezerve_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_mrp_state_global ADD CONSTRAINT uys_mrp_state_global_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_mrp_state_order ADD CONSTRAINT uys_mrp_state_order_pkey PRIMARY KEY (order_id);
ALTER TABLE ONLY public.uys_notes ADD CONSTRAINT uys_notes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_operations ADD CONSTRAINT uys_operations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_operator_notes ADD CONSTRAINT uys_operator_notes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_operators ADD CONSTRAINT uys_operators_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_orders ADD CONSTRAINT uys_orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_orders ADD CONSTRAINT uys_orders_siparis_no_unique UNIQUE (siparis_no);
ALTER TABLE ONLY public.uys_pending_flows ADD CONSTRAINT uys_pending_flows_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_rapido_bom ADD CONSTRAINT uys_rapido_bom_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_recipes ADD CONSTRAINT uys_recipes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_session_memory ADD CONSTRAINT uys_session_memory_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.uys_sevk_satirlari ADD CONSTRAINT uys_sevk_satirlari_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_sevkler ADD CONSTRAINT uys_sevkler_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_stations ADD CONSTRAINT uys_stations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_stok_hareketler ADD CONSTRAINT uys_stok_hareketler_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_tedarikciler ADD CONSTRAINT uys_tedarikciler_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_tedarikler ADD CONSTRAINT uys_tedarikler_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_test_runs ADD CONSTRAINT uys_test_runs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_work_orders ADD CONSTRAINT uys_work_orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_yedekler ADD CONSTRAINT uys_yedekler_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.uys_yetki_ayarlari ADD CONSTRAINT uys_yetki_ayarlari_pkey PRIMARY KEY (id);

-- ════ 5. FOREIGN KEY ════

ALTER TABLE ONLY public.uys_chat_attachments
    ADD CONSTRAINT uys_chat_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.uys_chat_messages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_chat_members
    ADD CONSTRAINT uys_chat_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.uys_chat_channels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_chat_mentions
    ADD CONSTRAINT uys_chat_mentions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.uys_chat_messages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_chat_messages
    ADD CONSTRAINT uys_chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.uys_chat_channels(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_chat_messages
    ADD CONSTRAINT uys_chat_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.uys_chat_messages(id);
ALTER TABLE ONLY public.uys_chat_reactions
    ADD CONSTRAINT uys_chat_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.uys_chat_messages(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_ie_hazirlama_kalemler
    ADD CONSTRAINT uys_ie_hazirlama_kalemler_ie_id_fkey FOREIGN KEY (ie_id) REFERENCES public.uys_ie_hazirlama(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_ie_log
    ADD CONSTRAINT uys_ie_log_ie_id_fkey FOREIGN KEY (ie_id) REFERENCES public.uys_ie_hazirlama(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_mrp_calculations
    ADD CONSTRAINT uys_mrp_calculations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.uys_orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_mrp_state_order
    ADD CONSTRAINT uys_mrp_state_order_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.uys_orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_pending_flows
    ADD CONSTRAINT uys_pending_flows_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.uys_orders(id);
ALTER TABLE ONLY public.uys_sevk_satirlari
    ADD CONSTRAINT uys_sevk_satirlari_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.uys_orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.uys_sevk_satirlari
    ADD CONSTRAINT uys_sevk_satirlari_sevk_id_fkey FOREIGN KEY (sevk_id) REFERENCES public.uys_sevkler(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.uys_stok_hareketler
    ADD CONSTRAINT uys_stok_hareketler_tedarik_id_fkey FOREIGN KEY (tedarik_id) REFERENCES public.uys_tedarikler(id) ON DELETE SET NULL;

-- ════ 6. INDEX ════

CREATE INDEX idx_acik_barlar_durum ON public.uys_acik_barlar USING btree (durum);
CREATE INDEX idx_acik_barlar_malkod ON public.uys_acik_barlar USING btree (ham_malkod);
CREATE INDEX idx_acik_barlar_plan ON public.uys_acik_barlar USING btree (kaynak_plan_id);
CREATE INDEX idx_fire_logs_telafi_wo_id ON public.uys_fire_logs USING btree (telafi_wo_id);
CREATE INDEX idx_uys_logs_tarih ON public.uys_logs USING btree (tarih);
CREATE INDEX idx_uys_logs_wo_id ON public.uys_logs USING btree (wo_id);
CREATE INDEX idx_uys_notes_sayfa ON public.uys_notes USING btree (sayfa);
CREATE INDEX idx_uys_stok_malkod ON public.uys_stok_hareketler USING btree (malkod);
CREATE INDEX idx_uys_work_orders_malkod ON public.uys_work_orders USING btree (malkod);
CREATE INDEX idx_uys_work_orders_order_id ON public.uys_work_orders USING btree (order_id);
CREATE INDEX ix_orders_state ON public.uys_orders USING btree (state);
CREATE INDEX uys_sh_dup_guard_idx ON public.uys_stok_hareketler USING btree (malkod, updated_at DESC) WHERE ((wo_id IS NULL) AND (log_id IS NULL));
CREATE INDEX uys_sh_tedarik_id_idx ON public.uys_stok_hareketler USING btree (tedarik_id) WHERE (tedarik_id IS NOT NULL);
CREATE INDEX uys_wo_rc_id_kirno_durum_idx ON public.uys_work_orders USING btree (rc_id, kirno, durum);

-- ════ 7. TRIGGER ════

-- updated_at triggerları
CREATE TRIGGER trg_uys_acik_barlar_updated_at BEFORE UPDATE ON public.uys_acik_barlar FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_active_work_updated_at BEFORE UPDATE ON public.uys_active_work FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_bom_trees_updated_at BEFORE UPDATE ON public.uys_bom_trees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_checklist_updated_at BEFORE UPDATE ON public.uys_checklist FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_customers_updated_at BEFORE UPDATE ON public.uys_customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_durus_kodlari_updated_at BEFORE UPDATE ON public.uys_durus_kodlari FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_fire_logs_updated_at BEFORE UPDATE ON public.uys_fire_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_hm_tipleri_updated_at BEFORE UPDATE ON public.uys_hm_tipleri FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_izinler_updated_at BEFORE UPDATE ON public.uys_izinler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_kesim_planlari_updated_at BEFORE UPDATE ON public.uys_kesim_planlari FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_kullanicilar_updated_at BEFORE UPDATE ON public.uys_kullanicilar FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_logs_updated_at BEFORE UPDATE ON public.uys_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_malzemeler_updated_at BEFORE UPDATE ON public.uys_malzemeler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_mrp_calculations_updated_at BEFORE UPDATE ON public.uys_mrp_calculations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_mrp_rezerve_updated_at BEFORE UPDATE ON public.uys_mrp_rezerve FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_notes_updated_at BEFORE UPDATE ON public.uys_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_operations_updated_at BEFORE UPDATE ON public.uys_operations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_operator_notes_updated_at BEFORE UPDATE ON public.uys_operator_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_operators_updated_at BEFORE UPDATE ON public.uys_operators FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_orders_updated_at BEFORE UPDATE ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_recipes_updated_at BEFORE UPDATE ON public.uys_recipes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_sevk_satirlari_updated_at BEFORE UPDATE ON public.uys_sevk_satirlari FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_sevkler_updated_at BEFORE UPDATE ON public.uys_sevkler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_stations_updated_at BEFORE UPDATE ON public.uys_stations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_stok_hareketler_updated_at BEFORE UPDATE ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_tedarikciler_updated_at BEFORE UPDATE ON public.uys_tedarikciler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_tedarikler_updated_at BEFORE UPDATE ON public.uys_tedarikler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_v15_31_silinen_hareketler_updated_at BEFORE UPDATE ON public.uys_v15_31_silinen_hareketler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_work_orders_updated_at BEFORE UPDATE ON public.uys_work_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_uys_yetki_ayarlari_updated_at BEFORE UPDATE ON public.uys_yetki_ayarlari FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- İş mantığı triggerları
CREATE TRIGGER trg_cascade_malzeme_kod AFTER UPDATE ON public.uys_malzemeler FOR EACH ROW EXECUTE FUNCTION public.cascade_malzeme_kod_update();
CREATE TRIGGER trg_clear_kesim_on_order_update AFTER UPDATE ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.tg_clear_bekleyen_kesim_planlari();
CREATE TRIGGER trg_malkod_cascade_update AFTER UPDATE OF kod ON public.uys_malzemeler FOR EACH ROW EXECUTE FUNCTION public.fn_malkod_cascade_update();
CREATE TRIGGER trg_mrp_bom_trees AFTER INSERT OR DELETE OR UPDATE ON public.uys_bom_trees FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();
CREATE TRIGGER trg_mrp_durum_on_order_close BEFORE UPDATE OF durum ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.fn_mrp_durum_on_order_close();
CREATE TRIGGER trg_mrp_durum_on_wo_tamam AFTER UPDATE OF durum ON public.uys_work_orders FOR EACH ROW EXECUTE FUNCTION public.fn_mrp_durum_check_on_wo();
CREATE TRIGGER trg_mrp_kesim_planlari AFTER INSERT OR DELETE OR UPDATE ON public.uys_kesim_planlari FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();
CREATE TRIGGER trg_mrp_orders AFTER INSERT OR DELETE OR UPDATE ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.invalidate_mrp_order();
CREATE TRIGGER trg_mrp_recipes AFTER INSERT OR DELETE OR UPDATE ON public.uys_recipes FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();
CREATE TRIGGER trg_mrp_state_refresh_order AFTER INSERT OR UPDATE ON public.uys_mrp_state_order FOR EACH ROW EXECUTE FUNCTION public.fn_mrp_state_refresh_order();
CREATE TRIGGER trg_mrp_stok_hareketler AFTER INSERT OR DELETE OR UPDATE ON public.uys_stok_hareketler FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();
CREATE TRIGGER trg_mrp_tedarikler AFTER INSERT OR DELETE OR UPDATE ON public.uys_tedarikler FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();
CREATE TRIGGER trg_mrp_work_orders AFTER INSERT OR DELETE OR UPDATE ON public.uys_work_orders FOR EACH ROW EXECUTE FUNCTION public.invalidate_mrp_order();
CREATE TRIGGER trg_pending_flow_order_id BEFORE INSERT OR UPDATE ON public.uys_pending_flows FOR EACH ROW EXECUTE FUNCTION public.fn_pending_flow_set_order_id();
CREATE TRIGGER trg_recete_sure_cascade AFTER UPDATE OF satirlar ON public.uys_recipes FOR EACH ROW EXECUTE FUNCTION public.fn_recete_sure_cascade();
CREATE TRIGGER trg_recipe_op_sync AFTER UPDATE OF satirlar ON public.uys_recipes FOR EACH ROW EXECUTE FUNCTION public.fn_recipe_op_sync();
CREATE TRIGGER trg_refresh_state_orders AFTER INSERT OR UPDATE OF durum, sevk_durum, recete_id ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_order_state();
CREATE TRIGGER trg_refresh_state_tedarik AFTER INSERT OR DELETE OR UPDATE ON public.uys_tedarikler FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_order_state();
CREATE TRIGGER trg_refresh_state_wo AFTER INSERT OR DELETE OR UPDATE ON public.uys_work_orders FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_order_state();
CREATE TRIGGER trg_stok_hareket_dup_guard BEFORE INSERT ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.fn_stok_hareket_dup_guard();
CREATE TRIGGER trg_stok_hareket_refresh_order AFTER INSERT OR DELETE ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.fn_stok_hareket_refresh_order();
CREATE TRIGGER trg_stok_invalidate_mrp_state AFTER INSERT OR UPDATE ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.fn_stok_invalidate_mrp_state();
CREATE TRIGGER trg_stok_reset_mrp_durum AFTER INSERT OR UPDATE ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.fn_stok_reset_mrp_durum();

-- ════ 8. VIEW ════

CREATE VIEW public.v_stok_anlik WITH (security_invoker='true') AS
 SELECT malkod,
    COALESCE(sum(CASE WHEN (tip = 'giris'::text) THEN miktar ELSE (0)::numeric END), (0)::numeric) AS giris_toplam,
    COALESCE(sum(CASE WHEN (tip = 'cikis'::text) THEN miktar ELSE (0)::numeric END), (0)::numeric) AS cikis_toplam,
    COALESCE(sum(CASE WHEN (tip = 'bar_acilis'::text) THEN miktar ELSE (0)::numeric END), (0)::numeric) AS bar_acilis_toplam,
    (COALESCE(sum(CASE WHEN (tip = 'giris'::text) THEN miktar ELSE (0)::numeric END), (0)::numeric)
     - COALESCE(sum(CASE WHEN (tip = ANY (ARRAY['cikis'::text, 'bar_acilis'::text])) THEN miktar ELSE (0)::numeric END), (0)::numeric)) AS stok
   FROM public.uys_stok_hareketler
  GROUP BY malkod;

CREATE VIEW public.v_hammadde_tuketim AS
 SELECT (sh.tarih)::date AS tarih,
    sh.malkod,
    COALESCE(sh.malad, sh.malkod, ''::text) AS malad,
    max(m.hammadde_tipi) AS hammadde_tipi,
    (sum(sh.miktar))::bigint AS adet,
    CASE
        WHEN (max(m.hammadde_tipi) = ANY (ARRAY['SAC'::text, 'LEVHA'::text, 'PLY'::text]))
        THEN round((((sum(sh.miktar) * COALESCE(max(m.boy), (0)::numeric)) * COALESCE(max(m.en), (0)::numeric)) / 1000000.0), 3)
        ELSE round(((sum(sh.miktar) * COALESCE(max(m.uzunluk), (0)::numeric)) / 1000.0), 3)
    END AS toplam_metre,
    round(
        CASE
            WHEN (max(m.hammadde_tipi) = ANY (ARRAY['SAC'::text, 'LEVHA'::text, 'PLY'::text]))
            THEN ((((sum(sh.miktar) * COALESCE(max(m.boy), (0)::numeric)) * COALESCE(max(m.en), (0)::numeric)) / 1000000.0) * COALESCE(max(m.birim_kg_metre), (0)::numeric))
            ELSE (((sum(sh.miktar) * COALESCE(max(m.uzunluk), (0)::numeric)) / 1000.0) * COALESCE(max(m.birim_kg_metre), (0)::numeric))
        END, 2) AS toplam_kg,
    bool_or((m.birim_kg_metre IS NULL)) AS kg_eksik
   FROM (public.uys_stok_hareketler sh
     JOIN public.uys_malzemeler m ON ((m.kod = sh.malkod)))
  WHERE ((sh.tip = 'cikis'::text) AND (sh.malkod IS NOT NULL) AND (m.tip = 'Hammadde'::text))
  GROUP BY (sh.tarih)::date, sh.malkod, COALESCE(sh.malad, sh.malkod, ''::text);

-- ════ 9. RLS POLİCY ════

-- 9.1 RLS aktifleştir — tüm UYS tablolarında
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name LIKE 'uys_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.table_name);
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated;', t.table_name);
  END LOOP;
END $$;

-- 9.2 allow_all — düşük kısıtlı tablolar (client-side RBAC yeterli)
DO $$
DECLARE t text;
BEGIN
  FOR t IN VALUES
    ('uys_acik_barlar'),('uys_active_work'),('uys_activity_log'),('uys_bildirimler'),
    ('uys_chat_attachments'),('uys_chat_channels'),('uys_chat_members'),('uys_chat_mentions'),
    ('uys_chat_messages'),('uys_chat_reactions'),('uys_checklist'),('uys_customers'),
    ('uys_durus_kodlari'),('uys_fire_logs'),('uys_hm_tipleri'),('uys_izinler'),
    ('uys_kesim_planlari'),('uys_logs'),('uys_manuel_mudahale_log'),('uys_mrp_calculations'),
    ('uys_mrp_rezerve'),('uys_mrp_state_global'),('uys_mrp_state_order'),('uys_notes'),
    ('uys_operations'),('uys_operator_notes'),('uys_pending_flows'),('uys_sevk_satirlari'),
    ('uys_stations'),('uys_tedarikciler'),('uys_test_runs'),('uys_v15_31_silinen_hareketler'),
    ('uys_yedekler')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I;', t);
    EXECUTE format('CREATE POLICY "allow_all" ON public.%I USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

-- 9.3 uys_dev_files — sadece admin + GitHub Actions service role
ALTER TABLE public.uys_dev_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_only" ON public.uys_dev_files;
CREATE POLICY "admin_only" ON public.uys_dev_files
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "github_actions_sync" ON public.uys_dev_files;
CREATE POLICY "github_actions_sync" ON public.uys_dev_files
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9.4 uys_session_memory — sadece admin
ALTER TABLE public.uys_session_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_only" ON public.uys_session_memory;
CREATE POLICY "admin_only" ON public.uys_session_memory
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 9.5 uys_kullanicilar — authenticated okuyabilir, admin yazabilir
ALTER TABLE public.uys_kullanicilar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_select" ON public.uys_kullanicilar;
CREATE POLICY "authenticated_select" ON public.uys_kullanicilar
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_write" ON public.uys_kullanicilar;
CREATE POLICY "admin_write" ON public.uys_kullanicilar
  FOR ALL TO authenticated USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

-- 9.6 uys_yetki_ayarlari — authenticated okuyabilir, admin yazabilir
ALTER TABLE public.uys_yetki_ayarlari ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_select" ON public.uys_yetki_ayarlari;
CREATE POLICY "authenticated_select" ON public.uys_yetki_ayarlari
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_write" ON public.uys_yetki_ayarlari;
CREATE POLICY "admin_write" ON public.uys_yetki_ayarlari
  FOR ALL TO authenticated USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

-- 9.7 uys_operators — anon okuyabilir (login için), authenticated tam erişim
ALTER TABLE public.uys_operators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.uys_operators;
CREATE POLICY "anon_select" ON public.uys_operators FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "authenticated_full" ON public.uys_operators;
CREATE POLICY "authenticated_full" ON public.uys_operators TO authenticated USING (true) WITH CHECK (true);

-- 9.8 uys_audit_log — insert ve select ayrı policyler
ALTER TABLE public.uys_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_insert" ON public.uys_audit_log;
CREATE POLICY "audit_insert" ON public.uys_audit_log FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "audit_select" ON public.uys_audit_log;
CREATE POLICY "audit_select" ON public.uys_audit_log FOR SELECT TO authenticated USING (true);

-- 9.9 uys_orders — authenticated okuma, admin/planlama yazma
ALTER TABLE public.uys_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_select" ON public.uys_orders;
CREATE POLICY "orders_select" ON public.uys_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "orders_write" ON public.uys_orders;
CREATE POLICY "orders_write" ON public.uys_orders
  FOR ALL TO authenticated
  USING (public.current_user_role() = ANY (ARRAY['admin','planlama']))
  WITH CHECK (public.current_user_role() = ANY (ARRAY['admin','planlama']));

-- 9.10 uys_stok_hareketler — authenticated okuma, admin/planlama/depocu yazma
ALTER TABLE public.uys_stok_hareketler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stok_select" ON public.uys_stok_hareketler;
CREATE POLICY "stok_select" ON public.uys_stok_hareketler FOR SELECT TO authenticated USING (true);

-- 9.11 uys_malzemeler — authenticated okuma, admin/planlama yazma
ALTER TABLE public.uys_malzemeler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "malzeme_select" ON public.uys_malzemeler;
CREATE POLICY "malzeme_select" ON public.uys_malzemeler FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "malzeme_write" ON public.uys_malzemeler;
CREATE POLICY "malzeme_write" ON public.uys_malzemeler
  FOR ALL TO authenticated
  USING (public.current_user_role() = ANY (ARRAY['admin','planlama']))
  WITH CHECK (public.current_user_role() = ANY (ARRAY['admin','planlama']));

-- 9.12 uys_recipes — authenticated okuma, admin/planlama yazma
ALTER TABLE public.uys_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipes_select" ON public.uys_recipes;
CREATE POLICY "recipes_select" ON public.uys_recipes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "recipes_insert" ON public.uys_recipes;
CREATE POLICY "recipes_insert" ON public.uys_recipes FOR INSERT TO authenticated WITH CHECK (public.current_user_role() = ANY (ARRAY['admin','planlama']));
DROP POLICY IF EXISTS "recipes_update" ON public.uys_recipes;
CREATE POLICY "recipes_update" ON public.uys_recipes FOR UPDATE TO authenticated USING (public.current_user_role() = ANY (ARRAY['admin','planlama']));
DROP POLICY IF EXISTS "recipes_delete" ON public.uys_recipes;
CREATE POLICY "recipes_delete" ON public.uys_recipes FOR DELETE TO authenticated USING (public.current_user_role() = ANY (ARRAY['admin','planlama']));

-- 9.13 uys_bom_trees — authenticated okuma, admin/planlama yazma
ALTER TABLE public.uys_bom_trees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bom_trees_select" ON public.uys_bom_trees;
CREATE POLICY "bom_trees_select" ON public.uys_bom_trees FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bom_trees_insert" ON public.uys_bom_trees;
CREATE POLICY "bom_trees_insert" ON public.uys_bom_trees FOR INSERT TO authenticated WITH CHECK (public.current_user_role() = ANY (ARRAY['admin','planlama']));
DROP POLICY IF EXISTS "bom_trees_update" ON public.uys_bom_trees;
CREATE POLICY "bom_trees_update" ON public.uys_bom_trees FOR UPDATE TO authenticated USING (public.current_user_role() = ANY (ARRAY['admin','planlama']));
DROP POLICY IF EXISTS "bom_trees_delete" ON public.uys_bom_trees;
CREATE POLICY "bom_trees_delete" ON public.uys_bom_trees FOR DELETE TO authenticated USING (public.current_user_role() = ANY (ARRAY['admin','planlama']));

-- 9.14 uys_ie_hazirlama — authenticated okuma, admin/planlama yazma
ALTER TABLE public.uys_ie_hazirlama ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ie_haz_select" ON public.uys_ie_hazirlama;
CREATE POLICY "ie_haz_select" ON public.uys_ie_hazirlama FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ie_haz_insert" ON public.uys_ie_hazirlama;
CREATE POLICY "ie_haz_insert" ON public.uys_ie_hazirlama FOR INSERT TO authenticated WITH CHECK (public.current_user_role() = ANY (ARRAY['admin','planlama']));
DROP POLICY IF EXISTS "ie_haz_update" ON public.uys_ie_hazirlama;
CREATE POLICY "ie_haz_update" ON public.uys_ie_hazirlama FOR UPDATE TO authenticated USING (public.current_user_role() = ANY (ARRAY['admin','planlama']));
DROP POLICY IF EXISTS "ie_haz_delete" ON public.uys_ie_hazirlama;
CREATE POLICY "ie_haz_delete" ON public.uys_ie_hazirlama FOR DELETE TO authenticated USING (public.current_user_role() = ANY (ARRAY['admin','planlama']));

-- 9.15 uys_ie_hazirlama_kalemler ve uys_ie_log — tüm authenticated erişim
ALTER TABLE public.uys_ie_hazirlama_kalemler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ie_kalem_all" ON public.uys_ie_hazirlama_kalemler;
CREATE POLICY "ie_kalem_all" ON public.uys_ie_hazirlama_kalemler TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.uys_ie_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ie_log_all" ON public.uys_ie_log;
CREATE POLICY "ie_log_all" ON public.uys_ie_log TO authenticated USING (true) WITH CHECK (true);

-- 9.16 uys_rapido_bom — authenticated okuma, admin/planlama yazma
ALTER TABLE public.uys_rapido_bom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rapido_bom_select" ON public.uys_rapido_bom;
CREATE POLICY "rapido_bom_select" ON public.uys_rapido_bom FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rapido_bom_insert" ON public.uys_rapido_bom;
CREATE POLICY "rapido_bom_insert" ON public.uys_rapido_bom FOR INSERT TO authenticated WITH CHECK (public.current_user_role() = ANY (ARRAY['admin','planlama']));
DROP POLICY IF EXISTS "rapido_bom_update" ON public.uys_rapido_bom;
CREATE POLICY "rapido_bom_update" ON public.uys_rapido_bom FOR UPDATE TO authenticated USING (public.current_user_role() = ANY (ARRAY['admin','planlama']));
DROP POLICY IF EXISTS "rapido_bom_delete" ON public.uys_rapido_bom;
CREATE POLICY "rapido_bom_delete" ON public.uys_rapido_bom FOR DELETE TO authenticated USING (public.current_user_role() = ANY (ARRAY['admin','planlama']));

-- 9.17 uys_sevkler — authenticated okuma, admin/planlama yazma
ALTER TABLE public.uys_sevkler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sevk_select" ON public.uys_sevkler;
CREATE POLICY "sevk_select" ON public.uys_sevkler FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sevk_write" ON public.uys_sevkler;
CREATE POLICY "sevk_write" ON public.uys_sevkler
  FOR ALL TO authenticated
  USING (public.current_user_role() = ANY (ARRAY['admin','planlama']))
  WITH CHECK (public.current_user_role() = ANY (ARRAY['admin','planlama']));

-- ════ 10. REALTIME ════

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name LIKE 'uys_%'
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ════ BİTTİ ════
-- Sonraki adım: Veri Yönetimi > JSON Yedek Yükle ile backup'ı yükle.
