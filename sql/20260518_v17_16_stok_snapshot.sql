-- ============================================================
-- Migration: v17.16 — Günlük Net Stok Snapshot
-- Tarih: 2026-05-18
-- TEST:  cowgxwmhlogmswatbltz — henüz uygulanmadı
-- PROD:  lmhcobrgrnvtprvmcito — henüz uygulanmadı
-- ============================================================
-- Amaç: İstenilen tarih için malkod bazında net stoku
--        uys_stok_snapshot tablosuna yazar.
--        Semantik buildStokMap (hammaddeHesap.ts) ile aynıdır:
--          giris            → +miktar
--          cikis/bar_acilis/rezerv → -miktar
--          diğer            → 0 (görmezden gel)
-- ============================================================

-- 1. Snapshot tablosu
CREATE TABLE IF NOT EXISTS public.uys_stok_snapshot (
    id              text                     NOT NULL,
    tarih           text                     NOT NULL,  -- YYYY-MM-DD
    malkod          text                     NOT NULL,
    malad           text,
    net_stok        numeric      DEFAULT 0,
    olusturuldu_at  timestamptz  DEFAULT now() NOT NULL,
    CONSTRAINT uys_stok_snapshot_pkey          PRIMARY KEY (id),
    CONSTRAINT uys_stok_snapshot_tarih_malkod  UNIQUE (tarih, malkod)
);

COMMENT ON TABLE public.uys_stok_snapshot
    IS 'Günlük net stok snapshot — al_stok_snapshot() RPC ile doldurulur.';

-- 2. Snapshot RPC fonksiyonu
--    Parametre: snapshot_tarihi (TEXT, YYYY-MM-DD, varsayılan: bugün)
--    Dönüş: JSON { snapshot_tarihi, malzeme_sayisi }
--
--    Aynı tarih için tekrar çalıştırılabilir (ON CONFLICT DO UPDATE).
CREATE OR REPLACE FUNCTION public.al_stok_snapshot(
    snapshot_tarihi text DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD')
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.al_stok_snapshot(text) TO authenticated;

-- Rollback notu:
-- DROP FUNCTION IF EXISTS public.al_stok_snapshot(text);
-- DROP TABLE IF EXISTS public.uys_stok_snapshot;
