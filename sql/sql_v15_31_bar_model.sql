-- ════════════════════════════════════════════════════════════════
-- UYS v3 — v15.31 BAR MODEL (Stok Hareketi Yeniden Tasarımı)
-- ════════════════════════════════════════════════════════════════
-- Uygulama: Supabase SQL Editor'de tek dosya çalıştırılır.
-- Idempotent — birden fazla çalıştırılabilir.
--
-- Yeni akış:
--  - Ham profil/boru/plaka için kesir stok düşümü KALDIRILDI.
--  - Kesim planı satırı tamamlanınca: bar_acilis (−1) + acik_bar_giris (kalan mm) yazılır.
--  - Açık bar havuzu: uys_acik_barlar tablosunda tekrar kullanılabilir kalan barlar.
--
-- Stok hareket tipi aralığı (uys_stok_hareketler.tip):
--   'giris', 'cikis'           (mevcut — tedarik, yarı mamul üretim, sarf)
--   'bar_acilis'               (yeni — ham bardan −1, tip!='giris' olduğu için
--                               mevcut stok hesaplarında otomatik çıkış sayılır)
--
-- Açık bar havuzu (artık barlar) uys_stok_hareketler'de izlenmez;
-- ayrı tabloda (uys_acik_barlar) tutulur. Ham malkod bakiyesini etkilemez.

-- ════ 1. AÇIK BAR HAVUZU ════

CREATE TABLE IF NOT EXISTS public.uys_acik_barlar (
  id text PRIMARY KEY,
  ham_malkod text NOT NULL,                -- kaynak ham malzeme (örn. BORU 6000 MM)
  ham_malad text,
  uzunluk_mm numeric NOT NULL DEFAULT 0,   -- bu açık barın kalan uzunluğu
  kaynak_plan_id text,                      -- uys_kesim_planlari.id
  kaynak_satir_id text,                     -- satir.id
  bar_index integer DEFAULT 0,              -- satir içinde kaçıncı bar (hamAdet>1 için)
  olusma_tarihi text,
  durum text NOT NULL DEFAULT 'acik',       -- 'acik' | 'tuketildi'
  tuketim_log_id text,                      -- tüketildiyse hangi üretim log'u ile
  tuketim_tarihi text,
  not_ text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acik_barlar_malkod ON public.uys_acik_barlar(ham_malkod);
CREATE INDEX IF NOT EXISTS idx_acik_barlar_durum ON public.uys_acik_barlar(durum);
CREATE INDEX IF NOT EXISTS idx_acik_barlar_plan ON public.uys_acik_barlar(kaynak_plan_id);

-- Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.uys_acik_barlar;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ════ 2. GÖÇ — Küsüratlı Stok Hareketleri TEMİZLEME ════
-- Buket kararı (22 Nis): Sil, sıfırdan başla.
-- Sadece bar-model'e giren Hammaddelerin küsüratlı çıkışları silinir.
-- Korunan kayıtlar:
--   - Tedarik kaynaklı (id LIKE 'ted-%')  [idempotent, tam sayı]
--   - Tam sayı miktarlı kayıtlar (manuel sayım, açılış)
--   - Mamul/YarıMamul giriş hareketleri (üretim kanıtı)
--
-- NOT: Bu blok sadece ilk kurulumda çalıştırılır. Tekrar çalıştırıldığında
-- zaten silinmiş olduğu için no-op olur.

-- Güvenlik kontrolü: Tablonun var olduğundan emin ol
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='uys_stok_hareketler') THEN
    RAISE NOTICE 'uys_stok_hareketler yok — migration atlandı';
    RETURN;
  END IF;
END $$;

-- Silme öncesi audit tablosu (geri almak için)
CREATE TABLE IF NOT EXISTS public.uys_v15_31_silinen_hareketler AS
SELECT * FROM public.uys_stok_hareketler WHERE false;

-- Aday satırları audit'e kopyala (idempotent — duplicate yazmaz)
INSERT INTO public.uys_v15_31_silinen_hareketler
SELECT s.* FROM public.uys_stok_hareketler s
WHERE
  -- Sadece bar-model'e giren malzemeler (ham + uzunluk>0)
  s.malkod IN (
    SELECT m.kod FROM public.uys_malzemeler m
    WHERE m.tip = 'Hammadde' AND COALESCE(m.uzunluk, 0) > 0
  )
  -- Küsüratlı miktar (0.33 gibi)
  AND MOD(s.miktar::numeric, 1) <> 0
  -- Çıkış hareketleri (orantılı düşümden gelen)
  AND s.tip = 'cikis'
  -- Tedarik kaynaklı değil (id ted- ile başlamıyor) — korunur
  AND s.id NOT LIKE 'ted-%'
  -- Zaten audit'te yoksa
  AND NOT EXISTS (SELECT 1 FROM public.uys_v15_31_silinen_hareketler a WHERE a.id = s.id);

-- Silinecek kayıt sayısını raporla
DO $$
DECLARE adet integer;
BEGIN
  SELECT COUNT(*) INTO adet FROM public.uys_v15_31_silinen_hareketler;
  RAISE NOTICE 'v15.31 Göç — %s adet küsüratlı çıkış kaydı audit tablosuna alındı ve silinecek', adet;
END $$;

-- Gerçek silme işlemi
DELETE FROM public.uys_stok_hareketler
WHERE id IN (SELECT id FROM public.uys_v15_31_silinen_hareketler);

-- ════ 3. DOĞRULAMA ════

DO $$
DECLARE
  kalan_kusurat integer;
  acik_bar_tablo boolean;
BEGIN
  SELECT COUNT(*) INTO kalan_kusurat
  FROM public.uys_stok_hareketler s
  WHERE
    s.malkod IN (
      SELECT m.kod FROM public.uys_malzemeler m
      WHERE m.tip = 'Hammadde' AND COALESCE(m.uzunluk, 0) > 0
    )
    AND MOD(s.miktar::numeric, 1) <> 0
    AND s.tip = 'cikis';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='uys_acik_barlar'
  ) INTO acik_bar_tablo;

  RAISE NOTICE 'v15.31 Doğrulama — uys_acik_barlar tablosu: %', CASE WHEN acik_bar_tablo THEN 'VAR ✓' ELSE 'YOK ✗' END;
  RAISE NOTICE 'v15.31 Doğrulama — bar-model HM için kalan küsüratlı çıkış: % (0 olmalı)', kalan_kusurat;
END $$;

-- ════ 4. GERİ ALMA (ACIL DURUM) ════
-- Eğer migration sonrası geri almak istersen:
--   INSERT INTO public.uys_stok_hareketler
--   SELECT * FROM public.uys_v15_31_silinen_hareketler
--   ON CONFLICT (id) DO NOTHING;
-- Ve audit tablosunu bırak — kanıt olarak kalsın.
