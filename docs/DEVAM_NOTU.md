# DEVAM_NOTU — UYS v3 Oturum Geçişi

## Son oturum: 5 May 2026 — 8 sürüm kapandı (v16.40 → v16.47)

| Ver | Konu | Durum |
|---|---|---|
| v16.40 | Multi-device DB-only Playwright (6 senaryo) | ✅ 18/18 green |
| v16.41 | F-21 idempotent fix + uys_mrp_calculations FK CASCADE | ✅ |
| v16.42 | İstek #20 KART RENAME altyapı (8 tablo cascade) | ✅ |
| v16.43 | İstek #21 Supabase Auth login + useAuth test mode bypass | ✅ |
| v16.44 | İE Modal UX (adet boş + draggable Pointer Events) | ✅ |
| v16.45 | TUR1-3F trg_recipe_op_sync (reçete UPDATE → açık WO senkron) | ✅ |
| v16.46 | IE-MultiSelectFilters (Orders.tsx) + IE-UYS-002 disiplin | ✅ saha |
| v16.47 | IE-StokDupGuard (trigger + 28 kayıt/2778 birim temizlik) | ✅ |

## Aktif altyapı

- **TEST**: cowgxwmhlogmswatbltz (Frankfurt)
- **PROD**: lmhcobrgrnvtprvmcito (Frankfurt)
- TEST + PROD şemalar senkron
- Aktif trigger: `trg_recipe_op_sync`, `trg_stok_hareket_dup_guard`
- Yedek: `uys_stok_hareketler_dup_temizlik_yedek` (28 satır, rollback için)

## Yarım kalan (sonraki oturumda)

1. **Frontend submit guard** (`Warehouse.tsx` Manuel Giriş/Çıkış modal): `submitting` state + disabled buton. DB güvenli, UX iyileştirme.
2. **Multi-filter Playwright spec** (07-multi-filter.spec.ts): saha kodu PROD'da çalışıyor; test debt.
3. **"Tedarik (otomatik onarım)" duplicate'leri** (sn_fark > 30): ayrı bug, ayrı sprint.

## Backlog

- İstek #18: fire → sipariş dışı İE
- İstek #19: MRP stoktan ver
- Bilgi Bankası §32.9'a v16.41-v16.47 girdileri
- UYS dışı: Libya, TL-İSG-017, Mavvo, GFB, COPQ, BSC v3

## IE-UYS-002 disiplin kuralları (5 May 2026'dan aktif)

- **§3.3 Spec yazımı:** ilk tur inline özet ~30-50 satır → onay → dosya. Hedef 120-180 satır.
- **§3.4** Max 2 kritik açık soru
- **§3.5** Aynı dosyayı 2. kez okuma
- **§5 KISIT:** kalite/hız/doğruluk asla feda edilmez

## Yeni Claude'a kritik kurallar

- **Buket oturum sonlandırma yetkisini kontrol eder** ("dur", "kapat", "yarın"). Claude oturum sonu önermez.
- **Sandbox build doğrulama** zip teslim öncesi şart
- **Supabase değişiklikleri MCP tools ile**, PowerShell SQL talimatı verme
- **UYS şifreleri konuşmada gösterilmez** (anon key OK, RLS koruyor)
- **Saha kodu PowerShell ile orchestrate ediliyor** (sandbox file tools yoksa) — pre-check + atomik replace, here-string `@'...'@` ile literal
- **Manuel test: `npm run dev`** (test mode değil) — `dev:test` auth bypass aktif
- **`.env` gerekli**: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
- **Memory limit 30/30 dolu** — yeni edit yapılamıyor, bu dosya context'tir.

## Ortam

- Repo: `$env:USERPROFILE\Documents\GitHub\ozler-uys-v3`
- Node v22.22.1 portable
- Playwright: 18/18 green spec'ler (01-auth, 02-ie, 03-mesaj, 04-multi-device, 05-modal-ux, 06-recipe-op-sync)
- WorkOrders.tsx zaten multi-select kullanıyor (MultiCheckDropdown referans pattern)

## Acil durum rollback

```sql
-- v16.45 trigger geri al
DROP TRIGGER IF EXISTS trg_recipe_op_sync ON uys_recipes;
DROP FUNCTION IF EXISTS fn_recipe_op_sync();

-- v16.47 trigger geri al + silinen 28 kaydı geri yükle
DROP TRIGGER IF EXISTS trg_stok_hareket_dup_guard ON uys_stok_hareketler;
DROP FUNCTION IF EXISTS fn_stok_hareket_dup_guard();
INSERT INTO uys_stok_hareketler SELECT * FROM uys_stok_hareketler_dup_temizlik_yedek;
```