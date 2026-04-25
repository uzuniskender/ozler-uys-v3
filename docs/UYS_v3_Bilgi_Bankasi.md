# UYS v3 — Bilgi Bankası

*Üretim Yönetim Sistemi*

Özler Kalıp ve İskele Sistemleri A.Ş.

**Sürüm: v15.47.3** (statusUtils yayılım + 'beklemede' bug fix + §18.3 güncellemesi)

Son Güncelleme: **25 Nisan 2026** (21. oturum hotfix #3 — kapsam genişletme)

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
18. İndirilenler Hijyen Kuralı
18.2. Yeni Tablo Konvansiyonu
18.3. Durum String Konvansiyonu ⭐ YENİ

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
- **v15.41**: Stok anomalisi rapor düzeltmesi. Test senaryolarında `_uretimGirisi` ve `_uretimGirisiFire` helper'ları doğrudan DB'ye insert yapıyor, UI'daki `OperatorPanel.save()` → `canProduceWO()` yolunu atlıyor. Bu sebeple rapora `-3 stok` gibi anomalik değerler düşebiliyor (özellikle Senaryo 5'te fire dahil 8 hammadde tüketimi sebebiyle). Rapor okunabilirliğini artırmak için `SenaryoAdim` tipine opsiyonel `bypassNotu?: string` alanı eklendi; `adim()` helper'ına opsiyonel `meta` parametresi eklendi. 6 üretim adımı (S1 #5, S2 #5, S3 #10, S4 #10, S5 #5 fire, S5 #9 telafi) artık `BYPASS_NOTU_URETIM` sabit metnini taşıyor. `TestMode.tsx` canlı log render'ı bypassNotu varsa adım kartının altında ℹ️ ikonu + gri italik açıklama satırı gösteriyor. JSON raporda da alan korunuyor → arşivlenen rapor okuyucusu kasıtlı bypass'ı görebiliyor. **Hiçbir mantık değişmedi** — yalnız tip + UI metadata; PASS/FAIL kararları, validation kuralları, helper davranışları aynı.
- **v15.42**: `uys_work_orders.termin` kolonu eklendi. audit-columns 4 trace incelemesi sırasında ortaya çıktı — `autoChain.ts:64` her İE oluşturulurken `termin: termin || null` yazıyordu ama DB'de kolon yoktu, Supabase silent reject ediyordu. Bilgi Bankası §5.2 "Her İE kendi terminine sahip" hedefi DB seviyesinde desteklenmiyordu. Migration (`sql/20260425_v15_42_wo_termin.sql`): (1) `ALTER TABLE uys_work_orders ADD COLUMN termin text`, (2) Geriye dönük backfill — mevcut İE'lerin terminini `uys_orders.termin` alanından kopyalar (order_id join). Kod değişikliği YOK — autoChain.ts zaten doğru yazıyordu, artık DB'ye değer iletiliyor. İE bağımsız termini şu andan itibaren persist ediliyor. Doğrulama: 75 İE total, 15 backfill (siparişin termini vardı), 60 terminsiz (test/sipariş termini boştu).
- **v15.43**: `audit-columns.cjs` yorum temizleyici. Önceki sürümde `supabase.from(...)` regex'i JSDoc/inline yorumları kod sanıp false positive trace warning üretiyordu (örn. `testRun.ts:172` JSDoc içindeki kullanım örneği). Yeni `stripComments()` state machine helper'ı: (1) Block yorum `/* ... */` → boşluğa, (2) Line yorum `// ...` → boşluğa, (3) String literal'ler (`'`, `"`, `` ` ``) korunur — URL'lerdeki `//` ve template literal içindeki yorum benzeri içerik etkilenmez, (4) Newline'lar korunur — satır numaraları ve regex offset'leri bozulmaz. `extractUsages()` artık strip'lenmiş içerik üzerinde çalışır; tüm aşağıdaki regex/parser otomatik yorum-bağımsız hale geldi. Beklenen sonuç: trace warning sayısı 4'ten 3'e düşer (testRun.ts:172 listede olmaz).
- **v15.44**: Üç UI işi tek patch — geri alma ve manuel plan havuz önerisi. (1) **Hurda geri alma UI**: Warehouse.tsx "Hurdaya Gönderilen" alt tab'ında her satıra "↩ Geri Al" butonu (admin only, RBAC: `acikbar_hurda_geri_al`). `barModel.ts.acikBarHurdadanGeriAl()` durumu 'hurda' → 'acik' yapar, hurda_* alanlarını temizler. fire_logs SİLİNMEZ — kayıt `not_` alanına `[İPTAL: tarih kullanıcı]` prefix eklenir → audit trail korunur. fire_log id'si artık deterministik (`'fire-bar-hurda-' + acikBarId`) → idempotent + geri alma sırasında bulunabilir. (2) **Havuz geri alma UI**: yeni "Tüketilmiş Bar" alt tab'ı. Admin'e "↩ Geri Al" butonu (RBAC: `acikbar_havuz_geri_al`). `acikBarTuketimGeriAl()` durumu 'tuketildi' → 'acik' yapar, tuketim_* alanlarını temizler. **Stok hareketlerine DOKUNULMAZ** — eğer üretim gerçekten yapıldıysa stok zaten düşmüştür, otomatik geri alma double-counting yaratır. Yanlış işaretleme senaryosu için tasarlandı. Confirm dialog'da net uyarı. (3) **Manuel plan'da havuz önerisi**: KesimOlusturModal `kaydet()` artık yeni planId'yi `onSaved(planId)` callback'ine iletiyor. Parent CuttingPlans bu ID ile otomatik plan'daki havuz tarama mantığının aynısını çalıştırıyor (en küçük parça boyu vs. havuz bar uzunluğu kontrolü). Uygun havuz barı varsa HavuzOneriModal açılır. Schema değişikliği YOK, kod-only patch.
- **v15.45**: Operasyonel disiplin paketi. (1) **İndirilenler Hijyen Kuralı** — yeni bölüm §18'e eklendi. Her patch teslim mesajının sonunda Claude bir cleanup komutu verir; apply + push doğrulandıktan sonra kullanıcı bu komutu çalıştırır → Downloads'taki ilgili patch zip + extracted klasör silinir. Repo dosyaları ASLA Downloads'a kopyalanmaz, içerik dosyaları (planlar, notlar) repoya taşınır. (2) **Faz B planı repoya taşındı** — Downloads kalıntılarında bulunan v15.21 dönemi `faz_b_plan.md` (Sipariş Termin Farkındalığı, 3 parçalı plan) artık `docs/faz_b_plan.md`. Parça 1 zaten v15.42 ile yapıldı (uys_work_orders.termin); Parça 2 (MRP termin-gruplu) ve Parça 3 (Kesim'de manuel kalem seçimi) backlog'a alındı.
- **v15.46**: İş Emirleri arşivi repoya taşındı. Eski "Günaydın" oturumunda hazırlanan **6 detaylı iş emri** + **21 maddelik master backlog** + **10 öneri özeti** artık `docs/is_emri/` altında. Dosyalar: `00_BACKLOG_Master.md` (özet + durum + kategoriler), `01_OperatorPaneli.md` (production-blocker, /operator route, RBAC operator rolü, mobil-first), `02_YedeklemeYonetimi.md` (/backup route, JSON snapshot, geri yükleme), `03_UretimZinciri.md` (autoZincir + MRP modal + Kesim optimizasyon + Üst bar göstergeleri — 4 büyük özellik tek iş emri), `04_Sevkiyat.md` (oluşturma formu + sipariş bazlı kalan hesabı + yasal irsaliye), `05_VeriOperasyonlari.md` (Toplu Sipariş Excel + PDF çıktı + Stok Onarım — 3 bölüm), `06_ProblemTakip.md` (KPI 4. kart, sekmeli modal, tarihce/yorum tabloları, Excel I/O). 10 öneri 6 iş emrinde paketlendi çünkü bazıları birbirine bağımlı (örn. üretim zinciri 4 özelliği bir arada). 11 madde çıkarıldı (gerekçeleriyle master backlog'da). Doc-only patch — kod değişikliği YOK.
- **v15.47**: Üretim Zinciri Faz 1 + Faz 5 başlangıcı (`docs/is_emri/03_UretimZinciri.md`). 3 küçük parça tek patch'te: (1) **DB veri modeli** — `uys_kesim_planlari`'ya 4 yeni kolon (`ham_en`, `ham_kalinlik`, `fire_kg`, `artik_malzeme_kod`), `uys_tedarikler`'e 2 yeni kolon (`auto_olusturuldu`, `mrp_calculation_id`), yeni tablo `uys_mrp_calculations` (her MRP run snapshot'ı için JSONB alanlar: `brut_ihtiyac`, `stok_durumu`, `acik_tedarik`, `net_ihtiyac`). Bu altyapı Faz 2-4 (kesim optimizasyon + MRP modal + autoZincir) için hazır. Migration idempotent + RAISE NOTICE ile doğrulama. (2) **2 yeni RBAC aksiyonu** — MRP grubuna `tedarik_auto` ve `auto_chain_run` eklendi (planlama default). `mrp_calculate` ve `cutting_optimize` zaten mevcut (`mrp_calc`, `cutting_add`), duplicate yaratılmadı. (3) **Üst bar zincir göstergeleri** — Topbar.tsx'e 3 tıklanabilir badge: `[KESİM 🔴 N]` (kesim operasyonu olan, plana atanmamış İE sayısı), `[MRP 🟡 N]` (mrpDurum != 'tamamlandi' aktif sipariş sayısı), `[TEDARİK 🟢 N]` (geldi=false bekleyen tedarik sayısı). Renk: 0=yeşil, 1-5=sarı, 6+=kırmızı. `useMemo` ile cache'li, ilgili 4 store array değişince yeniden hesaplanır. Tıklayınca filtreli sayfaya yönlendirir (`#/cutting`, `#/orders`, `#/procurement`). Mobile'de gizli (`hidden md:flex` — küçük ekranda yer kalmıyor).
- **v15.47.1 (hotfix + konvansiyon)**: Push sırasında audit-schema FAIL verdi — yeni `uys_mrp_calculations` tablosu store ve DataManagement listesinde olmadığı için. Whitelist'lere yorumlu giriş eklendi (Faz 3'te modal kendi fetch edecek, backup gereksiz çünkü snapshot yeniden hesaplanabilir). **Asıl önemli:** Bu durum gelecekte 5+ kez tekrar gelecekti (İş Emri #2, #4, #5, #6 hepsinde yeni tablolar geliyor). Bilgi Bankası §18.2 "Yeni Tablo Konvansiyonu" bölümü eklendi: her yeni migration'a 2 satırlık intent yorumu (BACKUP: evet/hayır + STORE: hangi sürümde eklenecek), karar matrisi (4 farklı tablo tipine göre nereye girer), kontrol listesi. Bir sonraki tablo geldiğinde bu konvansiyon takip edilirse aynı sıkıntı yaşanmaz.
- **v15.47.2 (hotfix #2 + konvansiyon)**: v15.47'deki Topbar MRP badge'i 12 gösterdi ama gerçek 0 olmalıydı. SQL doğrulamasıyla ortaya çıktı: `uys_orders.durum` eski siparişlerde `'kapalı'`, `mrp_durum` ise `'tamam'` (kısa form). Topbar mantığı sadece `'iptal'/'tamamlandi'` filtresi kullanıyordu, bu eski string'leri kaçırıyordu. **Çözüm:** `src/lib/statusUtils.ts` yeni dosya — 4 helper (`isOrderActive`, `isOrderMrpPending`, `isWorkOrderOpen`, `isCuttingPlanActive`, `isProcurementPending`) tüm bilinen string varyantlarını normalize ediyor. Topbar artık bu helper'ları kullanıyor; mantık 2 satıra düştü. Aynı helper'lar gelecekte başka sayfalarda da kullanılabilir, tutarlılık sağlanır. **Asıl önemli:** DB seviyesinde 4 farklı "tamamlandı" kavramı varyantı tespit edildi (`'tamamlandi'`, `'tamam'`, `'kapalı'`, `'kapali'`). Bilgi Bankası §18.3 "Durum String Konvansiyonu" eklendi — her tablo için kullanılan durum string'leri belge edildi, DB-wide migrate riskli olduğu için kod seviyesinde normalize stratejisi açıklandı, gelecek için yeni durum eklerken kontrol listesi eklendi.
- **v15.47.3 (hotfix #3 + yayılım)**: statusUtils.ts yayılımı 4 sayfaya — kapsam audit'i sırasında **gerçek bir bug** ortaya çıktı: WorkOrders.tsx'te `'beklemede'` (paused) durumu var ama Topbar `isWorkOrderOpen` helper'ı sadece `'tamamlandi'/'iptal'` filtreliyordu. **Sonuç:** Paused İE'ler "açık" sayılıyor, KESİM badge'inde false positive sayım yapıyordu. Düzeltme: `WO_CLOSED_OR_PAUSED_STATES` 3'lü set (`'tamamlandi'`, `'iptal'`, `'beklemede'`) → paused İE'ler artık plana alınmıyor. **2 yeni helper:** `isCuttingPlanPending(cp)` (CuttingPlans liste için), `isAcikBarAvailable(b)` (havuz önerisi için — gelecekte de kullanılır). **2 sayfa refactor:** `Procurement.tsx` 5 yer (filtered, markGeldiBulk, toggleSelectAll, toplamBekleyen, bulk select checkbox — `!t.geldi` → `isProcurementPending(t)`), `CuttingPlans.tsx` 7 yer (3 wo durum filtresi → `!isWorkOrderOpen(w)`, 3 acikBar durum kontrolü → `isAcikBarAvailable(a)`, 1 plan durum filtresi → `isCuttingPlanPending`). `Orders.tsx` ve `WorkOrders.tsx` çoğunlukla insert/update payload veya UI eşleştirme, helper'a sokmak gereksizdi (bilerek dokunulmadı). §18.3 DB snapshot tablosu güncellendi — 3 yeni keşif: `uys_work_orders.durum`'da `'beklemede'`, `uys_orders.mrp_durum`'da `'eksik'`/`'calistirildi'`, `uys_acik_barlar.durum` (yeni satır: `'acik'`/`'tuketildi'`/`'hurda'`).

---

# 2. BİR SONRAKİ OTURUMA NOTLAR ⭐

## ✅ TAMAMLANAN — v15.38 → v15.43

**v15.38: Yasak Kontrolleri** — stok/duruş/silme engeli, Senaryo 6 (10/10 OK).

**v15.39: SR #11 Havuz Adaptasyonu** — normal + havuz ayrımı, 3 eksik tipi. **11/11 PASS doğrulandı** (timestamp 2026-04-24T21:15).

**v15.40 + v15.40.1: Pre-push Hook** — `scripts/git-hooks/pre-push` repoda versionable. `core.hooksPath` ile aktive. 3 check: audit-schema, audit-columns, tsc --noEmit. PATH fix: Git Bash `/c/Program Files/nodejs` + npm global (iki makine paths). Hotfix: doğrudan `./node_modules/.bin/tsc` + `.gitattributes` LF enforce. **3/3 PASS doğrulandı** (timestamp 2026-04-25).

**v15.41: Stok Anomalisi Rapor Düzeltmesi** — `SenaryoAdim.bypassNotu` alanı + `BYPASS_NOTU_URETIM` sabiti. 6 üretim adımına bypass notu işlendi. UI'da ℹ️ + gri italik alt satır. JSON raporda da yer alır.

**v15.42: uys_work_orders.termin kolonu** — audit-columns 4 trace incelemesinden çıktı. autoChain.ts zaten yazıyordu, DB'de kolon eksikti. Migration ile eklendi + backfill yapıldı (75 İE, 15 backfill).

**v15.43: audit-columns yorum temizleyici** — `stripComments()` state machine helper. JSDoc içindeki örnek `supabase.from(...)` çağrıları artık false positive üretmiyor. Beklenen: 4 trace warning → 3.

**v15.44: Geri alma UI'ları + manuel plan havuz önerisi** — 3 küçük iş tek patch. Hurda geri alma + havuz geri alma (admin only, audit trail korunur). Manuel plan kaydet sonrası havuz önerisi modal'ı (otomatik plan'la eşit deneyim).

**v15.45: Operasyonel disiplin** — İndirilenler Hijyen Kuralı (§18) + Faz B planı repoya taşındı (`docs/faz_b_plan.md`).

**v15.46: İş Emirleri arşivi** — `docs/is_emri/` altında 6 detaylı iş emri + master backlog (21 madde + 10 öneri).

**v15.47: Üretim Zinciri Faz 1+5** — DB veri modeli (kesim_planlari + tedarikler genişleme + yeni mrp_calculations tablosu) + 2 RBAC + Topbar 3 badge (KESİM/MRP/TEDARİK 🔴/🟡/🟢). İş Emri #3'ün ilk parçası.

## 🟡 Sıradaki Öncelik

**İş Emri #3 devamı** (`docs/is_emri/03_UretimZinciri.md`):

- **v15.48: Faz 2 — Kesim Optimizasyon** (algoritma + UI). En az fire/en çok parça kuralı, greedy first-fit, 50 iterasyonlu fire optimize, plan birleştirme, kesim artığı → otomatik malzeme kartı. `cutting-optimizer.ts` yeni dosya + 5 senaryo birim test.
- **v15.49: Faz 3 — MRP Modal** (refactor + UI). Mevcut `mrp.ts` refactor edilecek. **Faz B Parça 2 ile entegre yapılırsa daha verimli** — termin gruplu MRP aynı anda. MRPModal.tsx yeni dosya.
- **v15.50: Faz 4 — autoZincir** (orchestration). Sipariş → İE → Kesim → MRP → Tedarik tek tıkla. Progress modal. Mevcut `autoChain.ts` üzerine eklenecek.
- **v15.50.1: Faz 6 — Test** (Playwright E2E + birim).

**Alternatif yön** — Faz B kalan parçalar (`docs/faz_b_plan.md`): Parça 2 (MRP termin-gruplu) ile Parça 3 (Kesim manuel kalem seçimi). v15.49 ile entegre yapılabilir.

## 🟢 Küçük İşler

- Toplu senaryo farklı reçetelerle çalıştırılabilir
- Operator + Admin için test kapsamı (S1-S5 tüm rollerde tekrar)

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
Temiz.

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
│   ├── DEVAM_NOTU.md                # Sonraki oturum için
│   ├── faz_b_plan.md                ⭐ v15.45 YENİ (Sipariş Termin Farkındalığı)
│   └── is_emri/                     ⭐ v15.46 YENİ (Master backlog + 6 detaylı iş emri)
│       ├── 00_BACKLOG_Master.md     # 21 madde + 10 öneri özeti + durum
│       ├── 01_OperatorPaneli.md     # /operator route (production-blocker)
│       ├── 02_YedeklemeYonetimi.md  # /backup route (production-blocker)
│       ├── 03_UretimZinciri.md      # autoZincir + MRP + Kesim + Üst bar
│       ├── 04_Sevkiyat.md           # Sevkiyat oluşturma formu
│       ├── 05_VeriOperasyonlari.md  # Toplu Sipariş + PDF + Stok Onarım
│       └── 06_ProblemTakip.md       # KPI + tarihçe + yorum
├── sql/
│   ├── master_schema.sql
│   ├── 20260424_v15_34_hurda.sql
│   ├── 20260424_v15_34_fire_tip.sql
│   ├── 20260424_v15_36_pending_flows.sql
│   ├── 20260424_v15_37_test_mode.sql
│   ├── 20260425_v15_42_wo_termin.sql
│   └── 20260425_v15_47_uretim_zinciri_faz1.sql      ⭐ v15.47 YENİ
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

# 18. İndirilenler Hijyen Kuralı (v15.45) ⭐ YENİ

## Temel Kural

Her patch teslim mesajının **SONUNDA** Claude bir cleanup komutu verir. Apply + push doğrulandıktan sonra kullanıcı bu komutu çalıştırır → Downloads'taki ilgili patch zip + extracted klasör silinir.

## Komut Formatı (her patch için)

```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-vXX-YY.zip","$env:USERPROFILE\Downloads\patch-vXX-YY" -Recurse -Force -ErrorAction SilentlyContinue
```

(`vXX-YY` her patch'te kendine has — ör. `v15-45`, `v15-46`, ...)

## Kurallar

1. **Patch zip'leri** apply + push doğrulandıktan sonra silinir — repo'da var, GitHub'da var, Downloads'ta tutmaya gerek yok
2. **Upload için hazırlanan zip'ler** (`uys_xxx.zip`, `audit_xxx.zip` — Buket'in Claude'a gönderdiği geçici paketler) Claude'a yüklendiğinde işini yaptı, hemen silinebilir
3. **Repo dosyaları** (`src/`, `docs/`, `scripts/`, `.git/`, `sql/`) **ASLA Downloads'a kopyalanmaz** — `Documents\GitHub\ozler-uys-v3\` tek doğru yer. Duplicate riskini önler.
4. **İçerik dosyaları** (planlar, notlar, eski belgeler) repoya taşınır → Downloads'ta bırakılmaz. Örnek: v15.45'te `faz_b_plan.md` → `docs/faz_b_plan.md`
5. **Bilgi bankası repo'da tutulur** — `docs/UYS_v3_Bilgi_Bankasi.md` tek geçerli versiyon. Downloads'ta veya başka yerde eski kopyalar varsa SİLİNİR.

## Klasör Yapısı

| Yer | İçerik | Yaşam Süresi |
|---|---|---|
| `Downloads\` | Geçici zip'ler (patch + upload) | Patch sonrası silinir |
| `Documents\GitHub\ozler-uys-v3\` | **Tek geçerli repo** | Kalıcı |
| `Documents\GitHub\ozler-uys-v3\docs\` | Bilgi bankası, iş listesi, planlar | Kalıcı (versionable) |

## İlk Test (v15.45 oturumunda)

Buket Downloads klasöründe biriken eski 13+ patch zip + 3 upload zip + 3 eski repo zip + 1 kopya `GitHub\ozler-uys-v3\` klasörü tespit etti. Tek seferlik temizlik komutuyla hepsi silindi. v15.45 patch'i bu kuralı kalıcı hale getirdi: Claude bundan sonra her patch'in sonunda cleanup komutu verecek.

---

# 18.2 Yeni Tablo Konvansiyonu (v15.47.1) ⭐ YENİ

## Sorun

v15.47'de `uys_mrp_calculations` tablosu eklendiğinde `audit-schema.cjs` push'ı engelledi: "Bu tablo store ve DataManagement listesinde yok". Çünkü tablo Faz 3'te kullanılacak ama Faz 1'de oluşturuldu — şu an boş duruyor, kimse fetch etmiyor.

Aynı durum gelecekte 5+ kez daha gelecek (İş Emri #2 → `pt_yedekler`, #4 → `sevk_satirlari`, #5 → `stok_onar_logs`, #6 → `pt_tarihce` + `pt_yorumlar`). Bu konvansiyon o tekrarı önlemek için.

## Yeni Tablo İçin Karar Matrisi

Bir migration'da yeni tablo eklerken **4 soru** sorulmalı:

| Soru | Evet → | Hayır → |
|------|--------|---------|
| **Q1.** UI bu tabloyu fetch edip listeleyecek mi (LoadAll)? | `store/index.ts` TABLE_MAP'e mapper ekle | `STORE_WHITELIST`'e ekle (yorumla) |
| **Q2.** Realtime subscription gerekli mi (anlık güncelleme)? | TABLE_MAP'te otomatik dahil | `STORE_WHITELIST` yeterli |
| **Q3.** JSON yedek/restore'a dahil mi? | `DataManagement.tsx` `tables` listesine ekle | `DATA_MGMT_WHITELIST`'e ekle (yorumla) |
| **Q4.** Tablo runtime'da kullanılabilir hale gelecek mi? | Hangi sürümde? (yorum) | Tek seferlik göç/audit (yorum) |

## 4 Tablo Tipi ve Nereye Gider

### Tip A: First-class tablo (kullanıcı verisi)
**Örnek:** `uys_orders`, `uys_work_orders`, `pt_problemler`, `sevk_satirlari` (gelecek)

**Eylem:**
1. `store/index.ts`: yeni mapper + TABLE_MAP girişi
2. `types/index.ts`: TypeScript interface
3. `DataManagement.tsx`: `tables` listesine ekle
4. **Whitelist'e EKLENMEZ**

### Tip B: Audit / log tablosu (tarihsel kayıt, runtime UI yok)
**Örnek:** `uys_v15_31_silinen_hareketler`, `stok_onar_logs` (gelecek)

**Eylem:**
1. `STORE_WHITELIST`'e ekle (UI fetch etmiyor)
2. `DataManagement.tsx` listesine **EKLE** (audit kaydı yedeklenmeli — silinirse kaybolur)
3. **DATA_MGMT_WHITELIST'e EKLENMEZ**

### Tip C: Snapshot / cache (yeniden hesaplanabilir)
**Örnek:** `uys_mrp_calculations` (v15.47), gelecekte cache tabloları

**Eylem:**
1. `STORE_WHITELIST`'e ekle (modal/sayfa kendi fetch edecek)
2. `DATA_MGMT_WHITELIST`'e ekle (backup gereksiz, yeniden hesaplanabilir)
3. Migration yorumunda hangi sürümde dolacağı belirtilmeli

### Tip D: Backup tablosu (yedek için yedek)
**Örnek:** `pt_yedekler` (gelecek — İş Emri #2)

**Eylem:**
1. **STORE_WHITELIST'e EKLE** (büyük JSON blob, global state'e yüklenmemeli)
2. **DATA_MGMT_WHITELIST'e EKLE** (yedeğin yedeğini almak abes)
3. Backup sayfasında özel UI ile yönetilir

## Migration Yorumu Şablonu

Her yeni tablo migration'ının başında 2 satırlık intent yorumu:

```sql
-- v15.XX — yeni_tablo_adi
-- TIP: A | B | C | D (bkz. §18.2)
-- BACKUP: evet | hayir (sebep)
-- STORE: yapıldı | sürüm (yapılacak) | hayir (kalıcı)
CREATE TABLE IF NOT EXISTS public.yeni_tablo_adi (
  ...
);
```

**Örnek (uys_mrp_calculations için doğru hali):**
```sql
-- v15.47 — uys_mrp_calculations
-- TIP: C (snapshot, yeniden hesaplanabilir)
-- BACKUP: hayir (her MRP run yeniden çalıştırılabilir)
-- STORE: v15.49 (Faz 3 MRP modal yazınca modal kendi fetch edecek)
```

## Kontrol Listesi (her yeni tablo için)

Migration yazmadan önce:
- [ ] Q1-Q4 sorularını cevapla
- [ ] Tabloyu Tip A/B/C/D'den birine sok
- [ ] Migration başına intent yorumu ekle
- [ ] Gerekiyorsa whitelist'e (yorumlu) ekle
- [ ] Gerekiyorsa store/types/DataManagement'a ekle

Push öncesi:
- [ ] `npm run build` — TypeScript hatası yok mu
- [ ] `node scripts/audit-schema.cjs` — yeşil mi
- [ ] `node scripts/audit-columns.cjs` — yeşil mi
- [ ] Hook 3/3 OK

Bu 4 madde sırası takip edilirse "schema FAIL" hatası tekrarlanmaz.

## Gelecek Tablolar İçin Önceden Karar

İş Emirlerinde gelecek tabloların önceden tip ataması:

| Tablo | Kaynak İş Emri | Tip | Aksiyon |
|---|---|---|---|
| `pt_yedekler` | #2 | D | İki whitelist'te + Backup sayfası özel fetch |
| `sevk_satirlari` | #4 | A | Tam entegrasyon (store + types + DataManagement) |
| `stok_onar_logs` | #5 | B | Store whitelist + DataManagement'a EKLE |
| `pt_tarihce` | #6 | A (audit ile karışık) | Tam entegrasyon, modal kendi fetch eder |
| `pt_yorumlar` | #6 | A | Tam entegrasyon, realtime gerek |

İlgili iş emrinde bu tipler kontrol edilmeli, yanlışsa düzeltilmeli.

---

# 18.3 Durum String Konvansiyonu (v15.47.2) ⭐ YENİ

## Sorun

DB seviyesinde tablolar arasında durum string'leri tutarsız. Aynı kavramı (örn. "tamamlandı") farklı tablolar farklı yazıyor. v15.47'de bu Topbar MRP badge'inde false positive yaratttı (12 göstermek yerine 0 olması gerekirdi).

## Mevcut Durum (DB Snapshot — v15.47.2 itibariyle, v15.47.3 ile genişletildi)

Aşağıdaki sorgu ile gerçek string'ler tespit edildi:

```sql
SELECT 'orders' AS tablo, COALESCE(durum, '(bos)') AS durum, count(*)
FROM public.uys_orders GROUP BY durum
UNION ALL ... (5 tablo için)
```

| Tablo | Durum string'leri | Kaynak |
|---|---|---|
| `uys_orders.durum` | `'kapalı'` (10), `(boş)` (2) | DB sorgusu (v15.47.2) |
| `uys_orders.mrp_durum` | `'tamam'`, `'bekliyor'`, `'eksik'`, `'calistirildi'` | DB sorgusu + Orders.tsx:281 (v15.47.3 audit) |
| `uys_work_orders.durum` | `'tamamlandi'`, `'bekliyor'`, **`'beklemede'`** ⚠️ | DB sorgusu + WorkOrders.tsx (v15.47.3 audit — paused durumu) |
| `uys_kesim_planlari.durum` | `'tamamlandi'` (25), `'bekliyor'` (11) | DB sorgusu |
| `uys_tedarikler.durum` | `'geldi'` (68) — bekleyenlerde durum boş | DB sorgusu |
| `uys_acik_barlar.durum` | `'acik'`, `'tuketildi'`, `'hurda'` | Store mapper + barModel.ts (v15.47.3 audit) |

## Tutarsızlıklar

| Kavram | Kullanılan string'ler |
|---|---|
| "Tamamlandı" | `'tamamlandi'` (modern), `'tamam'` (kısa, sadece `mrp_durum`'da), `'kapalı'` (sadece `orders.durum`'da) |
| "Bekliyor" | `'bekliyor'` (tutarlı) |
| "İptal" | `'iptal'` (tutarlı) |
| "Geldi" | `'geldi'` (sadece tedarikler) |

## Strateji — Kod Seviyesinde Normalize

DB-wide migrate (örn. `'tamam'` → `'tamamlandi'`, `'kapalı'` → `'tamamlandi'`) **YAPILMIYOR**, çünkü:
- `'kapalı'` aslında "tamamlandı"dan farklı bir kavram olabilir (sevki bitmiş, kapatılmış ama farklı semantik)
- Başka mantıklar bu string'lere bağımlı olabilir, kırarız
- Risk yüksek, fayda az

**Yerine: `src/lib/statusUtils.ts`** — tüm durum kontrolü helper'lardan geçer.

## Helper Fonksiyonları

```typescript
// statusUtils.ts (v15.47.2 + v15.47.3 genişletmesi)
isOrderActive(o)           // sipariş aktif mi (kapalı/iptal/tamamlandi değil)
isOrderMrpPending(o)       // MRP bekleniyor mu (mrp_durum 'tamam'|'tamamlandi' değil)
isWorkOrderOpen(w)         // İE açık mı — v15.47.3: 'beklemede' (paused) da kapalı sayılır
isCuttingPlanActive(cp)    // kesim planı iptal değil mi
isCuttingPlanPending(cp)   // v15.47.3 — plan tamamlanmamış (liste/sayım için)
isProcurementPending(t)    // tedarik bekleniyor mu (geldi=false ve iptal değil)
isAcikBarAvailable(b)      // v15.47.3 — açık bar havuzda kullanılabilir mi
```

Her helper içeride **bilinen tüm varyantları kontrol ediyor** (`'tamam' OR 'tamamlandi'`, `'kapalı' OR 'kapali' OR 'tamamlandi' OR 'iptal'`, WorkOrder için `'tamamlandi' OR 'iptal' OR 'beklemede'`).

## Yeni Yer / Yeni Durum Eklerken Kontrol Listesi

**Yeni bir sayfada durum filtresi yazıyorsan:**
- [ ] `statusUtils.ts`'ten ilgili helper'ı kullan, asla doğrudan `o.durum === 'tamamlandi'` yazma
- [ ] Helper yoksa **yeni helper EKLE** (içinde tüm varyantları say)
- [ ] Test: ekrandaki sayı/filtre ile DB sorgusu eşleşiyor mu?

**Yeni bir durum string'i ekliyorsan (örn. `orders.durum = 'beklemede'`):**
- [ ] İlgili `statusUtils.ts` helper'ına eklediğin string'i ekle
- [ ] Eski string'lerin (`'kapalı'`, `'tamam'`) hala desteklendiğinden emin ol
- [ ] §18.3 tablosunu güncelle (yeni satır ekle)

**Yeni bir tablo ekliyorsan ve durum alanı varsa:**
- [ ] §18.2'ye göre tipi belirle (A/B/C/D)
- [ ] Migration'da durum alanı için `CHECK (durum IN (...))` constraint **DÜŞÜN** (yeni tablolar tutarlı kalsın)
- [ ] §18.3 tablosuna yeni satır ekle

## DB-Wide Standartlaştırma Kararı (Gelecek)

Bu konuyu kapsamlı çözmek için iki yol var:

**A. Migrate (riskli, kapsamlı):** Tüm `'tamam'` → `'tamamlandi'`, `'kapalı'` → yeni statü. Migration + tüm kod taraması + test. **Tahmini 1-2 gün iş.** Şu an YAPMIYORUZ — fayda/risk dengesi düşük.

**B. Yeni statü konvansiyonu (orta vadeli):** İleride yeni tablo eklediğimizde sadece şu standart durumları kullan: `'aktif' | 'bekliyor' | 'tamamlandi' | 'iptal'`. Eski tablolar dokunulmaz, helper'lar normalize eder. Yeni tablolar baştan tutarlı.

**Tavsiye: B.** v15.48+ tüm migrationlar B'ye uyumlu yazılır. Eski tablolar zaman içinde refactor için fırsat çıktıkça düzeltilebilir, ama acil değil.

---

## Son canlı sürüm
**v15.47.3** — statusUtils yayılım + 'beklemede' bug fix + §18.3 güncellemesi.

---

*Bu belge v15.47 itibariyle günceldir. Sonraki oturumlarda patch'in içinde `docs/UYS_v3_Bilgi_Bankasi.md` olarak güncellenecek, manuel upload beklenmeyecektir.*

---

*Bu belge v15.46 itibariyle günceldir. Sonraki oturumlarda patch'in içinde `docs/UYS_v3_Bilgi_Bankasi.md` olarak güncellenecek, manuel upload beklenmeyecektir.*

---

*Bu belge v15.44 itibariyle günceldir. Sonraki oturumlarda patch'in içinde `docs/UYS_v3_Bilgi_Bankasi.md` olarak güncellenecek, manuel upload beklenmeyecektir.*
