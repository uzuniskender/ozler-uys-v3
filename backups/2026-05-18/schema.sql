--
-- PostgreSQL database dump
--

\restrict fWOoABhpz5f1DzazkDhVRQsG9FYgBEE34VL9kdVYIY3aC4oaNjVp7QgE5N0mfID

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Ubuntu 17.10-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: order_state; Type: TYPE; Schema: public; Owner: -
--

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


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: -
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


--
-- Name: admin_update_user_password(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: al_stok_snapshot(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.al_stok_snapshot(snapshot_tarihi text DEFAULT to_char((CURRENT_DATE)::timestamp with time zone, 'YYYY-MM-DD'::text)) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    malzeme_sayisi integer := 0;
BEGIN
    INSERT INTO public.uys_stok_snapshot (
        id, tarih, malkod, malad, net_stok, olusturuldu_at
    )
    SELECT
        'snap-' || md5(snapshot_tarihi || malkod),
        snapshot_tarihi,
        malkod,
        (array_agg(malad ORDER BY updated_at DESC NULLS LAST))[1],
        SUM(CASE
            WHEN tip = 'giris'                          THEN  miktar
            WHEN tip IN ('cikis', 'bar_acilis', 'rezerv') THEN -miktar
            ELSE 0
        END),
        now()
    FROM public.uys_stok_hareketler
    WHERE test_run_id IS NULL
    GROUP BY malkod
    ON CONFLICT (tarih, malkod) DO UPDATE
        SET net_stok       = EXCLUDED.net_stok,
            malad          = EXCLUDED.malad,
            olusturuldu_at = now();

    GET DIAGNOSTICS malzeme_sayisi = ROW_COUNT;

    RETURN jsonb_build_object(
        'snapshot_tarihi', snapshot_tarihi,
        'malzeme_sayisi',  malzeme_sayisi
    );
END;
$$;


--
-- Name: arsivle_stok_hareketleri(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.arsivle_stok_hareketleri(kesim_tarihi text DEFAULT to_char((CURRENT_DATE - '1 year'::interval), 'YYYY-MM-DD'::text)) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    arsiv_sayisi    integer := 0;
    konsolide_sayisi integer := 0;
    v_malkod        text;
    v_malad         text;
    v_net           numeric;
BEGIN
    -- Güvenlik: kesim_tarihi en az 6 ay önce olmalı
    IF kesim_tarihi > to_char(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM-DD') THEN
        RAISE EXCEPTION 'kesim_tarihi en az 6 ay önce olmalı (verilen: %)', kesim_tarihi;
    END IF;

    -- a) Arşive kopyala (E2E test kayıtları hariç)
    INSERT INTO public.uys_stok_hareketler_arsiv (
        id, tarih, malkod, malad, miktar, tip,
        log_id, wo_id, aciklama, updated_at,
        test_run_id, rezerv_order_id, tedarik_id, arsivlendi_at
    )
    SELECT
        id, tarih, malkod, malad, miktar, tip,
        log_id, wo_id, aciklama, updated_at,
        test_run_id, rezerv_order_id, tedarik_id, now()
    FROM public.uys_stok_hareketler
    WHERE tarih < kesim_tarihi
      AND test_run_id IS NULL
    ON CONFLICT (id) DO NOTHING;

    GET DIAGNOSTICS arsiv_sayisi = ROW_COUNT;

    IF arsiv_sayisi = 0 THEN
        RETURN jsonb_build_object(
            'arsivlendi', 0, 'konsolide', 0, 'kesim_tarihi', kesim_tarihi
        );
    END IF;

    -- b-c) Bakiye konsolidasyonu
    FOR v_malkod, v_malad, v_net IN
        SELECT
            malkod,
            (array_agg(malad ORDER BY tarih DESC))[1],
            SUM(CASE
                WHEN tip = 'giris'                        THEN  miktar
                WHEN tip IN ('cikis','bar_acilis','rezerv') THEN -miktar
                ELSE 0
            END)
        FROM public.uys_stok_hareketler
        WHERE tarih < kesim_tarihi
          AND test_run_id IS NULL
        GROUP BY malkod
        HAVING SUM(CASE
                WHEN tip = 'giris'                        THEN  miktar
                WHEN tip IN ('cikis','bar_acilis','rezerv') THEN -miktar
                ELSE 0
               END) <> 0
    LOOP
        INSERT INTO public.uys_stok_hareketler (
            id, tarih, malkod, malad, miktar, tip, aciklama
        ) VALUES (
            'arsiv-kons-' || md5(v_malkod || kesim_tarihi),
            kesim_tarihi,
            v_malkod,
            v_malad,
            abs(v_net),
            CASE WHEN v_net > 0 THEN 'giris' ELSE 'cikis' END,
            'Arşivleme bakiye konsolidasyonu — ' || kesim_tarihi
        )
        ON CONFLICT (id) DO NOTHING;

        konsolide_sayisi := konsolide_sayisi + 1;
    END LOOP;

    -- d) Eski kayıtları sil
    DELETE FROM public.uys_stok_hareketler
    WHERE tarih < kesim_tarihi
      AND test_run_id IS NULL;

    RETURN jsonb_build_object(
        'arsivlendi',    arsiv_sayisi,
        'konsolide',     konsolide_sayisi,
        'kesim_tarihi',  kesim_tarihi
    );
END;
$$;


--
-- Name: cascade_malzeme_kod_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cascade_malzeme_kod_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.kod IS DISTINCT FROM NEW.kod THEN
    -- Reçetelerdeki gömülü malkod referanslarını güncelle
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

    -- Açık WO'ların malkodunu güncelle
    UPDATE uys_work_orders
    SET malkod = NEW.kod
    WHERE malkod = OLD.kod AND durum NOT IN ('tamamlandi', 'iptal');

    RAISE NOTICE 'Malzeme kodu cascade: % → %', OLD.kod, NEW.kod;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: compute_order_state(text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: FUNCTION compute_order_state(p_order_id text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.compute_order_state(p_order_id text) IS 'IE #14 Faz B - Auto-state hesabi.';


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT LOWER(rol) FROM public.uys_kullanicilar
  WHERE auth_user_id = auth.uid() AND aktif = true LIMIT 1;
$$;


--
-- Name: fn_malkod_cascade_update(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_mrp_durum_check_on_wo(); Type: FUNCTION; Schema: public; Owner: -
--

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
      WHERE id = v_order_id
        AND mrp_durum != 'tamam';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_mrp_durum_on_order_close(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_mrp_state_refresh_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_mrp_state_refresh_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM refresh_order_state(NEW.order_id);
  RETURN NEW;
END;
$$;


--
-- Name: fn_pending_flow_set_order_id(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_recete_sure_cascade(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_recipe_op_sync(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_stok_hareket_dup_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_stok_hareket_dup_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Sistem otomatik akışlar muaf
  IF NEW.wo_id IS NOT NULL OR NEW.log_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tedarik referansı varsa: zaman bağımsız duplicate kontrol
  IF NEW.tedarik_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.uys_stok_hareketler
      WHERE tedarik_id = NEW.tedarik_id
        AND id <> NEW.id
    ) THEN
      RAISE NOTICE 'Tedarik % icin stok hareket zaten var, skip', NEW.tedarik_id;
      RETURN NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- tedarik_id yoksa: 5 saniyelik pencere (updated_at kullan, created_at yok)
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


--
-- Name: fn_stok_hareket_refresh_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_stok_hareket_refresh_order() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_order_id text;
BEGIN
  -- wo_id varsa → o WO'nun order_id'sini al → sadece o siparişi güncelle
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


--
-- Name: fn_stok_invalidate_mrp_state(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: fn_stok_reset_mrp_durum(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: invalidate_mrp_global(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: FUNCTION invalidate_mrp_global(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.invalidate_mrp_global() IS 'Global MRP cache invalidate. Statement-level trigger fonksiyonu. Hata yumusak.';


--
-- Name: invalidate_mrp_order(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: FUNCTION invalidate_mrp_order(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.invalidate_mrp_order() IS 'Order bazli MRP cache invalidate. Row-level. orders icin global de bayatlatir. Hata yumusak.';


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.uys_kullanicilar
    WHERE auth_user_id = auth.uid()
      AND LOWER(rol) = 'admin' AND aktif = true
  );
$$;


--
-- Name: refresh_order_state(text); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


--
-- Name: tg_clear_bekleyen_kesim_planlari(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: tg_refresh_order_state(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL AND ppt.tablename NOT LIKE '% %'),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  -- Count raw slot entries before apply_rls/subscription filter
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  -- Apply RLS and filter as before
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  -- Real rows with slot count attached
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  -- Sentinel row: always returned when no real rows exist so Elixir can
  -- always read slot_changes_count. Identified by wal IS NULL.
  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: pt_problemler; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pt_problemler (
    id text NOT NULL,
    problem text NOT NULL,
    termin date,
    sorumlu text,
    durum text DEFAULT 'Açık'::text NOT NULL,
    yapilanlar text,
    notlar text,
    olusturan text,
    olusturma timestamp with time zone DEFAULT now(),
    son_degistiren text,
    son_degistirme timestamp with time zone,
    kapatma_tarihi date,
    __client text,
    kok_neden text,
    kalici_cozum text
);


--
-- Name: uys_acik_barlar; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_active_work; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_activity_log; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_audit_log; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_bildirimler; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_bom_trees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_bom_trees (
    id text NOT NULL,
    mamul_kod text,
    mamul_ad text,
    ad text,
    rows jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: uys_chat_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_chat_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    storage_path text NOT NULL,
    mime_type text,
    file_name text,
    size_bytes bigint,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: uys_chat_channels; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_chat_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_chat_members (
    channel_id uuid NOT NULL,
    user_id text NOT NULL,
    role text DEFAULT 'member'::text,
    muted boolean DEFAULT false,
    last_read_at timestamp with time zone,
    joined_at timestamp with time zone DEFAULT now(),
    CONSTRAINT uys_chat_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text])))
);


--
-- Name: uys_chat_mentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_chat_mentions (
    message_id uuid NOT NULL,
    user_id text NOT NULL,
    read_at timestamp with time zone
);


--
-- Name: uys_chat_messages; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_chat_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_chat_reactions (
    message_id uuid NOT NULL,
    user_id text NOT NULL,
    emoji text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: uys_checklist; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_customers (
    id text NOT NULL,
    ad text,
    kod text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: uys_dev_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_dev_files (
    path text NOT NULL,
    content text NOT NULL,
    sha text,
    size_bytes integer,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by text DEFAULT 'claude'::text,
    committed_hash text
);


--
-- Name: TABLE uys_dev_files; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.uys_dev_files IS 'DevSync — repo dosyaları Claude erişimi için';


--
-- Name: uys_durus_kodlari; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_durus_kodlari (
    id text NOT NULL,
    kod text,
    ad text,
    kategori text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: uys_fire_logs; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_hm_tipleri; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: TABLE uys_hm_tipleri; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.uys_hm_tipleri IS 'Hammadde sınıflandırma tipleri (Profil, Boru, Sac vb.)';


--
-- Name: COLUMN uys_hm_tipleri.kod; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_hm_tipleri.kod IS 'Kısa kod, BÜYÜK harf (PRF, BOR, SAC)';


--
-- Name: COLUMN uys_hm_tipleri.ad; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_hm_tipleri.ad IS 'UI''da görünen isim';


--
-- Name: COLUMN uys_hm_tipleri.aciklama; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_hm_tipleri.aciklama IS 'Opsiyonel açıklama / alt tip bilgisi';


--
-- Name: COLUMN uys_hm_tipleri.varsayilan_birim; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_hm_tipleri.varsayilan_birim IS 'Stok/reçetede dropdown seçildiğinde auto-fill birim';


--
-- Name: COLUMN uys_hm_tipleri.sira; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_hm_tipleri.sira IS 'UI sırası (küçük değer üstte)';


--
-- Name: COLUMN uys_hm_tipleri.aktif; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_hm_tipleri.aktif IS 'Pasif tipler dropdown listelerinde görünmez';


--
-- Name: uys_ie_hazirlama; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_ie_hazirlama_kalemler; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_ie_hazirlama_log; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_ie_log; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_izinler; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_kesim_planlari; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_kullanicilar; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: COLUMN uys_kullanicilar.aktif_oturum_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_kullanicilar.aktif_oturum_id IS 'Aktif oturum UUID. Login sırasında üretilir, başka cihaz girince değiştirilir, eski cihaz Realtime ile fark eder.';


--
-- Name: COLUMN uys_kullanicilar.aktif_oturum_cihaz; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_kullanicilar.aktif_oturum_cihaz IS 'Aktif oturum cihaz tanımı (örn: "iPad — Safari"). Uyarı UIsinde kullanılır.';


--
-- Name: COLUMN uys_kullanicilar.aktif_oturum_son; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_kullanicilar.aktif_oturum_son IS 'Son aktivite timestamp. Stale session detection için.';


--
-- Name: uys_logs; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_lokasyonlar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_lokasyonlar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kod character varying(30) NOT NULL,
    ad character varying(100),
    bolum character varying(50),
    tip character varying(20) DEFAULT 'raf'::character varying NOT NULL,
    kapasite integer,
    aktif boolean DEFAULT true NOT NULL,
    olusturma timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: uys_malzemeler; Type: TABLE; Schema: public; Owner: -
--

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
    malzeme_cinsi text,
    lokasyon_kodu character varying(30)
);


--
-- Name: COLUMN uys_malzemeler.birim_kg_metre; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_malzemeler.birim_kg_metre IS 'Hammadde için kg/m (örn. NPU 120 = 13.4). Yarı mamul/mamul için NULL.';


--
-- Name: uys_manuel_mudahale_log; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_mrp_calculations; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_mrp_rezerve; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_mrp_state_global; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: TABLE uys_mrp_state_global; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.uys_mrp_state_global IS 'Global MRP cache (sirket geneli brut ihtiyac + net eksik). Singleton, id=1.';


--
-- Name: uys_mrp_state_order; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: TABLE uys_mrp_state_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.uys_mrp_state_order IS 'Order bazli MRP cache. CASCADE delete: order silinince cache otomatik temizlenir.';


--
-- Name: uys_notes; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_operations (
    id text NOT NULL,
    kod text,
    ad text,
    bolum text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: uys_operator_notes; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_operators; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: COLUMN uys_operators.auth_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_operators.auth_user_id IS 'Supabase Auth user UUID. NULL = henuz Auth migrate edilmedi (Asama 3 hedefi). 30 Nis 2026 v16.22.';


--
-- Name: COLUMN uys_operators.aktif_oturum_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_operators.aktif_oturum_id IS 'Aktif oturum UUID. Login sırasında üretilir, başka cihaz girince değiştirilir, eski cihaz Realtime ile fark eder.';


--
-- Name: COLUMN uys_operators.aktif_oturum_cihaz; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_operators.aktif_oturum_cihaz IS 'Aktif oturum cihaz tanımı. Uyarı UIsinde kullanılır.';


--
-- Name: COLUMN uys_operators.aktif_oturum_son; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_operators.aktif_oturum_son IS 'Son aktivite timestamp. Stale session detection için.';


--
-- Name: COLUMN uys_operators.bolumler; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_operators.bolumler IS 'Ek bölüm atamaları. Dolu ise bolum alanının önüne geçer.';


--
-- Name: uys_orders; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: COLUMN uys_orders.state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.uys_orders.state IS 'IE #14 Faz B - Otomatik hesaplanan siparis state. compute_order_state() ile guncellenir.';


--
-- Name: uys_pending_flows; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_rapido_bom; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_recipes; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_session_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_session_memory (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: uys_sevk_satirlari; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_sevkler; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_stations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_stations (
    id text NOT NULL,
    kod text,
    ad text,
    op_ids jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: uys_stok_hareketler; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_stok_hareketler_arsiv; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_stok_hareketler_arsiv (
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
    arsivlendi_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE uys_stok_hareketler_arsiv; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.uys_stok_hareketler_arsiv IS 'uys_stok_hareketler arşivi — arsivle_stok_hareketleri() RPC ile doldurulur.';


--
-- Name: uys_stok_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_stok_snapshot (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snapshot_tarihi date NOT NULL,
    malkod text NOT NULL,
    malad text,
    net_stok numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE uys_stok_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.uys_stok_snapshot IS 'Günlük net stok snapshot — al_stok_snapshot() RPC ile doldurulur.';


--
-- Name: uys_tedarikciler; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_tedarikler; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_test_runs; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_v15_31_silinen_hareketler; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_work_orders; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_yedekler; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: uys_yetki_ayarlari; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uys_yetki_ayarlari (
    id text NOT NULL,
    rol text,
    aksiyon text,
    izin boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now(),
    data jsonb
);


--
-- Name: v_hammadde_tuketim; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_hammadde_tuketim AS
 SELECT (b.tuketim_tarihi)::date AS tarih,
    b.ham_malkod AS malkod,
    b.ham_malad AS malad,
    count(*) AS adet,
    round((sum(b.uzunluk_mm) / 1000.0), 3) AS toplam_metre,
    round(((sum(b.uzunluk_mm) / 1000.0) * COALESCE(max(m.birim_kg_metre), (0)::numeric)), 2) AS toplam_kg,
    bool_or((m.birim_kg_metre IS NULL)) AS kg_eksik,
    m.hammadde_tipi,
    COALESCE(wo.op_kod, ''::text) AS op_kod,
    COALESCE(wo.op_ad, ''::text) AS op_ad
   FROM (((public.uys_acik_barlar b
     LEFT JOIN public.uys_malzemeler m ON ((m.kod = b.ham_malkod)))
     LEFT JOIN public.uys_logs lg ON ((lg.id = b.tuketim_log_id)))
     LEFT JOIN public.uys_work_orders wo ON ((wo.id = lg.wo_id)))
  WHERE ((b.durum = 'tuketildi'::text) AND (b.tuketim_tarihi IS NOT NULL))
  GROUP BY (b.tuketim_tarihi)::date, b.ham_malkod, b.ham_malad, m.hammadde_tipi, wo.op_kod, wo.op_ad;


--
-- Name: v_stok_anlik; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_stok_anlik WITH (security_invoker='true') AS
 SELECT malkod,
    COALESCE(sum(
        CASE
            WHEN (tip = 'giris'::text) THEN miktar
            ELSE (0)::numeric
        END), (0)::numeric) AS giris_toplam,
    COALESCE(sum(
        CASE
            WHEN (tip = 'cikis'::text) THEN miktar
            ELSE (0)::numeric
        END), (0)::numeric) AS cikis_toplam,
    COALESCE(sum(
        CASE
            WHEN (tip = 'bar_acilis'::text) THEN miktar
            ELSE (0)::numeric
        END), (0)::numeric) AS bar_acilis_toplam,
    (COALESCE(sum(
        CASE
            WHEN (tip = 'giris'::text) THEN miktar
            ELSE (0)::numeric
        END), (0)::numeric) - COALESCE(sum(
        CASE
            WHEN (tip = ANY (ARRAY['cikis'::text, 'bar_acilis'::text])) THEN miktar
            ELSE (0)::numeric
        END), (0)::numeric)) AS stok
   FROM public.uys_stok_hareketler
  GROUP BY malkod;


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: messages_2026_05_15; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_15 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_16; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_16 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_17; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_17 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_18; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_18 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_19; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_19 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_20; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_20 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: messages_2026_05_21; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages_2026_05_21 (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text,
    rollback text[]
);


--
-- Name: messages_2026_05_15; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_15 FOR VALUES FROM ('2026-05-15 00:00:00') TO ('2026-05-16 00:00:00');


--
-- Name: messages_2026_05_16; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_16 FOR VALUES FROM ('2026-05-16 00:00:00') TO ('2026-05-17 00:00:00');


--
-- Name: messages_2026_05_17; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_17 FOR VALUES FROM ('2026-05-17 00:00:00') TO ('2026-05-18 00:00:00');


--
-- Name: messages_2026_05_18; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_18 FOR VALUES FROM ('2026-05-18 00:00:00') TO ('2026-05-19 00:00:00');


--
-- Name: messages_2026_05_19; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_19 FOR VALUES FROM ('2026-05-19 00:00:00') TO ('2026-05-20 00:00:00');


--
-- Name: messages_2026_05_20; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_20 FOR VALUES FROM ('2026-05-20 00:00:00') TO ('2026-05-21 00:00:00');


--
-- Name: messages_2026_05_21; Type: TABLE ATTACH; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages ATTACH PARTITION realtime.messages_2026_05_21 FOR VALUES FROM ('2026-05-21 00:00:00') TO ('2026-05-22 00:00:00');


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: pt_problemler pt_problemler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pt_problemler
    ADD CONSTRAINT pt_problemler_pkey PRIMARY KEY (id);


--
-- Name: uys_acik_barlar uys_acik_barlar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_acik_barlar
    ADD CONSTRAINT uys_acik_barlar_pkey PRIMARY KEY (id);


--
-- Name: uys_active_work uys_active_work_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_active_work
    ADD CONSTRAINT uys_active_work_pkey PRIMARY KEY (id);


--
-- Name: uys_activity_log uys_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_activity_log
    ADD CONSTRAINT uys_activity_log_pkey PRIMARY KEY (id);


--
-- Name: uys_audit_log uys_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_audit_log
    ADD CONSTRAINT uys_audit_log_pkey PRIMARY KEY (id);


--
-- Name: uys_bildirimler uys_bildirimler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_bildirimler
    ADD CONSTRAINT uys_bildirimler_pkey PRIMARY KEY (id);


--
-- Name: uys_bom_trees uys_bom_trees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_bom_trees
    ADD CONSTRAINT uys_bom_trees_pkey PRIMARY KEY (id);


--
-- Name: uys_chat_attachments uys_chat_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_attachments
    ADD CONSTRAINT uys_chat_attachments_pkey PRIMARY KEY (id);


--
-- Name: uys_chat_channels uys_chat_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_channels
    ADD CONSTRAINT uys_chat_channels_pkey PRIMARY KEY (id);


--
-- Name: uys_chat_members uys_chat_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_members
    ADD CONSTRAINT uys_chat_members_pkey PRIMARY KEY (channel_id, user_id);


--
-- Name: uys_chat_mentions uys_chat_mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_mentions
    ADD CONSTRAINT uys_chat_mentions_pkey PRIMARY KEY (message_id, user_id);


--
-- Name: uys_chat_messages uys_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_messages
    ADD CONSTRAINT uys_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: uys_chat_reactions uys_chat_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_reactions
    ADD CONSTRAINT uys_chat_reactions_pkey PRIMARY KEY (message_id, user_id, emoji);


--
-- Name: uys_checklist uys_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_checklist
    ADD CONSTRAINT uys_checklist_pkey PRIMARY KEY (id);


--
-- Name: uys_customers uys_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_customers
    ADD CONSTRAINT uys_customers_pkey PRIMARY KEY (id);


--
-- Name: uys_dev_files uys_dev_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_dev_files
    ADD CONSTRAINT uys_dev_files_pkey PRIMARY KEY (path);


--
-- Name: uys_durus_kodlari uys_durus_kodlari_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_durus_kodlari
    ADD CONSTRAINT uys_durus_kodlari_pkey PRIMARY KEY (id);


--
-- Name: uys_fire_logs uys_fire_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_fire_logs
    ADD CONSTRAINT uys_fire_logs_pkey PRIMARY KEY (id);


--
-- Name: uys_hm_tipleri uys_hm_tipleri_kod_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_hm_tipleri
    ADD CONSTRAINT uys_hm_tipleri_kod_key UNIQUE (kod);


--
-- Name: uys_hm_tipleri uys_hm_tipleri_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_hm_tipleri
    ADD CONSTRAINT uys_hm_tipleri_pkey PRIMARY KEY (id);


--
-- Name: uys_ie_hazirlama_kalemler uys_ie_hazirlama_kalemler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_ie_hazirlama_kalemler
    ADD CONSTRAINT uys_ie_hazirlama_kalemler_pkey PRIMARY KEY (id);


--
-- Name: uys_ie_hazirlama_log uys_ie_hazirlama_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_ie_hazirlama_log
    ADD CONSTRAINT uys_ie_hazirlama_log_pkey PRIMARY KEY (id);


--
-- Name: uys_ie_hazirlama uys_ie_hazirlama_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_ie_hazirlama
    ADD CONSTRAINT uys_ie_hazirlama_pkey PRIMARY KEY (id);


--
-- Name: uys_ie_log uys_ie_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_ie_log
    ADD CONSTRAINT uys_ie_log_pkey PRIMARY KEY (id);


--
-- Name: uys_izinler uys_izinler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_izinler
    ADD CONSTRAINT uys_izinler_pkey PRIMARY KEY (id);


--
-- Name: uys_kesim_planlari uys_kesim_planlari_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_kesim_planlari
    ADD CONSTRAINT uys_kesim_planlari_pkey PRIMARY KEY (id);


--
-- Name: uys_kullanicilar uys_kullanicilar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_kullanicilar
    ADD CONSTRAINT uys_kullanicilar_pkey PRIMARY KEY (id);


--
-- Name: uys_logs uys_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_logs
    ADD CONSTRAINT uys_logs_pkey PRIMARY KEY (id);


--
-- Name: uys_lokasyonlar uys_lokasyonlar_kod_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_lokasyonlar
    ADD CONSTRAINT uys_lokasyonlar_kod_key UNIQUE (kod);


--
-- Name: uys_lokasyonlar uys_lokasyonlar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_lokasyonlar
    ADD CONSTRAINT uys_lokasyonlar_pkey PRIMARY KEY (id);


--
-- Name: uys_malzemeler uys_malzemeler_kod_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_malzemeler
    ADD CONSTRAINT uys_malzemeler_kod_key UNIQUE (kod);


--
-- Name: uys_malzemeler uys_malzemeler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_malzemeler
    ADD CONSTRAINT uys_malzemeler_pkey PRIMARY KEY (id);


--
-- Name: uys_manuel_mudahale_log uys_manuel_mudahale_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_manuel_mudahale_log
    ADD CONSTRAINT uys_manuel_mudahale_log_pkey PRIMARY KEY (id);


--
-- Name: uys_mrp_calculations uys_mrp_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_mrp_calculations
    ADD CONSTRAINT uys_mrp_calculations_pkey PRIMARY KEY (id);


--
-- Name: uys_mrp_rezerve uys_mrp_rezerve_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_mrp_rezerve
    ADD CONSTRAINT uys_mrp_rezerve_pkey PRIMARY KEY (id);


--
-- Name: uys_mrp_state_global uys_mrp_state_global_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_mrp_state_global
    ADD CONSTRAINT uys_mrp_state_global_pkey PRIMARY KEY (id);


--
-- Name: uys_mrp_state_order uys_mrp_state_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_mrp_state_order
    ADD CONSTRAINT uys_mrp_state_order_pkey PRIMARY KEY (order_id);


--
-- Name: uys_notes uys_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_notes
    ADD CONSTRAINT uys_notes_pkey PRIMARY KEY (id);


--
-- Name: uys_operations uys_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_operations
    ADD CONSTRAINT uys_operations_pkey PRIMARY KEY (id);


--
-- Name: uys_operator_notes uys_operator_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_operator_notes
    ADD CONSTRAINT uys_operator_notes_pkey PRIMARY KEY (id);


--
-- Name: uys_operators uys_operators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_operators
    ADD CONSTRAINT uys_operators_pkey PRIMARY KEY (id);


--
-- Name: uys_orders uys_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_orders
    ADD CONSTRAINT uys_orders_pkey PRIMARY KEY (id);


--
-- Name: uys_orders uys_orders_siparis_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_orders
    ADD CONSTRAINT uys_orders_siparis_no_unique UNIQUE (siparis_no);


--
-- Name: uys_pending_flows uys_pending_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_pending_flows
    ADD CONSTRAINT uys_pending_flows_pkey PRIMARY KEY (id);


--
-- Name: uys_rapido_bom uys_rapido_bom_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_rapido_bom
    ADD CONSTRAINT uys_rapido_bom_pkey PRIMARY KEY (id);


--
-- Name: uys_recipes uys_recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_recipes
    ADD CONSTRAINT uys_recipes_pkey PRIMARY KEY (id);


--
-- Name: uys_session_memory uys_session_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_session_memory
    ADD CONSTRAINT uys_session_memory_pkey PRIMARY KEY (key);


--
-- Name: uys_sevk_satirlari uys_sevk_satirlari_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_sevk_satirlari
    ADD CONSTRAINT uys_sevk_satirlari_pkey PRIMARY KEY (id);


--
-- Name: uys_sevkler uys_sevkler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_sevkler
    ADD CONSTRAINT uys_sevkler_pkey PRIMARY KEY (id);


--
-- Name: uys_stations uys_stations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_stations
    ADD CONSTRAINT uys_stations_pkey PRIMARY KEY (id);


--
-- Name: uys_stok_hareketler_arsiv uys_stok_hareketler_arsiv_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_stok_hareketler_arsiv
    ADD CONSTRAINT uys_stok_hareketler_arsiv_pkey PRIMARY KEY (id);


--
-- Name: uys_stok_hareketler uys_stok_hareketler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_stok_hareketler
    ADD CONSTRAINT uys_stok_hareketler_pkey PRIMARY KEY (id);


--
-- Name: uys_stok_snapshot uys_stok_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_stok_snapshot
    ADD CONSTRAINT uys_stok_snapshot_pkey PRIMARY KEY (id);


--
-- Name: uys_stok_snapshot uys_stok_snapshot_snapshot_tarihi_malkod_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_stok_snapshot
    ADD CONSTRAINT uys_stok_snapshot_snapshot_tarihi_malkod_key UNIQUE (snapshot_tarihi, malkod);


--
-- Name: uys_tedarikciler uys_tedarikciler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_tedarikciler
    ADD CONSTRAINT uys_tedarikciler_pkey PRIMARY KEY (id);


--
-- Name: uys_tedarikler uys_tedarikler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_tedarikler
    ADD CONSTRAINT uys_tedarikler_pkey PRIMARY KEY (id);


--
-- Name: uys_test_runs uys_test_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_test_runs
    ADD CONSTRAINT uys_test_runs_pkey PRIMARY KEY (id);


--
-- Name: uys_work_orders uys_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_work_orders
    ADD CONSTRAINT uys_work_orders_pkey PRIMARY KEY (id);


--
-- Name: uys_yedekler uys_yedekler_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_yedekler
    ADD CONSTRAINT uys_yedekler_pkey PRIMARY KEY (id);


--
-- Name: uys_yetki_ayarlari uys_yetki_ayarlari_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_yetki_ayarlari
    ADD CONSTRAINT uys_yetki_ayarlari_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_15 messages_2026_05_15_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_15
    ADD CONSTRAINT messages_2026_05_15_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_16 messages_2026_05_16_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_16
    ADD CONSTRAINT messages_2026_05_16_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_17 messages_2026_05_17_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_17
    ADD CONSTRAINT messages_2026_05_17_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_18 messages_2026_05_18_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_18
    ADD CONSTRAINT messages_2026_05_18_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_19 messages_2026_05_19_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_19
    ADD CONSTRAINT messages_2026_05_19_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_20 messages_2026_05_20_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_20
    ADD CONSTRAINT messages_2026_05_20_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: messages_2026_05_21 messages_2026_05_21_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages_2026_05_21
    ADD CONSTRAINT messages_2026_05_21_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: idx_users_created_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_created_at_desc ON auth.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_email ON auth.users USING btree (email);


--
-- Name: idx_users_last_sign_in_at_desc; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_last_sign_in_at_desc ON auth.users USING btree (last_sign_in_at DESC);


--
-- Name: idx_users_name; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_users_name ON auth.users USING btree (((raw_user_meta_data ->> 'name'::text))) WHERE ((raw_user_meta_data ->> 'name'::text) IS NOT NULL);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: idx_acik_barlar_durum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acik_barlar_durum ON public.uys_acik_barlar USING btree (durum);


--
-- Name: idx_acik_barlar_malkod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acik_barlar_malkod ON public.uys_acik_barlar USING btree (ham_malkod);


--
-- Name: idx_acik_barlar_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acik_barlar_plan ON public.uys_acik_barlar USING btree (kaynak_plan_id);


--
-- Name: idx_audit_kayit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_kayit ON public.uys_audit_log USING btree (kayit_id);


--
-- Name: idx_audit_kullanici; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_kullanici ON public.uys_audit_log USING btree (kullanici_ad);


--
-- Name: idx_audit_olay; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_olay ON public.uys_audit_log USING btree (olay_tipi);


--
-- Name: idx_audit_tablo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_tablo ON public.uys_audit_log USING btree (tablo);


--
-- Name: idx_audit_zaman; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_zaman ON public.uys_audit_log USING btree (zaman DESC);


--
-- Name: idx_bildirimler_okundu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bildirimler_okundu ON public.uys_bildirimler USING btree (okundu, olusturma DESC) WHERE (okundu = false);


--
-- Name: idx_bildirimler_olusturma; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bildirimler_olusturma ON public.uys_bildirimler USING btree (olusturma DESC);


--
-- Name: idx_bildirimler_test_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bildirimler_test_run ON public.uys_bildirimler USING btree (test_run_id) WHERE (test_run_id IS NOT NULL);


--
-- Name: idx_chat_channels_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_channels_type ON public.uys_chat_channels USING btree (type);


--
-- Name: idx_chat_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_members_user ON public.uys_chat_members USING btree (user_id);


--
-- Name: idx_chat_mentions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_mentions_user ON public.uys_chat_mentions USING btree (user_id) WHERE (read_at IS NULL);


--
-- Name: idx_chat_messages_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_channel ON public.uys_chat_messages USING btree (channel_id, created_at DESC);


--
-- Name: idx_chat_messages_reply; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_reply ON public.uys_chat_messages USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);


--
-- Name: idx_fire_logs_telafi_wo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fire_logs_telafi_wo_id ON public.uys_fire_logs USING btree (telafi_wo_id);


--
-- Name: idx_ie_haz_durum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_haz_durum ON public.uys_ie_hazirlama USING btree (durum);


--
-- Name: idx_ie_haz_siparis; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_haz_siparis ON public.uys_ie_hazirlama USING btree (siparis_no);


--
-- Name: idx_ie_haz_sipno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_haz_sipno ON public.uys_ie_hazirlama USING btree (siparis_no);


--
-- Name: idx_ie_kalem_ie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_kalem_ie ON public.uys_ie_hazirlama_kalemler USING btree (ie_id);


--
-- Name: idx_ie_kalem_urun; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_kalem_urun ON public.uys_ie_hazirlama_kalemler USING btree (urun_kodu);


--
-- Name: idx_ie_log_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_log_event ON public.uys_ie_log USING btree (event);


--
-- Name: idx_ie_log_ie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_log_ie ON public.uys_ie_log USING btree (ie_id);


--
-- Name: idx_kullanicilar_aktif_oturum_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kullanicilar_aktif_oturum_id ON public.uys_kullanicilar USING btree (aktif_oturum_id) WHERE (aktif_oturum_id IS NOT NULL);


--
-- Name: idx_mrp_calc_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mrp_calc_order ON public.uys_mrp_calculations USING btree (order_id, hesaplandi DESC);


--
-- Name: idx_mudahale_kullanici; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mudahale_kullanici ON public.uys_manuel_mudahale_log USING btree (kullanici_id, tarih DESC);


--
-- Name: idx_mudahale_tarih; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mudahale_tarih ON public.uys_manuel_mudahale_log USING btree (tarih DESC);


--
-- Name: idx_mudahale_test_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mudahale_test_run ON public.uys_manuel_mudahale_log USING btree (test_run_id) WHERE (test_run_id IS NOT NULL);


--
-- Name: idx_operator_notes_kategori; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operator_notes_kategori ON public.uys_operator_notes USING btree (kategori);


--
-- Name: idx_operator_notes_oncelik; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operator_notes_oncelik ON public.uys_operator_notes USING btree (oncelik) WHERE (oncelik = 'Acil'::text);


--
-- Name: idx_operators_aktif_oturum_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operators_aktif_oturum_id ON public.uys_operators USING btree (aktif_oturum_id) WHERE (aktif_oturum_id IS NOT NULL);


--
-- Name: idx_pending_flows_user_aktif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pending_flows_user_aktif ON public.uys_pending_flows USING btree (user_id, durum);


--
-- Name: idx_pt_problemler_durum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_problemler_durum ON public.pt_problemler USING btree (durum);


--
-- Name: idx_pt_problemler_son_degistirme; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_problemler_son_degistirme ON public.pt_problemler USING btree (son_degistirme DESC);


--
-- Name: idx_pt_problemler_termin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pt_problemler_termin ON public.pt_problemler USING btree (termin);


--
-- Name: idx_rapido_bom_hammadde; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rapido_bom_hammadde ON public.uys_rapido_bom USING btree (hammadde_kodu);


--
-- Name: idx_rapido_bom_istasyon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rapido_bom_istasyon ON public.uys_rapido_bom USING btree (is_istasyonu);


--
-- Name: idx_rapido_bom_urun; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rapido_bom_urun ON public.uys_rapido_bom USING btree (urun_kodu);


--
-- Name: idx_rezerve_malkod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rezerve_malkod ON public.uys_mrp_rezerve USING btree (malkod);


--
-- Name: idx_rezerve_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rezerve_order ON public.uys_mrp_rezerve USING btree (order_id);


--
-- Name: idx_sevkler_durum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sevkler_durum ON public.uys_sevkler USING btree (durum);


--
-- Name: idx_stok_hareket_rezerv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stok_hareket_rezerv ON public.uys_stok_hareketler USING btree (rezerv_order_id) WHERE (rezerv_order_id IS NOT NULL);


--
-- Name: idx_stok_hareketler_log_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stok_hareketler_log_id ON public.uys_stok_hareketler USING btree (log_id) WHERE (log_id IS NOT NULL);


--
-- Name: idx_stok_hareketler_rezerv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stok_hareketler_rezerv ON public.uys_stok_hareketler USING btree (malkod, tip) WHERE (tip = 'rezerv'::text);


--
-- Name: idx_stok_hareketler_tarih; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stok_hareketler_tarih ON public.uys_stok_hareketler USING btree (tarih DESC);


--
-- Name: idx_stok_hareketler_wo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stok_hareketler_wo_id ON public.uys_stok_hareketler USING btree (wo_id) WHERE (wo_id IS NOT NULL);


--
-- Name: idx_test_runs_durum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_runs_durum ON public.uys_test_runs USING btree (durum);


--
-- Name: idx_uys_activity_log_kullanici; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_activity_log_kullanici ON public.uys_activity_log USING btree (kullanici);


--
-- Name: idx_uys_activity_log_modul; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_activity_log_modul ON public.uys_activity_log USING btree (modul);


--
-- Name: idx_uys_activity_log_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_activity_log_order ON public.uys_activity_log USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: idx_uys_activity_log_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_activity_log_ts ON public.uys_activity_log USING btree (ts DESC);


--
-- Name: idx_uys_activity_log_wo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_activity_log_wo ON public.uys_activity_log USING btree (wo_id) WHERE (wo_id IS NOT NULL);


--
-- Name: idx_uys_chat_attachments_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_chat_attachments_message ON public.uys_chat_attachments USING btree (message_id);


--
-- Name: idx_uys_chat_mentions_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_chat_mentions_message ON public.uys_chat_mentions USING btree (message_id);


--
-- Name: idx_uys_chat_mentions_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_chat_mentions_user_unread ON public.uys_chat_mentions USING btree (user_id, read_at) WHERE (read_at IS NULL);


--
-- Name: idx_uys_chat_messages_body_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_chat_messages_body_trgm ON public.uys_chat_messages USING gin (body extensions.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: idx_uys_chat_messages_channel_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_chat_messages_channel_created ON public.uys_chat_messages USING btree (channel_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_uys_hm_tipleri_aktif_sira; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_hm_tipleri_aktif_sira ON public.uys_hm_tipleri USING btree (aktif, sira) WHERE (aktif = true);


--
-- Name: idx_uys_hm_tipleri_kod_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_hm_tipleri_kod_lower ON public.uys_hm_tipleri USING btree (lower(kod));


--
-- Name: idx_uys_kullanicilar_auth_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_kullanicilar_auth_user_id ON public.uys_kullanicilar USING btree (auth_user_id);


--
-- Name: idx_uys_logs_malkod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_logs_malkod ON public.uys_logs USING btree (malkod) WHERE (malkod IS NOT NULL);


--
-- Name: idx_uys_logs_tarih; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_logs_tarih ON public.uys_logs USING btree (tarih);


--
-- Name: idx_uys_logs_wo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_logs_wo_id ON public.uys_logs USING btree (wo_id);


--
-- Name: idx_uys_logs_wo_id_tarih; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_logs_wo_id_tarih ON public.uys_logs USING btree (wo_id, tarih DESC);


--
-- Name: idx_uys_mrp_calculations_test_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_mrp_calculations_test_run_id ON public.uys_mrp_calculations USING btree (test_run_id) WHERE (test_run_id IS NOT NULL);


--
-- Name: idx_uys_notes_sayfa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_notes_sayfa ON public.uys_notes USING btree (sayfa);


--
-- Name: idx_uys_operators_auth_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_operators_auth_user_id ON public.uys_operators USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);


--
-- Name: idx_uys_sevk_satirlari_malkod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_sevk_satirlari_malkod ON public.uys_sevk_satirlari USING btree (malkod);


--
-- Name: idx_uys_sevk_satirlari_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_sevk_satirlari_order ON public.uys_sevk_satirlari USING btree (order_id);


--
-- Name: idx_uys_sevk_satirlari_sevk; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_sevk_satirlari_sevk ON public.uys_sevk_satirlari USING btree (sevk_id);


--
-- Name: idx_uys_sevkler_sevk_no_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_uys_sevkler_sevk_no_unique ON public.uys_sevkler USING btree (sevk_no) WHERE (sevk_no IS NOT NULL);


--
-- Name: idx_uys_stok_malkod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_stok_malkod ON public.uys_stok_hareketler USING btree (malkod);


--
-- Name: idx_uys_work_orders_durum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_work_orders_durum ON public.uys_work_orders USING btree (durum);


--
-- Name: idx_uys_work_orders_ist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_work_orders_ist_id ON public.uys_work_orders USING btree (ist_id) WHERE (ist_id IS NOT NULL);


--
-- Name: idx_uys_work_orders_malkod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_work_orders_malkod ON public.uys_work_orders USING btree (malkod);


--
-- Name: idx_uys_work_orders_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_work_orders_order_id ON public.uys_work_orders USING btree (order_id);


--
-- Name: idx_uys_yedekler_tarih; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uys_yedekler_tarih ON public.uys_yedekler USING btree (alindi_tarih DESC, alindi_saat DESC);


--
-- Name: ix_mrp_state_order_invalidated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_mrp_state_order_invalidated ON public.uys_mrp_state_order USING btree (invalidated) WHERE (invalidated = true);


--
-- Name: ix_orders_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_state ON public.uys_orders USING btree (state);


--
-- Name: uys_sh_dup_guard_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uys_sh_dup_guard_idx ON public.uys_stok_hareketler USING btree (malkod, updated_at DESC) WHERE ((wo_id IS NULL) AND (log_id IS NULL));


--
-- Name: uys_sh_tedarik_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uys_sh_tedarik_id_idx ON public.uys_stok_hareketler USING btree (tedarik_id) WHERE (tedarik_id IS NOT NULL);


--
-- Name: uys_wo_rc_id_kirno_durum_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uys_wo_rc_id_kirno_durum_idx ON public.uys_work_orders USING btree (rc_id, kirno, durum);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_15_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_15_inserted_at_topic_idx ON realtime.messages_2026_05_15 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_16_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_16_inserted_at_topic_idx ON realtime.messages_2026_05_16 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_17_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_17_inserted_at_topic_idx ON realtime.messages_2026_05_17 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_18_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_18_inserted_at_topic_idx ON realtime.messages_2026_05_18 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_19_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_19_inserted_at_topic_idx ON realtime.messages_2026_05_19 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_20_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_20_inserted_at_topic_idx ON realtime.messages_2026_05_20 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: messages_2026_05_21_inserted_at_topic_idx; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_2026_05_21_inserted_at_topic_idx ON realtime.messages_2026_05_21 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: messages_2026_05_15_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_15_inserted_at_topic_idx;


--
-- Name: messages_2026_05_15_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_15_pkey;


--
-- Name: messages_2026_05_16_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_16_inserted_at_topic_idx;


--
-- Name: messages_2026_05_16_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_16_pkey;


--
-- Name: messages_2026_05_17_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_17_inserted_at_topic_idx;


--
-- Name: messages_2026_05_17_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_17_pkey;


--
-- Name: messages_2026_05_18_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_18_inserted_at_topic_idx;


--
-- Name: messages_2026_05_18_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_18_pkey;


--
-- Name: messages_2026_05_19_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_19_inserted_at_topic_idx;


--
-- Name: messages_2026_05_19_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_19_pkey;


--
-- Name: messages_2026_05_20_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_20_inserted_at_topic_idx;


--
-- Name: messages_2026_05_20_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_20_pkey;


--
-- Name: messages_2026_05_21_inserted_at_topic_idx; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_inserted_at_topic_index ATTACH PARTITION realtime.messages_2026_05_21_inserted_at_topic_idx;


--
-- Name: messages_2026_05_21_pkey; Type: INDEX ATTACH; Schema: realtime; Owner: -
--

ALTER INDEX realtime.messages_pkey ATTACH PARTITION realtime.messages_2026_05_21_pkey;


--
-- Name: uys_malzemeler trg_cascade_malzeme_kod; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cascade_malzeme_kod AFTER UPDATE ON public.uys_malzemeler FOR EACH ROW EXECUTE FUNCTION public.cascade_malzeme_kod_update();


--
-- Name: uys_orders trg_clear_kesim_on_order_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clear_kesim_on_order_update AFTER UPDATE ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.tg_clear_bekleyen_kesim_planlari();


--
-- Name: uys_malzemeler trg_malkod_cascade_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_malkod_cascade_update AFTER UPDATE OF kod ON public.uys_malzemeler FOR EACH ROW EXECUTE FUNCTION public.fn_malkod_cascade_update();


--
-- Name: uys_bom_trees trg_mrp_bom_trees; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_bom_trees AFTER INSERT OR DELETE OR UPDATE ON public.uys_bom_trees FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();


--
-- Name: uys_orders trg_mrp_durum_on_order_close; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_durum_on_order_close BEFORE UPDATE OF durum ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.fn_mrp_durum_on_order_close();


--
-- Name: uys_work_orders trg_mrp_durum_on_wo_tamam; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_durum_on_wo_tamam AFTER UPDATE OF durum ON public.uys_work_orders FOR EACH ROW EXECUTE FUNCTION public.fn_mrp_durum_check_on_wo();


--
-- Name: uys_kesim_planlari trg_mrp_kesim_planlari; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_kesim_planlari AFTER INSERT OR DELETE OR UPDATE ON public.uys_kesim_planlari FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();


--
-- Name: uys_orders trg_mrp_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_orders AFTER INSERT OR DELETE OR UPDATE ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.invalidate_mrp_order();


--
-- Name: uys_recipes trg_mrp_recipes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_recipes AFTER INSERT OR DELETE OR UPDATE ON public.uys_recipes FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();


--
-- Name: uys_mrp_state_order trg_mrp_state_refresh_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_state_refresh_order AFTER INSERT OR UPDATE ON public.uys_mrp_state_order FOR EACH ROW EXECUTE FUNCTION public.fn_mrp_state_refresh_order();


--
-- Name: uys_stok_hareketler trg_mrp_stok_hareketler; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_stok_hareketler AFTER INSERT OR DELETE OR UPDATE ON public.uys_stok_hareketler FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();


--
-- Name: uys_tedarikler trg_mrp_tedarikler; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_tedarikler AFTER INSERT OR DELETE OR UPDATE ON public.uys_tedarikler FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_mrp_global();


--
-- Name: uys_work_orders trg_mrp_work_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mrp_work_orders AFTER INSERT OR DELETE OR UPDATE ON public.uys_work_orders FOR EACH ROW EXECUTE FUNCTION public.invalidate_mrp_order();


--
-- Name: uys_pending_flows trg_pending_flow_order_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pending_flow_order_id BEFORE INSERT OR UPDATE ON public.uys_pending_flows FOR EACH ROW EXECUTE FUNCTION public.fn_pending_flow_set_order_id();


--
-- Name: uys_recipes trg_recete_sure_cascade; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recete_sure_cascade AFTER UPDATE OF satirlar ON public.uys_recipes FOR EACH ROW EXECUTE FUNCTION public.fn_recete_sure_cascade();


--
-- Name: uys_recipes trg_recipe_op_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recipe_op_sync AFTER UPDATE OF satirlar ON public.uys_recipes FOR EACH ROW EXECUTE FUNCTION public.fn_recipe_op_sync();


--
-- Name: uys_orders trg_refresh_state_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refresh_state_orders AFTER INSERT OR UPDATE OF durum, sevk_durum, recete_id ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_order_state();


--
-- Name: uys_tedarikler trg_refresh_state_tedarik; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refresh_state_tedarik AFTER INSERT OR DELETE OR UPDATE ON public.uys_tedarikler FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_order_state();


--
-- Name: uys_work_orders trg_refresh_state_wo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refresh_state_wo AFTER INSERT OR DELETE OR UPDATE ON public.uys_work_orders FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_order_state();


--
-- Name: uys_stok_hareketler trg_stok_hareket_dup_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stok_hareket_dup_guard BEFORE INSERT ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.fn_stok_hareket_dup_guard();


--
-- Name: uys_stok_hareketler trg_stok_hareket_refresh_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stok_hareket_refresh_order AFTER INSERT OR DELETE ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.fn_stok_hareket_refresh_order();


--
-- Name: uys_stok_hareketler trg_stok_invalidate_mrp_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stok_invalidate_mrp_state AFTER INSERT OR UPDATE ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.fn_stok_invalidate_mrp_state();


--
-- Name: uys_stok_hareketler trg_stok_reset_mrp_durum; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stok_reset_mrp_durum AFTER INSERT OR UPDATE ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.fn_stok_reset_mrp_durum();


--
-- Name: uys_acik_barlar trg_uys_acik_barlar_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_acik_barlar_updated_at BEFORE UPDATE ON public.uys_acik_barlar FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_active_work trg_uys_active_work_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_active_work_updated_at BEFORE UPDATE ON public.uys_active_work FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_bom_trees trg_uys_bom_trees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_bom_trees_updated_at BEFORE UPDATE ON public.uys_bom_trees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_checklist trg_uys_checklist_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_checklist_updated_at BEFORE UPDATE ON public.uys_checklist FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_customers trg_uys_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_customers_updated_at BEFORE UPDATE ON public.uys_customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_durus_kodlari trg_uys_durus_kodlari_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_durus_kodlari_updated_at BEFORE UPDATE ON public.uys_durus_kodlari FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_fire_logs trg_uys_fire_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_fire_logs_updated_at BEFORE UPDATE ON public.uys_fire_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_hm_tipleri trg_uys_hm_tipleri_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_hm_tipleri_updated_at BEFORE UPDATE ON public.uys_hm_tipleri FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_izinler trg_uys_izinler_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_izinler_updated_at BEFORE UPDATE ON public.uys_izinler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_kesim_planlari trg_uys_kesim_planlari_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_kesim_planlari_updated_at BEFORE UPDATE ON public.uys_kesim_planlari FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_kullanicilar trg_uys_kullanicilar_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_kullanicilar_updated_at BEFORE UPDATE ON public.uys_kullanicilar FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_logs trg_uys_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_logs_updated_at BEFORE UPDATE ON public.uys_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_malzemeler trg_uys_malzemeler_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_malzemeler_updated_at BEFORE UPDATE ON public.uys_malzemeler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_mrp_calculations trg_uys_mrp_calculations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_mrp_calculations_updated_at BEFORE UPDATE ON public.uys_mrp_calculations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_mrp_rezerve trg_uys_mrp_rezerve_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_mrp_rezerve_updated_at BEFORE UPDATE ON public.uys_mrp_rezerve FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_notes trg_uys_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_notes_updated_at BEFORE UPDATE ON public.uys_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_operations trg_uys_operations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_operations_updated_at BEFORE UPDATE ON public.uys_operations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_operator_notes trg_uys_operator_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_operator_notes_updated_at BEFORE UPDATE ON public.uys_operator_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_operators trg_uys_operators_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_operators_updated_at BEFORE UPDATE ON public.uys_operators FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_orders trg_uys_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_orders_updated_at BEFORE UPDATE ON public.uys_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_recipes trg_uys_recipes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_recipes_updated_at BEFORE UPDATE ON public.uys_recipes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_sevk_satirlari trg_uys_sevk_satirlari_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_sevk_satirlari_updated_at BEFORE UPDATE ON public.uys_sevk_satirlari FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_sevkler trg_uys_sevkler_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_sevkler_updated_at BEFORE UPDATE ON public.uys_sevkler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_stations trg_uys_stations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_stations_updated_at BEFORE UPDATE ON public.uys_stations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_stok_hareketler trg_uys_stok_hareketler_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_stok_hareketler_updated_at BEFORE UPDATE ON public.uys_stok_hareketler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_tedarikciler trg_uys_tedarikciler_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_tedarikciler_updated_at BEFORE UPDATE ON public.uys_tedarikciler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_tedarikler trg_uys_tedarikler_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_tedarikler_updated_at BEFORE UPDATE ON public.uys_tedarikler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_v15_31_silinen_hareketler trg_uys_v15_31_silinen_hareketler_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_v15_31_silinen_hareketler_updated_at BEFORE UPDATE ON public.uys_v15_31_silinen_hareketler FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_work_orders trg_uys_work_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_work_orders_updated_at BEFORE UPDATE ON public.uys_work_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: uys_yetki_ayarlari trg_uys_yetki_ayarlari_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_uys_yetki_ayarlari_updated_at BEFORE UPDATE ON public.uys_yetki_ayarlari FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: uys_chat_attachments uys_chat_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_attachments
    ADD CONSTRAINT uys_chat_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.uys_chat_messages(id) ON DELETE CASCADE;


--
-- Name: uys_chat_channels uys_chat_channels_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_channels
    ADD CONSTRAINT uys_chat_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.uys_kullanicilar(id) ON DELETE SET NULL;


--
-- Name: uys_chat_members uys_chat_members_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_members
    ADD CONSTRAINT uys_chat_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.uys_chat_channels(id) ON DELETE CASCADE;


--
-- Name: uys_chat_members uys_chat_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_members
    ADD CONSTRAINT uys_chat_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.uys_kullanicilar(id) ON DELETE CASCADE;


--
-- Name: uys_chat_mentions uys_chat_mentions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_mentions
    ADD CONSTRAINT uys_chat_mentions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.uys_chat_messages(id) ON DELETE CASCADE;


--
-- Name: uys_chat_mentions uys_chat_mentions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_mentions
    ADD CONSTRAINT uys_chat_mentions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.uys_kullanicilar(id) ON DELETE CASCADE;


--
-- Name: uys_chat_messages uys_chat_messages_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_messages
    ADD CONSTRAINT uys_chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.uys_chat_channels(id) ON DELETE CASCADE;


--
-- Name: uys_chat_messages uys_chat_messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_messages
    ADD CONSTRAINT uys_chat_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.uys_chat_messages(id) ON DELETE SET NULL;


--
-- Name: uys_chat_messages uys_chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_messages
    ADD CONSTRAINT uys_chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.uys_kullanicilar(id) ON DELETE SET NULL;


--
-- Name: uys_chat_reactions uys_chat_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_reactions
    ADD CONSTRAINT uys_chat_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.uys_chat_messages(id) ON DELETE CASCADE;


--
-- Name: uys_chat_reactions uys_chat_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_chat_reactions
    ADD CONSTRAINT uys_chat_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.uys_kullanicilar(id) ON DELETE CASCADE;


--
-- Name: uys_ie_hazirlama_kalemler uys_ie_hazirlama_kalemler_ie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_ie_hazirlama_kalemler
    ADD CONSTRAINT uys_ie_hazirlama_kalemler_ie_id_fkey FOREIGN KEY (ie_id) REFERENCES public.uys_ie_hazirlama(id);


--
-- Name: uys_ie_log uys_ie_log_ie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_ie_log
    ADD CONSTRAINT uys_ie_log_ie_id_fkey FOREIGN KEY (ie_id) REFERENCES public.uys_ie_hazirlama(id) ON DELETE RESTRICT;


--
-- Name: uys_mrp_calculations uys_mrp_calculations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_mrp_calculations
    ADD CONSTRAINT uys_mrp_calculations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.uys_orders(id) ON DELETE CASCADE;


--
-- Name: uys_mrp_state_order uys_mrp_state_order_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_mrp_state_order
    ADD CONSTRAINT uys_mrp_state_order_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.uys_orders(id) ON DELETE CASCADE;


--
-- Name: uys_pending_flows uys_pending_flows_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_pending_flows
    ADD CONSTRAINT uys_pending_flows_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.uys_orders(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- Name: uys_sevk_satirlari uys_sevk_satirlari_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_sevk_satirlari
    ADD CONSTRAINT uys_sevk_satirlari_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.uys_orders(id) ON DELETE SET NULL;


--
-- Name: uys_sevk_satirlari uys_sevk_satirlari_sevk_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_sevk_satirlari
    ADD CONSTRAINT uys_sevk_satirlari_sevk_id_fkey FOREIGN KEY (sevk_id) REFERENCES public.uys_sevkler(id) ON DELETE CASCADE;


--
-- Name: uys_stok_hareketler uys_stok_hareketler_tedarik_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uys_stok_hareketler
    ADD CONSTRAINT uys_stok_hareketler_tedarik_id_fkey FOREIGN KEY (tedarik_id) REFERENCES public.uys_tedarikler(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_dev_files admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.uys_dev_files TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'uzuniskender@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'uzuniskender@gmail.com'::text));


--
-- Name: uys_session_memory admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_only ON public.uys_session_memory TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'uzuniskender@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'uzuniskender@gmail.com'::text));


--
-- Name: uys_kullanicilar admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_write ON public.uys_kullanicilar TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: uys_yetki_ayarlari admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_write ON public.uys_yetki_ayarlari TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: pt_problemler allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.pt_problemler TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_acik_barlar allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_acik_barlar TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_active_work allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_active_work TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_activity_log allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_activity_log TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_bildirimler allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_bildirimler TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_chat_attachments allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_chat_attachments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_chat_channels allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_chat_channels TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_chat_members allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_chat_members TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_chat_mentions allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_chat_mentions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_chat_messages allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_chat_messages TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_chat_reactions allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_chat_reactions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_checklist allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_checklist TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_customers allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_customers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_durus_kodlari allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_durus_kodlari TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_fire_logs allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_fire_logs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_hm_tipleri allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_hm_tipleri TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_izinler allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_izinler TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_kesim_planlari allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_kesim_planlari TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_logs allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_logs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_manuel_mudahale_log allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_manuel_mudahale_log TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_mrp_calculations allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_mrp_calculations TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_mrp_rezerve allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_mrp_rezerve TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_mrp_state_global allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_mrp_state_global TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_mrp_state_order allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_mrp_state_order TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_notes allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_notes TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_operations allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_operations TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_operator_notes allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_operator_notes TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_pending_flows allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_pending_flows TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_sevk_satirlari allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_sevk_satirlari TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_stations allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_stations TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_tedarikciler allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_tedarikciler TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_test_runs allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_test_runs TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_v15_31_silinen_hareketler allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_v15_31_silinen_hareketler TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_yedekler allow_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_all ON public.uys_yedekler TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_operators anon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_select ON public.uys_operators FOR SELECT TO anon USING (true);


--
-- Name: uys_audit_log audit_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_insert ON public.uys_audit_log FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: uys_audit_log audit_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_select ON public.uys_audit_log FOR SELECT TO authenticated USING (true);


--
-- Name: uys_operators authenticated_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_full ON public.uys_operators TO authenticated USING (true) WITH CHECK (true);


--
-- Name: uys_kullanicilar authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select ON public.uys_kullanicilar FOR SELECT TO authenticated USING (true);


--
-- Name: uys_yetki_ayarlari authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select ON public.uys_yetki_ayarlari FOR SELECT TO authenticated USING (true);


--
-- Name: uys_bom_trees bom_trees_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_trees_delete ON public.uys_bom_trees FOR DELETE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_bom_trees bom_trees_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_trees_insert ON public.uys_bom_trees FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_bom_trees bom_trees_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_trees_select ON public.uys_bom_trees FOR SELECT TO authenticated USING (true);


--
-- Name: uys_bom_trees bom_trees_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_trees_update ON public.uys_bom_trees FOR UPDATE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_dev_files github_actions_sync; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY github_actions_sync ON public.uys_dev_files TO anon USING (true) WITH CHECK ((updated_by = ANY (ARRAY['synced'::text, 'github-actions'::text])));


--
-- Name: uys_ie_hazirlama ie_haz_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ie_haz_delete ON public.uys_ie_hazirlama FOR DELETE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_ie_hazirlama ie_haz_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ie_haz_insert ON public.uys_ie_hazirlama FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_ie_hazirlama ie_haz_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ie_haz_select ON public.uys_ie_hazirlama FOR SELECT TO authenticated USING (true);


--
-- Name: uys_ie_hazirlama ie_haz_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ie_haz_update ON public.uys_ie_hazirlama FOR UPDATE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_ie_hazirlama_kalemler ie_kalem_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ie_kalem_all ON public.uys_ie_hazirlama_kalemler TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: uys_ie_log ie_log_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ie_log_all ON public.uys_ie_log TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: uys_lokasyonlar lokasyon_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lokasyon_select ON public.uys_lokasyonlar FOR SELECT TO authenticated USING (true);


--
-- Name: uys_lokasyonlar lokasyon_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lokasyon_write ON public.uys_lokasyonlar TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text, 'depocu'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text, 'depocu'::text])));


--
-- Name: uys_malzemeler malzeme_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY malzeme_select ON public.uys_malzemeler FOR SELECT TO authenticated USING (true);


--
-- Name: uys_malzemeler malzeme_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY malzeme_write ON public.uys_malzemeler TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text, 'uretim_sor'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text, 'uretim_sor'::text])));


--
-- Name: uys_orders orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select ON public.uys_orders FOR SELECT TO authenticated USING (true);


--
-- Name: uys_orders orders_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_write ON public.uys_orders TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: pt_problemler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pt_problemler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_rapido_bom rapido_bom_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rapido_bom_delete ON public.uys_rapido_bom FOR DELETE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_rapido_bom rapido_bom_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rapido_bom_insert ON public.uys_rapido_bom FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_rapido_bom rapido_bom_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rapido_bom_select ON public.uys_rapido_bom FOR SELECT TO authenticated USING (true);


--
-- Name: uys_rapido_bom rapido_bom_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rapido_bom_update ON public.uys_rapido_bom FOR UPDATE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_recipes recipes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recipes_delete ON public.uys_recipes FOR DELETE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_recipes recipes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recipes_insert ON public.uys_recipes FOR INSERT TO authenticated WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_recipes recipes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recipes_select ON public.uys_recipes FOR SELECT TO authenticated USING (true);


--
-- Name: uys_recipes recipes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recipes_update ON public.uys_recipes FOR UPDATE TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_sevkler sevk_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sevk_select ON public.uys_sevkler FOR SELECT TO authenticated USING (true);


--
-- Name: uys_sevkler sevk_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sevk_write ON public.uys_sevkler TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_stok_hareketler stok_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stok_select ON public.uys_stok_hareketler FOR SELECT TO authenticated USING (true);


--
-- Name: uys_stok_hareketler stok_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stok_write ON public.uys_stok_hareketler TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'uretim_sor'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'uretim_sor'::text])));


--
-- Name: uys_tedarikler tedarik_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tedarik_select ON public.uys_tedarikler FOR SELECT TO authenticated USING (true);


--
-- Name: uys_tedarikler tedarik_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tedarik_write ON public.uys_tedarikler TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text])));


--
-- Name: uys_acik_barlar; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_acik_barlar ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_active_work; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_active_work ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_bildirimler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_bildirimler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_bom_trees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_bom_trees ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_chat_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_chat_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_chat_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_chat_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_chat_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_chat_members ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_chat_mentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_chat_mentions ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_chat_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_chat_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_checklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_checklist ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_dev_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_dev_files ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_durus_kodlari; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_durus_kodlari ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_fire_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_fire_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_hm_tipleri; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_hm_tipleri ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_ie_hazirlama; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_ie_hazirlama ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_ie_hazirlama_kalemler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_ie_hazirlama_kalemler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_ie_hazirlama_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_ie_hazirlama_log ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_ie_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_ie_log ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_izinler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_izinler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_kesim_planlari; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_kesim_planlari ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_kullanicilar; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_kullanicilar ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_lokasyonlar; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_lokasyonlar ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_malzemeler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_malzemeler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_manuel_mudahale_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_manuel_mudahale_log ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_mrp_calculations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_mrp_calculations ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_mrp_rezerve; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_mrp_rezerve ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_mrp_state_global; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_mrp_state_global ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_mrp_state_order; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_mrp_state_order ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_operator_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_operator_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_operators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_operators ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_pending_flows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_pending_flows ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_rapido_bom; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_rapido_bom ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_recipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_session_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_session_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_sevk_satirlari; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_sevk_satirlari ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_sevkler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_sevkler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_stations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_stations ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_stok_hareketler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_stok_hareketler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_tedarikciler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_tedarikciler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_tedarikler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_tedarikler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_test_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_test_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_v15_31_silinen_hareketler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_v15_31_silinen_hareketler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_work_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_work_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_yedekler; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_yedekler ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_yetki_ayarlari; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uys_yetki_ayarlari ENABLE ROW LEVEL SECURITY;

--
-- Name: uys_work_orders wo_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wo_select ON public.uys_work_orders FOR SELECT TO authenticated USING (true);


--
-- Name: uys_work_orders wo_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wo_write ON public.uys_work_orders TO authenticated USING ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text, 'uretim_sor'::text]))) WITH CHECK ((public.current_user_role() = ANY (ARRAY['admin'::text, 'planlama'::text, 'uretim_sor'::text])));


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: objects chat_attachments_delete; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY chat_attachments_delete ON storage.objects FOR DELETE USING ((bucket_id = 'chat-attachments'::text));


--
-- Name: objects chat_attachments_insert; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY chat_attachments_insert ON storage.objects FOR INSERT WITH CHECK ((bucket_id = 'chat-attachments'::text));


--
-- Name: objects chat_attachments_read; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY chat_attachments_read ON storage.objects FOR SELECT USING ((bucket_id = 'chat-attachments'::text));


--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime_messages_publication WITH (publish = 'insert, update, delete, truncate');


--
-- Name: supabase_realtime pt_problemler; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.pt_problemler;


--
-- Name: supabase_realtime uys_acik_barlar; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_acik_barlar;


--
-- Name: supabase_realtime uys_active_work; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_active_work;


--
-- Name: supabase_realtime uys_bom_trees; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_bom_trees;


--
-- Name: supabase_realtime uys_chat_attachments; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_chat_attachments;


--
-- Name: supabase_realtime uys_chat_channels; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_chat_channels;


--
-- Name: supabase_realtime uys_chat_members; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_chat_members;


--
-- Name: supabase_realtime uys_chat_mentions; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_chat_mentions;


--
-- Name: supabase_realtime uys_chat_messages; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_chat_messages;


--
-- Name: supabase_realtime uys_chat_reactions; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_chat_reactions;


--
-- Name: supabase_realtime uys_checklist; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_checklist;


--
-- Name: supabase_realtime uys_customers; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_customers;


--
-- Name: supabase_realtime uys_durus_kodlari; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_durus_kodlari;


--
-- Name: supabase_realtime uys_fire_logs; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_fire_logs;


--
-- Name: supabase_realtime uys_hm_tipleri; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_hm_tipleri;


--
-- Name: supabase_realtime uys_izinler; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_izinler;


--
-- Name: supabase_realtime uys_kesim_planlari; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_kesim_planlari;


--
-- Name: supabase_realtime uys_kullanicilar; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_kullanicilar;


--
-- Name: supabase_realtime uys_logs; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_logs;


--
-- Name: supabase_realtime uys_malzemeler; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_malzemeler;


--
-- Name: supabase_realtime uys_mrp_rezerve; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_mrp_rezerve;


--
-- Name: supabase_realtime uys_notes; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_notes;


--
-- Name: supabase_realtime uys_operations; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_operations;


--
-- Name: supabase_realtime uys_operator_notes; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_operator_notes;


--
-- Name: supabase_realtime uys_operators; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_operators;


--
-- Name: supabase_realtime uys_orders; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_orders;


--
-- Name: supabase_realtime uys_recipes; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_recipes;


--
-- Name: supabase_realtime uys_sevkler; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_sevkler;


--
-- Name: supabase_realtime uys_stations; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_stations;


--
-- Name: supabase_realtime uys_stok_hareketler; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_stok_hareketler;


--
-- Name: supabase_realtime uys_tedarikciler; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_tedarikciler;


--
-- Name: supabase_realtime uys_tedarikler; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_tedarikler;


--
-- Name: supabase_realtime uys_work_orders; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_work_orders;


--
-- Name: supabase_realtime uys_yetki_ayarlari; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.uys_yetki_ayarlari;


--
-- Name: supabase_realtime_messages_publication messages; Type: PUBLICATION TABLE; Schema: realtime; Owner: -
--

ALTER PUBLICATION supabase_realtime_messages_publication ADD TABLE ONLY realtime.messages;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict fWOoABhpz5f1DzazkDhVRQsG9FYgBEE34VL9kdVYIY3aC4oaNjVp7QgE5N0mfID

