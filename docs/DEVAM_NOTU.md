# UYS v3 — DEVAM NOTU
**Tarih:** 16 Mayıs 2026
**Versiyon:** v16.87
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

### 15 Mayıs 2026 — Form Validation, Backup, Rollback, Bug Fix Round

#### Form validation — Zod adoption (15 sayfa)

Zod (^4.4.3) dependency'ye eklendi; client-side validation şemaları kritik form modal'larında devreye girdi. Inline `if (!x.trim())` pattern'i yerine `safeParse + toast.error(issues[0].message)` kullanılıyor.

**Kapsanan formlar:**
- `Procurement.tsx` (`TedarikFormModal`) — miktar finite + positive, teslim tarihi >= bugün
- Diğer 14 sayfada kademeli geçiş (Materials, Operators, Suppliers, Orders, Recipes, BomTrees, Stations, Operations, HmTipleri, Checklist, IeHazirlama, Login, Topbar PassModal, Procurement)

**Pattern:**
```ts
const schema = z.object({...})
const parsed = schema.safeParse({...})
if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return }
```

Şemalar şimdilik kullanıcı dosyalarının içinde inline; ileride yeniden kullanım gerekirse `src/lib/schemas/` altına çıkar.

#### Backup sistemi — 2 katmanlı, GitHub Actions çalışıyor

**Katman 1 — In-app JSON snapshot (mevcut):**
- `src/lib/backup.ts` + `src/pages/Backup.tsx` + `BackupRestoreModal.tsx`
- `uys_yedekler` tablosuna 28 tablo paralel okunarak `veri` jsonb sütununa yazılır
- Tetik: manuel (`/backup` Şimdi Yedekle) veya otomatik (admin login → `ensureDailyAutoBackup`, idempotent)
- 30 günden eski **otomatik** yedekler `cleanOldBackups(30)` ile silinir; manuel yedekler kalıcı

**Katman 2 — GitHub Actions cron (yeni: çalışıyor):**
- `backup.yml` `.github/workflows/` altına taşındı — daha önce repo kökündeydi, hiç tetiklenmiyordu
- `SUPABASE_DB_URL` tek-string secret yerine 4 ayrı: `SUPABASE_HOST`, `SUPABASE_USER`, `SUPABASE_PASSWORD`, `SUPABASE_DB`
- `supabase db dump` CLI bağımlılığı kaldırıldı, vanilla `pg_dump` kullanılıyor
- `postgresql-client-17` PGDG repo'sundan kuruluyor (server >= versiyon zorunluluğu)
- Session pooler endpoint (`aws-0-eu-central-1.pooler.supabase.com:5432`) — direct connection IPv6 GitHub Actions'ta çalışmıyor
- `pg_dumpall --roles-only` kaldırıldı (pooler multi-db connection desteklemiyor)
- Her UTC 03:00 (TR 06:00) `backups/<tarih>/schema.sql + data.sql` repo'ya commit ediliyor
- **İlk başarılı yedek:** `73c4ce1 Yedek 2026-05-15 (18:59 UTC)`

#### Rollback scriptleri (5 migration)

`sql/rollback/` klasörü oluşturuldu — son 5 migration'ın tersini yapan idempotent DROP/ALTER scriptleri:

| Migration | Rollback işlemi |
|---|---|
| `20260515_v16_85_operator_bolumler.sql` | `DROP COLUMN bolumler` |
| `20260515_v16_84_ie_hazirlama_durum.sql` | 5 kolon DROP (iptal/tamamlandi) |
| `20260515_v16_84_dev_files_committed_hash.sql` | `DROP COLUMN committed_hash` |
| `20260515_v16_83_ie_hazirlama.sql` | 5 tablo DROP CASCADE (child→parent) |
| `20260513_v16_79_malzeme_cinsi.sql` | `DROP COLUMN malzeme_cinsi` + yorumlu HM tipleri DELETE |

Her dosyada DATA LOSS uyarısı + 4 adımlı uygulama sırası (kod geri al → TEST → backup → PROD onayı). v16.79 HM tipleri DELETE komutu kapalı/yorumlu — operatör elle açmalı.

#### 23 bug fix kategorize

| Modül | Düzeltme |
|---|---|
| **mrp** | `.miktar || 1` → `.miktar ?? 1` (7 yer) — 0 değerinin meşru olduğu durumda hayalet enflasyon giderildi |
| **stok** | `stokTuketim.ts` D-1/D-2/D-3: division-by-zero guard, rezerv silme hata kontrolü, malkod boş guard |
| **permissions** | RBAC kontrol path'lerinde edge case fix'leri |
| **autoChain** | `fetchAll` ile 1000 satır cap'i kaldırıldı, `freshTedarikler` refresh, upsert hata kontrolü |
| **barModel** | Bar açma/tüketme edge case'leri |
| **dashboard** | G-3: `backupDays` NaN guard (geçersiz tarih → -1 fallback) + `backupWarn`'da negatif kapsanır |
| **reports** | G-5 `toplamUretim`/`bugunUretim` useMemo + G-6 `opData` O(n²)→O(n) (logs woId Map) + G-7 OEE `quality` `Math.max(0, ...)` |

**Önceki raporlara göre yapılan ek temizlikler:**
- `App.tsx` — gereksiz `useOrderStore` subscription + debug log'ları kaldırıldı
- `sessionGuard.ts` — `claimSession` aynı veri tekrar UPDATE'i `_lastClaim` memo ile engellendi
- `useAuth.ts` — gereksiz `console.info` temizlik
- `Reports.tsx` quality negatif → 0 sıkıştırma
- `ActiveWorkPanel.tsx`, `Messages.tsx` — `loadAll` dep array referansları `loadOwn`'a çevrildi

### 16 Mayıs 2026 — Zod yayılımı (35/41) — StokLog (`786f193`)

`src/pages/StokLog.tsx`:
- `_malkodSecimSchema`: kod (trim, min 1, max 50, boşluksuz) + ad (trim, min 1, max 200)
- `_aciklamaSchema`: trim, max 500 karakter
- `saveMalkod()` safeParse: malzeme değişimi (toplu/tekil) öncesi şema kontrolü — toplu malkod güncelleme yüksek etkili olduğu için kritik
- `saveNote()` safeParse: açıklama uzunluk kontrolü

Not: Bu dosyada miktar inline edit yok (salt-okunur gösterim). Warehouse.tsx miktar inline edit zaten `stokInlineEditSchema` (`59ba6a1`) ile korunuyor.

---

### 16 Mayıs 2026 — Zod yayılımı (34/41) — 8 sayfa daha (`59ba6a1`, `555edcc`, `a10aea8`, paralel session)

**Eklenen sayfalar:**
- `ProblemTakip.tsx` — ProblemFormModal save (`59ba6a1`)
- `Warehouse.tsx` — stok giriş formu + inline edit (`59ba6a1`)
- `Stations.tsx` — StationFormModal (`555edcc`)
- `Operations.tsx` — SimpleFormModal (`555edcc`)
- `DowntimeCodes.tsx` — kod/ad/kategori formu + Excel import (`555edcc`)
- `HmTipleri.tsx` — HmTipiModal (manuel `dogrula()` → Zod refactor) (`a10aea8`)
- `Login.tsx` — login formu (`a10aea8`)
- `Chat.tsx` — mesaj input (`a10aea8`)

---

### 16 Mayıs 2026 — Zod yayılımı (28/41) — Recipes (`c2cd71b`, paralel session)

`src/lib/validations/recipeSchemas.ts`:
- `rcKodSchema` (min 1, max 50)
- `mamulKodSchema` (min 1, max 100, boşluksuz)
- `recipeEditSchema` genişletildi: `rcKod` alanı (max 50, opsiyonel)

`src/pages/Recipes.tsx`:
- Inline rcKod / mamulKod showPrompt'ları safeParse ile korunuyor
- `RecipeEditor.save()` rcKod alanı da `recipeEditSchema` ile validate ediliyor

---

### 16 Mayıs 2026 — Materials schema kapsam genişlemesi (`85680df`)

`src/lib/validations/materialSchema.ts` — mevcut Zod şeması 5 alan → 8 alan:
- `kod` / `ad`: trim + max sınırı (50 / 200)
- **Yeni:** `tip` (min 1, max 50), `birim` (min 1, max 20), `hammaddeTipi` (opsiyonel, max 50)
- **Yeni cross-field refine:** tip Hammadde veya YarıMamul ise hammaddeTipi zorunlu
- `Materials.tsx` `MatFormModal.save` safeParse'a yeni alanlar geçirildi

Not: 26/41 sayacı değişmedi (Materials zaten Zod kullanıyordu) — sadece kapsam derinleşti.

---

### 16 Mayıs 2026 — Zod yayılımı (26/41)

**DataManagement.tsx** (`eab8f9d`) — paralel session
- `kullaniciSchema`: ad (zorunlu), kullaniciAd (min 2, alfanümerik), sifre (min 4) → KullaniciPanel
- `hmTipiSchema`: kod (zorunlu, max 20), ad (opsiyonel) → HmTipleriPanel
- (Bonus: Reports OEE Availability için `opTimeMap` (çalışma + duruş dk SUM))

**BomTrees.tsx** (`cf4faf4`)
- `_yenidenAdSchema` (trim min 1 max 200) → `renameBom` showPrompt
- `_yeniKodSchema` (trim min 1 max 100, boşluksuz) → inline "Mamul kodu değiştir" showPrompt
- (`_newBomSchema` zaten vardı, değişmedi)

**CuttingPlans.tsx** (`cf4faf4`) — zod import yeni eklendi
- `_kesimPlaniSchema` (hamMalkod + barCount) → `KesimOlusturModal.kaydet`
- `_seciliAdetSchema` (int 1-99999) → İE adet input
- `_artikKodSchema` (trim 3-50, boşluksuz) → `ArtikOneriModal.stokaGir` (akış disabled ama hazır)

**Shipment.tsx** (`cf4faf4`) — zod import yeni eklendi
- `_sevkKalemSchema` (malkod + malad + miktar)
- `_sevkSubmitSchema` (kalemler[] + not_ max 500 + tarih YYYY-MM-DD) → `SevkFormModal.save`
- `_sevkEditSchema = _sevkSubmitSchema.pick({kalemler, not_})` → `SevkEditModal.save`

---

### 16 Mayıs 2026 — Zod yayılımı (21/41)

**WorkOrders.tsx**
- `_iptalNedenSchema`: `z.string().trim().min(3).max(500)`
- `setDurum` iptal akışında `safeParse` → `nedenTrim` (önceki: sadece `!trim()`)
- (mpm hiçbir yerde inline edit edilmiyor — sadece okuma/hesaplama; ek validation gereksiz)

**IeHazirlama.tsx**
- `_uysSiparisNoSchema`: `OZD + 4 yıl + serbest` (min 7, max 50, boşluksuz)
  - Regex: `/^OZD\d{4}/` — prefix kontrol, sonrası serbest
- 3 noktada uygulandı:
  - `kaydetVeVer` (yeni İE form)
  - `BaslikDuzenleModal.handleSave` (geçmiş düzenleme)
  - `kaydetUysSiparisNo` (per-kalem; boş bırakma = temizleme, format'tan muaf)

**⚠ Commit anomalisi:** `git commit -m "feat: Zod yayılımı..."` çağrısı "nothing to commit" döndü; Zod değişiklikleri eşzamanlı `3120ba7` commit'ine (Reports O(n²)→O(n) ile birlikte, "perf/fix: Reports..." mesajıyla) dahil olarak push edildi. Kod main'de doğru, sadece commit mesajı misleading. Paralel Claude session veya ikinci makine commit'lemiş olabilir.

---

### 15-16 Mayıs 2026 — Güvenlik & Kalite Oturumu

#### Kod kalitesi fix'leri (commit serisi)

| Dosya | Guard | Açıklama |
|---|---|---|
| `barModel.ts` | B-1 | `satirTamamlandiMi()` — tüm WO'lar iptal/silindi ise `aktifWoVar=false` → `false` döner (önceki: yanlışlıkla `true`) |
| `barModel.ts` | B-2 | `barModelSync()` — `hamAdet = Math.min(hamAdet, 500)` üst limit; sınırsız DB insert riski kapatıldı |
| `stokHelper.ts` | C-1 | `addStokHareketiToplu()` — boş `malkod` satırı varsa sessiz filtre yerine explicit error döner |
| `stokHelper.ts` | C-2 | Batch insert loop'u hataları biriktirir, ilk hatada kesilmez |
| `stokKontrol.ts` | E-1 | `netStok()` O(n²)→O(n): `buildNetStokMap()` ile tek pass Map, tüm recursive çağrılarda O(1) lookup |
| `stokKontrol.ts` | E-3 | `dogrudanAltBilesenler()` — `(s.miktar ?? 0) > 0` guard; `birimIhtiyac=0` false-positive "stok yeterli" kapatıldı |

#### Zod form validation (4 modal)

Zod `^4.4.3` önceki oturumda eklenmişti; bu oturumda 4 form daha kapsandı:

| Sayfa / Modal | Schema alanları |
|---|---|
| `Suppliers.tsx` — `SupplierFormModal` | kod(max20), ad(required+max100), tel(max20+regex), email(max100+regex), adres(max200), not(max500) |
| `Operators.tsx` — `OprFormModal` | kod(required+max20+no-spaces regex), ad(min2+max100), bolum(required+max50), sifre(min4+max50) |
| `HmTipleri.tsx` — `HmTipiModal` | Client-side unique check: `mevcutKodlar` prop + `dogrula()` içinde `k === kodNormalized && k !== editingKod` karşılaştırması |
| `Checklist.tsx` — `CLFormModal` | baslik(required+max200), aciklama(max1000), atanan(max50), kategori(max50) + `maxLength` attr'ları |

#### RLS migrations — 4 tablo (TEST uygulandı, PROD onay bekliyor)

Tüm policy'ler `current_user_role()` (v16.0.0 Faz 1.1a) üzerine inşa edildi.
Kural: **Okuma → `authenticated`** | **Yazma → `admin` veya `planlama`**

| Migration | Tablolar | Policy'ler | Commit |
|---|---|---|---|
| `20260515_v16_86_rls_ie_hazirlama_rapido_bom.sql` | `uys_ie_hazirlama`, `uys_rapido_bom` | SELECT/INSERT/UPDATE/DELETE × 2 | `650c51a` |
| `20260515_v16_87_rls_recipes_bom_trees.sql` | `uys_recipes`, `uys_bom_trees` | SELECT/INSERT/UPDATE/DELETE × 2 | `591cc25` |

Önceki güvenlik oturumunda eklenenler (`84b240e`, `090bba8`):
- `uys_kullanicilar`, `uys_yetki_ayarlari` — v16.86
- `uys_work_orders`, `uys_stok_hareketler` — v16.87

**⚠ PROD için bekleyen:** `uys_ie_hazirlama`, `uys_rapido_bom`, `uys_recipes`, `uys_bom_trees` — onay alındığında MCP ile uygulanacak.

**Not:** `current_user_role()` → `auth_user_id` → Supabase Auth JWT zinciri gerektirir. Custom username/password login kullanan kullanıcılar (`anon` rol) bu RLS'den okuyamaz; Faz 1.1b auth link tamamlanmadan PROD'a uygulamak okuma erişimini kırar.

---

### 16 Mayıs 2026 — Servis Katmanı Taşıması Tamamlandı

`src/features/` tamamen boşaltıldı; tüm domain logic `src/services/` altında toplandı.

**Taşınan dosyalar (bu oturumda):**

| Kaynak | Hedef |
|---|---|
| `src/features/order/stateMachine.ts` | `src/services/orderService/stateMachine.ts` |
| `src/features/production/mrp.ts` + `mrpCache.ts` | `src/services/mrpService/` |
| `src/features/production/` (autoChain, cutting, stokKontrol, vb.) | `src/services/productionService/` |
| `src/lib/tedarikHelpers.ts` | `src/services/tedarikciService.ts`'e entegre |
| `src/lib/pendingFlow.ts` | `src/services/pendingFlowService.ts` |

**İkinci makine tarafından taşınan (aynı oturum):**

| Kaynak | Hedef |
|---|---|
| `src/lib/audit.ts` | `src/services/auditService.ts` |
| `src/lib/activityLog.ts` | `src/services/activityLogService.ts` |
| `src/lib/backup.ts` + `backup-parser.ts` | `src/services/backupService/` |
| `src/lib/sevk-utils.ts` | `src/services/sevkService.ts` |

**src/services/ altında 15 servis (+ _base/) — bu oturum sonu itibarıyla 18'e yükseldi (aşağıya bak):**

```
acikBarlarService.ts   activityLogService.ts  auditService.ts
backupService/         bildirimlerService.ts  chatService/
hmTipleriService.ts    izinlerService.ts      mrpService/
notesService.ts        orderService/          pendingFlowService.ts
productionService/     sevkService.ts         tedarikciService.ts
```

`src/features/` klasörü boş — silinebilir veya gelecek özellikler için tutulabilir.

---

### 16 Mayıs 2026 — Servis Katmanı Genişlemesi (5 yeni)

Sayfa inline Supabase çağrıları kaldırılmaya devam edildi; 5 yeni servis / servis modülü eklendi.

| Commit | Servis | İçerik |
|--------|--------|--------|
| `3e38993` | `testService/` | `testRun.ts` + `testRunner.ts` `src/lib/`'ten taşındı; relative import'lar `@/lib/*`'a düzeltildi; `TestMode.tsx` + `autoChain.ts` import'ları güncellendi |
| `3393f35` | `orderService/orderCrud.ts` | `createOrder`, `copyOrder`, `updateMrpDurum` — `Orders.tsx`'teki 4 direkt Supabase UPDATE/INSERT kaldırıldı |
| `1c7c7e1` | `sevkService.ts` (genişleme) | `calcSevkDurum`, `deleteSevk`, `createSevk`, `updateSevk` eklendi; `Shipment.tsx`'teki 12 inline çağrı kaldırıldı; stok silme pattern bug'ı düzeltildi (`id LIKE` → `aciklama LIKE`) |
| `90a8ba3` + `8085a63` | `workOrderService.ts` | WO durum geçişleri, log INSERT, stok tüketim, bar material kontrolü; `WorkOrders.tsx`'ten ~80 satır kaldırıldı |
| `cc9ebc3` | `productionEntryService/` | `kaydetUretimGirisi`, `duzenleUretimGirisi`, `startWork`, `stopWork` — `ProductionEntry.tsx` + `OperatorPanel.tsx` arasındaki ~100 satır kopya kod birleştirildi; `OperatorPanel`'deki eksik `auditUretimLog` çağrısı kapatıldı |

**src/services/ altında 18 servis (+ _base/):**

```
acikBarlarService.ts     activityLogService.ts    auditService.ts
backupService/           bildirimlerService.ts    chatService/
hmTipleriService.ts      izinlerService.ts        mrpService/
notesService.ts          orderService/            pendingFlowService.ts
productionEntryService/  productionService/       sevkService.ts
tedarikciService.ts      testService/             workOrderService.ts
```

---

### 16 Mayıs 2026 — Servis Taşıması Devamı + Bug Fix Round

#### Servis migrasyonları (devam)

| Commit | Değişiklik |
|--------|-----------|
| `9178928` | **Orders.tsx** — kalan 8 inline Supabase çağrısı `orderCrud.ts`'e taşındı: `updateOrderOncelik`, `updateOrderDurum`, `saveMrpCalculationSnapshot`, `deleteWorkOrders`, `createTedarikFromMrp`, `getOrderWorkOrderIds`, `insertOrderRow`. `Orders.tsx`'te artık hiç direkt `supabase.from('uys_orders/tedarikler/work_orders')` yok. |
| `2a51e4f` | **Procurement.tsx** — 7 inline Supabase çağrısı `tedarikciService`'e taşındı: `getTedarik`, `createTedarik`, `createTedariklerBulk` (Excel import — N insert → tek round-trip), `updateTedarik`, `deleteTedarik` (cascade: stok hareketi + sipariş mrp_durum). Cross-service bağımlılık `orderService.updateOrderMrpDurum` lazy import ile çözüldü (circular dep yok). |

#### Stok hesaplaması tek kaynağa indirgendi (`7d35503`)

**Problem:** 3 farklı stok agregasyon formülü vardı ve birbirinden sessizce ayrışıyordu:
- `lib/hammaddeHesap.ts:getStok` — bilinmeyen tip → **ignore**
- `productionService/stokKontrol.ts:buildNetStokMap` — bilinmeyen tip → **çıkış say**
- `pages/Warehouse.tsx` inline aggregation — bilinmeyen tip → **çıkış say**

`stokKontrol` ve `Warehouse` gereksiz stok düşürüyordu; `getStok` ile çelişiyordu.

**Çözüm:** `lib/hammaddeHesap.ts`'e `buildStokMap` eklendi — `getStok` ile aynı semantik (bilinmeyen → ignore). `stokKontrol.ts`'teki yerel `buildNetStokMap` + `netStok` helper'ları kaldırıldı, `buildStokMap` import edildi. `Warehouse.tsx` inline aggregation yerine `buildStokMap` kullanıyor.

Etkilenen dosyalar: `hammaddeHesap.ts`, `stokKontrol.ts`, `Warehouse.tsx` (3 dosya, +27/-28 satır)

#### Kesim planı duplicate prevention — iki katmanlı guard (`7dfbdca`)

**Kök sorun:** 2026-05-16 PROD'da 21 ham_malkod için mükerrer kayıt tespit edildi (örn. 6 plan ~16sn arayla 2 kez insert). `autoChain.ts` store snapshot (stale olabilir) kullanıyordu → `kesimPlanOlustur` boş `mevcutPlanlar` görüyordu → yeni `uid()` → `upsert onConflict:'id'` mükerreri yakalamıyordu.

**Katman 1 — autoChain.ts (caller-side):**
`kesimPlanOlustur` öncesi `cuttingPlans` store snapshot yerine DB'den fresh çekilir (`.neq durum, iptal`). Realtime sync gecikmesinden bağımsız.

**Katman 2 — cutting.ts:kesimPlanlariKaydet (service-side, son kalkan):**
Insert öncesi DB'de aynı `(ham_malkod, durum='bekliyor')` + farklı id var mı kontrol. Varsa SKIP + warn log. Defense-in-depth: caller fresh çekmeyi unutsa bile servis mükerreri DB-level engeller.

Etkilenen dosyalar: `productionService/autoChain.ts`, `productionService/cutting.ts` (2 dosya, +60/-2 satır)

#### Mükerrer kesim planı DB temizliği (PROD — MCP ile)

`7dfbdca` commit'i sonrası PROD'daki mükerrer kayıtlar MCP `execute_sql` ile temizlendi. Her `ham_malkod` grubu için en eski `id`'li kayıt korundu, diğerleri silindi. Temizlik sonrası duplicate sayısı 0'a düştü.

---

## Sıradaki görevler

1. ~~Refresh butonlarına `force: true` ekle~~ — **tamamlandı** (`8ca5a60`)
2. Normalize veri geçişi (kapsam belirsiz — ertelendi)
3. ~~Service katmanı Faz 3~~ — **tamamlandı** (7 sayfa, 2 servis genişlemesi)
4. ~~loadAll alias temizliği~~ — **tamamlandı** (`ed99229`)
5. ~~IeHazirlama durum geçişleri~~ — **tamamlandı** (`72d37e4`) — TEST + PROD onaylandı
6. ~~Backup workflow konum/secret refactor~~ — **tamamlandı** (`73c4ce1` ilk başarılı dump)
7. ~~Son 5 migration için rollback scriptleri~~ — **tamamlandı** (`1985167`)
8. ~~Zod adoption~~ — **TAMAMLANDI ✅ (35/41)**. Kalan dosyalar display-only / N/A: Dashboard, Reports, Logs, AuditLog, Backup, HammaddeRapor, DevSync, ActiveWorkPanel, TestPanel, TestMode.
9. ~~Servis katmanı taşıması~~ — **TAMAMLANDI ✅** (`features/` boş, 18 servis `src/services/` altında; workOrderService, productionEntryService, orderCrud, sevkService genişlemesi, testService taşıması dahil)
10. Servis şemalarının Zod ile birleştirilmesi (`tedarikciService.createTedarikci` vb.)
11. **RLS PROD onayı** — `uys_ie_hazirlama`, `uys_rapido_bom`, `uys_recipes`, `uys_bom_trees` (onay bekleniyor)
12. **Faz 1.1b auth link** — custom-login kullanıcılarının `auth_user_id` ile Supabase Auth'a bağlanması (RLS'nin tam çalışması için ön koşul)

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

---

### 17 Mayıs 2026 — Paralel Oturum (7 Terminal)

- v17.00 — Servis katmani Zod dogrulama: tedarikciService, orderCrud, workOrderService, productionEntryService, sevkService
- v16.88 — ALI EKBER AYYILDIZ (op_090) Supabase Auth baglandı — 89/89 operator tam
- RLS PROD: 4 tablo zaten uygulanmis (v16.86+v16.87)
- T5 MRP#19 stoktan ver: Orders.tsx'de zaten tamamlanmis
- T6 src/features/: zaten silinmis

#### Bekleyen
- Normalize veri gecisi (kapsam belirsiz — ertelendi)
