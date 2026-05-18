# UYS v3 — DEVAM NOTU
**Tarih:** 18 Mayıs 2026
**Versiyon:** v17.15
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
10. ~~Servis şemalarının Zod ile birleştirilmesi~~ — **TAMAMLANDI ✅** (`8e3af34` v17.00 — 5 servis)
11. ~~**RLS PROD onayı**~~ — **TAMAMLANDI ✅** (v16.86+v16.87 uygulanmış)
12. ~~**Faz 1.1b auth link**~~ — **TAMAMLANDI ✅** (v16.88 — 89/89 operatör)
13. **mrpEngine Faz 3** — karar noktaları (satın alma teklifi, acil üretim) akışı
14. **ActiveWorkPanel v2 test** — istasyon/bölüm gruplama görünümü PROD'da doğrulama

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

### 17 Mayıs 2026 — Paralel Oturum (7 Terminal) + Akşam Oturumu

#### Gün boyunca tamamlananlar

**v16.88 — Auth link** (`c573904`)
- ALİ EKBER AYYILDIZ (op_090) Supabase Auth'a bağlandı — 89/89 operatör tam
- RLS PROD: `uys_ie_hazirlama`, `uys_rapido_bom`, `uys_recipes`, `uys_bom_trees` — zaten uygulanmış (v16.86+v16.87)

**v17.00 — Servis katmanı Zod giriş doğrulama** (`8e3af34`, `28e5ef2`)
- `tedarikciService`, `orderCrud`, `workOrderService`, `productionEntryService`, `sevkService` — tüm create/update fonksiyonları Zod `safeParse` ile korundu
- T5 MRP#19 stoktan ver: `Orders.tsx`'de zaten tamamlanmış
- T6 `src/features/`: zaten silinmiş

**v17.01 — DevSync v1.3 + mrpEngine saf fonksiyon katmanları** (`f7c66db`)
- `DevSync.tsx`: `backups/` alt klasörü yükleme dışında bırakıldı (yedek SQL dosyaları Supabase'e push edilmiyordu)
- `mrpService/mrpEngine.ts` oluşturuldu: 339 satır — saf fonksiyon katmanları; `mrp.ts`'ten iş mantığı ayrıştırıldı

**v17.02 — İstek #18 fire telafisi İE** (`28e5ef2`)
- `WorkOrders.tsx` — fire tespitinde telafi İE (iş emri) oluştur akışı (+19 satır)
- `workOrderService.ts` — `createTelafİE` fonksiyonu Zod doğrulamalı (+60 satır)

**v17.03 — mrpEngine Faz 2** (`99ef8c8`)
- `mrpEngine.ts` +147 satır: cutting plan override (mevcut plan varsa güncelle) + multi-sipariş agregasyonu
- `mrp.ts`'e bağımlı olmayan bağımsız hesaplama yolu; test edilebilir saf fonksiyonlar

**v17.04 — ActiveWorkPanel v2** (`ce1474b`)
- `ActiveWorkPanel.tsx` 293 ekleme / 64 silme — tam yeniden yazım:
  - Progress bar (tamamlanan/toplam adet oranı) her iş emri satırında
  - İstasyon ve bölüm bazlı gruplama görünümü
  - Ortalama ilerleme hesabı (bölüm/istasyon toplamı)

**v17.05 — StokLog sayfalama** (`3bf5d2e`)
- `StokLog.tsx` +53 / -11 satır: filtreler artık client-side değil server-side push-down
- Sayfa sayfalama (pagination) eklendi — büyük `uys_stok_hareketler` sorgularında bellek ve gecikme azaldı

**v17.06 — Dashboard: tamamlanma yakın İE rengi + Bugün Üretim KPI**
- `Dashboard.tsx` — `aktifKartlar`'a `yakin` flag eklendi: `pct >= 90 && !uzunAcik && !durgun`
- Aktif Çalışmalar panel başlığına `✓ N tamamlanıyor` badge (emerald) eklendi
- Tamamlanmaya yakın kartlar yeşil-emerald border/bg ile ayrıştırıldı; progress bar emerald renk
- KPI grid'e "Bugün Üretim" kartı eklendi (`logs.tarih === today` toplam adet); grid `lg:grid-cols-7`'ye genişletildi

#### sql/ ve master_schema.sql güncelleme (bu oturum)

**sql/ migration durumu:**
Bugün (17 Mayıs) DB şema değişikliği YOK — v17.01–v17.06 tamamen TypeScript katmanında.
Son migration: `20260516_v16_89_simplify_stok_invalidate_trigger.sql`

**master_schema.sql yenilendi (2026-04-17 → 2026-05-17):**
`backups/2026-05-17/schema.sql` (pg_dump 17.10) bazlı tam yeniden yazım:
- 50 tablo (önceki 25 → chat, MRP cache, IE hazırlama, DevSync, audit, vb.)
- 22 public fonksiyon (set_updated_at, compute_order_state, invalidate_mrp_*, fn_stok_*, cascade, vb.)
- 30+ updated_at trigger + iş mantığı triggerları
- 2 view (v_stok_anlik, v_hammadde_tuketim)
- order_state enum tipi
- RLS policy'ler (allow_all, admin_only, authenticated_select, admin_write grupları)

#### v17.07 — Vitest unit testleri: barModel, fireTelafi, cutting

**Eklenen test dosyaları:**
- `src/services/productionService/barModel.test.ts` — 15 test
  - `isBarMaterial`, `isBarMaterialByKod`, `barAcilisStokId`, `acikBarKayitId`, `acikBarHavuzuToplamMm`
  - Supabase + utils vi.mock ile izole edildi
- `src/services/productionService/fireTelafi.test.ts` — 10 test
  - Guard kontrolleri: qty<1, telafiWoId, null WO → null dönüş
  - `fireTelafiAkisi` hata mesajları + başarılı tek-WO yolu
  - `topluFireTelafi` filtreleme mantığı
- `src/services/productionService/cutting.pure.test.ts` — 8 test
  - `getParcaBoy`: uzunluk / boy / min(boy,en) / fallback (regex bozuk → 0)
  - `getHamBoy`: uzunluk / max(boy,en) / ad'dan MM parse

**Toplam birim testi:** 111 (önceki 78 → +33) — tümü yeşil

#### Bekleyen
- Normalize veri geçişi (kapsam belirsiz — ertelendi)

---

### 17 Mayıs 2026 — Akşam Oturumu (v17.08–v17.09)

#### Bu oturumda tamamlananlar

**Procurement gecikme kolonu**
- `Procurement.tsx` — `teslimTarihi < today() && !geldi` koşulunda kırmızı `⚠ Gecikti` badge
- Filtre listesine "Geciken" seçeneği (`text-red`) eklendi
- Tablo başlığına "Gecikme" kolonu eklendi (Teslim ile Durum arasında)

**Operators bölüm gruplama**
- `Operators.tsx` — toggle buton: liste ↔ bölüm görünümü
- `bolumStats` useMemo: `activeWork.tarih === today()` cross-reference ile o gün çalışan sayısı
- Bölüm görünümünde her kart: toplam / aktif / bugün çalışan operatör sayısı
- **Operators izin takvimi** (`cee1f74`): bu hafta onaylı izinli operatörler amber badge + bölüm kart vurgusu

**E2E spec 03-problem-takip**
- `tests/e2e/specs/03-problem-takip.spec.ts` oluşturuldu
- Akış: problem oluştur → D4 kök neden + D5 kalıcı çözüm → "Kapandı olarak işaretle" → satır yeşil doğrula
- `tests/e2e/helpers/cleanup.ts` — `pt_problemler` için iki temizleme satırı: `col: 'id'` + `col: 'problem'` (UI kayıtları UUID id alıyor)
- Fix: `getByRole('button', { name: 'Ekle', exact: true })` — has-text case-insensitive false match düzeltildi

**Chat PDF inline önizleme (v15.20)** (`cee1f74`)
- `AttachmentView` — `application/pdf` için `<embed>` ile 320px inline önizleme
- Resim/diğer dosya davranışı değişmedi; PDF'e indir ikonu eklendi

**Diğer commitler (kullanıcı)**
- `81ad35e` — Reports Gecikme tab genişletme v17.08
- `d7817f7` — Procurement tedarikci bazlı gruplama / Liste+Tedarikçi toggle v17.08
- `50df278` — src/lib dead code temizliği (kullanılmayan export + constants.ts silindi) v17.09
- `a70af58` — Dashboard haftalık üretim trendi mini widget v17.09

---

### 17 Mayıs 2026 — Gece Oturumu (v17.08 devamı)

**Dashboard "Bugün İzinli Operatörler" widget** (commit `5a0d24f`)
- `bugunIzinliGruplanmis` useMemo: bugün onaylı (`onaylandi`) izinleri bölüm bazında gruplar, alfabetik sıralar
- KPI grid `lg:grid-cols-7` → `lg:grid-cols-8`; 8. KPI kartı: 🏖 Bugün İzinli — izinli sayısı, `N bölüm` / `tam kadro` alt satırı, `/operators` link
- "Bugün İzinli / Raporlu" panel → "Bugün İzinli Operatörler": flat liste → bölüm başlıklı gruplu layout (bölüm chip + kişi sayısı + tür badge + saat aralığı)
- Commit anomalisi: Dashboard.tsx değişiklikleri bu makinede `git add` + `git commit` beklerken ikinci makine aynı diff'i `5a0d24f` içinde push etti; pre-commit hook pull yaptı → local diff temizlendi

**İkinci makine commit'leri (aynı gece, origin/main'e geldi)**
- `5a4d8bc` — Operations istatistik kolonları + detay paneli v17.08
- `5a0d24f` — Reports OEE tab: haftalık trend + istasyon bar chart + %85 hedef çizgisi v17.10
- `31b5c02` — Stations kapasite istatistikleri + detay paneli v17.12

---

### 17 Mayıs 2026 — Gece/Sabah Oturumu (v17.09–v17.14)

#### T1 commit'leri (bu oturum sırasında origin/main'e geldi)

| Commit | Değişiklik |
|--------|-----------|
| `c9e6346` | AuditLog kullanıcı dropdown + çoklu olay filtresi + Excel export v17.09 |
| `84bb0c2` | Reports DuruşAnalizi tab — pie chart + istasyon bar chart + haftalık trend v17.10 |
| `6773f09` | Logs aktivite özeti — son 7 gün v17.06 |
| `6bdf696` | Logs aktivite özeti — üretim/fire tip dağılımı + operators dep v17.10 |
| `0499982` | Backup sayfası — boyut ort, zamanlama durumu kartı, son 5 yedek paneli v17.12 |
| `0a45ca1` | HmTipleri malzeme sayısı + toplam stok + min stok altı istatistiği v17.13 |
| `6915285` | OperatorPanel Günlük Hedef göstergesi + ilerleme bar v17.13 |
| `2dc06ee` | OperatorPanel günlük hedef göstergesi — ilerleme bar + tahmini bitiş saati v17.13 |
| `d72fc2e` | ProductionEntry Şablondan Yükle — son 3 giriş şablon listesi v17.13 |
| `ba5b2f5` | DowntimeCodes kodId eşleşmesi düzelt + son 5 kullanım detay paneli v17.14 |
| `cd51246` | Reports İstasyonPerf tab — OEE karşılaştırma + fire oranı + haftalık trend v17.10 |
| `7918281` | Reports istperf — OEE bileşenler bar + kalite trend + mini bar v17.07 |

#### Bu oturumda yapılanlar (T0)

**DowntimeCodes detay paneli** (`6e99bf0`)
- `DowntimeCodes.tsx` — sağdan kayan sabit panel: Kullanım/Toplam/Ort. KPI kartları + istasyon dağılımı progress barları
- Satır tıklandığında `selectedKod` state ile panel açılır, X ile kapanır

**AuditLog React Fragment fix** (`28bf273`)
- `rows.map()` içinde anonim `<>` → `<Fragment key={row.id}>` — React key uyarısı giderildi
- Dört özellik (kullanıcı filtre, çoklu olay seçim, tarih aralığı, Excel export) önceden tam uygulanmıştı

#### Doğrulanan "zaten uygulanmış" özellikler

- **Procurement.tsx** tedarikçi gruplama — Liste ↔ Tedarikçi toggle, geciken/bekleyen badge, miktarOzet (`d7817f7`)
- **Reports.tsx İstasyon Perf.** tab — OEE bileşen bar, fire oranı bar, haftalık trend LineChart, tıklanabilir karşılaştırma tablosu (`cd51246` + `7918281`)
- **AuditLog.tsx** filtreler + Excel export (`c9e6346`)

---

### 17 Mayıs 2026 — Son Oturum (v17.13 — OperatorPanel + ProductionEntry)

#### OperatorPanel Günlük Hedef göstergesi (`6915285`)

`src/pages/OperatorPanel.tsx`:
- `VARDIYA_DK = 480` — 8 saatlik standart vardiya sabiti (module-level)
- `gunlukHedefInfo` useMemo — her `acikWO` için:
  - `islemSure > 0` → `min(kalan, floor(480 / islemSure))` — işlem süresi bazlı kapasite tahmini
  - `islemSure = 0` → kalan hedef adedi (fallback)
  - Çıktı: `{ uretim, hedef, pct, varIslemSure }`
- **🎯 Günlük Hedef** kartı — İşler tabı başında, hedef veya üretim > 0 ise görünür:
  - Üretilen / Hedef rakamları + %ilerleme
  - Renkli ilerleme bar: accent → amber (%70) → green (%100)
  - Alt başlık: "işlem süresi bazlı tahmin" / "kalan İE hedefleri"

#### ProductionEntry Şablondan Yükle (`d72fc2e`)

`src/pages/ProductionEntry.tsx` → `EntryModal`:
- `sonKayitlar` useMemo — aynı WO'nun son 3 logu; koşul: en az 1 operatör, duruş veya not
- `uygulaŞablon(log)` — seçilen şablondan `oprList`, `duruslar`, `not` alanlarını doldurur (saat şu an ile normalize edilir, aktif olmayan operatörler filtrelenir)
- **📋 Şablondan Yükle (N)** butonu — tarih alanının üzerinde, sadece şablon varsa görünür; toggle ile şablon listesi açılır
- Şablon kartları: tarih + adet + operatör adları + duruş sayısı + not önizlemesi

#### Vitest unit testleri — 3 yeni dosya (önceki oturumdan, bu oturum tamamlandı)

| Dosya | Test sayısı | Kapsam |
|---|---|---|
| `barModel.test.ts` | 15 | `isBarMaterial`, `isBarMaterialByKod`, `barAcilisStokId`, `acikBarKayitId`, `acikBarHavuzuToplamMm` |
| `fireTelafi.test.ts` | 10 | `fireTelafiIeOlustur` guard'lar, `fireTelafiAkisi` hata + başarı yolları, `topluFireTelafi` filtreleme |
| `cutting.pure.test.ts` | 8 | `getParcaBoy` (uzunluk/boy/min/fallback), `getHamBoy` (uzunluk/max/MM parse) |

**Toplam birim testi:** 111 (önceki 78 → +33) — tümü yeşil

#### Warehouse kritik stok paneli + toplu tedarik (`57ae214`)

`src/pages/Warehouse.tsx` — +118 satır:
- `kritikStok` useMemo — `stokMap` × `materials`: `minStok > 0 && stok < minStok` koşulundaki ham/yarı mamul malzemeler; eksik miktar + birim; `stok/minStok` oranına göre artan sıralı
- `secilenKritik` Set state — checkbox ile çoklu seçim; "Tümünü Seç" kısayolu
- `showKritik` toggle — panel görünürlüğü
- `topluTedarikOlustur()` — seçili malzemeler için `uys_tedarikler` insert (durum: bekliyor, not: "Toplu tedarik — kritik stok"); başarı sonrası `/procurement` yönlendirme
- UI: kırmızı "Kritik Stok" başlıklı katlanabilir panel; tablo sütunları: seç / malzeme / mevcut / min / eksik; "Tedarik Oluştur (N)" butonu

#### Sıradaki görevler (güncellendi)

- Normalize veri geçişi (kapsam belirsiz — ertelendi)
- mrpEngine Faz 3 — karar noktaları (satın alma teklifi, acil üretim) akışı

---

### 17 Mayıs 2026 — Bu Oturum (v17.05–v17.07)

Bu oturumda 6 özellik tamamlandı. İlk 3'ü context sıkıştırılmadan önce yapıldı; son 3'ü bu pencerede.

#### Tamamlananlar

| Commit | Dosya | Özellik |
|--------|-------|---------|
| `0e65431` | `mrpEngine.ts` + `mrpEngine.test.ts` | **hesaplaMRPv2()** — `HesaplaMRPParams` alır; `ordIds` filtresi, `urunler` multi-product genişlemesi, `secilenWoIds`; `buildResult` ile `MRPRow[]` döndürür; mevcut `hesaplaMRP` dokunulmadı. 8 birim testi (vitest): no-recipe, stok yok/yeterli, ordIds filtresi, null tümü, urunler genişleme, MRPRow şekli |
| `e7aba56` | `WorkOrders.tsx` + `workOrderService.ts` | **Toplu Termin Güncelle** — toplu işlemler barına Calendar ikonu + DatePicker + onay modal; `topluTerminGuncelle(ids, termin)` servise eklendi; `wo_edit` RBAC kapısı |
| `759b7ff` | `Shipment.tsx` | **Paketleme Listesi** — per-satır ve per-grup checkbox; seçim toolbar (N sevkiyat); `window.print()` popup HTML: minified CSS, şirket başlığı, her kalem malkod/malad/miktar/birim (birim: SevkKalem.birim → materials → 'Adet' zinciri) |
| `e42de88` | `ProblemTakip.tsx` | **Excel export + Özet görünümü** (v17.05): Excel: D1–D8 + durum + termin gecikme + 30 gün+ geciken Evet/Hayır + audit alanları (xlsx lazy import). Özet: Recharts donut PieChart (Açık/Devam/Kapandı renk kodlu), 5 özet kart, son 30 gün kapanan + kapatılma oranı. Liste↔Özet toggle buton header'da |
| `6773f09` | `Logs.tsx` | **Kullanıcı Aktivite Özeti** (v17.06): mount'ta `uys_activity_log`'dan son 7 günü filtreden bağımsız yükler (limit 2000). Kullanıcı başına: toplam işlem, normalize sıklık çubuğu (`aktiviteMax`), modül/aksiyon badge (top 4). Açılır/kapanır panel, varsayılan açık |
| `7918281` | `Reports.tsx` | **İstasyon Perf. geliştirme** (v17.07): OEE tek bar → gruplu 4-bar (Kullanılabilirlik/Performans/Kalite/OEE), `Legend` eklendi; haftalık trend dual Y-eksen (sol: üretim/fire, sağ: 0–100%) + Kalite % çizgisi; tablo Fire% ve OEE hücrelerine renk kodlu mini progress bar |

#### Teknik notlar

- **mrpEngine.test.ts** — 8 test eklendi → toplam 31 (mrpEngine dosyasında), tüm 78 birim testi yeşil (bu oturum öncesi)
- **recharts Legend** — `Reports.tsx` import satırına eklendi; `ProblemTakip.tsx`'e `PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer` eklendi (daha önce yoktu)
- **xlsx lazy import** — `ProblemTakip.tsx`'te de aynı pattern (dynamic `import('xlsx')`) kullanıldı; bundle bölümlemesi korundu
- **Dual-axis LineChart** — haftalık trend'de `yAxisId="left"/"right"` + `orientation="right"` pattern; `CartesianGrid` + `Legend` var, `ReferenceLine` yok (kalite için eşik belirsiz)

#### Build durumu

Tüm commitler `npm run build` öncesi geçirildi: prebuild audits (schema + column + saglik-syntax) + `tsc --noEmit` + `vite build` — hepsi temiz.

---

### 18 Mayıs 2026 — Tüm Oturum Özeti + master_schema.sql Durumu

#### master_schema.sql — güncel, yenileme gerekmez

Son migration: `20260516_v16_89_simplify_stok_invalidate_trigger.sql`
17–18 Mayıs arası **DB şema değişikliği yapılmadı** — tüm v17.x commit'leri TypeScript katmanında.
`sql/master_schema.sql` 17 Mayıs'ta `backups/2026-05-17/schema.sql` (pg_dump 17.10) bazlı yenilendi; hâlâ geçerli.

#### Tam commit tablosu — 17–18 Mayıs 2026

Tüm makinelerden (T0 = iskender.uzun / T1 = Iskender) gelen commit'ler kronolojik sıra ile:

| Commit | Makine | Özellik |
|--------|--------|---------|
| `fbb849a` | T1 | Reports MalzemeTüketim: top-10 bar chart + aylık trend line v17.10 |
| `8624996` | T1 | Materials satır genişletme — Son Hareketler mini panel v17.07 |
| `e996734` | T1 | WorkOrders kapasite görünümü toggle (İE listesi ↔ Kapasite) v17.10 |
| `2a5ca0c` | T1 | Checklist öncelik sırala + atanan filtre + tamamlanma progress bar v17.11 |
| `5b1ff40` | T1 | Warehouse stok hareketi özeti mini widget (son 7 gün aktif ürünler) v17.11 |
| `759b7ff` | T1 | Shipment paketleme listesi — checkbox seçim + `window.print()` popup v17.11 |
| `f55ca45` | T1 | StokLog Manuel Hareket Ekle modal — Zod doğrulama + `addStokHareketi` v17.11 |
| `8b72204` | T1 | BomTrees where-used analizi (Kullanıldığı Yerler) — reçete × BOM çapraz v17.12 |
| `5a4d8bc` | T1 | Operations istatistik kolonları + tıklanabilir detay paneli v17.08 |
| `5a0d24f` | T1 | Reports OEE tab (haftalık trend + istasyon bar + %85 hedef); Dashboard izin widget v17.10 |
| `31b5c02` | T1 | Stations kapasite istatistikleri + tıklanabilir detay paneli v17.12 |
| `461bf4d` | T0 | docs: DEVAM_NOTU gece oturumu — Dashboard izin widget + T1 commitler |
| `6e99bf0` | T0 | DowntimeCodes detay panel — istasyon dağılımı + KPI kartları v17.13 |
| `28bf273` | T0 | fix: AuditLog Fragment key uyarısı (`<>` → `<Fragment key>`) v17.14 |
| `0499982` | T1 | Backup sayfası — boyut ort. kartı, zamanlama durumu, son 5 yedek paneli v17.12 |
| `0a45ca1` | T1 | HmTipleri malzeme sayısı + toplam stok + min stok altı istatistiği v17.13 |
| `c9e6346` | T1 | AuditLog kullanıcı dropdown + çoklu olay filtresi + Excel export v17.09 |
| `84bb0c2` | T1 | Reports DuruşAnalizi tab — pie chart + istasyon bar + haftalık trend v17.10 |
| `6773f09` | T0 | Logs Kullanıcı Aktivite Özeti — son 7 gün, modül/aksiyon badge v17.06 |
| `6bdf696` | T1 | Logs aktivite özeti — üretim/fire tip dağılımı + operators bağımlılık v17.10 |
| `ba5b2f5` | T1 | DowntimeCodes kodId eşleşmesi düzelt + son 5 kullanım detay paneli v17.14 |
| `6915285` | T0 | OperatorPanel 🎯 Günlük Hedef — islemSure bazlı ilerleme bar v17.13 |
| `2dc06ee` | T1 | OperatorPanel günlük hedef — tahmini bitiş saati eklendi v17.13 |
| `cd51246` | T1 | Reports İstasyonPerf tab — OEE karşılaştırma + fire oranı + haftalık trend v17.10 |
| `7918281` | T0 | Reports istperf — OEE 4-bar bileşen + kalite trend + mini progress bar v17.07 |
| `d72fc2e` | T0 | ProductionEntry 📋 Şablondan Yükle — son 3 giriş şablon listesi v17.13 |
| `e42de88` | T0 | ProblemTakip Excel export + Özet pie chart (Recharts donut) v17.05 |
| `57ae214` | T1 | Warehouse kritik stok paneli — checkbox seçim + toplu tedarik oluştur v17.11 |
| `42ca5c5` | T0 | docs: DEVAM_NOTU Warehouse kritik stok paneli eklendi |
| `e33efb9` | T1 | docs: DEVAM_NOTU v17.09–v17.14 T1+T0 commit özeti |
| `f6932f1` | T0 | docs: DEVAM_NOTU Son Oturum özeti — OperatorPanel + ProductionEntry |
| `360dbd6` | T1 | docs: DEVAM_NOTU v17.05–v17.07 oturum özeti |

#### Belgelenmemiş T1 commit detayları

**Materials satır genişletme** (`8624996`):
- `Materials.tsx` — satıra tıklanınca inline panel açılır: son X stok hareketi (tarih/miktar/giriş/çıkış) mini tablo

**WorkOrders kapasite toggle** (`e996734`):
- Başlık alanına toggle buton: İş Emri listesi ↔ Kapasite görünümü
- Kapasite görünümü: operasyon bazında toplam hedef / üretilen / kalan / %doluluk

**Checklist geliştirme** (`2a5ca0c`):
- Öncelik sıralaması: Kritik → Yüksek → Orta → Düşük filtre chip'leri
- Atanan kişi filtresi (dropdown)
- Başlık alanına: "N/M tamamlandı" + tamamlanma yüzdesi progress bar

**Warehouse stok hareketi özeti** (`5b1ff40`):
- Son 7 gün aktif ürünler — hareket sayısı, giriş/çıkış toplamı mini widget
- Warehouse sayfasının üst kısmında daraltılabilir panel

**StokLog Manuel Hareket Ekle** (`f55ca45`):
- Modal: malkod seçimi + miktar (Zod: int, positive) + tür (Giriş/Çıkış) + not
- `addStokHareketi` servis fonksiyonu çağırır; liste anlık güncellenir

**BomTrees where-used** (`8b72204`):
- "Kullanıldığı Yerler" sekmesi: seçili bileşenin hangi BOM'larda (hangi mamulde) kullanıldığını listeler
- `uys_bom_trees` çapraz sorgu — bileşen kodu eşleşmesi

**Operations detay paneli** (`5a4d8bc`):
- Operasyon listesi satırlarına istatistik kolonları: toplam İE / açık İE / tamamlanan
- Satır tıklandığında sağ panel: İE detayları, haftalık üretim özeti

**Stations detay paneli** (`31b5c02`):
- İstasyon satırlarına kapasite kolonları: kullanım oranı, aktif/toplam İE
- Detay panel: haftalık trend sparkline, atanmış operatörler, aktif işler

**Reports OEE tab** (`5a0d24f`):
- Haftalık OEE trend LineChart + %85 hedef çizgisi
- İstasyon bazlı OEE bar chart (Availability × Performance × Quality)

**Reports DuruşAnalizi** (`84bb0c2`):
- PieChart: duruş kodları dağılımı (kod bazında toplam süre)
- İstasyon bar chart: hangi istasyonda ne kadar duruş
- Haftalık trend: duruş süresi değişimi

**AuditLog geliştirme** (`c9e6346`):
- Kullanıcı dropdown filtresi (çoklu seçim)
- Olay tipi çoklu seçim (checkbox)
- Excel export (`xlsx` lazy import, tüm kolonlar)

**Backup sayfası** (`0499982`):
- KPI kartları: son yedek boyutu, ortalama boyut, zamanlama durumu (son 24 saatte yedek var mı)
- Son 5 yedek tablosu: tarih / boyut / tür / durum

**HmTipleri istatistik** (`0a45ca1`):
- Her satıra: bu tipe bağlı malzeme sayısı, toplam stok, min stok altı sayısı
- Kritik (min stok altı > 0) satırlar kırmızı vurgu

#### Sıradaki görevler

1. mrpEngine Faz 3 — karar noktaları (satın alma teklifi, acil üretim) akışı
2. Normalize veri geçişi (kapsam belirsiz — ertelendi)
3. E2E test kapsamı genişletme (mevcut: 03-problem-takip; önerilen: üretim girişi + sevkiyat akışı)

---

### 18 Mayıs 2026 — Sabah Oturumu (v17.15)

#### hesaplaMRP → hesaplaMRPv2 tam geçiş (`ea86f45`)

**Amaç:** Tüm MRP hesaplama call site'larını positional-arg API'den object-param API'ye taşımak.

**Değişen dosyalar (6):**

| Dosya | Değişiklik |
|-------|-----------|
| `mrpEngine.ts` | `hesaplaMRPv2` body: engine pipeline yerine `hesaplaMRP`'ye delege. `import { hesaplaMRP } from './mrp'` eklendi. Tüm params (logs, retrospektif, secilenYMIds) artık geçiriliyor |
| `mrp.ts` | `hesaplaMRP` fonksiyonuna `@deprecated` JSDoc eklendi |
| `mrpService/index.ts` | `export { hesaplaMRPv2 } from './mrpEngine'` eklendi |
| `Orders.tsx` | 3 çağrı v2 object syntax'a taşındı; `ReturnType<typeof hesaplaMRP>` → `MRPRow[]` |
| `MRP.tsx` | 4 çağrı v2 object syntax'a taşındı (ymSet, retrospektif=true dahil) |
| `audit-schema.cjs` | `CODE_AHEAD_WHITELIST` eklendi — migration bekleyen tablolar için (ilk: `uys_lokasyonlar`) |

**Parametre eşlemesi (positional → object):**
```
hesaplaMRP(ordIds, orders, wos, recipes, stokHareketler, tedarikler, cpMapped, mats, ymSet, mrpRezerve, orderId, logs, retrospektif)
→
hesaplaMRPv2({ ordIds, orders, workOrders: wos, recipes, stokHareketler, tedarikler, cuttingPlans: cpMapped, materials: mats, secilenYMIds: ymSet, mrpRezerve, currentOrderId: orderId, logs, retrospektif })
```

**Önemli not:** `mrpRezerve` parametresi v15.63'ten beri no-op (rezerve mantığı kaldırıldı, geriye uyumluluk için parametre tutuldu). v2'ye geçişte davranış değişikliği yok.

**Yol haritası:** `hesaplaMRPv2` şu an `hesaplaMRP`'ye delege ediyor. Engine pipeline (explodeBOM → netting → buildResult) `logs`, `retrospektif`, `secilenYMIds` desteklediğinde implementasyon call site değişmeden swap edilecek.

#### Sıradaki görevler (güncellendi)

- mrpEngine Faz 3 — karar noktaları (satın alma teklifi, acil üretim) akışı
- Normalize veri geçişi (kapsam belirsiz — ertelendi)
- WMS lokasyon migration (`sql/20260518_v17_07_wms_lokasyonlar.sql`) — TEST sonra PROD uygulanacak

---
