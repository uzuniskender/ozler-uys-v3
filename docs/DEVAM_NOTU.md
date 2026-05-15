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

## Sıradaki görevler

1. Refresh butonlarına `force: true` ekle (onay bekleniyor):
   - `Topbar.tsx:252` → `loadAllStores({ force: true })`
   - `ActiveWorkPanel.tsx:79` → `loadOwn({ force: true })`
   - `DataManagement.tsx:~1216` → `loadAll({ force: true })`
2. Normalize veri geçişi (kapsam belirsiz — ertelendi)
3. ~~Service katmanı Faz 3~~ — **tamamlandı** (6 sayfa, 2 servis genişlemesi)

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
