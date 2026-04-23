# UYS v3 v15.31 — Paket İçeriği

## Repo'da hangi dosya nereye gidecek?

| Paket Dosyası | Repo Konumu |
|---|---|
| `sql_v15_31_bar_model.sql` | `sql/sql_v15_31_bar_model.sql` **(YENİ)** |
| `barModel.ts` | `src/features/production/barModel.ts` **(YENİ)** |
| `master_schema.sql` | `master_schema.sql` (overwrite) |
| `audit-schema.cjs` | `scripts/audit-schema.cjs` (overwrite) |
| `stokTuketim.ts` | `src/features/production/stokTuketim.ts` (overwrite) |
| `DataManagement.tsx` | `src/pages/DataManagement.tsx` (overwrite) |
| `ProductionEntry.tsx` | `src/pages/ProductionEntry.tsx` (overwrite) |
| `Warehouse.tsx` | `src/pages/Warehouse.tsx` (overwrite) |
| `store_index.ts` | `src/store/index.ts` (overwrite — "store_" önekini sil!) |
| `types_index.ts` | `src/types/index.ts` (overwrite — "types_" önekini sil!) |
| `v15_31_patch_notes.md` | repo kökü veya istediğin yer |

**Not:** `store_index.ts` ve `types_index.ts` dosyalarının paketteki adı farklı çünkü ikisinin de ismi `index.ts` — kafa karışmasın diye klasör adını öneke aldım. Repo'ya kopyalarken sadece `index.ts` olarak kaydet.

## Deploy Sırası

**Kod + SQL aynı deploy'da gitmeli.** Detaylar için `v15_31_patch_notes.md` §7.

1. 10 dosyayı repo'ya kopyala (yukarıdaki konumlara)
2. `git add . && git commit -m "v15.31 — Bar Model Faz A"` (tam mesaj patch notes'ta)
3. `git push`
4. GitHub Actions build yeşil mi bekle
5. Canlı sayfa yüklendi mi kontrol et (Depolar → Açık Bar Havuzu tabı var mı?)
6. Supabase SQL Editor → `sql_v15_31_bar_model.sql` içeriğini çalıştır
7. Çıktıdaki Notice'ları oku: kaç kayıt silindi, kalan küsürat 0 mu
8. UYS'de sayfa yenile; 1 test üretim girişi yap → açık bar düşüyor mu

## Test Sonuçları (paketlemeden önce)

- `npx tsc --noEmit` → 0 hata ✅
- `npm run audit:columns` → 215 çağrı, 0 sorun ✅
- `npm run audit:schema` → 35 tablo, tüm listeler uyumlu ✅

## Rollback

SQL'deki audit tablosu (`uys_v15_31_silinen_hareketler`) silinen hareketleri kanıt olarak tutar. Sorun çıkarsa:

```sql
INSERT INTO public.uys_stok_hareketler
SELECT * FROM public.uys_v15_31_silinen_hareketler
ON CONFLICT (id) DO NOTHING;
```

Ve kodu önceki commit'e geri at. Detaylı açıklama patch notes §7'de.
