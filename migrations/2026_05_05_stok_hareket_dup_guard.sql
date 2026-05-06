-- v16.47 — Stok hareketleri çift-tıklama duplicate önleme (kalıcı koruma)
-- TEST: cowgxwmhlogmswatbltz (uygulandı 5 May 2026)
-- PROD: lmhcobrgrnvtprvmcito (uygulandı 5 May 2026)
-- Geriye dönük temizlik: 28 kayıt (2778 birim) silindi, yedek tablo dolu
--
-- Pencere: 5 sn
-- Kapsam: SADECE manuel akış (wo_id IS NULL AND log_id IS NULL)
-- Davranış: sessiz skip (RETURN NULL), kullanıcı tek kayıt görür

CREATE INDEX IF NOT EXISTS uys_sh_dup_guard_idx 
  ON public.uys_stok_hareketler(malkod, updated_at DESC)
  WHERE wo_id IS NULL AND log_id IS NULL;

CREATE OR REPLACE FUNCTION public.fn_stok_hareket_dup_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Sistem-otomatik akışlar muaf (üretim/fire/rezerv)
  IF NEW.wo_id IS NOT NULL OR NEW.log_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 5 sn pencerede aynı (malkod, miktar, tip, aciklama) varsa SESSIZ SKIP
  IF EXISTS (
    SELECT 1 FROM public.uys_stok_hareketler
    WHERE malkod = NEW.malkod
      AND miktar = NEW.miktar
      AND tip    = NEW.tip
      AND COALESCE(aciklama,'') = COALESCE(NEW.aciklama,'')
      AND wo_id IS NULL AND log_id IS NULL
      AND updated_at >= NOW() - INTERVAL '5 seconds'
      AND id <> NEW.id
  ) THEN
    RAISE NOTICE 'Duplicate stok hareket bastirildi: % % %', NEW.malkod, NEW.miktar, NEW.tip;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stok_hareket_dup_guard ON public.uys_stok_hareketler;
CREATE TRIGGER trg_stok_hareket_dup_guard
BEFORE INSERT ON public.uys_stok_hareketler
FOR EACH ROW EXECUTE FUNCTION public.fn_stok_hareket_dup_guard();