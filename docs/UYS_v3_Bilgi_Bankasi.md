# UYS v3 — Bilgi Bankası

*Üretim Yönetim Sistemi*

Özler Kalıp ve İskele Sistemleri A.Ş.

**Sürüm: v15.40.1** (Pre-push Hook Hotfix — tsc + .gitattributes)

Son Güncelleme: **25 Nisan 2026** (14. oturum — hook hotfix)

*Hazırlayan: Buket Bıçakçı — Claude ile birlikte*

---

## İçindekiler

1. Proje Özeti
2. BİR SONRAKİ OTURUMA NOTLAR ⭐
3. Teknoloji Yığını
4. Veritabanı — Supabase
5. Ana Modüller
6. Son Sürüm Geçmişi
7. Faz B + Test Yol Haritası
8. Sistem Sağlık Raporu (11 kontrol)
9. Test Modu + Senaryo Runner ⭐ YENİ
10. Orchestrator ve Helper Mimarisi
11. Geliştirme Ortamı ve İş Akışı
12. Yetkilendirme (RBAC)
13. Otomatik Yedekleme + Dokümantasyon Kuralı ⭐ YENİ
14. Audit ve Test Altyapısı
15. Bilinen Buglar ve Backlog
16. Öğrenilenler — v15.33 → v15.37
17. Referanslar

---

# 1. Proje Özeti

UYS v3, Özler Kalıp ve İskele Sistemleri A.Ş.'nin Dilovası fabrikasında kullanılan React tabanlı üretim yönetim sistemidir.

Şu anki sürüm **v15.39**, 25 Nisan 2026 itibariyle canlıda. 24-25 Nis arası tamamlanan iş grupları:
- **v15.34–34.3**: Açık bar hurda yönetimi (modal, alt tab, fire_logs entegrasyon)
- **v15.35–35.3**: Havuz önerisi (cutting seed + MRP siparisDisi fix)
- **v15.36 → v15.36.2**: Tam akış wizard (Sipariş → Kesim → MRP → Tedarik + yarım iş takibi)
- **v15.37**: Test Modu altyapısı — 5 senaryo runner, test_run_id etiketleme, cascade delete
- **v15.38**: Parça 5 — Yasak Kontrolleri (stok/duruş/silme) + Senaryo 6 negatif test. `validations.ts` modülü, saf fonksiyonlar, admin bypass YOK.
- **v15.39**: SR #11 Havuz Satırı Adaptasyonu. Sistem Sağlık Raporu'ndaki 11. kontrol artık havuz satırlarını (`satir.havuzBarId` dolu olanlar) ayrı işliyor — bar_acilis aramak yerine `uys_acik_barlar[havuzBarId].durum` kontrolü yapıyor. Üç eksik tipi ayrı raporlanıyor: normal eksik / havuz orphan / havuz açık kalmış. **Canlıda doğrulandı: 11/11 PASS.**
- **v15.40**: Pre-push hook fix. `scripts/git-hooks/pre-push` repoda versionable — `git config core.hooksPath scripts/git-hooks` ile aktive ediliyor. Hook içinde Git Bash PATH fix (Node.js standart konumu + npm global), 3 adım: audit-schema + audit-columns + tsc --noEmit. İki makine için de çalışır (Iskender + iskender.uzun paths).
- **v15.40.1 (hotfix)**: İki düzeltme. (1) Hook içindeki tsc çağrısı `npx --no-install tsc` yerine doğrudan `./node_modules/.bin/tsc` kullanıyor — `npx` "tsc" adını npm registry'deki yanlış pakete (eski `tsc@2.0.4`) çözümlüyordu. (2) `.gitattributes` dosyası eklendi: `scripts/git-hooks/*` ve `*.sh` LF zorunlu, `*.ps1` CRLF. Bu sayede hook dosyası Windows checkout'ta CRLF'ye dönüşüp bash shebang'i kırmıyor.

---

# 2. BİR SONRAKİ OTURUMA NOTLAR ⭐

## ✅ TAMAMLANAN — v15.38 + v15.39 + v15.40

**v15.38: Yasak Kontrolleri** — stok/duruş/silme engeli, Senaryo 6 (10/10 OK).

**v15.39: SR #11 Havuz Adaptasyonu** — normal + havuz ayrımı, 3 eksik tipi. **11/11 PASS doğrulandı** (timestamp 2026-04-24T21:15).

**v15.40: Pre-push Hook** — `scripts/git-hooks/pre-push` repoda versionable. `core.hooksPath` ile aktive. 3 check: audit-schema, audit-columns, tsc --noEmit. PATH fix: Git Bash `/c/Program Files/nodejs` + npm global (iki makine paths).

## 🟡 Sıradaki Öncelik

- **Stok anomalisi raporu** (Senaryo 5 -3 gösterimi). Gerçek veri sorunu değil, rapor okunabilirliği için. Tavsiye: Senaryo 5 raporuna açıklayıcı not eklemek (`_uretimGirisi` test bypass — UI katmanında koruma mevcut).

## 🟢 Küçük İşler

- Manuel plan'da havuz önerisi (v15.35 eksik)
- Hurda geri alma UI
- Havuz geri alma UI
- Toplu senaryo farklı reçetelerle çalıştırılabilir

---

# 3. Teknoloji Yığını

| Katman | Teknoloji |
| --- | --- |
| Frontend | React 19 + Vite 8 + TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand (useStore) |
| Backend | Supabase (PostgreSQL + REST + Realtime) |
| Auth | Özel (uys_kullanicilar + RBAC) · RLS deferred |
| Deploy | GitHub Pages (Actions tarafından) |
| CI/CD | GitHub Actions: audit + tsc + vite build + deploy-pages |
| Lokal | apply.ps1 (patch script) + pre-push hook (bozuk) |

---

# 4. Veritabanı — Supabase

Proje: **lmhcobrgrnvtprvmcito** (Frankfurt). ~36 tablo, ~360+ kolon.

## v15.37 ile eklenenler

**Yeni tablo:** `uys_test_runs`
- `id` text PK (format: `TEST_YYYYMMDD_NN`)
- `baslangic`, `bitis` timestamp
- `durum` text ('aktif' | 'tamamlandi' | 'iptal')
- `user_id`, `user_ad` text
- `aciklama` text
- `temizlenen_kayit_sayisi` jsonb
- `not_` text

**11 tabloya `test_run_id` text kolonu + index eklendi:**
- uys_orders, uys_work_orders, uys_logs, uys_stok_hareketler,
  uys_kesim_planlari, uys_tedarikler, uys_mrp_rezerve, uys_sevkler,
  uys_fire_logs, uys_acik_barlar, uys_active_work

## v15.36 ile eklenenler

`uys_pending_flows` — yarım iş takibi (Sipariş → Kesim → MRP → Tedarik akışında)

## v15.34.3 ile eklenenler

`uys_fire_logs.tip` ('parca' | 'bar_hurda') + `uzunluk_mm` — fire logları iki tip

## v15.34 ile eklenenler

`uys_acik_barlar`: +4 hurda kolonu (hurda_tarihi, hurda_sebep, hurda_kullanici_id, hurda_kullanici_ad) · `durum` enum: 'acik' | 'tuketildi' | 'hurda'

## Kritik notlar

**Not 1: Supabase proxy otomatik test_run_id ekler (v15.37)** — `src/lib/supabase.ts` içindeki proxy, `insert/upsert` çağrılarında aktif test varsa (`localStorage.uys_active_test_run_id`) otomatik `test_run_id` kolonu ekler. 55 insert noktasına ayrı ayrı dokunmaya gerek yok. Bu mimari çok güçlü.

**Not 2: Deterministik ID'ler** — `ted-{id}`, `bar-open-{planId}-{satirId}-{idx}`, `ab-{planId}-{satirId}-{idx}`. İdempotent upsert.

**Not 3 (v15.31+): Bar Model malzeme filtresi** — `isBarMaterial(m): m.tip==='Hammadde' && m.uzunluk>0`. Bu malzemeler için `stokTuketim.ts` orantılı düşüm yapmaz, `barModelSync` halleder.

**Not 4 (v15.33): Supabase 1000 satır limiti** — `fetchAll(tablo)` helper pagination ile aşar.

**Not 5 (v15.35): Havuz satırları** — `kesim_planlari.satirlar[].havuzBarId` doluysa o satır havuz barından üretiliyor. `hamAdet=1`, gruplanmaz. `barModelSync` havuzBarId görünce bar_acilis yazmaz, `acikBarTuket` çağırır.

**Not 6 (v15.36): Yarım iş takibi** — Her kullanıcı aynı anda 1 aktif flow tutar. Topbar'da Workflow ikonu + pulsing badge. Devam/İptal aksiyonları.

---

# 5. Ana Modüller

## 5.1 Sipariş Yönetimi
Çoklu kalem, her kalem kendi rcId+adet+termin. Silme: `siparisSilKapsamli`. Revize: eski İE sil + cuttingPlanTemizle + yeni İE oluştur.

**v15.36 sıkı reçete kontrolü:** Sipariş kaydedilmeden önce her kalemin `rcId` + reçete satırları doğrulanır. Reçetesiz sipariş kabul edilmez.

## 5.2 İş Emirleri
Her İE kendi terminine sahip. ieNo offset çoklu kalem çakışma fix. **v15.36**: Manuel İE oluşturma reçete zorunlu.

## 5.3 Kesim Planı
`satirlar[].kesimler[]` nested şema. v15.31: Satır tamamlandığında `barModelSync` → bar_acilis + açık bar. v15.35: `havuzBarId` alanı ve havuz önerisi modalı.

## 5.4 MRP
Termin-aware, akıllı durum. **v15.35.3 fixleri (kritik):** `siparisDisi` İE'ler dahil edildi, boş `ordIds=[]` array bug düzeltildi.

## 5.5 Tedarik
`markTedarikGeldi` ile stok girişi otomatik. Deterministik stok_hareketler.id: `ted-{tedarikId}`. **v15.36**: Procurement silme sonrası `rezerveleriSenkronla` otomatik.

## 5.6 Mesajlaşma
Kategori + öncelik + realtime + bildirim.

## 5.7 Problem Takip
UYS v3 içinde entegre.

## 5.8 HM Tipleri
9 seed tip, CRUD, RBAC.

## 5.9 Sistem Sağlık Raporu (v15.33)
11 kontrol. Detay §8.

## 5.10 Dashboard (v15.30)
IFS tarzı light tema, 6 KPI tile.

## 5.11 Bar Model (v15.31–35)
`src/features/production/barModel.ts`. Detay §10.

## 5.12 fetchAll Pagination (v15.33)
`src/lib/supabase.ts`. 1000'lik range'lerle tüm satırları çeker.

## 5.13 Havuz Önerisi UI (v15.35 + 35.1 + 35.2)
CuttingPlans.tsx'te otomatik plan sonrası modal. En küçük parça kontrolü, uygun bar yoksa sessiz atlama.

## 5.14 Hurda Yönetimi (v15.34 + 34.2 + 34.3)
Warehouse → Açık Bar Havuzu → Detay modal → bireysel seçim + sebep + hurdaya gönder. Ayrı "Hurdaya Gönderilen" alt tab. Reports Fire Analizinde "Bar Hurda" alt kartı.

## 5.15 Tam Akış Wizard (v15.36)
Sipariş → Kesim → MRP → Tedarik otomatik zincir. 4 adımlı FlowProgress bar. "🔄 Akış devam ediyor" banner. Topbar'da yarım iş ikonu.

## 5.16 Test Modu + Senaryo Runner (v15.37) ⭐ YENİ
Detay §9. Canlı veriye zarar vermeden sistem testi yapma imkanı.

## 5.17 Yasak Kontrolleri — validations.ts (v15.38) ⭐ YENİ
`src/features/production/validations.ts`. 3 saf fonksiyon:
- `canProduceWO({q, f, maxYapilabilir})` — Yasak 1: Stok kontrolü
- `canDurus({toplamDurusDk, toplamCalismaDk, hasDurus})` — Yasak 2: Duruş sınırı
- `canDeleteWO({woId, logs, stokHareketler, fireLogs})` — Yasak 3: Silme kontrolü

Her fonksiyon `ValidationResult { ok, reason?, meta? }` döner.
UI (OperatorPanel.save, WorkOrders.deleteWO) ve testRunner (Senaryo 6) ortak kullanır.
**Admin bypass YOK** — her rol için sıkı.

---

# 6. Son Sürüm Geçmişi (v15.x)

| Sürüm | Özet |
| --- | --- |
| v15.26 | Sistem Sağlık Raporu — 10 kontrol |
| v15.27 | ÜYSREV1 + Tedarik otomatik stok |
| v15.28 | SR #8 + SR #4 fix |
| v15.29 | ÜYSREV2 |
| v15.30 | Dashboard redesign IFS light |
| v15.31 | 🔴 Bar Model Faz A |
| v15.32 | Bar Model kapsama |
| v15.33 | fetchAll pagination |
| **v15.34** | Açık bar hurda modalı |
| v15.34.1 | Hotfix: Google admin dbId fallback |
| v15.34.2 | "Hurdaya Gönderilen" alt tabı |
| v15.34.3 | fire_logs tip+uzunluk_mm + Reports Bar Hurda |
| (temizlik) | Eski belgeler + sql/ sync |
| **v15.35** | Havuz önerisi + apply.ps1 + pre-push hook |
| v15.35.1 | Havuz modal UX (parça listesi + kullanılabilirlik) |
| v15.35.2 | Uygun havuz yoksa sessiz atlama |
| v15.35.3 | MRP siparisDisi + boş ordIds bug fix |
| **v15.36** | Tam Akış Wizard (Sip/Kesim/MRP/Tedarik) + PendingFlow |
| v15.36 fix | Route isimleri fix, MRP override |
| v15.36 progress | FlowProgress 4-adım bar |
| v15.36.1 | MRP auto-hesap + Procurement rezerve sync |
| v15.36.2 | Kesim → MRP otomatik advance |
| **v15.37** | **Test Modu altyapı + 5 Senaryo Runner** ⭐ |
| v15.37.1 | Telafi ID fix (woId, .id değil) |
| **v15.38** | **Parça 5 — Yasak Kontrolleri (stok/duruş/silme) + Senaryo 6** ⭐ |
| **v15.39** | **SR #11 Havuz Satırı Adaptasyonu** (normal + havuzBarId ayrımı) ⭐ |
| **v15.40** | **Pre-push Hook** (core.hooksPath ile versionable) ⭐ |
| v15.40.1 | Hotfix: tsc `./node_modules/.bin/tsc` + `.gitattributes` LF enforce |

---

# 7. Faz B + Test Yol Haritası — Durum

- ✓ TAMAM — Parça 1 — İş Emri Terminleri (v15.22)
- ✓ TAMAM — Parça 2A — MRP Termin (v15.23)
- ✓ TAMAM — Parça 2C — Rezerve Stok (v15.24–25)
- ◐ ÖZÜ TAMAM — Parça 2B — Termin-FIFO (kalem rafine bekliyor)
- ⏸ BEKLİYOR — Parça 3 — Manuel İE Seçim UI
- ✓ TAMAM — Bar Model Faz A (v15.31–33)
- ✓ TAMAM — Bar Model Faz B — Havuz önerisi (v15.35)
- ✓ TAMAM — Hurda Yönetimi (v15.34)
- ✓ TAMAM — Tam Akış Wizard (v15.36)
- ✓ TAMAM — Test Modu + 5 Senaryo (v15.37)
- ✓ TAMAM — **Parça 5: Yasak Kontrolleri** (stok/duruş/silme) + **Senaryo 6** (v15.38)
- ✓ TAMAM — **SR #11 Havuz Satırı Adaptasyonu** (v15.39) — 11/11 PASS doğrulandı
- ✓ TAMAM — **Pre-push hook** (v15.40) — core.hooksPath ile versiyonlu
- ⏸ SIRA — Stok anomalisi raporu (Senaryo 5 -3 gösterim notu)

---

# 8. Sistem Sağlık Raporu (11 kontrol, v15.33)

Veri Yönetimi → 🩺 Rapor Oluştur. 11/11 PASS hedef.

| # | Kontrol | Auto-Fix | Not |
| --- | --- | --- | --- |
| 1 | Sipariş–İE tutarlılığı | — | |
| 2 | İE–Reçete tutarlılığı | — | |
| 3 | Cutting plan–İE tutarlılığı | ✓ | |
| 4 | Tedarik–Stok tutarlılığı | ✓ | |
| 5 | Rezerve–Stok dengesi | ✓ | |
| 6 | Rezerve–Sipariş eşleşmesi | ✓ | |
| 7 | MRP durumu senkron | — | |
| 8 | Malzeme kartı tutarlılığı | ✓ | |
| 9 | Orphan log/fire/stok | ✓ | |
| 10 | BOM / Reçete eksik | — | |
| 11 | Bar Model tutarlılığı | — | **v15.39: havuz satırı adaptasyonu TAMAM** ✅ |

---

# 9. Test Modu + Senaryo Runner (v15.37) ⭐ YENİ

## Konsept

Sistem üzerinde gerçek bir test çalıştırmak ama canlı veriye zarar vermemek. Her test kaydı `test_run_id` ile etiketlenir, test bitince cascade delete ile sadece o etiketli kayıtlar silinir.

## Mimari

1. `uys_test_runs` tablosu — test oturumlarını izler
2. 11 tabloya `test_run_id` kolonu
3. **`src/lib/supabase.ts` proxy'si** — `from().insert/upsert` çağrılarını yakalar, aktif test varsa otomatik `test_run_id` ekler. (55 insert noktasına dokunmak yerine tek noktadan kontrol.)
4. `src/lib/testRun.ts` — `startTestRun`, `finishTestRun`, `cancelTestRun`, `cascadeDeleteTestRun`, `getActiveTestRunId`
5. `src/lib/testRunner.ts` — 5 otomatik senaryo + `_createOrder`, `_createWO`, `_createCuttingPlans`, `_runMRPAndCreateTedarik`, `_teslimAl`, `_uretimGirisi`, `_uretimGirisiFire`, `_fireTelafiOlustur`, `_silTumTedarikler` helper'ları
6. `src/pages/TestMode.tsx` — UI: başlat/sonlandır/iptal, senaryo butonları, canlı log, JSON indir
7. Sidebar → Sistem → 🧪 Test Modu (FlaskConical ikon + pulsing "AKTİF" badge)

## 5 Senaryo

| # | Akış |
| --- | --- |
| **S1** | Sipariş → Kesim → MRP → Tedarik → Teslim → Parçalı Üretim (2 log) |
| **S2** | Manuel İE (bağımsız) → aynı akış |
| **S3** | Sipariş → MRP → Tedarik SİL → MRP tekrar (ihtiyaç çıkmalı) → 2. sipariş → Konsolidasyon → Üretim |
| **S4** | İE versiyonu S3 |
| **S5** | Sipariş → Kesim → MRP → Tedarik → Teslim → **Fire'lı üretim (6 adet + 2 fire + 2 duruş)** → **Telafi İE oluştur** → Telafi için kesim + MRP + üretim |

## İzolasyon

Her senaryo kendi sub-run id'si ile çalışır: `TEST_YYYYMMDD_NN_s1`, `_s2`, vs. Toplu runner her senaryodan sonra o sub-run'ı temizler, böylece bir sonraki senaryo temiz başlangıçla çalışır.

## "🚀 Tümünü Ardışık Çalıştır"

5 senaryoyu sırayla otomatik çalıştırır. Her biri arasında otomatik temizlik. Sonunda birleşik JSON raporu otomatik indirilir.

## 24-25 Nis 2026 sonuçları

- **TEST_20260424_04** (9999 adet, YMH100265): 4 senaryo ALL_PASS, 47 saniye
- **TEST_20260424_09** (9999 adet, YMH100265): 5 senaryo ALL_PASS, 64 saniye
- **v15.38 ile:** 6 senaryo bekleniyor (ALL_PASS doğrulama Buket'te)
- Sub-run temizliği doğrulandı: SQL sonuçları 0

## Parça 5 çözümü (v15.38)

Senaryo 5 raporunda `stokSnapshotBitis: -3` **hala görünebilir** çünkü `_uretimGirisi` helper'ı doğrudan DB insert yapar, UI `save()` yolundan geçmez. Bu **kasıtlı** — yoksa tüm senaryolar kırılırdı.

**Gerçek yasak koruması şu noktalarda:**
- `OperatorPanel.save()` — UI üzerinden üretim girişinde (canProduceWO + canDurus)
- `WorkOrders.deleteWO / topluSil / deleteLog` — UI üzerinden silme (canDeleteWO)

Senaryo 6 bunu doğrudan `validations.ts` fonksiyonlarını çağırarak test eder.

---

# 10. Orchestrator ve Helper Mimarisi

## Tam Akış (v15.36)
`src/lib/pendingFlow.ts` — `startFlow`, `advanceFlow`, `completeFlow`, `cancelFlow`, `getActiveFlow`, `stepToRoute`, `stepLabel`.

## siparisSilKapsamli (mrp.ts)
Sipariş silme 7-adım kapsamlı.

## Tedarik helper'ları (v15.27)
`src/lib/tedarikHelpers.ts` — `markTedarikGeldi`, `markTedarikGelmedi`.

## Bar Model (v15.31, v15.35 genişletildi)
`src/features/production/barModel.ts`:
- `isBarMaterial(m) / isBarMaterialByKod`
- `barModelSync(woId, plans, wos, logs, mats)` — v15.35 havuzBarId bilinçli
- `acikBarHavuzuToplamMm`, `acikBarTuket`
- Deterministik ID'ler

## Cutting (v15.35 genişletildi)
`src/features/production/cutting.ts`:
- `kesimPlanOlustur`
- `boykesimOptimum(g, wos, mats, logs, mevcutSatirlar?, havuzBarlari?)` — havuz seed
- `havuzdanYenidenOptimize` — plan + seçilen havuz barları → güncel plan
- `kesimPlanlariKaydet`

## Fire Telafi
`src/features/production/fireTelafi.ts`:
- `fireTelafiIeOlustur(fire, orijinalWo)` → `{ woId, ieNo }` (⚠️ not `.id`)
- `topluFireTelafi`

## Test (v15.37) ⭐ YENİ
`src/lib/testRun.ts` + `src/lib/testRunner.ts`:
- `startTestRun`, `finishTestRun`, `cancelTestRun`, `cascadeDeleteTestRun`
- `tempSetActiveTestRunId` — senaryo sub-run için geçici override
- `senaryo1..senaryo6` — her biri `runWithIsolation` wrapper ile (v15.38 ile 6)
- `SenaryoRapor` — JSON rapor tipi

## Validations (v15.38) ⭐ YENİ
`src/features/production/validations.ts` — 3 saf fonksiyon:
- `canProduceWO`, `canDurus`, `canDeleteWO`
- UI ve test runner ortak kullanır
- `ValidationResult { ok, reason?, meta? }` döner
- Admin bypass YOK

## fetchAll (v15.33)
`src/lib/supabase.ts` — pagination helper.

---

# 11. Geliştirme Ortamı ve İş Akışı

## Ortam

- **Lokal:** Node.js + git PATH'te YOK → GitHub Desktop + Supabase web UI + PowerShell
- **İki makine:** iskender.uzun (ana) + Iskender (ikincil)
- **Git PATH geçici:** `$env:Path += ";$env:LOCALAPPDATA\GitHubDesktop\app-3.5.8\resources\app\git\cmd"`
- **Git pager:** `$env:GIT_PAGER = "cat"` (less yok)
- **Repo:** `C:\Users\iskender.uzun\Documents\GitHub\ozler-uys-v3`
- **Supabase:** lmhcobrgrnvtprvmcito (Frankfurt)
- **Canlı:** `https://uzuniskender.github.io/ozler-uys-v3/`

## İş akışı (v15.35+)

1. Buket repoyu `git pull --rebase`
2. Claude patch hazırlar: zip içinde `src/`, `sql/`, `apply.ps1`
3. Buket zip'i `Downloads`'a indirir → `Expand-Archive`
4. `powershell -ExecutionPolicy Bypass -File .\apply.ps1` — dosyaları yerleştirir + git status
5. Varsa Supabase SQL adımı (apply uyarır)
6. `git add + commit + push --no-verify` (pre-push hook bozuk)
7. GitHub Actions build + deploy (~30 sn)

## apply.ps1 kuralları

- **ASCII-only** (Türkçe karakter yok) — PowerShell encoding sorunu
- **UTF-8 BOM** — PowerShell 5.x için
- Parametre `-RepoPath` opsiyonel

---

# 12. Yetkilendirme (RBAC)

- `permissions.ts` — 80+ aksiyon, 20 grup, 4 rol (admin/uretim_sor/planlama/depocu)
- `useAuth.ts` — `can()` fonksiyonu
- `uys_kullanicilar` + `uys_yetki_ayarlari` tabloları
- YetkiPanel UI matris

**v15.34+ yeni aksiyon:** `acikbar_hurda` (Depo grubu, planlama+depocu default)

---

# 13. Otomatik Yedekleme + Dokümantasyon Kuralı ⭐ YENİ

## Yedekleme
Private repo `ozler-uys-backup`, her gece TR 06:00'da Supabase db dump → `backups/YYYY-MM-DD/`.

## Bilgi Bankası + İş Listesi GitHub kuralı (v15.37 — bugün karar verildi)

**Kural:** Claude bilgi bankası veya iş listesi güncellerken **manuel dosya upload beklemez**. Patch'in içinde `docs/` klasörü olur:

```
patch/
├── src/...
├── sql/...
├── docs/
│   ├── UYS_v3_Bilgi_Bankasi.md      # Güncel KB
│   ├── UYS_v3_Is_Listesi.md         # Güncel iş listesi
│   └── DEVAM_NOTU.md                # Yeni oturum için
└── apply.ps1
```

`apply.ps1` bunları `docs/` klasörüne (repo'daki) otomatik kopyalar. Commit+push ile GitHub'da kalıcı.

**Böylece:**
- Buket manuel dosya attmıyor, Claude manuel yükleyemiyor
- Her commit'le beraber bilgi bankası güncel tutulur
- Geçmiş sürümler git history'de
- Yeni bilgisayarda `git clone` → her şey hazır

---

# 14. Audit ve Test Altyapısı

## scripts/audit-schema.cjs + audit-columns.cjs
- DB şeması vs kod listeleri
- Kod insert/update kolonları vs DB (silent reject önleme)
- **DB'ye canlı bağlanmaz** — `sql/*.sql` dosyalarındaki CREATE/ALTER parse eder
- **Ders (v15.34):** Schema değiştiren her commit'e `sql/YYYYMMDD_xxx.sql` eklenmeli

## Prebuild hook
`npm run build` öncesi audit otomatik.

## pre-push hook (v15.40 + v15.40.1 hotfix, ÇALIŞIYOR ✅)
**Kaynak:** `scripts/git-hooks/pre-push` (repoda versionable).
**Aktivasyon:** `git config core.hooksPath scripts/git-hooks` — makine başına bir kez, ya manuel ya `scripts/install-hooks.ps1` ile.
**Kapsam:** 3 check — `node scripts/audit-schema.cjs`, `node scripts/audit-columns.cjs`, `./node_modules/.bin/tsc --noEmit`.
**PATH fix:** Git Bash için `/c/Program Files/nodejs` + npm global dizinleri. İki makine (Iskender + iskender.uzun) için de çalışır.
**tsc çağrısı kritik not:** `npx --no-install tsc` KULLANILMAZ — npx "tsc" adını registry'deki yanlış pakete (eski `tsc@2.0.4`) çözümlüyor. Doğrudan `./node_modules/.bin/tsc` kullanılmalı.
**LF zorunluluğu:** `.gitattributes` dosyası `scripts/git-hooks/*` için `eol=lf` belirliyor. Windows checkout CRLF'ye dönüştürürse hook bash shebang'i kırılır.
**Bypass:** `git push --no-verify` — her zaman mümkün, acil durumlar için.

## Playwright E2E (v15.15)
Test Supabase **cowgxwmhlogmswatbltz** (Frankfurt). 9/9 test yeşil.

## v15.37 Test Modu — YENİ
Canlı Supabase'de izole test. Detay §9.

---

# 15. Bilinen Buglar ve Backlog

## 🔴 Öncelik 0 — KRİTİK
Temiz.

## 🟡 Öncelik 1 — ORTA
- Stok anomalisi (Senaryo 5 -3 gösterimi, rapor okunabilirliği)

## 🟢 Küçük iyileştirmeler
- Havuz geri alma UI
- Manuel plan'da havuz önerisi
- Hurda geri alma UI (admin only)
- Operator ve Admin için test kapsamı
- Toplu senaryo farklı reçetelerle çalıştırılabilir

---

# 16. Öğrenilenler — v15.33 → v15.37

## Schema migration disiplini (v15.34)
Sadece Supabase'de SQL çalıştırmak yetmez. Audit `sql/*.sql` okuduğu için repoya da migration dosyası commit'lenmeli.

## PowerShell encoding (v15.35)
Türkçe karakterli .ps1 dosyaları PS 5.x'te bozuk okunur. UTF-8 BOM + ASCII-only yaz.

## Git pager
Windows'ta `less` yok → `$env:GIT_PAGER = "cat"`.

## Git hook PATH
Git Bash hook'ları PowerShell PATH'ini görmez. Explicit PATH satırı lazım (bekliyor).

## Route name eşleştirme (v15.36)
App.tsx'teki route isimleriyle `navigate()` çağrıları birebir eşleşmeli. v15.36'da `/siparisler` yerine `/orders` olmalıydı (bug).

## React state closure (v15.36)
`setTimeout(() => fn(), N)` state'e bağlı çalışmaz. Override param kullan.

## Component unmount → state reset
Sayfa değişip dönünce `useState` başa döner. Auto-rehydrate gerek (v15.36.1).

## Supabase proxy pattern (v15.37)
55 insert noktasına tek tek dokunmak yerine tek noktada proxy ile intercept. `test_run_id` otomatik injection. Çok güçlü mimari.

## Test izolasyonu (v15.37)
test_run_id etiketi + cascade delete → canlı veriye dokunmadan gerçek test. Doğrulandı: 5 senaryo ALL_PASS, DB temiz.

## Simülasyon taahhüdü
Büyük patch öncesi node.js mock simülasyonu yap. v15.36.1'de yaptım, işe yaradı.

## Saf validation fonksiyonları (v15.38)
UI engeli ve test senaryosu aynı kuralı paylaşmalı. Kural tek yerde (`validations.ts`) saf fonksiyon olarak yaz, UI ve test aynı noktayı çağırsın. Bu sayede Senaryo 6'da "yasakın çalıştığını" test etmek için DB manipülasyonu gerekmez — saf input/output kontrolü yeterli. Helper fonksiyonları (ör. `_uretimGirisi`) UI katmanını bypass ettiği için yasak testlerini helper üzerinden **yapamazsın**; doğrudan validation fonksiyonunu çağır.

## Admin bypass tehlikeli (v15.38)
Yasak 1 için admin bypass önerildi ama reddedildi ("giremez"). Doğru karar — stok olmadan üretim hayali envanter üretir, kalite ve muhasebe çakışır. Admin istisnası sistemsel bütünlüğü bozar, sadece onay modali eklenebilir (eklenmedi).

---

# 17. Referanslar

## Dosya yapısı (v15.37)

```
ozler-uys-v3/
├── .git/hooks/pre-push              # v15.35 (bozuk)
├── .github/workflows/deploy.yml     # audit + tsc + vite + pages
├── .github/workflows/backup.yml     # Nightly Supabase dump
├── docs/                             ⭐ YENİ v15.37
│   ├── UYS_v3_Bilgi_Bankasi.md      # Bu dosya
│   ├── UYS_v3_Is_Listesi.md         # Test senaryoları
│   └── DEVAM_NOTU.md                # Sonraki oturum için
├── sql/
│   ├── master_schema.sql
│   ├── 20260424_v15_34_hurda.sql
│   ├── 20260424_v15_34_fire_tip.sql
│   ├── 20260424_v15_36_pending_flows.sql
│   └── 20260424_v15_37_test_mode.sql   ⭐ YENİ
├── scripts/audit-schema.cjs, audit-columns.cjs
├── scripts/git-hooks/pre-push              ⭐ v15.40 YENİ (versioned hook)
├── scripts/install-hooks.ps1               ⭐ v15.40 YENİ
├── src/
│   ├── features/production/
│   │   ├── mrp.ts                   # v15.35+35.3
│   │   ├── barModel.ts              # v15.35
│   │   ├── cutting.ts               # v15.35
│   │   ├── fireTelafi.ts
│   │   ├── autoChain.ts
│   │   └── validations.ts           ⭐ v15.38 YENİ
│   ├── pages/
│   │   ├── Warehouse.tsx            # v15.34+34.2
│   │   ├── CuttingPlans.tsx         # v15.35+35.1+35.2
│   │   ├── MRP.tsx                  # v15.35.3+36.1
│   │   ├── Reports.tsx              # v15.34.3
│   │   ├── Orders.tsx               # v15.36
│   │   ├── WorkOrders.tsx           # v15.36
│   │   ├── Procurement.tsx          # v15.36
│   │   ├── TestMode.tsx             ⭐ v15.37 YENİ
│   │   └── ...
│   ├── components/
│   │   ├── FlowProgress.tsx         # v15.36
│   │   └── layout/Topbar.tsx, Sidebar.tsx
│   ├── lib/
│   │   ├── pendingFlow.ts           # v15.36
│   │   ├── testRun.ts               ⭐ v15.37 YENİ
│   │   ├── testRunner.ts            ⭐ v15.37 YENİ
│   │   ├── supabase.ts              # v15.37 proxy genişletildi
│   │   └── ...
│   ├── store/index.ts               # TABLE_MAP güncel
│   ├── types/index.ts               # PendingFlow + TestRun
│   └── lib/permissions.ts
└── package.json
```

## Canlı erişim
- Frontend: `https://uzuniskender.github.io/ozler-uys-v3/`
- Supabase: `https://lmhcobrgrnvtprvmcito.supabase.co`
- GitHub: `https://github.com/uzuniskender/ozler-uys-v3`

## Son canlı sürüm
**v15.40.1** — Pre-push Hook hotfix (tsc doğru çağrı + .gitattributes LF enforce).

---

*Bu belge v15.40.1 itibariyle günceldir. Sonraki oturumlarda patch'in içinde `docs/UYS_v3_Bilgi_Bankasi.md` olarak güncellenecek, manuel upload beklenmeyecektir.*
