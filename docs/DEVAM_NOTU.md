# UYS v3 — DEVAM NOTU
**Tarih:** 15 Mayıs 2026
**Versiyon:** v16.76
**Repo:** uzuniskender/ozler-uys-v3
**PROD:** lmhcobrgrnvtprvmcito | **TEST:** cowgxwmhlogmswatbltz (Frankfurt)

---

## Bu oturumda tamamlananlar

- v16.74 — Stok girişinde mrp_state_order + mrp_durum otomatik invalidate (2 DB trigger)
- v16.75 — MRP badge sadece gerçek eksik sayar (isOrderMrpPending false positive giderildi)
- v16.76 — Production build console ve debugger drop (vite.config.ts esbuild.drop)

### 15 Mayıs 2026 — Render Optimizasyonu & Hooks Düzeltmesi

**Lazy loading (route-level code splitting)**
- `App.tsx` — admin/operator sayfaları `React.lazy` + `Suspense` ile sarıldı; bundle boyutu düştü
- `loadAllStores.ts` — uygulama bootstrap'i ayrı modüle çıkarıldı (`sessionGuard.ts` ile birlikte)

**Store slice hooks (4 hook)**
- `b96b831` — `useStore` composite shim kaldırıldı; 5 dosya doğrudan slice hook'larına (`useStokStore`, `useOrderStore`, …) geçirildi
- `useAuth.ts` ve ilgili dosyalar slice hook kullanımı ile yeniden yazıldı

**Render optimizasyonu**
- `App.tsx` / `sessionGuard.ts` — gereksiz yeniden-render'ı kesen memo/callback düzenlemeleri

**Hooks crash fix**
- `ade44f1` — Topbar `syncedHesap` hesabı: koşullu `useEffect` çağrısı (Rules of Hooks ihlali) düzeltildi

---

### 15 Mayıs 2026 — API Abstraction / Service Katmanı

**Faz 1 — Scaffold** (`src/services/_base/`)
- `errors.ts` — `ServiceError` sınıfı + `wrap()`, `isGuestBlocked`, `isUniqueViolation`, `isForeignKeyViolation`
- `query.ts` — `applyIlikeArama`, `applyAktifFiltre`, `auditAlanlari` (overload), `norm.{kod,ad,optStr}`
- `README.md` — Türkçe kural seti + şablon + kapsam kararları

**Faz 2 — İlk servisler** (tümü `src/services/` + gerekirse `src/types/`)
- `notesService.ts` + `ekipNot.ts` → `uys_notes` (listNotes/getNote/createNote/updateNote/deleteNote)
- `tedarikciService.ts` + `tedarikci.ts` → `uys_tedarikciler` (not_ ↔ not köprüsü dahili)
- `acikBarlarService.ts` → `uys_acik_barlar` (listAcikBarlar/getAcikBar/hurdaGonder; barModel domain işlemleri dokunulmadı)
- `izinlerService.ts` + `izin.ts` → `uys_izinler` (createIzin/onaylaIzin/reddetIzin/deleteIzin)
- `bildirimlerService.ts` → `uys_bildirimler` (listBildirimler/createBildirim/okunduIsaretle/topluOkunduIsaretle/acikBildirimVarMi)

**Kapsam dışında bırakılanlar (bilinçli):**
- `store/index.ts` TABLE_MAP/mapper'ları — dokunulmadı
- `barModel.ts`, `mrpCache.ts`, `autoChain.ts`, `stokTuketim.ts` — domain layer, dokunulmadı
- `chatService.ts` — zaten servis konumunda, ayrı stil
- Sayfa içi inline query'ler — organik göç; yeni kodda servis-first

---

### 15 Mayıs 2026 — Service Katmanı Faz 3 (sayfa migrasyonları)

**Servis genişlemesi**
- `izinlerService.updateIzin` eklendi (`62b6e9e`)
- `acikBarlarService.updateHamMalkodKaskat` eklendi (`62b6e9e`)

**Sayfa migrasyonları** (inline Supabase → servis)
- `HelpNotesButtons.tsx` → `notesService` (`8b079b1`)
- `Topbar.tsx` → `bildirimlerService` (`28a059d`)
- `OperatorPanel.tsx` → `izinlerService` — 4 çağrı: izin onayla/reddet/sil + toplu (`d20e6c1`)
- `MRP.tsx` + `MamulCikisModal.tsx` → `bildirimlerService` (`4c9fc77`)
- `Suppliers.tsx` → `tedarikciService` — 3 çağrı: delete/update/create + try/catch (`ea7a9f7`)
- `Operators.tsx` → `izinlerService` — 5 çağrı: onayla/reddet/sil/update/create + try/catch (`baa01c4`)

**Slice migration artıkları**
- `ActiveWorkPanel.tsx`, `Messages.tsx` — kalan `useStore` shim referansları temizlendi

**Diğer**
- `queryCache.ts` + `loadOwn` TTL gate (30 sn) — tekrar yüklemeyi önler (`3d1c242`)
- `IeHazirlama.tsx` + `20260515_v16_83_ie_hazirlama.sql` — v16.83 yeni özellik (`a83611b`)

## Güvenlik oturumu tamamlananlar

- uys_dev_files + uys_session_memory → RLS aktif, sadece uzuniskender@gmail.com erişebilir
- uys_dev_files fazla kaydı temizlendi (.github/scripts/devsync.js silindi, 172/172 eşitlendi)
- Supabase MCP bağlantısı oturum sonunda kapatılıyor (Buket manuel)
- GitHub 2FA ✅ | Supabase 2FA ✅ | Windows otomatik kilit ✅

### 15 Mayıs 2026 — useStore Shim Kaldırma + Hooks Düzeltmesi

**Store build fix**
- `src/store/index.ts` — composite shim restore edildi (önceki commit'te tip tanımları ile ezilmişti)
- `src/store/loadAllStores.ts` — stub'dan gerçek `Promise.all([...loadOwn()...])` implementasyona geçildi
- `src/app.tsx` — Windows case-insensitive dosya sistemi yüzünden oluşan `App.tsx` duplicate'i git'ten kaldırıldı

**useStore shim Phase 3 — tam göç (5 dosya)**
- `Topbar.tsx`, `Sidebar.tsx`, `Orders.tsx`, `DataManagement.tsx`, `testRunner.ts`
- `useStore` → `useOrderStore`, `useProductionStore`, `useWarehouseStore`, `useAuthStore` slice hook'ları
- `testRunner.ts`'de `getStores()` yardımcı fonksiyonu eklendi (non-React context için)
- Sonuç: `grep -rn "\buseStore\b" src/` → 0 harici tüketici kaldı

**DevSync crash fix (Rules of Hooks)**
- `Topbar.tsx` — `&&` kısa-devre değerlendirmesi hook çağrılarını koşullu yapıyordu; her slice için ayrı `const` değişkeni + sonra `&&` boolean hesabı
- Crash: "Cannot read properties of undefined (reading 'length') — vendor-charts içinde"

**Refresh buton analizi (değişiklik yok — rapor)**
- `force: true` gereken 3 buton: `Topbar.tsx:252`, `ActiveWorkPanel.tsx:79`, `DataManagement.tsx:~1216`
- Backup/Logs/StokLog refresh butonları store cache kullanmıyor (doğrudan DB sorgusu) → etkilenmiyor

### 15 Mayıs 2026 — Oturum Devam Raporu (Faz 2)

Bu bölüm önceki oturum özetinin bıraktığı yerden itibaren yapılan çalışmaları kapsar.

#### Servis migrasyonları (devam)

| Commit | Değişiklik | Satır farkı |
|--------|-----------|-------------|
| `d20e6c1` | `OperatorPanel.tsx` → `izinlerService` (5 inline: onaylaIzin × 2, reddetIzin × 2, createIzin) | +13 / -10 |
| `4c9fc77` | `MRP.tsx` → `acikBildirimVarMi` + `createBildirim`; `MamulCikisModal.tsx` → `createBildirim` (loop) | +9 / -16 |

#### loadAll alias temizliği (`ed99229`)

`const loadAll = loadAllStores` satırları her bileşenin/hook'un tepesinden kaldırıldı; call site'lar doğrudan `loadAllStores()` çağrısına dönüştürüldü.

**17 dosya, 26 alias satırı silindi:**

| Dosya | Alias sayısı | Özel durum |
|-------|-------------|-----------|
| `DataManagement.tsx` | 6 | `store = { ..., loadAll: loadAllStores }` — `store.loadAll()` çağrıları korundu |
| `OperatorPanel.tsx` | 3 | — |
| `CuttingPlans.tsx` | 2 | — |
| `Orders.tsx` | 2 | `TamZincirButton` prop imzasından `loadAll` kaldırıldı |
| `WorkOrders.tsx` | 1 | `WODetailModal` destructuring'den `loadAll` kaldırıldı |
| `Topbar.tsx`, `useRealtime.ts`, `testRunner.ts`, `BomTrees.tsx`, `Dashboard.tsx`, `Materials.tsx`, `MRP.tsx`, `Procurement.tsx`, `Recipes.tsx`, `Reports.tsx`, `Shipment.tsx`, `TestMode.tsx` | 1'er | — |

#### Bugün değişen dosyalar (tüm oturum — `ade44f1`..`ed99229`)

33 dosya, 477 ekleme / 293 silme:

```
src/components/HelpNotesButtons.tsx      — notesService migration
src/components/MamulCikisModal.tsx       — bildirimlerService migration
src/components/layout/Topbar.tsx         — bildirimlerService + Rules of Hooks fix + alias temizliği
src/hooks/useRealtime.ts                 — alias temizliği
src/lib/queryCache.ts                    — yeni: TTL gate (30 sn isFresh)
src/lib/testRunner.ts                    — alias temizliği
src/pages/ActiveWorkPanel.tsx            — slice migration leftover
src/pages/BomTrees.tsx                   — alias temizliği
src/pages/CuttingPlans.tsx               — alias temizliği
src/pages/Dashboard.tsx                  — alias temizliği
src/pages/DataManagement.tsx             — alias temizliği (6 alias, store nesnesi)
src/pages/MRP.tsx                        — bildirimlerService migration + alias temizliği
src/pages/Materials.tsx                  — alias temizliği
src/pages/Messages.tsx                   — slice migration leftover
src/pages/OperatorPanel.tsx              — izinlerService migration + alias temizliği
src/pages/Operators.tsx                  — izinlerService migration
src/pages/Orders.tsx                     — alias temizliği + TamZincirButton imzası
src/pages/Procurement.tsx                — alias temizliği
src/pages/Recipes.tsx                    — alias temizliği
src/pages/Reports.tsx                    — alias temizliği
src/pages/Shipment.tsx                   — alias temizliği
src/pages/Suppliers.tsx                  — tedarikciService migration
src/pages/TestMode.tsx                   — alias temizliği
src/pages/WorkOrders.tsx                 — alias temizliği + WODetailModal imzası
src/services/acikBarlarService.ts        — updateHamMalkodKaskat eklendi
src/services/izinlerService.ts           — updateIzin eklendi
src/store/loadAllStores.ts               — in-flight dedup (_inflight)
src/store/use{Order,Production,Warehouse,Auth}Store.ts — queryCache TTL gate
src/types/izin.ts                        — IzinUpdate tipi genişletildi
docs/DEVAM_NOTU.md                       — bu notlar
```

#### Çözülen sorunlar

- **GitHub Actions build patlaması** — `store/index.ts` composite shim ezilmişti; restore + `loadAllStores.ts` stub düzeltildi + `src/app.tsx` case-duplikası kaldırıldı
- **DevSync crash** — `Topbar.tsx`'de `&&` kısa-devre Rules of Hooks ihlali; 4 bağımsız `const` + sonra boolean birleştirme
- **useStore shim** — tüm harici tüketiciler slice hook'larına geçirildi (`grep useStore src/` → 0 sonuç)
- **Inline Supabase** — `uys_izinler`, `uys_bildirimler`, `uys_tedarikciler`, `uys_notes` tabloları için servis katmanı; 7 sayfada toplam 20+ inline çağrı kaldırıldı
- **loadAll alias şişkinliği** — 17 dosyada tekrarlayan tek satır alias kaldırıldı; codebase `loadAllStores` doğrudan referans ediyor

### 15 Mayıs 2026 — Bug fix & Performans (2. oturum devamı)

| Commit | Değişiklik |
|--------|-----------|
| `393c832` | IeHazirlama.tsx — başlık düzenleme (sipariş no, müşteri, tarihler, not) |
| `a9333fd` | IeHazirlama.tsx — Excel export'a "Sipariş Bilgileri" sekmesi eklendi |
| `4dc32af` | src/pages/ global error handling — Shipment/Procurement/WorkOrders/ProductionEntry try/catch+toast |
| `c40b1c6` | autoChain.ts — fetchAll (A-5), freshTedarikler (A-7), upsert hata kontrolü (A-4) |
| `7ffc483` | mrp.ts case-insensitive eşleşme; Dashboard.tsx logByWoId O(1) map + aktifOrders/acikWOs useMemo |
| `df31b1f` | MRP.tsx — orderHasEksik sadece aktifOrders üzerinde döner (terminal/arşiv için senkron hesap kaldırıldı) |

## Sıradaki görevler

1. ~~Refresh butonlarına `force: true` ekle~~ — **tamamlandı** (`8ca5a60`)
2. Normalize veri geçişi (kapsam belirsiz — ertelendi)
3. ~~Service katmanı Faz 3~~ — **tamamlandı** (7 sayfa, 2 servis genişlemesi)
4. ~~loadAll alias temizliği~~ — **tamamlandı** (`ed99229`)
5. ~~IeHazirlama durum geçişleri~~ — **tamamlandı** (`72d37e4`) — TEST'e migration uygulandı, PROD onay bekliyor

---

## DevSync — iş akışı

- Oturum başında DEVAM_NOTU.md upload gerekmez — Claude Supabase den okur
- Değişiklik sonrası: DevSync → Claude Değişiklikleri → İndir → git push
- DevSync URL: /#/dev-sync

---

## Kritik kurallar

- Buket oturum kapatır — Claude önerme
- Supabase değişiklikleri MCP tools ile — PowerShell SQL talimatı verme
- TEST önce, PROD sonra (onay alarak)
- Şifreler konuşmada gösterilmez
- Multi-machine: ana makine iskender.uzun, tali Iskender
- npm PATH: C:\\Users\\iskender.uzun\\nodejs\\
- Pre-push hook: .git/hooks/pre-push.cmd formatında
- Sandbox build (npm ci + npm run build) zorunlu — patch zip den önce
- Tek takip dosyası: docs/DEVAM_NOTU.md — her oturum başında Claude Supabase den okur
- DevSync aktif: Claude repo dosyalarını Supabase den okur (uys_dev_files tablosu)
- Supabase MCP bağlantısı: geliştirme oturumu başında aç, bitince kapat
