-- ═══ v15.14 — uys_yetki_ayarlari data kolon fix ═══
-- 18 Nisan 2026 — Column audit tespit etti:
--   Kod: .upsert({ id: 'rbac', data: localMap, updated_at: ... })
--   DB:  data kolonu yok → Supabase silent reject → RBAC özelleştirmeleri kaydedilmiyordu
--
-- Çözüm: Şemayı kod yapısına uyarla. jsonb kolon ekle, mevcut kolonlar kalsın.

ALTER TABLE public.uys_yetki_ayarlari
  ADD COLUMN IF NOT EXISTS data jsonb;

-- Doğrulama
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'uys_yetki_ayarlari'
ORDER BY ordinal_position;
