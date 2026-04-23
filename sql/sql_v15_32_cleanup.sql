-- ════════════════════════════════════════════════════════════════
-- UYS v3 — v15.32 BAR MODEL TEMİZLİK (v15.31 sonrası kalıntı)
-- ════════════════════════════════════════════════════════════════
-- Uygulama: Supabase SQL Editor'de tek dosya çalıştırılır.
-- Idempotent — tekrar çalıştırılabilir, no-op olur.
--
-- v15.31 göçü eski küsüratlı kayıtları temizledi.
-- Ama OperatorPanel.tsx / WorkOrders.tsx / CuttingPlans.tsx o pakette kaçtığı
-- için kullanıcılar v15.31 deploy'u sonrasında da OperatorPanel'den üretim girince
-- küsüratlı 'cikis' kayıtları yazılmaya devam etmiş (örn. mobvxm630l6xcb).
--
-- Bu script: v15.31 audit tablosundaki kritere uyan, ama v15.31 göçünden SONRA
-- yazılan küsüratlı çıkış kayıtlarını audit'e alıp siler.

-- ════ 1. AUDIT TABLOSU (YOKSA OLUŞTUR) ════
-- v15.31 zaten oluşturmuş olmalı; güvenlik için IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.uys_v15_31_silinen_hareketler AS
SELECT * FROM public.uys_stok_hareketler WHERE false;

-- ════ 2. KALAN KÜSÜRATLARI AUDIT'E AL ════

INSERT INTO public.uys_v15_31_silinen_hareketler
SELECT s.* FROM public.uys_stok_hareketler s
WHERE
  s.malkod IN (
    SELECT m.kod FROM public.uys_malzemeler m
    WHERE m.tip = 'Hammadde' AND COALESCE(m.uzunluk, 0) > 0
  )
  AND MOD(s.miktar::numeric, 1) <> 0
  AND s.tip = 'cikis'
  AND s.id NOT LIKE 'ted-%'
  AND NOT EXISTS (SELECT 1 FROM public.uys_v15_31_silinen_hareketler a WHERE a.id = s.id);

-- ════ 3. SİL ════

DO $$
DECLARE adet integer;
BEGIN
  SELECT COUNT(*) INTO adet FROM public.uys_v15_31_silinen_hareketler
  WHERE id IN (SELECT id FROM public.uys_stok_hareketler
               WHERE MOD(miktar::numeric, 1) <> 0 AND tip = 'cikis');
  RAISE NOTICE 'v15.32 Temizlik — % adet kalıntı küsüratlı çıkış siliniyor', adet;
END $$;

DELETE FROM public.uys_stok_hareketler
WHERE id IN (SELECT id FROM public.uys_v15_31_silinen_hareketler);

-- ════ 4. DOĞRULAMA ════

DO $$
DECLARE kalan_kusurat integer;
BEGIN
  SELECT COUNT(*) INTO kalan_kusurat
  FROM public.uys_stok_hareketler s
  WHERE
    s.malkod IN (SELECT m.kod FROM public.uys_malzemeler m
                 WHERE m.tip = 'Hammadde' AND COALESCE(m.uzunluk, 0) > 0)
    AND MOD(s.miktar::numeric, 1) <> 0
    AND s.tip = 'cikis';
  RAISE NOTICE 'v15.32 Doğrulama — kalan küsüratlı çıkış: % (0 olmalı)', kalan_kusurat;
END $$;
