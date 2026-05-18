-- ============================================================
-- Migration: v17.15 — Stok Hareketi Arşivleme
-- Tarih: 2026-05-18
-- TEST:  cowgxwmhlogmswatbltz — 2026-05-18
-- PROD:  lmhcobrgrnvtprvmcito — 2026-05-18
-- ============================================================
-- Amaç: 1 yıldan eski uys_stok_hareketler kayıtlarını
--        uys_stok_hareketler_arsiv tablosuna taşır.
--        Bakiye konsolidasyonu sayesinde net stok hesabı bozulmaz.
-- ============================================================

-- 1. Arşiv tablosu
CREATE TABLE IF NOT EXISTS public.uys_stok_hareketler_arsiv (
    id             text                     NOT NULL,
    tarih          text,
    malkod         text,
    malad          text,
    miktar         numeric      DEFAULT 0,
    tip            text         DEFAULT 'giris',
    log_id         text,
    wo_id          text,
    aciklama       text,
    updated_at     timestamptz  DEFAULT now(),
    test_run_id    text,
    rezerv_order_id text,
    tedarik_id     text,
    arsivlendi_at  timestamptz  DEFAULT now() NOT NULL,
    CONSTRAINT uys_stok_hareketler_arsiv_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.uys_stok_hareketler_arsiv
    IS 'uys_stok_hareketler arşivi — arsivle_stok_hareketleri() RPC ile doldurulur.';

-- 2. Arşivleme RPC fonksiyonu
--    Parametre: kesim_tarihi (TEXT, YYYY-MM-DD, varsayılan: bugün - 1 yıl)
--    Dönüş: JSON { arsivlendi, konsolide, kesim_tarihi }
--
--    Mantık:
--      a) tarih < kesim_tarihi olan kayıtları arsiv tablosuna kopyala
--      b) Her malkod için eski kayıtların net bakiyesini hesapla
--      c) Net ≠ 0 ise kesim_tarihi tarihli konsolidasyon hareketi ekle
--      d) Eski kayıtları sil
--
--    Konsolidasyon sayesinde stok hesabı: eski kayıtlar kalktıktan sonra
--    konsolidasyon hareketi doğru net stoku temsil eder.
CREATE OR REPLACE FUNCTION public.arsivle_stok_hareketleri(
    kesim_tarihi text DEFAULT to_char(CURRENT_DATE - INTERVAL '1 year', 'YYYY-MM-DD')
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

    -- b-c) Bakiye konsolidasyonu: her malkod için net hesapla ve kaydet
    --      Semantik: buildStokMap (hammaddeHesap.ts) ile birebir aynı
    --        giris → +miktar
    --        cikis / bar_acilis / rezerv → -miktar  (bar_acilis stoku düşürür)
    --        diğer → 0 (görmezden gel)
    FOR v_malkod, v_malad, v_net IN
        SELECT
            malkod,
            -- En son görülen ad'ı al (ORDER BY tarih DESC → first_value)
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
            -- Deterministik ID: ikinci çalıştırmada ON CONFLICT silently skip
            'arsiv-kons-' || md5(v_malkod || kesim_tarihi),
            kesim_tarihi,          -- kesim günü tarihli (< değil, = → silinmez)
            v_malkod,
            v_malad,
            abs(v_net),
            CASE WHEN v_net > 0 THEN 'giris' ELSE 'cikis' END,
            'Arşivleme bakiye konsolidasyonu — ' || kesim_tarihi
        )
        ON CONFLICT (id) DO NOTHING;

        konsolide_sayisi := konsolide_sayisi + 1;
    END LOOP;

    -- d) Eski kayıtları sil (konsolidasyon kayıtları tarih = kesim_tarihi → silinmez)
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

GRANT EXECUTE ON FUNCTION public.arsivle_stok_hareketleri(text) TO authenticated;

-- Rollback notu:
-- Geri alma: arsivden geri yükle + konsolidasyon kayıtlarını sil
-- INSERT INTO uys_stok_hareketler SELECT id,tarih,malkod,malad,miktar,tip,log_id,wo_id,aciklama,updated_at,test_run_id,rezerv_order_id,tedarik_id FROM uys_stok_hareketler_arsiv WHERE arsivlendi_at > '<arsivleme_zamani>';
-- DELETE FROM uys_stok_hareketler WHERE id LIKE 'arsiv-kons-%';
