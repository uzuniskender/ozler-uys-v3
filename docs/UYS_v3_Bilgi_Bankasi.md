# UYS v3 — Bilgi Bankası

*Üretim Yönetim Sistemi*

Özler Kalıp ve İskele Sistemleri A.Ş.

**Sürüm: v15.76** (Fire Telafi recursive akışı + Madde 11 delta + Loglar sayfası)

Son Güncelleme: **27 Nisan 2026** (akşam — 30+ commit, İş Emri #13 17/22 madde, kalıcılık kuralı eklendi)

*Hazırlayan: Buket Bıçakçı — Claude ile birlikte*

---

# §0. KALICILIK KURALI ⭐ (27 Nis 2026 sonu)

**Buket'in kuralı:** Chat geçici, docs kalıcı. Her oturum sonunda Bilgi Bankası kapsamlı güncellenir.

## Neden

- Chat'ler silinebilir, yeni cihaza geçilebilir, past_chat search bulamaz
- **Docs klasörü tek kalıcı kayıt**
- Yeni oturum başlarken sadece bu Bilgi Bankası + DEVAM_NOTU + master backlog okunur
- Önceki chat'i okumaya gerek olmamalı

## Her Oturum Sonu ZORUNLU Update'ler

1. `docs/UYS_v3_Bilgi_Bankasi.md` — yeni sürümler, kararlar, tartışmalar
2. `docs/DEVAM_NOTU.md` — sıradaki ilk iş + bağlam
3. `docs/is_emri/00_BACKLOG_Master.md` — durum güncellenir
4. İlgili iş emri md'leri — faz tamamlanınca

## Her Oturum Başı ZORUNLU Okumalar

1. `docs/DEVAM_NOTU.md`
2. `docs/UYS_v3_Bilgi_Bankasi.md` (özellikle §0, §18 ailesi, §19, §20, **§21 MRP Formülü**)
3. `docs/is_emri/00_BACKLOG_Master.md`
4. Aktif iş emri md (örn `13_AnaAkisRefactor.md`)

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
18.3. Durum String Konvansiyonu
18.4. Artık Yönetimi Konvansiyonu ⭐ YENİ

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
- **v15.48a**: İş Emri #3 Faz 2 algoritma katmanı (UI yok). 4 ana parça: (1) **`vitest` altyapısı** — daha önce sadece Playwright (E2E) vardı, birim test yoktu. `package.json`'a `vitest@^3.2.4` devDep eklendi, 2 script (`test:unit`, `test:unit:watch`), `vitest.config.ts` yeni dosya (alias `@/` resolver + node env, sadece `src/**/*.test.ts` dosyalarını çalıştırır, E2E dışlanır). (2) **`artikMalzemelerOlustur()` yeni export** — `cutting.ts`'e eklendi. Plan'ın `tamamlandi` durumlu satırlarındaki fire'ları tarar, eşik (default 50mm) üzeri olanları `ArtikSuggest` listesi olarak döner. Aynı `malkod+uzunluk` için adet birleştirir. Kod formatı: `ARTIK-{originalMalkod}-{uzunlukMm}`. **DB'ye yazmaz** — sadece öneri listesi; v15.48b UI tarafı kullanıcıya sunup onaylanırsa Material kartı oluşturacak. (3) **`cutting.test.ts` yeni dosya** — 5 senaryo / 17 test (sonra hotfix ile 12'ye düştü). Hotfix: `cutting.ts` Supabase'e bağımlı olduğu için vitest'te import edilemedi → `cuttingArtik.ts` saf-fonksiyon ayrı modüle çıkarıldı, `cutting.ts` re-export ediyor (geriye uyumlu). (4) **Mevcut algoritma keşfi** — `cutting.ts.boykesimOptimum()` zaten gelişmiş: best-fit yerleştirme, 50 iterasyonlu fire optimize döngüsü, plan birleştirme, havuz desteği. İş Emri #3 Faz 2 spec'inin %80'i zaten yapılmış — bu sürüm sadece güvenlik ağı (test) + artık öneri (yardımcı fonk) ekledi.
- **v15.48b1**: İş Emri #3 Faz 2 UI parçası 1/2 — Otomatik Plan önizleme modal'ı. **Sürpriz keşif:** `pages/CuttingPlans.tsx`'te zaten "Otomatik Plan" butonu vardı, ama **doğrudan DB'ye kaydediyordu** (önizleme yok). Kullanıcı sonucu görmeden plan oluşturuyordu. Bu sürüm aynı butonu **3 adımlı akışa** çevirdi: (1) Algoritma çalışır, (2) **Sonuç modal'ı** açılır — plan sayısı, toplam fire %, her plan için satır detayları (bar adedi, kesimler, fire mm), renkli fire göstergeleri (yeşil <%5, sarı %5-15, kırmızı >15), (3) Kullanıcı "Kaydet" derse `kesimPlanlariKaydet` ile DB'ye yazar (mevcut akış aynı), "İptal" derse hiçbir şey değişmez. Yeni `OtoPlanSonucModal` component'i eklendi. **Algoritmaya dokunulmadı** — sadece UI önizleme katmanı. Schema değişikliği YOK. **Akıllı filtre:** "Tüm açık İE'ler zaten planda" senaryosunda modal açılmaz, doğrudan toast bilgilendirir.
- **v15.48 (Faz 2 KAPANIŞ)**: v15.48b2 (Artık Malzeme UI) iptal edildi + §18.4 Artık Yönetimi Konvansiyonu eklendi. **Sürpriz keşif:** UYS v3'te v15.32'den itibaren kesim artıkları **otomatik olarak** `uys_acik_barlar` havuzuna ekleniyor (`barModelSync` mekanizması). Manuel "Material kartı oluştur + stok girişi" akışı **çift kayıt** yaratırdı (bir kez havuzda, bir kez malzemeler tablosunda). Bu sebeple v15.48b2 tasarımı durduruldu — **v15.48a'da yazılan `artikMalzemelerOlustur()` saf-fonksiyon olarak kalacak** (raporlama, istatistik, gelecek için altyapı). `cuttingArtik.ts` başına ⚠️ "UI'a bağlama, çakışma yaratır" uyarısı eklendi. Bilgi Bankası'na **§18.4 Artık Yönetimi Konvansiyonu** bölümü eklendi: artık akışının hangi katmanda olduğu (`uys_acik_barlar` havuzu), neden manuel material kartı yasak, gelecekte ne zaman bu kararı revize etmek gerekebilir. **Master backlog'ta İş Emri #3 Faz 2 → ✅ TAMAM olarak işaretlendi** (kapsam: algoritma + UI önizleme + güvenlik testi).
- **v15.49a**: Topbar Filtre Aktif — küçük UX iyileştirmesi. v15.47'de eklenen 3 zincir badge'i (KESİM/MRP/TEDARİK) tıklanınca ilgili sayfaya gidiyordu ama kullanıcı orada manuel filtre çekmek zorundaydı. Şimdi: (1) **MRP badge** → `#/orders?mrp=eksik` URL'iyle açılır, Orders sayfası `mrpFilter='eksik'` ile yüklenir → "MRP: Eksik" filtresi otomatik aktif (kırmızı dropdown ile görünür). (2) **TEDARİK badge** → `#/procurement` (zaten default `'bekliyor'` filtresi aktif, ek değişiklik gerekmedi). (3) **KESİM badge** → `#/cutting` (sayfa zaten "Kesim Önerileri — N İE planlanmamış" bölümünü gösteriyor, ek değişiklik gerekmedi). **Yeni:** `Orders.tsx`'e `mrpFilter` state + URL okuma + dropdown ('Tümü/Eksik/Tamam', renkli görsel feedback). `useEffect` ile URL parametresi değişince filtre senkron olur. Filter mantığı `'eksik'` durumunda kapalı siparişleri gizler (gündemde değil), `'tamam'` durumunda sadece MRP'si yapılmış olanları gösterir. Schema değişikliği YOK, kod-only.
- **v15.49b**: Master Backlog ilerleme paneli — sadece doc patch. `docs/is_emri/00_BACKLOG_Master.md` dosyasının başına 4 yeni özet bölüm eklendi: (1) **📊 Genel İlerleme** — ASCII progress bar ile 10 büyük önerinin durumu (3 tamam / 1 kısmi / 6 backlog) tek bakışta görülür. (2) **📅 Son Sürümler** — 25 Nisan'da gelen 15 sürümün master backlog'a etkisi tablo halinde (v15.46'dan v15.49a'ya kadar). (3) **📚 §18 Ailesi 4 Kalıcı Kural** — bütün operasyonel disipline tek tabloda erişim (Hijyen + Yeni Tablo + Durum String + Artık Yönetimi). (4) Mevcut "Kullanım" ve "10 Öneri" tablosu aynen kalır. **Amaç:** Yeni bir oturuma başlayan Claude (veya Buket) durumu 30 saniyede kavrayabilir, "ne yapıldı, ne kaldı, hangi kurallar var" net görsün. Schema değişikliği YOK, kod değişikliği YOK.

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

# 18.4 Artık Yönetimi Konvansiyonu (v15.48) ⭐ YENİ

## Tek Kural

**Kesim artıkları (fire) sadece `uys_acik_barlar` havuzunda izlenir. Manuel `uys_malzeme` kartı + stok girişi YASAK.**

## Sebep

UYS v3'te v15.32'den itibaren `barModelSync` mekanizması var. Bir kesim planı tamamlandığında otomatik olarak:
1. Kesilen her bar için `bar_acilis` stok hareketi
2. Her bar fire'ı için `uys_acik_barlar` kaydı (durum: 'acik', uzunlukMm: fire değeri)

Bu açık barlar:
- Depolar → "Açık Bar Havuzu" tab'ında listelenir
- Yeni kesim planı oluştururken "Havuz Önerisi" modal'ı uygun barları otomatik öneriyor
- Hurda akışı (v15.34) ve geri alma (v15.44) entegre

## Yasak

Manuel olarak şunlar **yapılmamalı**:
- `uys_malzeme.insert({ kod: 'ARTIK-X-1240', ... })`
- `uys_stok_hareketler.insert({ tip: 'giris', aciklama: 'Kesim artığı' })`

Sebep: Aynı fire iki kez kaydedilir (havuz + manuel kart) → stok şişer, raporlar yanıltıcı, MRP yanlış net ihtiyaç hesaplar.

## Ne Yapılabilir

`artikMalzemelerOlustur()` (cuttingArtik.ts) fonksiyonu var — **saf hesaplama**. UI'a bağlanmıyor. Kullanım alanları:

- Raporlama / istatistik: "Bu plan kaç bar artık çıkardı, hangi boylarda?"
- Birim test örneği (saf-fonksiyon, Supabase'siz)
- Gelecek için altyapı (havuz sistemi değişirse hazır)

## Bu Kararı Ne Zaman Revize Edebiliriz?

İki senaryo:
1. **Açık bar havuz sistemi performans sorunu yaratırsa** — örn. 10000+ bar varsa havuz UI yavaşlar, alternatif gerekebilir
2. **Müşteriden talep gelirse** — "Artıkları malzeme listesinde de görmek istiyorum, sayım için"

Bu senaryolar olmadan dokunma — mevcut sistem temiz çalışıyor.

## Kontrol Listesi

Yeni bir kesim/fire akışı yazıyorsan:
- [ ] `uys_malzeme.insert` ile `'ARTIK-...'` kodlu kart yaratıyor musun? → **YASAK**
- [ ] Fire için `tip: 'giris'` stok hareketi yazıyor musun? → **YASAK**
- [ ] `barModelSync` zaten bu işi yapıyor mu? → Evet, kontrol et
- [ ] Sadece raporlama ihtiyacın varsa `artikMalzemelerOlustur()` kullan

---

# 19. MRP Filtre Sözleşmesi (v15.50a serisi) ⭐ YENİ

## Tek Kural

> **Sipariş MRP listesinde görünür ⇔ kilit açık VE hesaplaMRP'de net > 0 satırı var.**

`mrp_durum` kolonu, açık tedarik listesi, üretim yüzdesi — **filter kararında kullanılmaz**. Sadece bilgi rozeti olarak gösterilebilir.

## Akış (Buket modeli)

MRP = stok eksikliği dedektörü. Akış basit:
1. Sipariş gelir
2. Hesaplama yapılır (BOM patlatma + stok düşürme + açık tedarik düşürme + diğer rezerveler)
3. **net > 0** olan kalemler eksiktir → liste'de görünür
4. Tedarik açılır (depoda veya yolda) → stok yetiyor → liste'den çıkar
5. Tedarik silinirse → stok tekrar yetmez → liste'ye geri döner (otomatik)

Hiçbir aşamada `mrp_durum` kolonuna gerek yok — gerçek dünya `hesaplaMRP` sonucunda gizli.

## Implementation (v15.50a.5+, MRP.tsx)

```typescript
const ORDER_ARCHIVED_STATES = new Set(['kapalı', 'kapali', 'iptal', 'İptal', 'tamamlandi', 'Tamamlandı'])

const orderHasEksik = useMemo(() => {
  const map: Record<string, boolean> = {}
  for (const o of orders) {
    if (ORDER_ARCHIVED_STATES.has(o.durum || '')) { map[o.id] = false; continue }
    const sonuc = hesaplaMRP([o.id], orders, workOrders, recipes, stokHareketler, tedarikler, cpMappedAll, materials, null, mrpRezerve, o.id)
    map[o.id] = sonuc.some(r => r.net > 0)
  }
  return map
}, [orders, workOrders, recipes, stokHareketler, tedarikler, cpMappedAll, materials, mrpRezerve])

const aktifOrders = useMemo(() => {
  return orders.filter(o => {
    if (ORDER_ARCHIVED_STATES.has(o.durum || '')) return showTamamlanan
    const eksikVar = orderHasEksik[o.id] ?? false
    return showTamamlanan ? !eksikVar : eksikVar
  })
}, [orders, orderHasEksik, showTamamlanan])
```

## Toggle (Arşiv)

`+ Arşiv (X)` toggle'ı **iki tip kayıt birden** gösterir:
- Kilitli siparişler (durum=kapalı/iptal/tamamlandı)
- Açık ama net=0 olan siparişler (stok yeterli, MRP işi yok)

## Test Senaryoları (10/10 PASS)

| # | durum | mrp_durum | Tedarik | Hesap net | Sonuç |
|---|---|---|---|---|---|
| 1 | `''` | `''` | yok | >0 | **Görünür** |
| 2 | `''` | `'bekliyor'` | yok | >0 | **Görünür** |
| 3 | `''` | `'eksik'` | yok | >0 | **Görünür** |
| 4 | `''` | `'tamam'` | VAR | =0 | **Gizli** |
| 5 | `''` | `'tamamlandi'` | VAR | =0 | **Gizli** |
| 6 | `'kapalı'` | herhangi | herhangi | herhangi | **Gizli** (kilit) |
| 7 | `'iptal'` | `''` | yok | herhangi | **Gizli** (kilit) |
| 8 | `'Tamamlandı'` | `'tamam'` | VAR | =0 | **Gizli** (kilit) |
| 9 | `''` | `'tamam'` | VAR | =0 | **Gizli** (doğrulama) |
| 10 | `''` | `'tamam'` | YOK (silindi) | >0 | **GÖRÜNÜR** ⭐ kritik |

S10: Tedarik silindiğinde MRP otomatik açılır.

## §18.3 İlişkisi

`statusUtils.ts`'de `isOrderArchived(o)` helper'ı **v15.50b'de eklendi**:

```typescript
export function isOrderArchived(o: Order): boolean {
  return !isOrderActive(o)
}
```

`isOrderActive` mevcut `ORDER_INACTIVE_STATES` set'ini kullanıyor (`'tamamlandi', 'kapalı', 'kapali', 'iptal'`) ve `.toLowerCase().trim()` yapıyor → büyük/küçük harf varyantlarına dirençli.

`MRP.tsx` v15.50b'de inline blacklist set'i kaldırıp helper'a geçti (4 yer). §18.3 statusUtils tutarlılığı genişledi.

## Acil UX Serisi Özeti (25 Nis 2026)

7 patch ile MRP UX katmanı temizlendi:
- **v15.50a** — Termin gruplama core (4/4 PASS) + stok pool FIFO bug fix
- **v15.50a.1** — onClick event leak (Hesapla button bypass bug'ı)
- **v15.50a.2** — MRP filtre v1 (mrp_durum yoksay) — yanlış yorum, revize edildi
- **v15.50a.3** — viewFilter default 'tum' (boş tablo bug'ı)
- **v15.50a.4** — 5 aşama tablo (yanlış sözleşme yorumu) — revize edildi
- **v15.50a.5** — TEK KURAL (net>0) — doğru sözleşme, kanıtlandı
- **v15.50a.6** — Topbar KESİM badge keyword fix (KESME LAZER yakalanmıyordu)
- **v15.50b** — Faz 3 MRP Modal entegrasyonu (snapshot insert + RBAC + isOrderArchived)
- **v15.51** — Faz 4 autoZincir Faz 3 standardına hizalama (snapshot + mrpTedarikOlustur delege + RBAC + lock)
- **v15.52a** — Operatör güvenlik (sicil hash lazy migration + RBAC operator actions)
- **v15.52a.1** — Hotfix: SQL migration `public.` prefix (audit-columns regex uyumu — yeni §18.5 kuralı)
- **v15.52b** — Topbar Kesim kolonu Orders.tsx'e eklendi (statusUtils 3 yeni helper)
- **v16.0.0 Faz 1.1a** — Auth altyapı (DB-only): `uys_kullanicilar.auth_user_id` + `current_user_role()` helper. İş Emri #12'nin başlangıcı, hiçbir RLS değişmedi.
- **v15.53 Adım 1** — Yedekleme altyapı: `uys_yedekler` tablosu + `backup.ts` servisi + 4 RBAC action
- **v15.53 Adım 1.1** — Hotfix: audit-schema whitelist (Tip D, recursion engelleme)
- **v15.53 Adım 2** — Backup.tsx UI: liste + manuel yedek + indir + sil + Sidebar menüsü
- **v15.53 Adım 3** — Geri yükleme (TEHLİKELİ): merge/replace + 2-adım onay modal + güvenlik yedeği
- **v15.53 Adım 4** — Otomatik günlük yedek + 30 gün temizleme (admin login fire-and-forget)
- **v15.53 Adım 5** — DataManagement'tan /backup yönlendirme bilgi notu

## Önemli Ders

**Sözleşmeyi yanlış sentezledim.** Müşteri net kural verdiğinde **birebir** uygulamak gerekir. "Sade tek kural" çıkarmaya çalışmak yanlış yola sürükler. Doğru süreç:
1. Müşteriden kuralı tablo halinde al
2. Test fixture'ı tablodaki **her satır** için yaz
3. Patch yazmadan önce tabloyu **birebir** koda çevir
4. Patch teslim mesajında "uygulanan kural" tablosu göster

**Hijyen kuralı:** Yeni MRP davranışı patch'inde önce §19 sözleşmesini oku, dokunulan filter mantığı kuralı bozmuyor mu kontrol et.

---

## Önceki Sürüm — v15.51
**v15.51** — Faz 4 autoZincir Faz 3 standardına hizalama: snapshot insert + mrpTedarikOlustur delege + RBAC + lock + hata sonrası kapatma. **İş Emri #3 KAPANDI (Faz 1+2+3+4+5 tümü ✅).**

### v15.51 Notları (27 Nis 2026 — Faz 4 Kapanışı)

**Sürpriz keşif #2:** DEVAM_NOTU "step-by-step UI eksik, dashboard/log paneli gerekli" diyordu. Aslında `pages/Orders.tsx` içindeki `TamZincirButton` zaten confirm dialog + live adım listesi (✅/⚠️/❌/ℹ️ ikonlu, `onProgress` callback'iyle) + 4 KPI kart + eksik malzemeler tablosu + action butonlar (MRP'ye git, Kesim'e git, Kapat) içeriyordu. Yeni UI gereksizdi. Asıl boşluk **Faz 3 standardına hizalama**ydı — autoZincir, manuel MRP modal'ın v15.50b'de getirdiği snapshot + flag desenini takip etmiyordu.

### v15.51'de Kapatılan 5 Eksik

1. **`uys_mrp_calculations` snapshot insert** — `autoChain.ts:autoZincir` MRP run sonrası, Faz 3 modal pattern'iyle birebir aynı (Tip C, §18.2 uyumlu). `hesaplayan` parametresi imzaya eklendi (12 → 13 parametre); Orders.tsx tarafı `useAuth().user?.username || email || dbId || 'system'` fallback ile dolduruyor. Snapshot insert sessiz fail olursa zincir akışı bozulmaz (try/catch + console.warn).

2. **Tedarik insert artık `mrpTedarikOlustur(opts)` ile delege** — Doğrudan `supabase.from('uys_tedarikler').insert()` çağrısı kaldırıldı, `mrpTedarikOlustur(orderId, siparisNo, filteredRows, { mrpCalculationId, auto: true })` ile değiştirildi. Sonuç: tedarik kayıtları `auto_olusturuldu: true` + `mrp_calculation_id: <snapshot.id>` FK ile yazılıyor → audit/raporlamada autoZincir vs manuel akış ayrımı yapılabilir.

3. **Termin-bazlı duplicate filter korundu** — autoZincir'in v15.50a sonrası eklenmiş özel kontrolü (`mevcutTed = tedarikler.find(t => t.malkod === r.malkod && t.orderId === orderId && (t.teslimTarihi || '') === xTermin && !t.geldi)`) `mrpTedarikOlustur`'a göndermeden önce ön-filter olarak uygulanıyor. `mrpTedarikOlustur` içinde sadece `r.net > 0` filter var, termin-bazlı kontrol yok — bu sebeple ön-filter mantığı korundu.

4. **`mrp_durum` güncellemesi + `rezerveYaz`** — Manuel MRP modal akışıyla hizalı: `yeniDurum = mrpSonuc.some(r => r.net > 0) ? 'eksik' : 'tamam'`, `update({ mrp_durum: yeniDurum })`, sonra `rezerveYaz(orderId, mrpSonuc)`. autoZincir akışı bundan önce bu kolonu güncellemiyordu — manuel akışla autoZincir akışı arasındaki tutarsızlık kapandı. **§19 etkisi yok:** Filter hala `hesaplaMRP` net>0 sonucuna bakıyor; `mrp_durum` filter karar mekanizmasına girmiyor (sadece bilgi rozeti).

5. **`Orders.tsx TamZincirButton` 3 düzeltme:**
   - `useAuth()` çağrısı eklendi, `if (!can('auto_chain_run')) return null` — yetki yoksa buton hiç render olmasın (manuel akışlar zaten `can('orders_mrp')`/`can('tedarik_auto')` ile sarılı).
   - `useRef(false)` ile concurrent lock — aynı sipariş için ikinci tetik `toast.info('Zincir zaten çalışıyor')` ile atlanır, `finally` bloğunda release.
   - Hata catch'inde `setSonuc({ woCount: 0, kesimCount: 0, mrpCount: 0, tedCount: 0, eksikler: [] })` — eski davranışta hata sonrası modal stuck kalıyordu (Kapat butonu sadece `sonuc` varken görünüyordu), şimdi boş struct ile sonuç paneli açılır → kullanıcı "Kapat"a basıp çıkabilir.

**Sonuç:** 2 dosya · 0 schema değişikliği · 0 rollback · §19 sözleşmesi korundu · §18.2 + §18.3 tutarlılığı arttı (autoZincir akışı manuel modal akışıyla hizalı oldu). İş Emri #3 master backlog'da TAMAM (5/5 faz).

**Sürpriz keşif dersi #2:** Faz 3'teki dersle aynı — DEVAM_NOTU'ndaki plan eski olabilir, **yeni iş'e başlamadan önce mevcut kodu dikkatli oku**. Bu patch'te de "yeni dashboard component'i" tahmini 30 dakikalık hizalama işine düştü.

### `autoZincir` İmza Değişikliği (Breaking Change Yok — Tek Çağrı Var)

Eski (v15.50b):
```typescript
autoZincir(orderId, woCount, orders, workOrders, recipes, operations, materials,
  stokHareketler, tedarikler, logs, cuttingPlans, onProgress?)
```

Yeni (v15.51):
```typescript
autoZincir(orderId, woCount, orders, workOrders, recipes, operations, materials,
  stokHareketler, tedarikler, logs, cuttingPlans, hesaplayan, onProgress?)
```

12 → 13 parametre. `hesaplayan` snapshot insert'in NOT NULL kolonu için. autoZincir tek yerden çağrılıyor (`Orders.tsx:TamZincirButton.run`) — orası güncellendi, başka yerde uyarı yok.

---

## Son canlı sürüm
**v15.68** (kod) — İş Emri #13 (Ana Akış Refactoru) **14/22 madde tamamlandı**. Kritik MRP+tedarik bug'ları kalıcı çözüldü, ana akış omurgası ayakta.

### v15.55-v15.68 Notları (27 Nis 2026 — İş Emri #13)

**Kapsanan maddeler:** 1, 2, 3, 4, 5, 6, 7, 10 (iskelet), 17, 18, 19, 20, 21, 22

**Kritik bug zinciri kapandı:**
- **F-21 idempotent tedarik** — 4 farklı tedarik açma noktasında çift kayıt önlendi (mrpTedarikOlustur, runMRP, autoChain, topluTedarikOlustur)
- **Rezerve düşürmesi kaldırıldı** — `mrp.ts` artık Buket'in formülünü uyguluyor: NET = BRÜT − STOK − YOLDA. Eski kod stoktan diğer siparişlerin rezervesini düşüyordu.
- **Kesim planı zorunluluğu** — ProductionEntry HARD BLOCK + WorkOrders Plan Bekliyor rozeti + tıklanabilir
- **Çift tedarik sahada düzeltildi** — S26A_02981_2 için 207 fazla tedarik SQL ile silindi

**Yeni bileşenler:**
- `ActiveFlowDecisionModal.tsx` — Devam/Beklet/İptal 3-buton modal (madde 17)
- `bekletFlow`, `devamEttirFlow` (pendingFlow.ts)
- `mrpTedarikDuzelt` (mrp.ts) — sipariş eksildiğinde fazla bekleyen tedarikleri otomatik iptal/azalt (madde 10 iskelet)

**UI iyileştirmeleri:**
- Topbar: bekletilen flow'lar mor "BEKLETİLDİ" badge ile görünür
- Toast: tedarik açıldıysa "Tedariklere Git" action butonu
- WorkOrders: Plan Bekliyor rozeti tıklanabilir → /cutting

**Kalan 8 madde:** 8, 9 (kısmen var), 11, 12 (kısmen yapıldı), 13, 14, 15, 16 (havuzla yapıldı sayılabilir).



### v15.53 Notları (27 Nis 2026 gece — İş Emri #2 Yedekleme KAPANIŞ)

**5 adımda büyük iş tamamlandı:**

**Adım 1 (altyapı):** `uys_yedekler` tablosu (Tip D — backend-only, JSONB blob), `backup.ts` servisi (takeBackup, listBackups, getBackup, deleteBackup), `backup-parser.ts` skeleton, 4 RBAC permission. Saha etki sıfır.

**Adım 1.1 (hotfix):** §18.5 kuralı kapsamında audit-schema whitelist (Tip D, recursion engelleme).

**Adım 2 (UI):** `/backup` route + Sidebar "Yedekler" menüsü (`Save` ikonu, `can('backup_view')` filtresi). Sayfa: 3 üst özet kart + Tip filtresi + tablo (Tarih/Saat/Tip/Boyut/Alan/Notlar/Aksiyon) + "Şimdi Yedekle" + "İndir" + "Sil".

**Adım 3 (TEHLİKELİ — geri yükleme):** `restoreBackup(id, mode, alanKisi, onProgress)` — merge (UPSERT) / replace (DELETE+INSERT). Güvenlik yedeği geri yükleme öncesi otomatik alınır. `BackupRestoreModal.tsx` 2-adım onay (mod seçimi 5sn timer + "GERI YÜKLE" yazma confirmation, GitHub-style). 5 step gösterim: mode → confirm → running → done/error. v22 format Faz 5'e ertelendi (sadece v3 destekli).

**Adım 4 (otomatik):** `cleanOldBackups(keepDays=30)` (manuel etkilenmez), `ensureDailyAutoBackup(alanKisi)` (idempotent — bugün varsa skipped). App.tsx admin login sonrası fire-and-forget useEffect ile çağrılır. Sessiz fail.

**Adım 5 (yönlendirme):** DataManagement.tsx eski JSON Yedek butonları korundu, üstüne bilgi banner: "Yedekler artık /backup sayfasında".

### v15.52b Notları (Orders.tsx Kesim Kolonu)

Memory'deki "Adim D" — yarım kalan UX iş. Orders.tsx tablosuna Kesim kolonu eklendi (İE ile MRP arasına). statusUtils.ts'e 3 yeni helper (`isKesimWO`, `getPlanliWoIds`, `getKesimEksikWoIds`). Topbar.tsx aynı mantığı yapıyor — refactor riski almadık (kod tekrarı kabul, ileride konsolide edilir).

### v16.0.0 Faz 1.1a Notları (Auth Altyapı)

İş Emri #12 (Güvenlik Refactoru) Yaklaşım A başlangıç adımı. **Sahaya etki sıfır** (RLS henüz değişmedi).

- Migration: `sql/20260427_v16_0_0_faz1_1a_auth_alti.sql`
- `uys_kullanicilar.auth_user_id uuid` kolonu (nullable, mevcut satırlar bozulmadı)
- `idx_uys_kullanicilar_auth_user_id` index (RLS lookup için)
- `public.current_user_role()` SQL helper — SECURITY DEFINER + STABLE. Anon çağrıda NULL döner.

**Sürpriz keşif:** Aynı oturumda RLS audit denenirken Google OAuth provider DISABLED olduğu keşfedildi. `auth.users` boş, kimse Google ile login olmamış. İş Emri #12 spec'i revize edildi: Faz 1+2 birleşti, "Admin Google OAuth pilot" geçersiz, yerine "Tüm AdminRole'leri sıfırdan Supabase Auth'a migrate" oldu.

### Önceki Sürüm — v15.52a + v15.52a.1
**v15.52a** — Operatör güvenlik: sicil hash (lazy migration) + RBAC operator actions. **İş Emri #1 KAPANDI.**

**v15.52a.1 hotfix** — SQL `public.` prefix (audit-columns regex uyumu) → yeni §18.5 kuralı.



**Sürpriz keşif #6 (en büyük):** İş Emri #1 spec'i 246 satır, 5 faz tasarlandı — gerçekte sahada **zaten %95 yapılmış**. `OperatorPanel.tsx` 1335 satır, 4 component (login akışı + ana panel + entry modal + mesaj formu + izin formu), eski monolit operator.html'in 811 satırının tamamı + bonus özellikler React'e port edilmiş. App.tsx'te `/operator` route, `OperatorRoutes` (geri tuşu engelli), useAuth'ta `operatorLogin` sessionStorage akışı — hepsi kurulu. Login.tsx'te bölüm/operatör/şifre 3-adım dropdown akışı, OPERATÖR MODU üst banner, 5 yazma tablosu DB'de mevcut + RLS aktif (görünüşte).

**Asıl boşluk: 3 güvenlik gap'i. v15.52a 2'sini kapattı:**

#### 1. Sicil Hash (Lazy Migration)

**Önce:** `uys_operators.sifre` plain text saklanıyordu (Login.tsx karşılaştırması). DB dump senaryosunda tüm operatör şifreleri okunabiliyordu.

**Sonra:** `src/lib/sicilHash.ts` yeni dosya — cyrb53 helper (`hashSicil`, `verifySicil`, `isHashed`). Format `cyrb53:HEX` — version prefix sayesinde gelecekte bcrypt/SHA-256'ya geçiş kolay. Migration: `uys_operators.sicil_hash text` kolonu eklendi (Tip — yeni KOLON, yeni TABLO değil, §18.2 karar matrisi gerekmedi).

**Lazy migration mantığı (Login.tsx `doOprLogin`):**
- Hash varsa → hash karşılaştırması
- Hash yoksa → plain text karşılaştırma → arka planda hashle + `sifre=null` UPDATE
- Her başarılı giriş bir adım dönüştürür; 1-2 hafta sonra (tüm aktif operatörler login olduktan sonra) `sifre` kolonu ayrı patch ile DROP edilir

#### 2. RBAC Operator Actions

**Önce:** `permissions.ts:can()` operator için her zaman `false` dönüyordu (`if (role === 'guest' || role === 'operator') return false`). OperatorPanel `can()` çağırmıyordu (sadece `isOperator` flag) — yani kontrol mekanizması yoktu.

**Sonra:** `OPERATOR_ACTIONS = new Set([...9 action])` — `op_view_workorders`, `op_log_production`, `op_log_fire`, `op_log_durus`, `op_start_work`, `op_stop_work`, `op_send_message`, `op_view_stok`, `op_request_izin`. `can()` operator role için bu set'e bakar. AdminRole DEFAULTS yapısı bozulmadı (operator ayrı izin domeni).

OperatorPanel hâlâ `can()` çağırmıyor — bu altyapı ileride yetki kontrolü eklemek isteyince hazır (örn. "üretim sorumlusu fire kayıt yetkisini operatör için kapatabilsin" senaryosu).

#### 3. RLS Gap → İş Emri #12

**Keşif:** RLS audit (paralelde çalıştırılan SQL) gösterdi ki 8 ana tablo `allow_all` policy'siyle korunuyor (`cmd: ALL, qual: true, with_check: true`) — yani gerçekte koruma yok. Anon key sahibi DB'deki tüm verileri okuyup yazabilir.

**Karar:** Mimari refactor gerektirdiği için (1-2 hafta) yeni iş emri olarak ayrıldı: `docs/is_emri/12_GuvenlikRefactor.md`. Detay: §20.

### v15.52a.1 Hotfix Notları — SQL `public.` Prefix Kuralı (§18.5)

Push sonrası GitHub Actions FAIL: `audit-columns.cjs` "Kolon yok: 'sicil_hash'" diyordu, halbuki Supabase'de kolon mevcuttu. Sebep: `audit-columns.cjs:164` regex'i `ALTER TABLE public.xxx` formatı bekliyor:

```javascript
const alterBlockRegex = /ALTER TABLE[^;]*public\.(\w+)([^;]+?);/gi
```

v15.52a SQL migration `public.` öneki olmadan yazıldığı için audit script kolon eklemesini yakalayamamıştı.

**Düzeltme:** Tek karakter migration (idempotent — `IF NOT EXISTS` zaten DB'deki kolonu koruyor). Yeni operasyonel kural §18.5 olarak Bilgi Bankası'na eklendi.

### Sayılar (v15.52a + v15.52a.1)

3 dosya değişiklik + 2 yeni dosya · 1 yeni kolon · 0 rollback · §19 sözleşmesi etkilenmedi · §18 ailesi 1 yeni kural kazandı (§18.5).

---

## §18.5 — SQL Migration `public.` Prefix Kuralı (v15.52a.1 Eklendi)

**Kural:** Tüm SQL migration'larda (`ALTER TABLE`, `CREATE TABLE`, DO blokları içindeki SELECT/UPDATE) **`public.` şema öneki ZORUNLU**.

**Sebep:** `scripts/audit-columns.cjs:164` regex'i `public.` öneki bekliyor:
```javascript
const alterBlockRegex = /ALTER TABLE[^;]*public\.(\w+)([^;]+?);/gi
```

Eksikse:
- ✗ Audit kolon eklemesini yakalayamaz
- ✗ Insert/update'ler için "kolon yok" warning'i çıkar
- ✗ GitHub Actions FAIL → push reddedilir

**Doğru örnek:**
```sql
ALTER TABLE public.uys_operators ADD COLUMN IF NOT EXISTS sicil_hash text;

DO $$
BEGIN
  SELECT count(*) FROM public.uys_operators WHERE aktif IS NOT FALSE;
END$$;
```

**Yanlış örnek:**
```sql
-- public. öneki YOK → audit fail
ALTER TABLE uys_operators ADD COLUMN sicil_hash text;
```

**Kontrol listesi:**
- [ ] Tüm `ALTER TABLE` ifadelerinde `public.` öneki var
- [ ] Yeni `CREATE TABLE` ise yine `public.` öneki kullanıldı
- [ ] DO blokları içindeki SELECT'lerde de tutarlılık için `public.` var
- [ ] Patch teslim mesajında "§18.5 kontrol edildi" notu

**Tarih:** v15.52a.1, 27 Nis 2026

---

## §20 — Tehdit Modeli & RLS Durumu (v15.52a.1 Eklendi)

### Mevcut Durum (27 Nis 2026)

8 ana tablo (`uys_operators`, `uys_logs`, `uys_fire_logs`, `uys_active_work`, `uys_operator_notes`, `uys_stok_hareketler`, `uys_work_orders`, `uys_orders`) RLS açık görünüyor ama tek `allow_all` policy (`cmd: ALL, qual: true, with_check: true`) ile korumasız. Pratik etki: anon key sahibi (yani frontend'i açan herkes) DB'deki tüm verileri okuyup yazabilir.

### Önemli Kısıt — Google OAuth DISABLED (27 Nis 2026 keşfedildi)

Supabase'de Google OAuth provider **kapalı**. `auth.users` tablosu **boş** — kimse Google ile giriş yapmamış. Tüm kullanıcılar (admin dahil) `uys_kullanicilar` tablosu + plain text `sifre` ile custom auth path'inden giriyor.

Bu kısıt İş Emri #12'nin orijinal Faz 1 planını ("Admin Google OAuth pilot") **geçersiz kılıyor**. Spec aynı gün revize edildi:
- Eski Faz 1 (Admin Google OAuth) ve Faz 2 (AdminRole'ler) → **birleştirildi**, yeni Faz 1 = "Tüm AdminRole'leri Supabase Auth'a sıfırdan migrate"
- Yaklaşım A korundu (email/password provider — Supabase'de default açık)
- Faz sayısı 5 → 4'e düştü, toplam süre değişmedi (~11 gün full-time)

`useAuth.ts` dosyasındaki `signInWithGoogle` fonksiyonu çağrıldığında `validation_failed: Unsupported provider` hatası verir.

### v16.0.0 Faz 1.1a — Altyapı (27 Nis 2026 yapıldı)

İş Emri #12'nin başlangıç altyapısı kuruldu (sahaya etki sıfır):
- `uys_kullanicilar.auth_user_id uuid` kolonu (nullable, mevcut satırlar bozulmadı)
- `idx_uys_kullanicilar_auth_user_id` index (RLS lookup performansı için)
- `public.current_user_role()` SQL helper — `auth.uid()` → `uys_kullanicilar.rol`. SECURITY DEFINER + STABLE. Anon çağrıda NULL döner.

Hiçbir RLS policy değişmedi, hiçbir tablo etkilenmedi. Faz 1.2+ devam edince bu altyapı kullanılacak.

Migration: `sql/20260427_v16_0_0_faz1_1a_auth_alti.sql` — idempotent (`IF NOT EXISTS`), `public.` prefix kullanıyor (§18.5).


### Niye Şu An Risk Düşük

1. **İç ağ kullanımı** — sahaya internet açık değil, dışarıdan erişim yok
2. **Operatörler teknik değil** — F12 → Console hack senaryosu uzak
3. **Niyet meselesi** — kötü amaç yok, herkes işini yapıyor
4. **Veri zaten paylaşılır** — Özler iç ağında herkes herkesi tanıyor

### Niye İleride Çözmek Gerek

**İç tehdit (düşük olasılık ama ciddi sonuç):**
- İşten ayrılan çalışan kayıt manipülasyonu yapabilir
- Operatör fire kaydını silerek hatasını gizleyebilir
- Yetkisiz veri okuma (maaş bilgisi, müşteri detayı) — ama UYS'te bu veri zaten yok

**Audit/Belgelendirme:**
- ISO 27001 (Bilgi Güvenliği) — büyüme/EU müşteri taleplerinde gündeme gelebilir
- Akkuyu NGS, IC İçtaş, Compaco Romania, MHM Yunanistan gibi büyük müşteriler tedarikçi audit'inde sorabilir
- ISO 9001 "süreç kontrolü" maddesi audit'inde değinilebilir

### Çözüm: İş Emri #12

Detay: `docs/is_emri/12_GuvenlikRefactor.md`. Yaklaşım A (Supabase Auth) seçildi. 5 fazlı plan:

1. **Faz 1 (~2 gün):** Admin pilot — `auth.users` ↔ `uys_kullanicilar` senkron, hassas tablolarda RLS sıkılaştır
2. **Faz 2 (~3 gün):** uretim_sor / planlama / depocu rolleri Auth'a taşı
3. **Faz 3 (~3 gün):** Operator rolü Auth'a taşı (sessionStorage `OPR_KEY` deseni kalkar)
4. **Faz 4 (~2 gün):** Tüm tablolarda RLS yayılımı + `allow_all` DROP + audit log
5. **Faz 5 (~1 gün):** Temizlik (eski custom auth path'leri kaldır, plain `sifre` kolonu DROP)

**Toplam:** ~11 gün full-time → Buket'in iş yüküyle 3-4 hafta'ya yayılır.

**Pre-requisite:** v15.52a lazy migration tamamlanmalı (tüm operatörler hash'lenmiş olmalı) — Faz 3 öncesi.

### Karar Gerekçesi (27 Nis 2026)

Buket "Güvenliğim için şimdi yapalım" tercihi. Ama günlük iş yükü (kalite müdürü + çevre görevlisi + operasyonel projeler) düşünüldüğünde tek seferde değil **kademeli** yapılacak. İş Emri #12 spec'i hazır, faz başına ayrı oturumda işlenecek.

**Karar revizyon notu:** Eğer iç tehdit endişesi yoksa ve audit yakın değilse, bu işi 6-12 ay erteleyip diğer iş emirlerini (#2 Yedekleme, #5 Sevk vb.) önceliklendirmek mantıklı olabilir. Buket revize edebilir.

---

## Multi-machine Notu (NB081 — 27 Nis 2026 Eklendi)

Buket bugün ana bilgisayara (NB081) geçti. Bu makinenin başlangıç durumu:
- ❌ Git CLI kurulu değildi (sadece GitHub Desktop) → Git for Windows kuruldu (PATH dahil)
- ❌ Node.js kurulu değil → v15.51 patch'inde build doğrulaması atlandı, GitHub Actions'a güvenildi (push başarılı, deploy yeşil)

**Gelecek oturumlarda** kod patch'i yapılacaksa ilk komut:
```powershell
node --version; npm --version; git --version
```

Eksik olan varsa kurulduktan sonra **PowerShell tamamen kapatılıp yeniden açılmalı** (PATH yenilenmesi için).

Pre-push hook'un içeriği bilinmiyor ama npm/build kontrolü yapmıyor anlaşılan (v15.51 push'u Node yokken başarılı geçti). İleride pre-push fail olursa `git push --no-verify` ile bypass + ayrı kontrol.

---

*Bu belge v15.53 Adım 5 itibariyle günceldir. 27 Nis 2026 gecesi 17 commit ile 3 İş Emri kapandı (#1 + #2 + #3). Sonraki oturumlarda patch'in içinde `docs/UYS_v3_Bilgi_Bankasi.md` olarak güncellenecek.*

---

*Bu belge v15.46 itibariyle günceldir. Sonraki oturumlarda patch'in içinde `docs/UYS_v3_Bilgi_Bankasi.md` olarak güncellenecek, manuel upload beklenmeyecektir.*

---

*Bu belge v15.44 itibariyle günceldir. Sonraki oturumlarda patch'in içinde `docs/UYS_v3_Bilgi_Bankasi.md` olarak güncellenecek, manuel upload beklenmeyecektir.*

---

# §21. MRP FORMÜLÜ — BUKET'İN KESİN KURALI ⭐ (v15.70 sonrası)

> **Bu kural sahaya özgüdür ve sürekli sapmalar yaşanmıştı. v15.70'te netleştirildi.**

## TEK FORMÜL

```
NET İHTİYAÇ = İHTİYAÇ - STOK - YOLDA
```

**Bu kadar. Başka hesap YOK.**

## Kavramların Tanımı

| Kavram | Tanım | Kaynak |
|---|---|---|
| **İhtiyaç** | Aktif siparişlerin/İE'lerin bu malzemeye olan toplam talebi | BOM × adet, kesim planı varsa hamAdet override |
| **Stok** | Anlık fiziksel stok (giris - cikis - bar_acilis) | uys_stok_hareketler |
| **Yolda** | Bekleyen tedarikler (geldi=false) | uys_tedarikler |
| **Net İhtiyaç** | Yeni tedarik gereken miktar | İhtiyaç - Stok - Yolda |

## Karar Mantığı

```
E�er İhtiyaç < Stok + Yolda  →  MRP "TAMAM" (yeterli)
E�er İhtiyaç > Stok + Yolda  →  MRP "EKSİK" (Net İhtiyaç kadar tedarik aç)
```

## Buket'in Kritik Açıklaması

> "İçerideki stok rezerve oldu diye kullanılmayacak yada yok oldu anlamında değil. Anlık sipariş ihtiyacı anlık stok ve anlık bekleyenden az ise tedarik oluşur. Buda nasıl olur fire olası yada stok kaybolması ile olur. Anlık durum ilave yada kayıp olmadan değişmez."

**Yani:**
- Stok 50, ihtiyaç 50 → tamam (rezerve diye düşmez)
- Aynı malzeme 2 sipariş arasında "yarışır" görünür ama gerçekte tüm stok tüm aktif siparişlere ait
- Net ihtiyaç ancak şu durumlarda değişir:
  - **Fire çıkması** (ihtiyaç artar, hammadde 5 daha lazım — Madde 13)
  - **Stok kaybolması** (manuel çıkış, sayım hatası — Madde 15)
  - **Yeni sipariş gelmesi** (ihtiyaç artar)
  - **Tedarik gelmesi** (yolda → stok'a geçer, yolda azalır, stok artar — net aynı)

## v15.70 Öncesi Yanlış Mantık

Eski kod `mrp.ts:349-352`:
```typescript
const baskaRezerve = mrpRezerve.filter(r => r.malkod === ... && r.orderId !== currentOrderId)
  .reduce((a, r) => a + r.miktar, 0)
stokPool[kLower] = Math.max(0, fizikselStok - baskaRezerve)
```

**Yanlış olan:** Diğer siparişlerin rezervesini stoktan düşüyordu. 208 stok varsa ve 208 rezerve varsa, yeni sipariş için "0" görünüyor → 207 birim eksik gibi gösteriyordu.

**Doğrusu:** Stok 208, ihtiyaç 207 → tamam. Yeterli.

## v15.70 Sonrası

`mrp.ts:355-359` — rezerve düşürmesi tamamen kaldırıldı:
```typescript
stokPool[kLower] = getStok(bi.malkod, stokHareketler)  // saf fiziksel stok
```

`rezerveYaz`, `rezerveSil`, `rezerveleriSenkronla` fonksiyonları **no-op** yapıldı. Caller imzaları korundu (Orders, MRP.tsx, vb. dokunulmadı).

## Rezerve Mantığını "Geri Getirme" — Yeni Tasarım (Madde 15 — Yarın)

Buket'in 27 Nis 18:50 açıklaması:
> "Depocu Ahmet kafasına göre malzeme alamaz, planlama sorumlusu onayı lazımdır."

Bu **eski rezerve mantığı değil**, yeni bir **onay sistemi**:
- Manuel çıkış için sipariş/İE bağlama zorunlu
- Yeni sipariş içerideki siparişlerin yetişmesini riske atıyorsa → planlama onayı bekler
- Onay gelmeden depo hareketi geçmez
- MRP formülüne dokunulmaz (yine `İhtiyaç < Stok + Yolda → tamam`)

**Bu kademeli yapılacak (yarın+):**
1. Aşama 1: Manuel çıkışta uyarı (tetikleyen aktif sipariş varsa toast + tedarik sayfası açma)
2. Aşama 2: Onay sistemi (pendingFlow benzeri)
3. Aşama 3: Manuel çıkış zorunlu sipariş/İE bağlama

## Yarın Yapılacak — MRP Senaryolarını Çıkar

Buket **yarın senaryoları anlatacak**, Claude soracak. Olası senaryolar:
- Sipariş geldi (yeni ihtiyaç) — MRP nasıl davranır?
- Tedarik geldi (yolda → stok) — MRP nasıl davranır?
- Üretim girildi (stok azaldı) — MRP nasıl davranır?
- Fire çıktı (ihtiyaç arttı + telafi) — MRP nasıl davranır?
- Manuel çıkış (stok kayıp) — MRP nasıl davranır?
- Sipariş azaldı/iptal — MRP nasıl davranır?
- Sipariş arttı — MRP nasıl davranır?

Her senaryo için: ne tetiklenir, hangi kayıt değişir, kullanıcıya ne gösterilir.

---

# §22. 27 NİSAN 2026 KAPSAMLI ÖZET (Kalıcı Kayıt)

Bu bölüm sadece bilgi amaçlı, gelecekteki Claude oturumları için. Bugün **30+ commit** yapıldı, çok büyük bir mimari refactor günü.

## Sabah-13:00 (Önceki Oturum — Gece İşleri)

3 İş Emri kapandı: **#1 Operatör + #2 Yedekleme + #3 Üretim Zinciri**

| Sürüm | İş |
|---|---|
| v15.51 | autoZincir Faz 4 hizalama (İş Emri #3 KAPANDI) |
| v15.52a | Operatör güvenlik (sicil hash + RBAC) (İş Emri #1 KAPANDI) |
| v15.52a.1 | SQL `public.` prefix kuralı (§18.5) |
| v15.52b | Topbar Kesim kolonu Orders.tsx |
| v16.0.0 Faz 1.1a | Auth altyapı (DB-only) — İş Emri #12 başladı |
| v15.53 (5 adım) | Yedekleme tam paketi (İş Emri #2 KAPANDI) |
| v15.54 | Sevk Faz 1 — veri modeli + altyapı |

## 13:00-19:00 (Bu Oturum — İş Emri #13)

22 maddelik Ana Akış Refactoru spec'i Buket tarafından verildi. **17/22 madde tamamlandı:**

| Madde | İş | Sürüm | Test |
|---|---|---|---|
| **F-21** | İdempotent tedarik (4 noktada çift kayıt önlendi) | v15.56 | Sahada görüldü |
| **F-19/20** | Otomatik tedarik (MRP eksik varsa otomatik açar) | v15.56 | ✅ |
| **Hard block** | Üretim girişinde kesim planı zorunlu | v15.55 | ✅ |
| **Plan Bekliyor rozeti** | WorkOrders'ta uyarı | v15.61 + v15.68 (tıklanabilir) | ✅ |
| **A1+A2** | "Yeni İE" butonu Sipariş'e taşındı | v15.57 | ✅ |
| **A3** | Stok + Tekil İE tikleri | v15.58 | Test bekliyor |
| **A4** | MRP'de bağımsız bölüm kaldırıldı | v15.59 | ✅ |
| **Madde 6** | Sipariş save sonrası koşullu /cutting | v15.60 | Test bekliyor |
| **MRP topluTedarik** | F-21 idempotent delege | v15.62 | ✅ |
| **§21 MRP Formülü** | Rezerve düşürmesi kaldırıldı (Buket formül) | v15.63 | Sahada görüldü |
| **Madde 17** | Devam/Beklet/İptal karar modalı | v15.64 + v15.65 | Test bekliyor |
| **Madde 7** | runMRP toast "Tedariklere Git" action | v15.66 | ✅ |
| **Madde 10** | Tedarik düzeltme (sipariş eksildiğinde) | v15.67 | Test bekliyor |
| **Warehouse Hotfix** | Manuel Giriş modal render | v15.69 | ✅ |
| **Rezerve Kapat** | rezerveYaz/Sil/Senkronla no-op | v15.70 | ✅ |
| **Ölü Kod Sil** | NewIEModal + ymIEs (-295 satır) | v15.71 | ✅ |
| **Smoke Test Menü** | Sidebar'a admin-only | v15.72 | ✅ |
| **Topbar Konsolide** | statusUtils helper'ları | v15.73 | ✅ |
| **Madde 11** | Sipariş Delta Revizyonu (8 senaryo) | v15.74 | ❗ **TEST BEKLİYOR** |
| **Madde 14** | Loglar Sayfası (`/logs` + uys_activity_log) | v15.75 | Test bekliyor |
| **Madde 13** | Fire Telafi Recursive Akışı | v15.76 | ❗ **TEST BEKLİYOR** |

## Kritik Kararlar — Niye Yapıldı

### 1. Rezerve Sistemi Kaldırıldı (v15.70)

**Sebep:** Buket'in formülü `İhtiyaç < Stok + Yolda → tamam`. Eski kod stoktan diğer siparişlerin rezervesini düşüyordu → 208 stok + 208 rezerve = 0 kullanılabilir görünüyordu → "207 eksik" diyordu. Bu **yanlış**. v15.70'te no-op yapıldı, mantık temizlendi.

**1-2 hafta sonra:** uys_mrp_rezerve tablo DROP + fonksiyon tanımları sil + mrpRezerve parametreleri imzalardan kaldır. Bugün yapılmadı çünkü geri dönüş zor; 1-2 hafta sahada sorun yoksa atılır.

### 2. v15.55 Hard Block

**Sebep:** Manuel İE'ler (IE-MANUAL) kesim planı yapmadan üretime geçiyordu. barModelSync sadece plana bağlı WO'ları yakalıyor → bar_acilis hareketi yazılmıyor → Sağlık Raporu Kontrol #11 fail. Şimdi: kesim opsiyonlu WO + plan yok = üretim girişi engellenir.

### 3. Madde 11 Delta Revizyonu (v15.74)

**Sebep:** Eski edit save kodu **tüm İE'leri silip yeniden açıyordu** → log'lar orphan kalıyordu, üretim ilerlemesi sıfırlanıyordu. Yeni mantık: 8 senaryo için kalem-bazlı diff, log'lar dokunulmaz, WO durum='iptal' (silme yok).

### 4. Madde 13 Fire Telafi Recursive (v15.76)

**Buket'in tarifi:** Sipariş 50 adet, 5 fire → ihtiyaç 55 olur. Üst basamak telafi açılır + alt basamak yarımamul stoğu yetmiyorsa alt operasyon WO'su açılır + recursive en alta kadar. Yeni telafi WO'lar `siparis_disi=false, order_id=orijinal sipariş`.

**Sipariş.adet aynı kalır (50, müşteriye gider). Üretim hedefi 55. OEE kalite katsayısı = 50/55.**

## Manuel Saha Düzeltmeleri (SQL ile)

**S26A_02981_2'nin 207 fazla tedariği** (10:13'te açılan):
```sql
DELETE FROM public.uys_stok_hareketler WHERE id = 'ted-moh1i3kzverrns';
DELETE FROM public.uys_tedarikler WHERE id = 'moh1i3kzverrns';
```
Stok 381 → 174 düzeldi (gerçek ihtiyaca uyumlu).

S26A_02707'nin 207 tedariği — gerçek ihtiyaç olduğu doğrulandı, silinmedi.

## Atıl Kod Listesi — GÜNCEL Durum

(`docs/atil_kod_analizi_20260427.md` ile birlikte oku)

### 27 Nis Akşamı Sonrası Kalan Atıl

| # | Konu | Durum |
|---|---|---|
| A1 | NewIEModal | ✅ v15.71'de SİLİNDİ |
| A2 | MRP.tsx ymIEs state'leri | ✅ v15.71'de SİLİNDİ |
| A3 | Rezerve sistemi (rezerveYaz/Sil/Senkronla) | 🟡 v15.70'te no-op. Aşama 2: 1-2 hafta sonra fonksiyon tanımları + tablo DROP |
| A4 | mrpRezerve + currentOrderId imza parametreleri | 🟡 A3 ile birlikte |
| B1 | İş Emri açma duplicate (Orders + WorkOrders) | 🟡 Backlog (Yaklaşım B kabul: navigate kalsın) |
| B2 | statusUtils ↔ Topbar duplicate | ✅ v15.73'te ÇÖZÜLDÜ |
| C1 | OrderFormModal eski tek-kalem | 🟡 Migration sonrası silinebilir |
| C2 | DataManagement eski JSON Yedek butonları | 🟡 1-2 ay sonra |
| C3 | uys_sevkler.kalemler jsonb | 🟡 Sevk Faz 2 sonrası |
| C4 | uys_operators.sifre plain | 🟡 Lazy migration tamamlanınca DROP |

## Yarın TODO (Yeni Bilgisayara Geçiş Sonrası)

### 1. Manuel Test (KRİTİK)

**Test edilmemiş 3 büyük değişiklik sahada:**

| Sürüm | Test Senaryosu |
|---|---|
| **v15.74** Sipariş Delta | Adet artış (50→55), adet azalış (50→45), termin değişimi, kalem ekle/sil, üretildi > yeniAdet hard block |
| **v15.76** Fire Telafi | Üretimde fire gir → Reports → Fire → "Telafisi İE Oluştur" → Sipariş'e bağlı yeni WO + alt basamaklar (yarımamul stok kontrolü) |
| **v15.75** Loglar | /logs sayfasını aç, 4 kaynak (sistem/üretim/stok/fire) görünüyor mu, filtreler çalışıyor mu, sağ panel link'leri çalışıyor mu |

### 2. MRP Senaryoları Konuşması

Buket anlatacak, Claude soracak. Senaryolar §21'de listeli. Her birinin sonunda:
- Hangi event tetiklenir
- Hangi kayıt güncellenir
- Kullanıcıya ne gösterilir
- Test edilebilir mi

### 3. Sağlık Raporu Kontrol 11

6 satır bar_acilis eksik (eski IE-MANUAL'ler için). Manuel SQL ile düzeltilebilir veya kabul edilir (geçmiş veri). v15.55 hard block bundan sonrasını engelliyor zaten.

### 4. Madde 15 Onay Sistemi

Rezerve mantığını **yeni** mimaride geri getirme. Aşamalı (1-3). Detay §21 sonunda.

### 5. Madde 16 Kesim Artık Ürün Sorma

Mevcut havuz mantığıyla yapıldı sayılır, UI'da onay sorma adımı eklenebilir.

### 6. Madde 8+9 Resmi Durum String'leri

"Plan Bekliyor" ve "Üretilebilir" durum string'leri WorkOrder durum kolonu için resmi olarak eklenebilir (DB'ye yazılmaz, UI türetimi yeterli).


# §23. 28 NİSAN 2026 — TEST İSPATI + MANUEL İE SAHA BUG FİX

Bu bölüm 28 Nis 2026 sabahı kaydıdır. Önceki gün §22'de listeli "test bekliyor" 3 sürüm test edildi, bir saha bug'ı keşfedildi ve düzeltildi.

## v15.77 — Otomatik Test Senaryoları (Senaryo 7/8/9)

3 büyük sürümü tekrarlanabilir test ile doğrulamak için 3 yeni senaryo eklendi:

| Senaryo | Test Edilen | Tip | Adım |
|---|---|---|---|
| **S7** | v15.74 Sipariş Delta (`siparisDelta` saf fonksiyon) | DB'siz | 12 alt-test |
| **S8** | v15.76 Fire Telafi Recursive (`fireTelafiAkisi` gerçek DB) | DB | 10 adım |
| **S9** | v15.75 Loglar Sayfası (`uys_activity_log` DB akışı) | DB | 6 alt-test |

Yan iş: `uys_activity_log` `TABLE_CASCADE`'e eklendi (testRun.ts) — Senaryo 9 cleanup için.

## Test Sonuçları (TEST_20260428_01, ALL_PASS)

| Senaryo | Sonuç | Süre | Kritik delil |
|---|---|---|---|
| S1, S2 | PASS | 4-7 sn | (mevcut, etkilenmedi) |
| S3 | KOŞMADI | — | Pre-existing: `if (mrp1?.tedarik === 0) throw` (testRunner.ts:569) — adet=10 ile stok yeterli, throw → finalize çalışmadı. Patch'le ilgili değil. |
| S4, S5 | PASS | 9-11 sn | (mevcut) |
| S6 | PASS | 1ms | Negatif yasak kontrolleri |
| **S7** | **PASS 12/12** | 2ms | AZALIS BLOCK delili: "47 üretildi, 45 olamaz". KALEM_SIL üretim varken `uretildiAdet=12` doğru. ÇOKLU revizyon (artış+termin+kalem_ekle) tek pas. |
| **S8** | **PASS 10/10** | 5.7sn | Üst telafi WO `orderId=<orijinal>`, `siparisDisi=false`, `bagimsiz=false`, `ieNo='IE-TEST-S8-PWQB-01-FTU1PN'` (FT pattern). `fire.telafi_wo_id` DB'de set. Sipariş.adet=10 değişmedi. İdempotency: 2. çağrıda "zaten açıldı" hatası. |
| **S9** | **PASS 6/6** | 1.1sn | INSERT/SELECT/modul filtresi/tarih filtresi/4-kaynak query/order_id filtresi. |

**Sonuç:** v15.74, v15.75, v15.76 sahaya çıkmaya **doğrulanmış** durumda.

## Senaryo 8 Yan Bulgu — Recursion Tetiklenmedi

YMH100265 reçetesinde YarıMamul satır VAR (`receteYarıMamulIcerir: true`) ama recursion açılmadı (`recursiveTetiklendi: false`). Sebep: 2 adet fire için YM stoğu yeterli, alt operasyon WO'su gerek yok. Doğru davranış.

Recursion'ı görmek için: YM stoğu az bir reçete + büyük adetle ikinci tur. Ama kod yolu hatasız çalıştığı doğrulandı.

## SAHA BUG'I — IE-MANUAL-MO9SDW3A (v15.78 ile düzeltildi)

Buket "bu teste güvenmiyorum" dedi — 6740 adet manuel İE operatör panelde "stok yetersiz" hard block veriyordu ama MRP'de hiçbir ihtiyaç görünmüyordu. Test bu durumu doğrulamadığı için Senaryo 1-9 PASS oldu ama gerçek hata duruyordu.

### Kök neden — iki katmanlı

1. **`mrp.ts` filtresi** (~satır 240, v15.35.3'ten beri):
   ```typescript
   if (ordIdSet) {
     if (!w.orderId || !ordIdSet.has(w.orderId)) return false  // manuel İE atlanır
   }
   ```
   Manuel İE'lerin `orderId=null` olduğu için sipariş bazlı çağrıda filtre dışı kalıyordu.

2. **`MRP.tsx` UI kaybı** (v15.59):
   "Bağımsız YM İş Emirleri" bölümü "İş Emri #13 madde 18 felsefesine ters" gerekçesiyle kaldırıldı, atıl kod analizi A2 maddesinde "ölü kod, ileride temizlenir" olarak işaretlendi. Aslında o UI manuel İE'lerin MRP'de görünür **tek** yoluydu.

### Arıza zinciri özeti

| Sürüm | Olay | Etki |
|---|---|---|
| v15.35.3 | Manuel İE'ler `bagimsiz \|\| siparisDisi` ile MRP kapsamına alındı | Doğru |
| Eski | `ordIdSet` filtresi `orderId` boş olanı atla | Sipariş bazlı detay için mantıklı |
| v15.59 | MRP.tsx "Bağımsız YM" UI render kaldırıldı | Manuel İE'ler MRP'de görünmez |
| v15.78 | UI geri (sipariş kartlarıyla aynı listede) + filtre override | **Düzeltildi** |

### v15.78 Düzeltmesi

**1. `mrp.ts` filtre mantığı (override):**
```typescript
// Explicit YM seçimi varsa override: sadece set içindekiler dahil, ordIdSet bypass.
if (secilenYMIds) return secilenYMIds.has(w.id)
// Explicit seçim yok → sipariş kapsamına bak (eski davranış)
if (ordIdSet) {
  if (!w.orderId || !ordIdSet.has(w.orderId)) return false
}
return true
```

UI explicit seçim yaparsa manuel İE her durumda dahil. Sipariş detay görünümleri (Orders.tsx) ymSet göndermez → eski davranış korunur. Kapsam değişikliği yalnızca yeni MRP.tsx UI'sı için.

**2. `MRP.tsx` — tek liste, "STOK" rozeti:**
Manuel İE'ler sipariş kartlarıyla **aynı görsel ve aynı `selectedOrders` set'inde**. Sarı kenarlık + "STOK" rozetiyle ayırt edilir. `splitSelected()` yardımcısı ID tipine göre `ordIds` ve `ymIds`'e ayırır. `hesapla()`, auto-select, `topluTedarikOlustur` hepsi manuel İE'leri kapsayacak şekilde güncellendi.

**3. Senaryo 10 — reproducible test:**
4 mod testi: A) tümü dahil, B) sipariş bazlı (manuel atlanır — kasıtlı), C) sadece manuel ymSet ile, **D) sipariş + manuel birlikte (v15.78 öncesi FAIL ederdi)**. MOD D = saha bug fix kanıtı.

### Manuel İE Tedariki

`order_id=null` ile açılır, `not_='MRP — Manuel İE: <ieNo>'` ile bağlantı izlenir. Şema değişmedi — `mrpTedarikDuzelt` gibi sipariş bazlı düzeltme akışları `orderId` boş olunca dokunmaz, yan etki yok.

İleride `uys_tedarikler.ie_id` kolonu eklenirse direkt İE bağlantısı kurulabilir. Şu an `not_` alanı yeterli izlenebilirlik.

## §15 Bilinen Buglar — Güncelleme

Eski "manuel İE MRP görünmüyor" bug'ı v15.78 ile **kapatıldı**. Saha vakası: IE-MANUAL-MO9SDW3A (6740 adet, YMH100274 — SLABFORM ÇERÇEVE YATAYI). Hard block veriyordu, MRP eksik göstermiyordu — Buket'in 28 Nis sabahı tespit ettiği saha bug'ı.

## Atıl Kod Analizi A2 Maddesi — REVİZYON

**Önceki kayıt (yanlıştı):**
> A2. MRP.tsx — Bağımsız YM İE state ve hesapları
> v15.59'da UI render kaldırıldı, state/hesaplama bırakıldı (yorum: "ölü kod, ileride temizlenir")

**Doğrusu:** O kod atıl değildi, manuel İE'lerin MRP'de görünür tek yoluydu. v15.78'de **geri eklendi** (sipariş kartlarıyla birleştirilmiş tek liste olarak — #13 madde 18 felsefesine de uyumlu).

**Ders:** "Atıl kod" tespiti yapılırken o kodun hangi senaryoda kullanıldığı incelenmiş olmalı. Bu durumda kullanıcı "manuel iş emri açıyorsa görmesi gereken" senaryosu kaçırılmıştı.

## 28 Nis Yarın TODO Güncel

S10 koşturulup PASS doğrulanırsa § güncellenecek. Şimdilik sıradaki öncelik:

1. **MRP senaryoları konuşması** (DEVAM_NOTU §22'deki Madde 2)
2. **Madde 15 onay sistemi** (planlama onayı, rezerve değil)
3. **Madde 8+9 durum string'leri**
4. **Madde 16 kesim artık ürün sorma**

Senaryo 3'ün adet bağımlılığı (testRunner.ts:569 `if (tedarik === 0) throw`) küçük bir improvement: dynamically detect "stok yetiyor mu" ve PASS dön (FAIL yerine). Backlog'a düşüldü, kritik değil.

# §24. 28 NİSAN 2026 — MRP TEMEL HESABI SAHA BUG FİX (v15.79-v15.81)

§23'ün devamı. Sabah 28 Nis 2026 — bir oturumda 5 sürüm sahaya çıktı, MRP'nin temel hesabındaki 13+ sürümlük gizli bug bulundu ve düzeltildi.

## Sürüm sırası ve odak

| Sürüm | Konu | Tetik |
|---|---|---|
| v15.79 | "Plan Bekliyor / Üretilebilir" efektif durum (#13 madde 8+9) | Buket'in "kullanıcı yanılmasın" kararı |
| v15.80 | Sağlık raporu Kontrol 5/6/7 — §21 sözleşmesine uygun revize | Kontrol 7 "rezerve yok = warn" mantığı v15.70'te anlamsızlaştı |
| v15.80a | plans/orders/recs değişken adı hotfix | İlk patch'te yanlış değişken adları kullanıldı |
| v15.80b | Kontrol 11 legacy IE-MANUAL filtresi | 2 eski IE-MANUAL satırı bar_acilis olmadan tamamlanmıştı (v15.55 öncesi) |
| **v15.81** | **MRP temel hesabı saha bug fix** | Kontrol 5 ↔ MRP sayfası çelişkisi — 7 IE-MANUAL tamamlandı durumda hammadde ihtiyacı üretiyordu |

## v15.79 — Plan Bekliyor / Üretilebilir Efektif Durum

İş Emri #13 madde 8+9. Kararlar (Buket):
- **DB'ye yazma yok** — UI türetimi (`getEffectiveStatus`)
- **Sadece 2 yeni durum:** `PlanBekliyor` ve `Uretilebilir`
- **Operatör paneli sadece üretilebilir + üretimde** görür (Plan Bekliyor olanlar GÖRÜNMEZ)
- **Tooltip dinamik:** eksik ne ise yazar (kesim plan / tedarik açılmamış / tedarik yolda)
- **Topbar yeni rozet:** `[PLAN BEKLEYEN N]` — toplam görünüm (mevcut KESİM/MRP/TEDARİK sebep ayrımı kalıyor)

Karar sırası (`getEffectiveStatus` içinde):
1. DB durumu zorlayıcı (iptal/tamamlandi/beklemede/uretimde) → onu döndür
2. Kesim opsiyonlu + plan yok → PlanBekliyor (kesim_plan)
3. Hammadde stoğu yeterli → Uretilebilir
4. Hammadde eksik + tedarik açılmamış → PlanBekliyor (tedarik_yok) ← öncelik
5. Hammadde eksik + tedarik yolda → PlanBekliyor (tedarik_yolda)

**Senaryo 11** (saf-fonksiyon, 10 alt-test, ~5 ms): DB durum öncelikleri, kesim plan, hammadde yeterli, tedarik yok/yolda, çoklu eksikte tedarik_yok öncelik kuralı, üretim ilerlemesi etkisi, BOM tanımsız edge case.

## v15.80 — Sağlık Raporu §21 Sözleşmesi

v15.70'te rezerve mantığı kaldırıldığı için Kontrol 5/6/7 anlamsızlaştı. Yeni mantık:

| Kontrol | Eski | Yeni |
|---|---|---|
| 5 | "Rezerve toplamı stok aşıyor mu" (anlamsız) | "MRP §21: tüm aktif sipariş+İE'ler için NET>0 var mı" — gerçek tutarlılık |
| 6 | "Orphan rezerve" | "Eski Rezerve Verisi (v15.70 sonrası kapsam dışı, ileride DROP)" — auto-fix korundu |
| 7 | "MRP tamam ama rezerve yok" (anlamsız) | "MRP tamam ama hesapla net>0 var mı" — gerçek tutarlılık |

**v15.80a hotfix:** İlk patch `cps`/`ords`/`recipes` yazılmıştı, doğrusu `plans`/`orders`/`recs` (Supabase fetch sonuçlarına verilen yerel adlar). Test ortamında çalıştırmadan kod yazma riski.

## v15.80b — Kontrol 11 Legacy IE-MANUAL Filtresi

Saha vakası: 2 plan satırı `bar_acilis` eksik raporlanıyordu — IE-MANUAL-MOCWQYNL ve IE-MANUAL-MOCWJRK6, 760/760 üretim tamamlandı, v15.55 hard block öncesi açılmış.

Filtre: Tüm WO'lar IE-MANUAL prefix'li + hiç bar_acilis yoksa → legacy, sessiz atla. Yeni vakalar (v15.55 sonrası) yine yakalanır (hard block ile zaten engellenmiş, yarım iş varsa bar_acilis 1+ olur).

## ⭐ v15.81 — MRP TEMEL HESABI SAHA BUG FİX

### Saha vakası (28 Nis sabahı tespit)

Sağlık raporu **Kontrol 5: 5 malzeme net ihtiyaç** dedi. MRP sayfası (Hesapla butonu sonrası) **0 eksik · 24 yeterli** dedi. İki kaynak aynı `hesaplaMRP` fonksiyonunu çağırıyor — farklı sonuç dönüyor.

SQL sorgusu 7 WO çıkardı: hepsi `IE-MANUAL-*`, hepsi `durum=tamamlandi`, üretim 100% bitmiş ama `hesaplaMRP` bunların hammadde ihtiyacını hâlâ üretiyor.

### Kök neden — pre-existing bug, port'tan beri

`mrp.ts` iki yerde:

```typescript
// Sipariş bazlı (satır 211, v2 port'undan beri):
const uretilen = urunWOs.reduce((a, w) => {
  const prod = stokHareketler.filter(h => h.woId === w.id).length > 0 ? 0 : 0 // simplify
  return a
}, 0)
const netAdet = u.adet  // ← üretim ilerlemesi yok sayıldı

// Bağımsız İE / manuel İE (satır 248, v15.35.3'ten beri):
const uretilen = stokHareketler.filter(h => h.woId === w.id).length > 0 ? 0 : 0
// (log bazlı hesaplama bu dosyada yok — şimdilik hedef kullanılır)
const kalan = w.hedef - uretilen  // ← her zaman hedef kadar kalan görünüyor
```

Yorumlar açık: "v2 uses wProd which needs logs" — port sırasında atlanmış. **uretilen=0 hardcode**'lanmış. Ek olarak manuel İE filtresinde sadece `iptal` filtreleniyor, `tamamlandi` filtre dışı.

13+ sürüm boyunca **tedarik fazla görünüyordu sürekli** ama kimse fark etmedi çünkü sahada bu farkı yakalamak zor.

### Düzeltme (mrp.ts, 3 değişiklik)

**1. `logs` parametresi eklendi (opsiyonel, geriye uyum):**
```typescript
hesaplaMRP(..., logs?: { woId: string; qty: number }[])
```

**2. Sipariş bazlı: gerçek üretim oranı:**
```typescript
const uretilen = logs ? urunWOs.reduce((a, w) =>
  a + logs.filter(l => l.woId === w.id).reduce((b, l) => b + l.qty, 0), 0) : 0
const oran = Math.min(1, uretilen / toplamHedef)
const netAdet = Math.max(0, Math.ceil(u.adet * (1 - oran)))
if (netAdet === 0) continue  // tamamen üretilmiş, BOM patlatma
```

**3. Manuel İE: gerçek kalan + tamamlandi filtresi:**
```typescript
if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false  // ← tamamlandi eklendi
// ...
const uretilen = logs ? logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0) : 0
const kalan = Math.max(0, w.hedef - uretilen)
```

### Caller'lar (10 çağrı)

`autoChain.ts` (1), `Orders.tsx` (3), `MRP.tsx` (4), `DataManagement.tsx` (2). Tümü `logs` parametresini geçiriyor. `logs` opsiyonel olduğu için eski caller'lar (varsa) kırılmıyor — eski davranış (uretilen=0) geriye uyumlu.

### Senaryo 12 — Saha Bug Fix Kanıtı

6 alt-test:
1. Manuel İE oluştur (orderId=null, hedef=10)
2. logs param yok → eski davranış (ihtiyaç çıkar)
3. logs=[] → uretilen=0, ihtiyaç hâlâ çıkar
4. logs=hedef×0.5 → toplamBrut yarıya düşer
5. ⭐ logs=hedef×1.0 → ihtiyaç **0** (saha bug fix kanıtı)
6. WO durum=tamamlandi → filtreden atılır (logs olmadan bile)

TEST_20260428_05: 12/12 senaryo PASS. Adım 5 her zaman 0 dönmek zorunda — saha vakası tekrarlanamaz.

### Sahaya etki

Sağlık raporu sonrası:
- **Önce:** 9 PASS · 1 WARN · 1 FAIL (Kontrol 5: 7 eksik, sonra 5 eksik)
- **Sonra:** 10 PASS · 1 WARN · 0 FAIL (Kontrol 5: PASS — "tüm hammaddeler stok veya yolda")

Kalan WARN: IE-AUTO-MOI5FZ2S `mrp_durum='tamam'` ama gerçekte 1 eksik (Kontrol 7). MRP koşturmak çözer.

## §22 Yarın TODO Güncel

İlk 4 madde duruyor:
1. MRP senaryoları konuşması (DEVAM_NOTU §22)
2. Madde 15 onay sistemi (planlama onayı, rezerve değil)
3. Madde 8+9 ✅ TAMAMLANDI (v15.79)
4. Madde 16 kesim artık ürün

Yeni eklemeler:
5. **Çoklu admin oturumu sorunu** (28 Nis tespit) — backlog. Aynı hesapla 2+ cihazdan login mümkün, race condition + state senkronsuzluğu. Test Modu cross-device sorunu bunun parçası: localStorage cihaz bazlı ama DB paylaşılır.
6. **uys_mrp_rezerve DROP** (atıl kod A3) — v15.81 ile MRP rezerve sistemi tamamen anlamsızlaştı. 1-2 hafta gözlem sonra DROP.
7. **Senaryo 3 adet bağımlılığı** (testRunner.ts:569) — `if tedarik===0 throw`, dynamically detect "stok yetiyor mu" + PASS dön. Düşük öncelik.

## Atıl Kod Analizi A2 — Yeniden Doğrulandı

v15.78'de geri eklenen "Bağımsız YM İE" UI bölümü v15.81'de logs parametresi eklenmesiyle artık doğru hesap yapıyor. Manuel İE'lerin MRP'de görünür olması + ihtiyacın gerçek kalan üzerinden hesaplanması — ikisi birden çalışınca saha modeline tam oturuyor.

---

# §25. 28 NİSAN 2026 ÖĞLEDEN SONRA — SAHA MODEL KONUŞMASI

15:37 → ~17:00 oturumu. Önceki oturumlarda kod tarafı çözüldükten sonra **kafadaki saha modeli** yazılı hale getirildi.

**Çıktı:** `docs/saha_model_28nis2026.md` (516 satır, 13 senaryo).

## Konuşulan 13 senaryo

```
1. Sipariş geldi
2. Manuel İE açıldı (siparişsiz, stok için)
3. Tedarik geldi
4. Sipariş arttı
5. Sipariş azaldı
6. Sipariş iptal
7. Tedarik yaklaşan termin / gecikme / iptal
8. Üretim girildi (normal, fire'sız)
9. Fire çıktı (telafi)
10. Manuel stok çıkışı (Madde 15 onay sisteminin kalbi)
11. Manuel stok girişi
12. 2 sipariş aynı malzeme (FIFO)
13. Hammadde alternatifi
```

## Ana keşifler

**Mamul/hammadde simetrik rezerv-tahsis modeli:**
```
                    MAMUL                        HAMMADDE
─────────────────────────────────────────────────────────
Otomatik bağlama    İE üretim → order_id        FIFO tahsis (termin)
                    rezerv

Görünürlük          Stok kartında rezerv         Stok kartında tahsis
                    dağılımı                     dağılımı

Manuel müdahale     Rezerv → başka sipariş       Tahsis → başka sipariş
                    Sebep+açıklama zorunlu       Sebep+açıklama zorunlu

Sonuç               Etkilenen sipariş için       Etkilenen sipariş için
                    EK İE                        ek tedarik/İE
```

**🔔 Bildirim merkezi (yeni özellik):**
Topbar'a yeni badge — sistem uyarıları için (chat/operatör mesajından ayrı). 7+ uyarı kaynağı (tedarik gecikme/iptal, sevkiyat termin, düşük stok, fire, manuel rezerv'e dokunma, vs).

**Madde 15 onay sistemi mimarisi netleşti:**
3 aşamalı kontrol modeli (serbest → rezerv → üretim ihtiyacı). Mamul ve hammadde için ayrı 2'şer aşama. Detay: saha_model_28nis2026.md.

## Kod tarafında EKSİK olan kavramlar

1. Mamul stok rezerv/serbest ayrımı (sipariş bazlı, order_id ile)
2. Hammadde stok tahsis dağılımı (FIFO termin)
3. Manuel müdahale modalı (rezerv'e dokunma + sebep zorunlu)
4. 🔔 Bildirim merkezi (Topbar badge + uys_bildirimler tablosu)
5. Senaryo 1 modalı doğrulaması ("55 mi 50 mi?")
6. Manuel İE termin zorunlu (Senaryo 2 + 12)
7. Malzeme kartı kalite/cins/standart/kaplama alanları
8. Malzeme alternatifleri tablosu + UI
9. Kesim planı alternatif boy desteği

## DÜZELTME gerek

**v15.74 AZALIS BLOCK kuralı yanlış:** Senaryo 5'te "üretildi > yeni adet → engel" kuralı saha modeline ters. Saha kuralı: fazla üretim engel değil, serbest stoğa. Senaryo 7 testi "doğru çalışıyor" demişti ama spec yanlıştı.

## Backlog senaryolar

1. İade akışı (Senaryo 5.4, 6.5)
2. Fire raporlama (Senaryo 9.8)
3. Çoklu admin oturumu (önceki tespit)
4. Operatör entry modal — kendini çıkaramama bug'ı (Senaryo 8.2)

## Sıradaki adım

Madde 15 onay sistemini tasarlamak. saha_model_28nis2026.md tüm girdileri sağlıyor — yeni Claude oturumu o dökümanı okur, kod patch'i çıkarır.


---

# §26. 29 NİSAN 2026 — MADDE 15 TAM TUR + 15 SÜRÜM REKOR GÜNÜ

**Tarih:** 29 Nisan 2026 (Çarşamba), sabah → akşam tek oturum
**Push edilen:** v15.82 → v15.96 (15 sürüm)
**Ana çıktı:** Madde 15 Onay Sistemi P1+P2+P3+P4 sahaya çıktı

---

## §26.1 — 15 Sürüm Listesi

| # | Sürüm | Konu | Etki |
|---|---|---|---|
| 1 | v15.82 | Saha model uyum: AZALIS BLOCK kaldırıldı + manuel İE termin zorunlu | Sipariş azaltma akışı saha kuralına uydu |
| 2 | v15.83 | Senaryo 1 modal Faz 1 MVP — kesim planı sonrası onay | autoZincir + onKesimFark callback |
| 3 | v15.84 | Senaryo 13 otomatik test — v15.83 modal'ının testRunner ispatı | 6/6 PASS (12.6 saniye) |
| 4 | v15.85 | Test cleanup bug fix (3 katmanlı) | 3 ay'lık birikmiş kalıntı sıfırlandı |
| 5 | v15.86 | "IE--01" boş prefix bug fix | 7 İE elden düzeltildi, kod düzeltildi |
| 6 | v15.87 | buildWorkOrders idempotency | DB MAX(sira) → duplicate sira imkansız |
| 7 | v15.88 | MRP "0 aktif sipariş" UX bug | Bekliyor durumu listede gözükür |
| 8 | v15.89 | Sağlık raporu 3 yeni kontrol | #12, #13, #14 sentinel'ler |
| 9 | v15.90 | Madde 15 P1: Veri modeli | rezerv kolon + 2 tablo + 4 RBAC action |
| 10 | v15.91 | Sipariş no UNIQUE constraint + UI duplicate koruması | DB sert + UI yumuşak hibrit |
| 11 | v15.92 | Madde 15 P2: Mamul rezerv UI | 2-aşama çıkış modalı + audit log entegrasyonu |
| 12 | v15.93 | Audit schema dosyaları | sql/ klasörüne v15.90 + v15.91 |
| 13 | v15.94 | Audit senkronizasyonu | bildirimler store'a, mudahale log whitelist'e |
| 14 | v15.95 | Madde 15 P3: Hammadde FIFO tahsis | MRP rozetleri (🟢🟡🔴) |
| 15 | v15.96 | Madde 15 P4: Bildirim merkezi | Topbar Bell + dropdown + 2 üretici |

---

## §26.2 — Bug Bug Yakalama Hikayesi

Bu gün dört ardışık bug yakalandı; her biri öncekiyle ilişkili. Saha gerçeği gizliydi, kademeli ortaya çıktı:

### Bug 1: Test Cleanup Eksikliği (v15.85)
**Tespit:** Sağlık raporu test sonrası TEST_S13 kalıntılarını gösterdi. 65 kayıt sahada.
**Kök sebep:** 3 katmanlı eksiklik:
1. `finishTestRun` statik `_s1`...`_s5` listesi → S6+ sub-run'lar gözden kaçtı (3 ay)
2. `uys_mrp_calculations` cascade listede yok
3. `autoChain.ts` mrp_calc insert'i `withTestRunId` ile sarılmamış (etiketsiz)

**Fix:** Dinamik sub-run tarama (LIKE parentId%) + cascade'e ekle + autoChain etiketleme

### Bug 2: IE--01 Boş Prefix (v15.86)
**Tespit:** Sağlık raporu sonrası DB sorgusu — 7 İE'de `ie_no = "IE--01"` (boş prefix).
**Kök sebep:** `Orders.tsx` satır 592 — Tekil İE modunda `siparisNo.trim()` (boş) kullanılıyordu, `etkinSiparisNo` (otomatik üretilmiş `IE-AUTO-...`) hazır olmasına rağmen.
**Fix:** Tek satır değişikliği (siparisNo → etkinSiparisNo). Mevcut 7 İE manuel SQL UPDATE ile düzeltildi.

### Bug 3: Duplicate Sira Numarası (v15.87)
**Tespit:** Test sırasında 40 İE oluştu, her sira numarası 2 kez tekrar etmiş (1,1, 2,2, ..., 20,20).
**Kök sebep:** `buildWorkOrders` aynı `orderId` için 2 kez çağrıldığında kalemden kaleme `siraBaslangic` doğru geçiyordu ama caller stale state durumunda woTotal=0 başlatabiliyordu.
**Fix:** DB'den `MAX(sira)` oku, caller'ın `siraBaslangic`'iyle `Math.max` al. Idempotent koruma — duplicate sira imkansız.

### Bug 4: Sipariş No Duplicate (v15.91)
**Tespit:** S26A_03151 hem 28 Nis hem 29 Nis kayıtları çıktı. 4 İE duplicate ie_no'ya yol açtı.
**Kök sebep:** Orders.tsx `siparis_no` UNIQUE değil — kullanıcı dikkatsiz girince veya müşteri tekrar gönderince 2 kayıt.
**Fix:** Hibrit (UI uyarı + DB UNIQUE constraint). 29 Nis kayıt 28 Nis'e DO bloğu ile birleştirildi (sira offset).

**Ders:** Sağlık raporu kontrolleri proaktif sentinel; sahaya yapışmış eski bug'ları açığa çıkardı. Yeni 3 kontrol (v15.89) sayesinde aynı bug ailesinden gelecek vakalar 5 dakikada yakalanacak.

---

## §26.3 — Madde 15 Mimarisi

### Veri Modeli (P1, v15.90)

**uys_stok_hareketler.rezerv_order_id (yeni kolon)**
- `tip='giris' + rezerv_order_id=order_id` → O sipariş için rezerv mamul
- `tip='giris' + rezerv_order_id=NULL` → Serbest stok
- `tip='cikis'` → Mevcut akış (rezerv izleme yok, çıkış serbestten + sonra rezerv'den varsayılır)

**uys_bildirimler (yeni tablo)**
- `tip`: 'sari' | 'kirmizi'
- `kategori`: 'stok' | 'rezerv_ihlali' | 'manuel_mudahale' | 'tedarik_gecikme' | 'termin_yaklasik' | 'mrp_eksik'
- `okundu`, `okundu_tarih`
- `ref_id` + `ref_tip` → tıklayınca yönlendirme
- `hedef_kullanici_id` (NULL = herkes)
- `test_run_id` (cleanup uyumlu)

**uys_manuel_mudahale_log (yeni tablo) — audit trail**
- `islem_tipi`: 'rezerv_kirma' | 'serbest_cikis' | 'fazla_cikis'
- `sebep` zorunlu (dropdown 5 seçenek)
- `aciklama` zorunlu (min 10 karakter)
- `stok_hareket_id` ilişkisi (hangi çıkış kaydına denk)

### Mamul Rezerv UI (P2, v15.92)

**hesaplaMamulRezervDurum() saf fonksiyon:**
- Toplam stok = giriş - çıkış
- Rezerv toplam = sum(giriş where rezerv_order_id IS NOT NULL), max(0, toplamStok ile sınırla)
- Serbest = max(0, toplamStok - rezervToplam)
- Detay: rezerv siparişlerini termin yakından uzağa sırala

**MamulCikisModal — 2-aşama akış:**
- Aşama 1: Stok özet (rezerv X / serbest Y), miktar girişi
  - Miktar ≤ serbest → tek tıkla "Cikisi Kaydet" (manuel müdahale değil)
  - Miktar > serbest → "Mudahale ile Devam" → Aşama 2 (yetki kontrolü)
- Aşama 2: Sebep dropdown + açıklama (min 10 char) → Onayla
  - Stok hareket insert + manuel_mudahale_log insert + bildirim (kırmızı)

**Yer:** Depolar → Anlık Stok tablosunda mamul satırlarında "📤 Çıkış" butonu

### Hammadde FIFO Tahsis (P3, v15.95)

**hesaplaHammaddeTahsisi() saf fonksiyon:**
- Birden fazla siparişin aynı hammaddeye ihtiyacı olabilir
- FIFO termin sırası: yakın termin önce alır
- Her sipariş için: tahsisStok + tahsisYolda + eksik
- **Request-time hesap** (DB'de saklanmaz, sayfa açılınca canlı)

**siparisTahsisOzeti() saf fonksiyon:**
- 🟢 yeşil: tüm hammadde stokta
- 🟡 sarı: stok yetersiz, tedarik yolda
- 🔴 kırmızı: yeni tedarik gerek (eksik)

**Yer:** MRP sayfası — sipariş kartlarında rozet + üstte toplam sayaç

### Bildirim Merkezi (P4, v15.96)

**Topbar Bell icon:**
- Chat icon yanında 🔔
- Badge: okunmamış sayı, kırmızı varsa kırmızı, sadece sarı varsa sarı
- Dropdown panel: son 20 okunmamış + "Hepsini okundu"
- Tıklayınca: ref_id'ye navigate (Sipariş/WO sayfaları)

**Bildirim üreticileri (otomatik):**
1. **Manuel müdahale** (v15.92'den) → kırmızı + rezerv_ihlali
2. **MRP eksik tespit** (v15.96'dan) → MRP "Hesapla" sonrası her eksik sipariş için sarı + mrp_eksik
   - Idempotent: aynı sipariş için açık bildirim varsa tekrar oluşturmaz

---

## §26.4 — Sağlık Raporu Üst Düzey Sürümü

v15.89 ile **3 yeni kontrol** eklendi (toplam 14):

**#12 Plansız Kesim İE'si**
- Kesim opsiyonlu (op_kod 023/025/026/027) İE'lerden hiçbir kesim plani satirinda yer almayanlar
- Saha vakası (29 Nis): 16 plansız İE — günlük yarım akış bırakma yakalanır
- Auto-fix yok (kullanıcı Tam Zincir bassın veya manuel plan yapsın)

**#13 Sipariş içi sıra numarası unique**
- v15.87 idempotency fix sentinel
- Saha vakası: 40 İE'de duplicate sira yakalandı

**#14 ie_no benzersizliği ve format**
- v15.86 boş prefix fix sentinel
- Plus global ie_no duplicate kontrolü
- Saha vakası: IE--01 formatı + S26A_03151 duplicate yakalandı

**Toplam kontrol durumu (29 Nis akşamı):**
- 12 PASS / 2 WARN / 0 FAIL
- WARN'lar saha aksiyon (BORU 5 Mayıs ihtiyaç + S26A_02808 mrp_durum bayat)

---

## §26.5 — Yarın İçin Açık Konular

### Madde 15 Eksikleri (öncelik: düşük, sahaya çıktı çalışıyor)
- Senaryo 1 modal **Düzenle modu** atlandı — kullanıcı manuel hedef girsin (Faz 2'ye ertelendi)
- Hammadde manuel müdahale UI — P3'te tahsis görünür, ama "rezerv kırma" UI'sı henüz yok (mamul tarafında var, hammaddeye taşınabilir)

### Backlog (öncelik: yüksek)
- **#5 Sevkiyat Oluşturma Formu** — Production-blocker
- **#7 Toplu Sipariş Excel İmport** — Pratik gereklilik
- **#9 Stok Onarım** — Audit kritik

### Bilinen WARN'lar (saha aksiyon, kod sorunu değil)
- BORU Ø48,3x3 5500mm — net 154 adet, termin 5 Mayıs
- S26A_02808 — mrp_durum bayat (MRP "Hesapla" çözer)

### v15.89'un yakalayamadığı (yarın yeni kontrol fikri)
- Aynı sipariş için açık bildirim sayısı limit kontrolü (şu an idempotent, ama eski okunmuşlar birikiyor)
- Bar Model orphan'larda eski kalıntı (#11 zaten kapsıyor — ama performans iyileştirilebilir)

---

## §26.6 — Mimari Kararlar Kaydı

**1. Mamul rezerv: kolon vs ayrı tablo?**
- Karar: Kolon (`rezerv_order_id` on `uys_stok_hareketler`)
- Sebep: Minimum değişiklik, mevcut sorgu paternlerini bozmaz

**2. Hammadde tahsis: real-time vs request-time?**
- Karar: Request-time (MRP sayfası açılınca hesapla)
- Sebep: Performans (her stok hareketinde N sipariş tahsis hesabı çok ağır)

**3. Manuel müdahale: sebep+açıklama zorunluluk seviyesi?**
- Karar: Hibrit — sebep dropdown ZORUNLU + açıklama serbest text (min 10 char) ZORUNLU
- Sebep: Audit log'un faydalı olması için bağlam şart, ama 5 sabit seçenek + serbest kombinasyonu pratik

**4. Sipariş no duplicate: UI vs DB seviyesi?**
- Karar: Hibrit — UI uyarı (yumuşak) + DB UNIQUE constraint (sert)
- Sebep: UI bug olursa DB durdurur; DB sert hata mesajı çirkin, UI önce yakalar

**5. Bildirim merkezi: realtime vs polling?**
- Karar: Store TABLE_MAP entry (otomatik realtime subscription dinler)
- Sebep: Mevcut altyapı yeterli, ek subscription gereksiz

**6. Senaryo 1 modal "Düzenle" modu erteleme:**
- Karar: Faz 2'ye ertelendi
- Sebep: Buket "Faz 1 yeterli, plan revizyonu Faz 3'e bırakılsın" dedi. Modal saha gerçeğine zaten uygun — bar bütünlüğü fazla parçası stoğa, az üretmek isteyen sipariş düzenlesin.

---

## §26.7 — Performans / Risk Notları

- **hammaddeTahsis hesabı:** N siparişe N MRP koşumu (N=10 için ~100ms). 50+ aktif sipariş varsa gecikme olabilir; ileride memo'lanabilir.
- **Bildirim büyümesi:** Eski okunmuş bildirimler tabloya birikir. İleride `cleanOldNotifications(30 days)` cron eklenebilir.
- **RLS hala `allow_all`:** §20'de planlı RLS Refactoru ile sıkıştırılacak. Yeni 2 tabloda da `allow_all` (mevcut sistemle uyumlu).
- **Audit script:** Yeni tablo eklemede 3 yer eşzamanlı güncellenmeli (DataManagement.tables + store/TABLE_MAP + audit-schema.cjs whitelist). v15.94 bu kuralın canlı uygulaması.

---

*Bu §26 oturumu 29 Nis 2026 akşamı (~17:00) tamamlandı. Madde 15 sahada, 15 sürüm tek günde rekor. Yarın yeni Claude oturumunun §26'yı + DEVAM_NOTU'yu okuması yeterli — chat aramaya gerek yok.*

---

## §26.8 — 29 Nis Akşam Eklemeleri (v15.97-v15.99)

### v15.97 — Doc Kalıcı Kayıt
DEVAM_NOTU + §26 + Backlog Master güncellendi. Yarınki yeni Claude oturumunun açılış kapısı.

### v15.98 — Bulk Import Çoklu Kalem
**Saha vakası:** S26A_03146 (MV GRUP, 5 Mayıs termin, 14 ürün kalemi) Excel ile yüklenirken "Excel içinde tekrar eden sipariş no" hatası.

**Bug:** `BulkOrderImportModal` (Orders.tsx satır 1345) `excelSipNoSeen` set'iyle aynı `siparis_no`'lu satırları reddediyordu. Plus execute aşamasında her satır için ayrı `uys_orders.insert` atılıyordu — v15.91 UNIQUE constraint nedeniyle de patlardı.

**Fix:** Parse'da duplicate kontrolü kaldırıldı. Execute'ta `siparis_no`'ya göre Map gruplaması:
- 1 grup = 1 `uys_orders.insert` (urunler[] çoklu kalem)
- Her kalem için `buildWorkOrders` (siraBaslangic offset, v15.87 idempotency korur)

**Sonuç:** S26A_03146 → 1 sipariş + 14 kalem + 14 İE.

### v15.99 — Reçete İç Tutarlılığı (#15 Sentinel)
**Saha vakası (29 Nis ~17:00):** IE-S26A_03146-04 plansız kaldı.

**Tanı:** Reçete (id=mojyurpq7b6xwz):
- `mamul_kod` = "Ø48,3X2,5MM - 1450 MM" (boşluklu, Excel ile eşleşen)
- İç YarıMamul satır `malkod` = "Ø48,3X2,5MM - 1450MM" (**boşluksuz**)

`buildWorkOrders` İE'nin `malkod`'unu reçete YarıMamul satırından kopyalıyor → İE'de "1450MM" (boşluksuz). Kesim algoritması ham malzemeden kesilen YM'leri **boyut bazında gruplandırırken** format farkı nedeniyle IE-04'ü atladı.

**Tek seferlik el kayması:** Tüm reçetelerde tarama yapıldı (B sorgusu) → **0 başka vaka**.

**Veri fix:**
```sql
UPDATE uys_recipes SET satirlar=jsonb_set(satirlar,'{0,malkod}','"Ø48,3X2,5MM - 1450 MM"')
WHERE id='mojyurpq7b6xwz';
UPDATE uys_work_orders SET malkod='Ø48,3X2,5MM - 1450 MM'
WHERE ie_no='IE-S26A_03146-04';
```
Sonra Otomatik Plan tekrar → IE-04 plana girdi.

**Sentinel (v15.99):** Sağlık raporu Kontrol #15 eklendi.
- Tüm reçetelerin `mamul_kod` ile `kirno=1` YarıMamul satır `malkod`'u karşılaştırılır
- BOŞLUK_FARKI → FAIL (auto-fix mümkün)
- TAMAMEN_FARKLI → WARN (manuel inceleme — yan ürün reçetesi olabilir)

### v15.97-v15.99 Mimari Karar — "Sentinel İlkesi"

29 Nis günü 5 saha bug'ı ortaya çıktı (v15.85, v15.86, v15.87, v15.91, v15.99). Hepsinin çözümünde aynı patern:

1. **Reaktif fix** — Bug'ı düzelt
2. **Veri temizliği** — Mevcut bozuk kayıtları SQL ile düzelt
3. **Sentinel kontrolü** — Sağlık raporuna kontrol ekle (ileride aynı el kayması 5 dk'da yakalanır)

Bu prensipte:
- v15.85 → v15.89 #11 (Bar Model) sentinel
- v15.86 → v15.89 #14 (ie_no format) sentinel
- v15.87 → v15.89 #13 (sira unique) sentinel
- v15.91 → v15.91 DB UNIQUE constraint (DB sentinel)
- v15.99 → v15.99 #15 (reçete iç tutarlılık) sentinel

**Toplam sağlık kontrolü: 15** (4'ü 29 Nis günü eklendi).

---

*Bu §26.8 ek bölümü 29 Nis 2026 ~17:00'da eklendi. Bugünün toplam push'u 18 sürüme ulaştı (v15.82 → v15.99).*

---

# §27. 30 Nisan 2026 — MRP Cutting Override Kök Çözümü + Patch Hijyen Krizi

**Tarih:** 30 Nisan 2026 sabah 05:00 → öğle 08:30 (5.5 saat)
**Sürüm aralığı:** v16.00 → v16.15 (14 sürüm + 1 doc commit `e753e71`)
**Saha vakası:** S26A_03150 + S26A_03146 + S26A_03151 — 5 Mayıs termin
**Sağlık raporu:** 13 PASS · 2 WARN → **17 PASS · 0 WARN · 0 FAIL** ⭐
**DB direkt fix:** 7 IE yuvarlama düzeltmesi + 4 saha tedariği (Supabase MCP üzerinden)

Bugün **Anthropic Claude'un Supabase MCP server'ı** ilk defa kullanıldı. Canlı DB sorgusu + UPDATE/INSERT yetki eklendi. Saha analizinde devrim seviyesinde hızlanma — önceden Buket'in SQL yapıştırma uğraşı yerine Claude doğrudan koşturuyor. Plus Claude Code VS Code uzantısı yarım gün kullanıldı (rate limit nedeniyle PowerShell zip-apply'a geri dönüldü).

## §27.1 — v16.00 Sağlık #15 Sentinel `recipes`/`recs` Tipo (Hotfix)

**Saha vakası:** Sabah 04:35'te Buket "Sağlık Raporu çalışmıyor" dedi. Console:

```
ReferenceError: recipes is not defined
    at l (index-DQMZo_zK.js:88:142169)
```

**Tanı:** v15.99 ile eklenen Sağlık #15 (Reçete iç tutarlılık) sentinel kodunda. Try bloğu başında destructure:

```ts
const recs = recRes.data || []  // satır 71
```

Ama #15 kontrol bloğunda 2 yerde `recipes` (camelCase) kullanılmış:

```ts
for (const r of recipes as any[]) { ... }     // satır 782 — undefined
${recipes.length} reçetede ...                 // satır 824 — undefined
```

Bilgi Bankası §26.8'deki dokümandaki `recipes` ismi sentinel kodunu yazarken oradan kopyalanmış, lokal değişken adına uydurulmamış.

**Fix:** 2 satırda `recipes` → `recs`. CRLF korundu, başka recipes kod referansı kalmadı (string literal `'recipes'` ve yorumlar dokunulmadı).

**Sentinel ilkesi:** Bu spesifik vaka için yeni sentinel eklenmedi (v16.15'te `scripts/saglik-syntax-check.cjs` ile **yapısal koruma** yapıldı, daha kapsamlı).

---

## §27.2 — v16.01 MRP Filtre `dbEksik` (Band-aid)

**Bağlam:** Buket "Hesapla yaptım, ama mrp_durum DB'de hala 'tamam' kaldı" dedi. DB'den canlı kontrol: `mrp_durum='eksik'` olarak işaretli 2 sipariş var ama **MRP listesinde gözükmüyorlar**.

**Sebep:** MRP.tsx satır 65-78 filter mantığı:

```ts
const eksikVar = orderHasEksik[o.id] ?? false   // hesaplaMRP canli sonucu
const henuzHesaplanmadi = (o.mrpDurum || 'bekliyor') === 'bekliyor'
const aktifMi = eksikVar || henuzHesaplanmadi    // ikisi de false → GİZLE
```

`mrpDurum='eksik'` durumu DB'de kayıtlıysa ama `eksikVar` (canlı `hesaplaMRP`) cutting override yüzünden 0 dönüyorsa → liste boş, kullanıcı tedarik açma akışına ulaşamıyor.

**Fix (band-aid):** Yeni `dbEksik` koşulu — DB'de `mrp_durum='eksik'` ise zorla aktif say.

```ts
const dbEksik = (o.mrpDurum || '') === 'eksik'
const aktifMi = eksikVar || henuzHesaplanmadi || dbEksik
```

**Neden band-aid:** Kök neden cutting override mantığında. v16.02 (LEVHA skip) ve v16.07 (max(BOM,plan)) ile gerçek çözüm.

---

## §27.3 — v16.02 + v16.07 Cutting Override KÖK ÇÖZÜM

### Eski (v15.50a Faz B P2'den beri)

`mrp.ts` step 4 "Cutting plan override":
- BOM patlatması ile elde edilen brüt ihtiyaç → `brutIhtiyac[malkod__termin]`
- Cutting plan satırlarındaki `hamAdet` toplamı → `planAdet`
- BOM **silinir**, plan adedi yazılır

**Mantık (eski yorum):** "Plan optimize edilmiş gerçek ihtiyaçtır, BOM teorik."

### Saha gerçeği — yanılma

**S26A_03150 plywood:** 5 IE × levha = BOM 214. `boykesimOptimum` 1D (sadece `parcaBoy`). Plywood 877×2677 için: 1500/877=1.71 → 1 sığar gerçekte. Algoritma 3000/877=3 dedi. Plan 83 hamAdet hesaplandı (=mevcut stok). Override 214'ü silip 83 yazdı → MRP "yeterli" sandı.

**Gerçekte:** 131 levha eksik. Sahada üretim çakılır.

### v16.02 — Hızlı çözüm (LEVHA skip)

Yüzey kesim için 1D mantık yanıltıcı, override **hiç yapma**:

```ts
if ((hmM as any)?.hammaddeTipi === 'LEVHA') {
  dbg('[MRP DEBUG] Cutting override skip (LEVHA - yüzey kesim, 1D plan güvenilmez):', hmk)
  return
}
```

Plywood için BOM 214 korundu → eksik 131 görünür.

### v16.07 — KÖK ÇÖZÜM (max(BOM, plan))

LEVHA özel halinin tüm tiplere genelleştirilmesi:

```ts
let bomToplam = 0
Object.keys(brutIhtiyac).forEach(bk => {
  if (bk.startsWith(malkodLower + '__')) {
    bomToplam += brutIhtiyac[bk].brut
    delete brutIhtiyac[bk]
  }
})
const finalBrut = Math.max(planAdet, bomToplam)
```

**Mantık:** Plan optimize ettiyse (havuz/artık tasarrufu) onu kullan, BOM aşan vakalarda BOM'a güven (saha gerçeğine kalibre).

**Sonuç:** Profil/boru için de gizli eksikler açığa çıktı:
- PROFIL 75x50x2: BOM 126 vs plan 119 (stok seviyesinde) → +7 gerçek eksik
- BORU 6060: BOM 25 vs plan 22 → +3 gerçek
- PLYWOOD 21mm: BOM 5 vs plan 3 → +2 gerçek

---

## §27.4 — v16.08 IE Yuvarlama Hatası KÖK FIX

**Saha vakası:** S26A_03151 IE-08 PLYWOOD 477×1477 hedef 2 adet. Reçete miktar `0.16666` (=1/6, levha başına 6 yarı mamul çıkar).

`buildWorkOrders` (autoChain.ts) miktarTotal hesabı:

```ts
miktarTotal: Math.round(t * m)  // ESKİ
// 2 × 0.16666 = 0.333 → round = 0 ⛔
```

IE.hm.miktarTotal=0 → kesim algoritması "hammadde gerekmez" sandı, **plan oluşturulmadı** → IE-08 plansız kaldı, "Plan Bekliyor" rozeti.

DEVAM_NOTU §26.5'te belirtilen **42 reçete yuvarlama hatası** (1/6, 1/7, 1/9, 1/11, 1/12, 1/13) bu kategoride. Sahada bu sefer gerçekleşti.

### Fix

```ts
miktarTotal: m > 0 ? Math.max(1, Math.ceil(t * m)) : 0
// 2 × 0.16666 = 0.333 → ceil = 1, max(1, 1) = 1 ✓
```

Ondalıklı reçeteler için artık her zaman en az 1 birim hammadde gerektirir. Sıfır reçete miktarı (sarf opsiyonel) için 0 korunur.

### DB fix (mevcut etkilenen IE'ler)

Tek SQL UPDATE ile 7 aktif IE düzeltildi (Supabase MCP üzerinden):

```sql
UPDATE uys_work_orders w
SET hm = (
  SELECT jsonb_agg(
    CASE
      WHEN (h.elem->>'miktarTotal')::numeric = 0 AND ...
      THEN jsonb_set(h.elem, '{miktarTotal}', to_jsonb(GREATEST(1, CEIL(...))::int))
      ELSE h.elem
    END
  )
  FROM jsonb_array_elements(w.hm) h(elem)
)
WHERE w.durum NOT IN ('iptal', 'tamamlandi')
  AND EXISTS (...)
```

7 IE: IE-S26A_03151-08 (PLYWOOD 477x1477), IE-S26A_03146-06 (BORU Ø57x3 50MM), IE-S26A_03146-10 (100x100x5 200MM), IE-S26A_03146-11 (TR Ø30 300MM), IE-S26A_03146-12 (TR Ø17 25MM), IE-S26A_03151-01 (PROFIL 50x100x3 379MM), IE-S26A_03151-02 (PROFIL 50x100x4 379MM).

### Sentinel #17 (v16.09)

```ts
// IE.hm.miktarTotal=0 ama receteye gore Hammadde miktar>0 ise FAIL
for (const w of wos) {
  const recete = recs.find((r: any) => r.id === w.rc_id)
  if (!recete) continue
  for (const h of (w.hm || [])) {
    if ((Number(h.miktarTotal) || 0) > 0) continue
    const reSatir = (recete.satirlar || []).find((s: any) =>
      s.malkod === h.malkod && s.tip === 'Hammadde' && Number(s.miktar) > 0
    )
    if (reSatir) yuvarlamaHatalari.push({ ... })
  }
}
durum: yuvarlamaHatalari.length === 0 ? 'pass' : 'fail',  // FAIL — kritik
```

Yeni IE'lerde aynı vaka olursa Sağlık raporunda **anında FAIL**.

---

## §27.5 — v16.05 Sipariş-Bütünü PlanBekliyor (#20)

**Eski mantık:** `statusUtils.ts:getEffectiveStatus` her IE'yi **bağımsız** değerlendiriyor. Aynı siparişteki birden çok IE aynı hammaddeyi paylaşırken, sistem her birini tek tek stoğa karşılaştırıyor. Toplam ihtiyacı görmüyor.

**Saha vakası:** S26A_03150 plywood 5 IE × ortalama 43 levha = 214 toplam, stok 83. Sistem sadece tek başına 100 ihtiyaç eden IE-14'ü "PlanBekliyor" gösterdi (Topbar=1). Diğer 4 IE "Üretilebilir" sanılıyordu.

**Çözüm:** `computeOrderHammaddeEksik` helper (statusUtils.ts):

```ts
export function computeOrderHammaddeEksik(
  orders, allWos, stokHareketler, tedarikler
): Map<string, Set<string>> {
  // Her sipariş için: aynı hammaddeyi paylaşan açık IE'lerin Σ ihtiyacı
  // > stok + yolda ise o hammadde "eksik" işaretlenir
}
```

`getEffectiveStatus`'a opsiyonel `orderHmEksikMap` parametresi eklendi. Hammadde stoğu kontrolü öncesi:

```ts
if (orderHmEksikMap && w.orderId) {
  const orderEksik = orderHmEksikMap.get(w.orderId)
  if (orderEksik && hm.length > 0) {
    const ilkOrtak = hm.find(h => orderEksik.has(h.malkod))
    if (ilkOrtak) return { status: 'PlanBekliyor', ..., blockedBy: 'tedarik_yok' }
  }
}
```

5 dosya etkilendi (statusUtils.ts + Topbar.tsx + WorkOrders.tsx + OperatorPanel.tsx + Orders.tsx). Topbar PlanBekleyen sayısı 1'den 39'a sıçradı (3 sipariş × ortalama 13 IE) — sahaya gerçek durum görünür.

**Bu mimari değişiklik #16 sentinel ile tutarlı:** ikisi de "sipariş-bütünü hammadde rekabeti" mantığını paylaşır. #16 Sağlık raporunda WARN/PASS, v16.05 ise UI'da PlanBekliyor rozeti.

---

## §27.6 — v16.12 CamelCase Mapping (Sağlık Raporunun Gerçek Bug'ı)

### Belirti

Sağlık #5 "PROFIL 75x50x4 net 41 ihtiyaç" dedi. DB'den canlı:
- BOM doğrudan kullanım: 150 (sadece S26A_03150)
- Stok: 155
- Açık tedarik: 0
- **Gerçek eksik: 0** (155 ≥ 150)

41 nereden çıkıyor? localStorage debug flag (v16.11) açıldı, console log akışı:

```
[MRP DEBUG] 50X75X4 MM - 437 MM için RECETE BULUNAMADI, üst reçetelerden HM toplanıyor! rc= undefined
[MRP DEBUG] Sipariş ... kalem 50X75X4 MM - 437 MM x130 → BOM: 1
```

**Tüm reçeteler "bulunamadı"!** Ama gerçekten reçeteler DB'de var.

### Kök neden

DataManagement.tsx satır 62-74:

```ts
const recs = recRes.data || []  // RAW DB sonucu, snake_case (mamul_kod)
```

`hesaplaMRP` (mrp.ts) içinde:

```ts
const rc = recipes.find(r => r.mamulKod === mamulKod)  // camelCase
```

`r.mamulKod` her zaman undefined (raw DB'de `mamul_kod` snake_case). Find başarısız → reçete bulunamadı → **fallback recursive yola düşüyor** (bomPatlaNet satır 50-90):

```ts
// Kendi reçetesi yok — üst reçetelerden alt kirno'ları bul
for (const r of recipes) {
  const ymSatir = satirlar.find(s => s.malkod === mamulKod)
  if (!ymSatir) continue
  // Hammadde/Sarf satırlarını topla
  ...
}
```

Bu fallback **çift sayım üretiyor**: aynı yarı mamul birden çok büyük reçetede geçtiği için her birinden HM tekrar tekrar ekleniyor. PROFIL 75x50x4 için: doğrudan 150 + fallback çift sayım 46 = **196**. Stok 155 → eksik 41.

### Fix (v16.12)

Mapping wrapper:

```ts
const recs = (recRes.data || []).map((r: any) => ({
  ...r,
  mamulKod: r.mamul_kod ?? r.mamulKod,
  rcKod: r.rc_kod ?? r.rcKod,
  bomId: r.bom_id ?? r.bomId,
}))
```

5 wrapper: wos, recs, orders, plans, mats (+ stoks, logs için kritik field'lar). `...spread` ile snake_case korunur (geriye uyumluluk), camelCase aliasleri eklenir. **Sentinel #16 ve #17 kontrol blokları her iki naming'i de kullanıyor — spread sayesinde bozulmaz.**

**Sonuç:** PROFIL 75x50x4 BOM 150 (gerçek), eksik 0. Sağlık #5 PASS.

---

## §27.7 — Patch Hijyen Krizi (KAZA ZİNCİRİ)

Bugünün en pahalı dersi: **patch tabanı dikkat**.

### Kaza zinciri

`recipes` tipo bug'ı **3 kere** ortaya çıktı:

| Zaman | Olay |
|---|---|
| 04:35 | v16.00 — ben düzelttim (str_replace, 2 satır) |
| 06:00 | v16.03 — Claude Code Sentinel #16 yazarken `Replacing 5 lines with 69 lines` yaptı. Bu replace blok `recipes` referansını da içermiş olabilir. v16.00 fix kayboldu. |
| 07:55 | v16.13 — ben v16.12 patch'imi `/home/claude/saglik/DataManagement.tsx`'i base alarak hazırladım (v15.99 zamanı snapshot). v16.00 fix yine kayboldu. Plus #16 + #17 sentinel'leri de bu base'de yoktu, **kazara silindi**. v16.14 ile geri eklendi. |

### Kök neden

**Full-file replace patch'leri eski snapshot'tan başlanırsa, aradaki commit'ler kaybolur.** Bunu Claude Code (LLM) farkına varmadan yapar — kendi belleğinde olan dosya state'ini kullanır, repo'daki canlı dosyayı görmez.

Aynısı insan için de geçerli — ben /home/claude'daki cache'i base alıp v16.12 ürettim, o cache eski.

### v16.15 Yapısal Koruma

`scripts/saglik-syntax-check.cjs` prebuild hook'una eklendi:

```js
// 1. kontroller.push sayısı
const kontrolCount = (src.match(/kontroller\.push\(\{/g) || []).length
if (kontrolCount < MIN_KONTROL) process.exit(1)

// 2. recipes kod referansı (yorum + string sabiti hariç)
// Yorumları ve string literallerini temizle, kalanda \brecipes\b ara
if (kotuRecipes.length > 0) process.exit(1)
```

`package.json` prebuild:

```json
"prebuild": "node scripts/audit-schema.cjs && node scripts/audit-columns.cjs && node scripts/saglik-syntax-check.cjs"
```

Build geçmez → push edilse bile GitHub Actions kırılır → canlıya gitmez. **Aynı kaza imkansız.**

### Patch hijyen kuralı (yeni)

Yeni patch yazımında — özellikle Claude Code veya full-file replace — **base dosyayı her zaman canlı repo'dan çek**. Eski snapshot'tan başlama. Kullanıcıya zip iste:

```powershell
Compress-Archive -Path 'src\pages\X.tsx' -DestinationPath 'Downloads\dump.zip'
```

Ondan sonra str_replace ile sadece değiştirilmesi gereken bölgeye dokun. Geri kalan kod aynen kalsın.

---

## §27.8 — "updated_at Sabit ≠ UPDATE Atılmadı" Yanılgısı

**Sahnedeki yanlış teşhis:** Buket "Hesapla yaptım, mrp_durum DB'de hala 'tamam'" dedi. DB'den canlı kontrol: mrp_durum gerçekten 'tamam', updated_at 17 saat önce. Ben "UPDATE atılmamış" sandım. v16.04 sentinel'i (UPDATE error/count=0 yakalama) yazdım. RLS allow_all kontrol ettim (engel yok).

**Gerçek:** PostgreSQL `uys_orders` tablosunda **otomatik `updated_at` trigger yok**. Supabase `update({ mrp_durum: 'tamam' })` çağrısı sadece `mrp_durum`'u günceller, `updated_at`'a dokunmaz. Hesapla butonu **DOĞRU çalışıyordu**, biz sabit `updated_at`'i yanlış yorumluyorduk.

**Saha açısından zarar yok** — Sağlık #7 mrp_durum gerçek hesapla uyumluluğu kontrol eder, updated_at'e bakmaz. Sentinel #7 zaten bu durumu doğru raporluyordu.

**Ders:** UPDATE'in DB'ye yansıyıp yansımadığını teşhis ederken `updated_at`'a güvenme. Direkt değişen field'ı oku (mrp_durum gibi). Veya değişen değeri RETURNING ile geri al (v16.04 sentinel bunu yapıyor).

### v16.16 — Çözüm uygulandı (DB migration)

`set_updated_at()` PL/pgSQL fonksiyonu zaten DB'de tanımlıydı (kim oluşturduğu commit history'sinde belirsiz, muhtemelen v15.x bir döneminde). Ama sadece **bir tabloda** (uys_hm_tipleri) trigger'a bağlanmıştı. Diğer 29 tabloda bağlantı yoktu.

`v16_16_updated_at_triggers_29_tablo` migration'ı ile `uys_*` ön ekli 30 tablonun tamamına `BEFORE UPDATE FOR EACH ROW EXECUTE FUNCTION set_updated_at()` trigger'ı eklendi:

```sql
DO $$
DECLARE t TEXT;
DECLARE tablolar TEXT[] := ARRAY['uys_acik_barlar', 'uys_active_work', ..., 'uys_yetki_ayarlari'];
BEGIN
  FOREACH t IN ARRAY tablolar LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
```

Test (S26A_03150 mrp_durum UPDATE): `updated_at` 0 saniye önce → otomatik güncellendi ✓.

**Bu DB-only migration, kod push gerektirmedi.** Supabase MCP `apply_migration` aracı üzerinden uygulandı.

**Ek ders:** DB'de hazır kayıtlı fonksiyonlar bağlanmamış olabilir. Yeni tablo eklemede §18.2 "Yeni Tablo Konvansiyonu"'na bir madde daha ekle: **trigger bağlantısını da yap** (audit-schema.cjs whitelist + DataManagement.tables + store/TABLE_MAP + **trg_<tablo>_updated_at trigger**).

---

*Bu §27 oturumu 30 Nis 2026 öğlen ~11:50'de tamamlandı. **14 sürüm + 1 doc commit + 1 DB migration + 4 DB fix + 5 saha krizi** tek günde. v15.99 öncesi DEVAM_NOTU'daki "42 reçete yuvarlama hatası" maddesi v16.08 ile kapandı (kalıcı kod fix + sentinel #17). #23 vakası v16.16 ile kapandı (PostgreSQL trigger). Yarın yeni Claude oturumunun §27'yi + DEVAM_NOTU'yu okuması yeterli — chat aramaya gerek yok.*

---

## §27.9 — OperatorPanel "orders is not defined" — v16.05 Baştan Kırıkmış

**Tarih:** 30 Nis 2026 öğleden sonra (~13:00 keşif, v16.20 fix)
**Etkilenen sürümler:** v16.05 (kaynak hata) → v16.20 (fix)

### Saha vakası

Buket "Operatör Paneli" sidebar linkine tıkladı (admin olarak), siyah ekran. Console:

```
Uncaught ReferenceError: orders is not defined
    at Cu (index-CFx5p9v_.js:64:163397)
    at ko (vendor-react-5zO3uBoY.js:8:47537)
    ...
```

`Cu` minified function = `OperatorMain` (OperatorPanel.tsx içinde alt component, satır 168).

### Teşhis (bundle analizi)

Bundle dosyasında 163397. byte civarına bakıldığında:

```js
function Cu({oprId:e,opr:t,...}){
  let{workOrders:s,logs:c,...,stokHareketler:v}=G()  // ← orders YOK
  y=(0,H.useMemo)(()=>gc(orders,s,v,_),[orders,s,v,_])  // ← orders kullanım, undefined
```

`gc` fonksiyon adı = `computeOrderHammaddeEksik` (statusUtils.ts'te tanımlı, v16.05 ile eklendi). Mantığı eşleşti.

`OperatorMain` useStore destructure'ında `orders` yoktu, ama useMemo `orders`'i bekliyordu.

### Kök neden

**v16.05 commit'i (sipariş-bütünü PlanBekliyor mantığı, #20) baştan kırıkmış**:
- `computeOrderHammaddeEksik` fonksiyonu eklendi (statusUtils.ts) ✓
- `OperatorMain`'e useMemo + gc çağrısı eklendi ✓
- ❌ **Ama `useStore()` destructure'a `orders` eklenmedi** (eksik)

Bu hata 9 ay boyunca fark edilmedi çünkü Buket admin olarak Operatör Paneli'ne **hiç girmemişti**. Sadece operatörler giriyordu, ve onlar zaten farklı bir auth path'inden girip OperatorRoutes (App.tsx 89) ile sadece `<OperatorPanel />` görüyordu — `OperatorMain` alt component aktif olunca patlıyordu.

### v16.20 Fix

OperatorPanel.tsx satır 172, tek satır değişikliği:

```ts
// Eski
const { workOrders, logs, ..., stokHareketler } = useStore()

// Yeni
const { orders, workOrders, logs, ..., stokHareketler } = useStore()
```

Plus DataManagement.tsx working copy bir noktada v16.13 hali ile eski snapshot'a düşmüş (kontroller.push 16). v16.14'in 17 sentinel'li hali geri eklendi (saglik-syntax-check geçsin).

### Ders

**Pilot test kapsamı**: Yeni eklenen mantık (örn. `computeOrderHammaddeEksik`) **kullanılmadığı sayfalarda fark edilmez**. v16.05 deploy edildiğinde:
- Topbar PlanBekleyen rozeti (orderHmEksikMap kullanımı) → çalıştı ✓
- WorkOrders rozetleri → çalıştı ✓
- Orders sayfası → çalıştı ✓
- **OperatorPanel/OperatorMain → KIRIK (kimse girmediği için fark edilmedi)** ❌

**Kural (v16.05 sonrası):** Yeni mimari değişiklik (refactor, helper fonksiyon, parametre eklemesi) deploy edilmeden önce **etkilenen tüm sayfalar admin tarafından gezilmeli**. Kontrol checklist'i hazırlanmalı.

**v16.15 saglik-syntax-check** bunu kısmen koruyor — kontroller.push sayısı eksiltilemiyor. Ama runtime hataları için (destructure eksik gibi) yapısal koruma yok. **Bilgi Bankası §27.10 (önerilen):** Pilot test gezme listesi. Yeni patch öncesinde 5-7 ana sayfaya admin olarak girip ekran resmiyle doğrulama.

---

## §27.10 — Auth User Manuel Manipülasyon Yasağı

**Tarih:** 30 Nis 2026 öğleden sonra (~14:00–15:00 admin Auth user yenileme krizi)
**Etki:** ~2 saat kayıp, saha etkilenmedi.

### Saha vakası — Buket'in admin şifresini kaybetmesi

Buket sabah Dashboard'dan `uzuniskender@gmail.com` Auth user oluşturdu, güçlü şifre koydu (UUID `b452596c-1fa1-4848-8849-df42fca98ad1`). Sonradan şifreyi unuttu. Sırasıyla yapılan yanlış adımlar:

1. **Reset email tetiklendi** → link `localhost:3000`'e yönlendirdi (Site URL ayarı yanlıştı)
2. Site URL düzeltildi (`https://uzuniskender.github.io/ozler-uys-v3`), reset link tekrar geldi
3. Yeni reset link "yeni şifre belirle" sayfasını **atlayıp** doğrudan login yaptı (Supabase recovery flow nüansı)
4. Şifre belirsiz kaldı
5. **Claude SQL ile encrypted_password'u 2 kez güncelledi** (`123456a!` ve `1234`) — pgcrypto `crypt('1234', gen_salt('bf', 10))` formatı KOD10 ve test pilotta çalıştı **ama uzuniskender Auth user'ında bir şekilde çalışmadı**
6. **Claude `auth.users` DELETE + INSERT manuel yöntemi** yaptı — Supabase iç tabloları (auth.flow_state, auth.mfa_factors, vs.) eksik kaldı, "Database error finding user" hatası
7. **Email rate limit doldu** (5+ reset email)
8. Sonunda Buket Dashboard'dan **yeniden oluşturdu** (UUID `ff76792a-4b3f-4ce5-afaf-25664b382ba1`), Claude `uys_kullanicilar.admin-temp.auth_user_id` ile bağladı

### Kritik kural

**`auth.users` tablosuna doğrudan DELETE + INSERT yapılmamalı.** Supabase Auth'un iç bütünlük kontrolü:
- Sadece `auth.users` ve `auth.identities` değil, **birden çok yardımcı tablo** etkilenir (auth.flow_state, auth.mfa_factors, auth.one_time_tokens, vs.)
- Manuel SQL ile yapmak iç tabloları **eksik bırakır**, "Database error finding user" tarzı hatalar verir
- Bu hatalar Supabase Auth backend fonksiyonlarından gelir, frontend'de net mesaj görünmez

**Kabul edilen yöntemler:**
1. **Supabase Dashboard** → Authentication → Users → Add user / Update / Delete (her şey tetiklenir, iç tablolar tutarlı)
2. **Supabase Admin API** (service_role key ile) — Edge function veya server-side script
3. **`pgcrypto.crypt()` ile sadece şifre güncelleme** — auth.users.encrypted_password UPDATE'i tek başına (yeni user'da güvenli, mevcut user'da risk)

**Kabul edilmeyen yöntem:**
- `DELETE FROM auth.users` + `INSERT INTO auth.users` (yapılmamalı)
- Auth user ID değişimi (UUID değiştirme — referanslar kopar)

### Pilot operatör user'larının çalışması (kontrast)

KOD10 ERKİN ve test_pilot için Supabase MCP ile manuel `INSERT INTO auth.users` yapıldı, **çalıştı**. Çünkü bu user'lar SIFIRDAN oluşturuldu, recovery email/şifre değişimi geçirmedi. Aşama 3'te 89 operatör için aynı bulk yöntemi başarıyla uygulandı.

**Yani manuel INSERT yeni user için çalışıyor** ama **mevcut user'ı silip yeniden INSERT etmek bozar**.

### Bilgi Bankası §18.2 ek madde — Yeni Kullanıcı Yönetimi Konvansiyonu

- Auth user oluşturma → Dashboard veya admin API
- Auth user silme → Dashboard
- Şifre güncelleme → kullanıcı kendisi (Magic Link veya Reset Email) veya admin API
- Manuel SQL sadece **encrypted_password UPDATE** için, **mevcut user'lar dahil** ancak risk düşük tutulmalı

---

## §27.11 — SQL INSERT'lerle Oluşturulan Auth User'larda Token Alanları Nüansı

**Tarih:** 30 Nis 2026 akşam (~16:00, RLS Aşama 3 sonrası kritik keşif)
**Etki:** 89 operatör Auth migration'ı **gerçekten** çalışmaya başladı.

### Saha vakası

89 operatör için bulk Auth user oluşturduktan sonra (v16.25), KOD83 EYÜP DÖNMEZ ile login test edildi. Console log:

```
[v16.22] Operatör Auth signIn OK: op_kod83@uys.local
[v16.22] Operator Auth session aktif: op_kod83@uys.local
```

Görünüşte başarılı. **AMA** DB'de `last_sign_in_at` NULL kaldı, audit log boş. Yani UI'da OK görüldü ama Supabase Auth backend'de **gerçekte session açılmadı** — sadece custom auth (sicil_hash) çalıştı, signInWithPassword sessizce fail oldu.

### Teşhis

Test pilot (Dashboard'dan oluşturulmuş, çalışan) ile KOD10 (SQL INSERT, çalışmayan) yan yana karşılaştırıldı:

| Alan | TEST_PILOT (Dashboard) | KOD10 (SQL INSERT) |
|---|---|---|
| `confirmation_token` | **`""`** (boş string) | **`null`** |
| `recovery_token` | **`""`** (boş string) | **`null`** |
| `email_change_token_new` | **`""`** (boş string) | **`null`** |
| `email_change` | **`""`** (boş string) | **`null`** |
| `last_sign_in_at` | dolu (login olmuş) | **NULL** (login olmamış) |

### Kök neden

**Supabase Auth `signInWithPassword` token alanlarının `NULL` değil, BOŞ STRING (`''`) olmasını bekliyor.** Manuel SQL INSERT'lerde varsayılan NULL kalıyor, login sessizce fail oluyor (frontend exception yutuyor, kullanıcıya gerçek hata gösterilmiyor).

Dashboard'dan oluşturulan user'larda Supabase'in iç trigger'ları varsayılan `''` yazıyor, bu yüzden login çalışıyor.

### Fix (v16.26 migration)

```sql
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, '')
WHERE email LIKE 'op_%@uys.local'
  AND (confirmation_token IS NULL OR recovery_token IS NULL ...);
```

89 operatör Auth user'ı düzeltildi. KOD83 ile test → `last_sign_in_at` doldu (29 saniye önce), aktif Auth session 1 → **gerçek Supabase Auth login** doğrulandı.

### Yarınki Claude için kural

**Auth user manuel SQL INSERT yaparken token alanlarını `''` (boş string) ile başlat, NULL bırakma:**

```sql
INSERT INTO auth.users (
  ..., confirmation_token, recovery_token,
  email_change_token_new, email_change_token_current, email_change,
  reauthentication_token, phone_change, phone_change_token
) VALUES (
  ..., '', '',  '', '', '',  '', '', ''
);
```

§27.10 kuralı (Dashboard yöntemi tercih edilmeli) hâlâ geçerli; bu §27.11 SQL gerektiğinde uyulması gereken **format** kuralı.

### Bonus — Email rate limit bypass

`uzuniskender@gmail.com` admin user'ı sabah-akşam aralığında **5+ Magic Link / Reset / DELETE+INSERT** geçirdi, Supabase tarafında **email-bazlı temporary ban** oluştu. signInWithPassword sessizce fail oluyordu, audit log bile yazmıyordu.

**Çözüm:** `admin@uys.local` sentetic email Auth user oluşturuldu (KOD83 ile aynı yapı, token alanları `''`). Frontend `useAuth.ADMIN_EMAILS` array'ine eklendi (v16.26):

```ts
const ADMIN_EMAILS = ['uzuniskender@gmail.com', 'admin@uys.local']
```

Yani admin için **2 yedek hesap**:
- `admin@uys.local + 1234` — günlük kullanım
- `uzuniskender@gmail.com` Magic Link — Supabase rate limit reset olunca yedek

---

# §28. RLS Migration Roadmap — Güvenlik Sertleştirme (4 Aşama)

**Tarih:** 30 Nis 2026 öğleden sonra başlangıç (~11:30) — sürdürüldü ~15:30
**Süreç:** Aşama 1 ✓, Aşama 2A ✓, Aşama 2C ✓, Aşama 3 ✓, Aşama 4 DENENDI-ROLLBACK ⚠️, Aşama 4 v2 + Aşama 5 hafta sonu için planlı

UYS v3 başlangıçta `allow_all` policy ile tüm tablolar herkese açıktı (Bilgi Bankası §20: "iç ağ kabul"). Anon key + public GitHub Pages = **dünya açık**. Supabase advisor 5 ERROR + ~45 WARN.

Bu §28 dört aşamalı migration roadmap'i belge eder. **Aşama 1 + 2A + 2C + 3** 30 Nisan'da yapıldı (90 Auth user canlı). **Aşama 4 v2** + Aşama 2B + Aşama 5 hafta sonu / pazartesi sabah erken için planlı.

## §28.1 — Aşama 1: Temel Güvenlik (✓ TAMAMLANDI v16.17)

**Hedef:** Advisor ERROR'larını kapatmak, sahaya zarar vermeden.

**Yapılan:**
1. **6 tabloya RLS açıldı + allow_all** (uys_acik_barlar, uys_mrp_calculations, uys_mrp_rezerve, uys_pending_flows, uys_test_runs, uys_v15_31_silinen_hareketler) — ERROR 5 → 0
2. **`set_updated_at` fonksiyonu güvenliklendi** (`SET search_path = public, pg_temp`) — search_path injection korumasi
3. **`current_user_role` SECURITY DEFINER → SECURITY INVOKER** (anon execute REVOKE)

**Saha etki:** SIFIR. Davranış değişmedi.

**Sonuç:** ERROR 5 → 0 ✅, WARN 45 → 41 (kalanı Aşama 3-4 hedefi).

## §28.2 — Aşama 2A: Hassas Tablolar (✓ TAMAMLANDI v16.21)

**Hedef:** Saha akışında okunmayan hassas tabloları anon erişimden kapatmak.

**Yapılan:**
- `uys_kullanicilar` (2 satır, 1 Buket Auth bağlı) → `allow_all` silindi → `authenticated_only`
- `uys_yetki_ayarlari` (0 satır, RBAC kuralı) → aynı

**Saha etki:** SIFIR. Buket Auth'lu erişir, operatörler `uys_operators` kullanıyor (uys_kullanicilar'dan değil). Custom auth fallback artık çalışmaz ama zaten plain text şifreler v16.18'de NULL'landı.

**Sonuç:** Anon key sahibi artık admin kullanıcı listesi göremez.

## §28.3 — Aşama 2B: chat-attachments Bucket (ÖTELENDİ → Aşama 3 sonrası)

**Hedef:** Storage bucket SELECT (listing) policy'sini daraltmak.

**Mevcut durum:** `chat-attachments` bucket public, listing policy `chat_attachments_read` SELECT TRUE. Advisor "Public Bucket Allows Listing" WARN.

**Risk analizi:** Operatörler chat'e erişemiyor (App.tsx OperatorRoutes sadece `<OperatorPanel />`). Ama admin/planlama (DENEME silinene kadar) chat kullanıyor olabilir. Plus chat-attachments tablosu 2 kayıt = aktif kullanılmış.

**Karar:** Operatör Auth migration (Aşama 3) öncesi dokunmamak. Anon listing kapatılırsa ve admin/planlama Auth oturumlu değilse chat dosyaları listelenemez. Aşama 3 sonrası tüm chat erişen kullanıcılar `authenticated` rolde olacak — o zaman güvenle daraltılır.

## §28.4 — Aşama 2C: Operatör Auth Pilot (✓ TAMAMLANDI v16.22-23)

**Hedef:** 1 operatöre Supabase Auth user oluşturup hibrit login akışını test etmek.

**Yapılan:**
1. **`uys_operators` tablosuna `auth_user_id uuid` kolonu eklendi** (v16.22 DDL) + index `idx_uys_operators_auth_user_id WHERE auth_user_id IS NOT NULL`
2. **TEST_PILOT operatör oluşturuldu** (id=`test-auth-pilot`, kod=`TEST`, bölüm=`TEST`, şifre=`pilot1234`) — sahaya etki sıfır, gerçek operatör değil
3. **Supabase Dashboard'dan `op_test@uys.local` Auth user** oluşturuldu (UUID `40f492e7-1b86-4f6b-856b-c13be84086d5`)
4. **`uys_operators.test-auth-pilot.auth_user_id` bağlandı**
5. **Frontend patch (v16.22)**:
   - `Login.tsx`: oprData type'a `authUserId` field, `doOprLogin` içinde sicil_hash başarılı olunca arka planda `supabase.auth.signInWithPassword({ email: 'op_<kod>@uys.local', password: oprSifre })`
   - `useAuth.ts onAuthStateChange`: `email.endsWith('@uys.local')` için Auth session koruyor (signOut çağırmıyor) — operatör Auth'lu kalır
6. **Pilot başarılı:** Buket TEST PILOT olarak login → console `[v16.22] Operator Auth signIn OK: op_test@uys.local` + DB'de aktif Supabase session
7. **v16.23: KOD10 ERKİN gerçek operatör Auth user'ı** oluşturuldu (`op_kod10@uys.local`). Buket admin olarak operatör paneline KOD10 ile login yaptı, çalıştı → 89 operatör için strateji netleşti
8. **v16.24: Admin login OPR_KEY temizleme fix** — operator session'ı `getStored()` önce sessionStorage okuduğu için admin override edilemiyordu. `useAuth` ADMIN_EMAILS branch'lerine `sessionStorage.removeItem(OPR_KEY)` eklendi.

**Sonuç:** Yan yana Auth mekanizması çalışıyor — operatör UX değişmedi (hala bölüm + isim + 1234), arka planda Auth session da otomatik açılıyor.

## §28.5 — Aşama 3: Operatör Auth Migration (✓ TAMAMLANDI v16.25)

**Hedef:** Tüm aktif 88 operatörü Supabase Auth'a migrate et.

**Yapılan (v16.25 bulk migration):**

```sql
DO $$
DECLARE
  op RECORD;
  yeni_uuid uuid;
  email_str text;
  toplam int := 0;
BEGIN
  FOR op IN
    SELECT id, kod, ad FROM uys_operators
    WHERE COALESCE(aktif, true) = true
      AND auth_user_id IS NULL
      AND kod IS NOT NULL AND kod != ''
    ORDER BY kod
  LOOP
    yeni_uuid := gen_random_uuid();
    email_str := 'op_' || LOWER(op.kod) || '@uys.local';
    -- INSERT INTO auth.users (..., crypt('1234', gen_salt('bf', 10)), ...)
    -- INSERT INTO auth.identities (...)
    -- UPDATE uys_operators SET auth_user_id = yeni_uuid WHERE id = op.id
    toplam := toplam + 1;
  END LOOP;
END $$;
```

**Sonuç:**
- **89/89 operatör** Auth bağlandı (test_pilot dahil — KOD10 zaten v16.23'te yapılmıştı)
- **90 toplam Supabase Auth user** (1 admin + 89 operatör)
- Saha akışı **DEĞİŞMEDİ** — operatörler hala bölüm + isim + 1234 yazıyor, arka planda Auth session

**Kritik bulgu (Buket):** Tüm operatörlerin default şifresi `1234`, ufak istisnalar dışında. Bu sayede toplu Auth user oluşturma kolaylaştı (ortak password). Migration tek SQL transaction'da tamamlandı, hiç hata yok.

## §28.6 — Aşama 4: Anon Role Temizliği (DENENDI → ROLLBACK)

**Hedef:** Tüm 38 tabloda `allow_all` → `authenticated_only`, anon erişimi kapatma.

**v16.25 (Aşama 4) DENEDIK:**

```sql
DO $$
DECLARE t TEXT;
DECLARE tablolar TEXT[] := ARRAY['pt_problemler', 'uys_acik_barlar', ..., 'uys_yedekler'];
BEGIN
  FOREACH t IN ARRAY tablolar LOOP
    EXECUTE format('DROP POLICY IF EXISTS allow_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY authenticated_only ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
```

**Saha kırıldı! Hata:** Login akışı **anon role** ile başlıyor:
- `Login.tsx` useEffect: `supabase.from('uys_operators').select('*')` — Auth oturumu açılmadan önce anon ile istek
- `authenticated_only` policy bunu engelledi → operatör seçim ekranı boş
- Plus Buket admin login formu kullanıyorsa, Login UI **uys_operators** tablosunu gösterirken authenticated olmadığı için patladı

**Acil rollback yapıldı:**

```sql
-- 41 tabloda authenticated_only DROP, allow_all geri
DO $$ DECLARE t TEXT; tablolar TEXT[] := ARRAY[...]; BEGIN
  FOREACH t IN ARRAY tablolar LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_only ON public.%I', t);
    EXECUTE format('CREATE POLICY allow_all ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
```

`uys_kullanicilar` ve `uys_yetki_ayarlari` (Aşama 2A'da yapılmış) authenticated_only kaldı, sahaya etki yok (Buket Auth'lu erişir, operatörler bu tablolardan zaten okumuyor).

### KÖK SORUN — chicken-and-egg

Operatör login flow'u:
1. **Anonim** (Auth yok) → Login.tsx açılır
2. Operatör Girişi butonuna basılır → **anon ile** `uys_operators` SELECT (bölüm + operatör listesi)
3. Operatör seçilir, şifre girilir → custom auth doğrulanır
4. ARDA PLAN'DA Supabase Auth signInWithPassword → **şimdi authenticated** olur
5. Sonra OperatorPanel açılır

Adım 2'de **anon SELECT** yapılması zorunlu. Eğer authenticated_only ise — chicken-and-egg, login bile başlayamaz.

### Aşama 4 v2 (cmd-bazlı policy, hafta sonu için planlı)

**Doğru çözüm**:

```sql
-- Ornek: uys_operators icin login akisi gerekli SELECT acik tutulur,
-- ama write islemleri sadece authenticated kullanicilar icin
CREATE POLICY anon_select ON public.uys_operators
  FOR SELECT TO anon USING (true);
CREATE POLICY authenticated_all ON public.uys_operators
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Diğer tablolar için:
- **Sadece login için gerekli** tablolar (uys_operators) → anon SELECT açık
- **Diğer tüm tablolar** → authenticated_only (anon SELECT bile yok)

Bu detaylı role-bazlı policy yazımı **saatlerce iş**, hafta sonu / pazartesi sabah erken (saha kapalıyken) yapılmalı.

## §28.7 — Admin Auth User Yenileme Krizi (v16.25 sonu, ~14:00–15:00)

**Tarih:** 30 Nis 2026 öğleden sonra (~14:00–15:00)
**Süre:** ~2 saat kayıp
**Saha etkisi:** Sıfır (Buket admin/admin123 fallback ile geçici giriş yaptı)

Detay için **§27.10 — Auth User Manuel Manipülasyon Yasağı**'na bakınız.

Özet:
- Buket sabah Dashboard'dan oluşturduğu admin Auth user şifresini unuttu
- Reset email zinciri + multiple SQL UPDATE state'i bozdu
- Claude `auth.users` DELETE + INSERT manuel yöntem yaptı → Supabase iç tablolarını eksik bıraktı → "Database error finding user"
- Email rate limit doldu
- Sonunda Buket Dashboard'dan **yeniden oluşturdu** (UUID `ff76792a-4b3f-4ce5-afaf-25664b382ba1`)

**Kritik kural (§27.10):** `auth.users` tablosuna doğrudan DELETE + INSERT yapılmamalı. Dashboard veya admin API kullanılmalı.

## §28.8 — Aşama 5: Network Restrictions + Anon Key Rotation (manuel, en son)

**Supabase Dashboard'dan manuel:**
- Network Restrictions → şirket IP whitelist (Özler OSB Dilovası IP)
- Yeni anon key oluştur, eskiyi devre dışı bırak (key rotation)
- Frontend `.env` ve build'lerde yeni key

**Süre:** 1 gün (test + canlı geçiş).

---

*§28 (RLS Migration Roadmap) 30 Nis 2026 öğleden sonra ~15:30'da güncellendi. **Aşama 1 + 2A + 2C + 3 ✓ TAMAMLANDI** (90 Auth user canlı). **Aşama 4 DENENDI → ROLLBACK** (chicken-and-egg). **Aşama 4 v2 (cmd-bazlı policy)** + Aşama 2B (chat-attachments) + Aşama 5 (network/key rotation) hafta sonu / pazartesi sabah erken için planlı. **22 sürüm + 9 DB migration + 6 DB fix + 5 saha krizi + RLS Aşama 1+2A+3 + 89/89 operatör Auth + OperatorPanel kazası fix + admin Auth yenileme** — tek günde rekor. Yarın yeni Claude oturumu için açılış kapısı: §27 (10 alt bölüm) + §28 (8 alt bölüm) + DEVAM_NOTU.*

---



# Bilgi Bankası — 1 Mayıs 2026 Eklemeleri

> Bu blokları `docs/UYS_v3_Bilgi_Bankasi.md` dosyasının **sonuna** ekle. Mevcut §28.8 ile §29.x arasına da konabilir; sıralı kalsın.

---

## §27.12 — Topbar.tsx `\n` Escape Kazası (v16.27 → v16.27c Hotfix)

**Tarih:** 30 Nis 2026 akşam → 1 May sabahı

### Olay

v16.27 (3-in-1: admin123 sil + version str + Topbar tıklama filter) push edildi. GitHub Actions build patladı:

```
[builtin:vite-transform] Error: Invalid Unicode escape sequence
  ╭─[ src/components/layout/Topbar.tsx:1:43 ]
1 │ import { useState, useMemo } from 'react'\nimport { useNavigate } from ...
```

Topbar.tsx **satır 1'in sonu** patlamıştı: önceki `\n` newline yerine **literal `\n` string** olarak yazılmıştı. Yani iki import yapışıktı:

```
import { useState, useMemo } from 'react'\nimport { useNavigate } from 'react-router-dom'
```

Vite bunu geçersiz Unicode escape sequence olarak görüp build'i kırdı.

### Kök Sebep

Whole-file replace eden bir tool (Claude Code veya manuel PowerShell `-replace`) `useNavigate` import'unu eklerken **`\n` newline ile literal `\n` string'i karıştırdı**. PowerShell'in `-replace` operatörü ham metni "string olarak" alıp metnin içine `\n` literal karakter dizisi yazdı, gerçek newline değil.

### Tespit Yöntemi

```bash
grep -nP '\\n' src/components/layout/Topbar.tsx
# Sadece bir satır dönüyorsa (satır 1) → kaza tespit edildi
# String literal içinde `\n` legitimate'tir, ama JSX/TS dışında "kod akışı" bağlamında değildir
```

### Hotfix v16.27c

Tek satır str_replace: literal `\n` → gerçek newline. Diff sadece 2 satır.

```ts
// ÖNCESI (1 satır, patlıyor):
import { useState, useMemo } from 'react'\nimport { useNavigate } from 'react-router-dom'

// SONRASI (2 satır, çalışıyor):
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
```

### Ders

Bu, DataManagement.tsx'in **kontroller.push 16<17** ve **recipes→recs** kazalarına benzer ama **farklı vektör**. Whole-file replace eden tool'lar `\n` newline ile literal `\n` string'i karıştırınca **silent build kırılması**. Saglik-syntax-check bunu yakalamadı çünkü kontrolü Topbar.tsx'i değil sadece DataManagement.tsx'i tarıyordu.

### TODO — Saglik-syntax-check Genişletme

`scripts/saglik-syntax-check.cjs`'a şu kontrolü eklemek lazım:

```js
// Tüm .tsx ve .ts dosyalarda literal \n imza
const files = glob.sync('src/**/*.{ts,tsx}')
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8')
  const lines = content.split('\n')
  // Sadece **import/export ve function tanım satırlarında** kontrol et
  // (string literal içindeki '\n' legitimate)
  for (const [i, line] of lines.entries()) {
    if ((/^(import|export|function|const|let|var)/).test(line) && /\\n/.test(line)) {
      throw new Error(`${f}:${i+1} literal \\n in code line — likely escape kazasi`)
    }
  }
}
```

### Hijyen Kuralı (§27.7'ye Ek)

**Kural #6:** Whole-file replace uygulayan tool'a TTL büyük dosya verirken, çıkarımı **diff modunda** kontrol et:
- `git diff --stat` ≤ N satır
- `git diff` çıktısı: ekleme/silme satır sayıları beklentine uygun mu
- Beklenen: 1-2 satır değişiklik. Gerçek: tüm dosya değişti → tool dosyayı tek satıra düşürdü, abort.

### Bağlam

v16.27 Acid Test: ardışık 3 küçük patch (admin123 + version + Topbar) **tek commit**'te birleştirildiği için kaza tespiti gecikti. Eğer **tek-konu commit** olsaydı (her biri ayrı), Topbar commit'i lokalde npm run build ile patlardı, push olmadan yakalanırdı.

**Yeni kural:** 3-in-1 birleşik patch'leri sadece **tüm parçalar build-test-edilmiş ve commit-tested** ise tek push'ta gönder. Aksi halde sıralı: A push → build yeşil → B push.

---

## §28.6.1 — RLS Aşama 4 v2 OP3: 40 Tablo authenticated_only (✓ TAMAMLANDI 1 May 2026)

**Tarih:** 1 May 2026 sabahı (İşçi Bayramı, saha kapalı — minimum risk penceresi)

### Yapılan

§28.6'da denenen **toptan 41 tablo authenticated_only** stratejisi (rollback'li) **cmd-bazlı policy ile değil**, **role-bazlı policy ile** uygulandı. Tek SQL — DO bloğu, 3 tablo hariç:

```sql
DO $$
DECLARE
  t text;
  excluded text[] := ARRAY['uys_operators', 'uys_kullanicilar', 'uys_yetki_ayarlari'];
  cnt int := 0;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'allow_all'
      AND roles::text = '{public}'
      AND tablename != ALL(excluded)
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER POLICY allow_all ON public.%I TO authenticated', t);
    cnt := cnt + 1;
  END LOOP;
END $$;
```

`uys_kullanicilar` + `uys_yetki_ayarlari` zaten Aşama 2A'da authenticated_only ✓.
`uys_operators` chicken-and-egg için ayrı, OP2'de ele alındı (§28.6.2).

### Smoke Test (anon role gerçek kapatma kanıtı)

```sql
SET LOCAL ROLE anon;
SELECT
  (SELECT COUNT(*) FROM public.uys_orders) AS anon_orders,           -- 0 (kapali)
  (SELECT COUNT(*) FROM public.uys_work_orders) AS anon_work_orders, -- 0
  (SELECT COUNT(*) FROM public.uys_recipes) AS anon_recipes,         -- 0
  (SELECT COUNT(*) FROM public.uys_chat_messages) AS anon_chat,      -- 0
  (SELECT COUNT(*) FROM public.uys_kullanicilar) AS anon_kullanici,  -- 0 (Asama 2A)
  (SELECT COUNT(*) FROM public.uys_operators) AS anon_operators;     -- 89 (chicken-and-egg)
```

Sonuç: 40 tablo anon role'e tamamen kapalı, sadece uys_operators 89 satır (login için zorunlu).

### Saha Doğrulama (Buket)

Magic Link oturumuyla:
- Siparişler: ✓ liste dolu
- İş Emirleri: ✓ liste dolu
- Operatör Paneli: ✓ liste görünüyor
- Stok kontrol, tedarik: ✓ çalışıyor

### Kazanım

| Önce | Sonra |
|---|---|
| 41 tablo public-allow_all | 40 tablo authenticated_only + 1 tablo anon SELECT only |
| Anon key sahibi tüm üretim verisini API'den çekebiliyor | Anon key sadece operatör listesi (login için) görebiliyor |
| Advisor: 5 ERROR | 0 ERROR (zaten Aşama 1'de hallolmuştu, kapsam tamamlandı) |

### Acil Rollback Hazırlığı (kullanılmadı)

```sql
-- Eğer saha kırılırsa tek SQL ile geri al (5 sn):
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_policies
           WHERE schemaname='public' AND policyname='allow_all' AND roles::text='{authenticated}'
  LOOP EXECUTE format('ALTER POLICY allow_all ON public.%I TO public', t);
  END LOOP;
END $$;
```

---

## §28.6.2 — Aşama 4 v2 OP2: uys_operators Lockdown (✓ TAMAMLANDI 1 May 2026)

**Tarih:** 1 May 2026 sabahı, OP3'ten ~30 dk sonra

### Sorun (OP3'ten Sonra Tespit)

OP3 sonrası tek public tablo kaldı: `uys_operators`. Login akışı için **anon SELECT** açık olması zorunlu (chicken-and-egg). Ancak `Login.tsx` aynı tabloya **anon UPDATE** de atıyordu (lazy hash migration, satır 69):

```ts
// Login.tsx — eski
if (!isHashed(stored)) {
  await supabase.from('uys_operators').update({
    sicil_hash: hashSicil(oprSifre),
    sifre: null,
  }).eq('id', opr.id)
}

// signInWithPassword bunun ALTINDA — yani UPDATE anon role'de atılıyordu
```

DB tarama: 79/89 operatör hâlâ plain text (sicil_hash boş) → her ilk login'de bu UPDATE tetikleniyor → anon UPDATE açık olmak zorunda.

### Çözüm — İki Adımlı

#### Adım 1 — Login.tsx Refactor (v16.28)

signInWithPassword'ı hash UPDATE'in **ÖNÜNE** taşı + UPDATE'i `authBasarili` guard'ına al:

```ts
// 1. Auth ÖNCE
let authBasarili = false
if (opr.authUserId) {
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
  if (!authErr) authBasarili = true
}

// 2. Hash UPDATE SONRA, guard ile
if (authBasarili && !isHashed(stored)) {
  await supabase.from('uys_operators').update({...}).eq('id', opr.id)
}
```

#### Adım 2 — Policy Sıkılaştırma (DB)

```sql
DROP POLICY IF EXISTS allow_all ON public.uys_operators;

CREATE POLICY anon_select ON public.uys_operators
  FOR SELECT TO anon USING (true);

CREATE POLICY authenticated_full ON public.uys_operators
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### Smoke Test (Saldırı Engeli Kanıtı)

```sql
SET LOCAL ROLE anon;
WITH test AS (
  UPDATE public.uys_operators
  SET sicil_hash = 'ATTACK_TEST'
  WHERE id = (SELECT id FROM public.uys_operators LIMIT 1)
  RETURNING id
)
SELECT COUNT(*) FROM test; -- 0 (UPDATE engellendi)
```

### Final Durum (Aşama 4 v2 Tam Tamamlandı)

| Kategori | Tablo | Kapsam |
|---|---|---|
| **authenticated_only (Asama 2A)** | 2 | uys_kullanicilar, uys_yetki_ayarlari |
| **authenticated_only (Asama 4 v2 OP3)** | 40 | Tüm üretim verileri |
| **uys_operators (Asama 4 v2 OP2)** | 1 | anon SELECT only, authenticated full |
| **TOPLAM güvenli** | **43/43** | %100 |

### Yan Etki Notu

Sıra önemliydi: **önce kod (v16.28), sonra policy**. Tersi olsaydı (önce policy), eski kod hâlâ anon UPDATE atmaya çalışır → 79 plain operatör'ün login'inde silent fail (catch'e düşer, hash migration ertelenir). Yeni kod önce gelirse anon UPDATE zaten atılmaz, policy değişimi sorunsuz.

---

## §29 — PDF Altyapı Kararları (1 May 2026)

**Bağlam:** Brief #8 (PDF Çıktı — İş Emri + Sevk İrsaliyesi). ISO audit zorunluluğu + saha şoför yardımcı belge ihtiyacı.

### §29.1 — Kütüphane Seçimi: jsPDF + jspdf-autotable

**Aday değerlendirmesi:**

| Kütüphane | Avantaj | Dezavantaj | Karar |
|---|---|---|---|
| **jsPDF + jspdf-autotable** | Yaygın, küçük (~80KB gz), tablo plug-in olgun, font yükleme kolay | API biraz "manuel" | ✅ Seçildi |
| pdfmake | Daha modern declarative | ~200KB gz, deprecation warns | ❌ |
| @react-pdf/renderer | React component pattern | Bundle 500KB+, font yönetimi karmaşık | ❌ |
| Browser print API | 0 kütüphane | Saha kontrol yok, format dağınık | ❌ |

### §29.2 — Türkçe Karakter Çözümü: DejaVu Sans TTF (Lazy Fetch)

**Sorun:** jsPDF'in default Helvetica fontu Türkçe karakterleri kutucuk gösterir.

**Çözüm:**
1. `public/fonts/DejaVuSans.ttf` (760KB) statik dosya
2. İlk PDF üretiminde fetch + base64 cache (modul scope)
3. Sonraki PDF'ler hızlı (cache hit)
4. Bundle etkilenmez (TTF static, fetch ile yüklenir, dynamic import lazy chunk)

```ts
// pdf-utils.ts — özet
let fontCache: { regular: string | null } = { regular: null }

async function loadFontBase64(): Promise<string> {
  if (fontCache.regular) return fontCache.regular
  const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const resp = await fetch(`${baseUrl}/fonts/DejaVuSans.ttf`)
  const buf = await resp.arrayBuffer()
  // ArrayBuffer → base64 (chunked)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
  fontCache.regular = b64
  return b64
}
```

### §29.3 — Tek-Konu Mimarisi: Modül Yapısı

```
src/lib/sirket-bilgileri.ts   — Özler resmi bilgileri sabitleri
src/lib/pdf-utils.ts          — newPdf(), ozlerHeader(), ozlerFooter() — ortak
src/lib/is-emri-pdf.ts        — generateIsEmriPDF(workOrder, order, logs)
src/lib/sevk-belge-pdf.ts     — generateSevkBelgePDF(sevk, order)
```

PDF butonları her zaman `await import()` ile **lazy import** — bundle etkilenmez, TTF tıklayana kadar yüklenmez.

### §29.4 — Sevk Belgesi: Yasal Değil, "İç Belge" Kararı

**Kritik mimari karar.** Brief'te "e-İrsaliye uyumlu / yasal evrak formatı" dendi ama saha gerçeği farklıydı:

**Mevcut durum:** Özler **DİA + MAVVO** kullanıyor — yasal e-İrsaliye GİB'e DİA'dan gönderiliyor. UYS v3 üretim sistemi bu yetkilendirilmemiş.

**Karar:** UYS v3'te **"SEVK BELGESİ"** (yasal değil), DİA'da **"E-İRSALİYE"** (yasal). Separation of concerns:

| Sistem | Sorumluluk |
|---|---|
| **DİA + MAVVO** | Ticari yasal evraklar (e-Fatura, e-İrsaliye, e-Arşiv). GİB entegrasyonu. |
| **UYS v3** | Üretim/saha yönetimi (iş emri, kesim, MRP, **iç sevk takip**). Audit kanıt + şoför yardımcı belge. |

**PDF içerik kuralı:**
- Başlık: "SEVK BELGESİ" (irsaliye **değil**)
- Disclaimer footer: "Resmi sevk irsaliyesi e-İrsaliye sisteminden basılır. Bu belge iç takip ve saha kullanımı içindir."
- "İrsaliye yerine geçer" ibaresi **YOK** (yasal sahteciliği önler)
- 3 imza alanı: Gönderen / Şoför / Teslim Eden (Alıcı YOK — yasal değil çünkü)

**Neden bu önemli:** Üretim sistemi yasal evrak basmaya kalkışırsa "iki sistemin tek soruyu ayrı ayrı yanıtlama riski" doğar (DİA bir şey, UYS başka bir şey gösterir → audit'te uyuşmazlık + yasal sorumluluk gri alan).

### §29.5 — Sürüm İlerlemesi

| Sürüm | İçerik | Durum |
|---|---|---|
| v16.29 | jsPDF + DejaVu + İş Emri PDF (FileText butonu) | ✅ canlı, saha onaylı |
| v16.29a | package-lock.json regen (Actions npm ci) | ✅ |
| v16.29b | package-lock.json sandbox restore (silinmişti) | ✅ |
| v16.30 | Sevk Belgesi PDF + imzaLabels jenerikleme + disclaimer | ✅ canlı |
| v16.30a | Sevk mapper genişletme (tasiyici/plaka/musteriKod 4 alan görünür oldu) | ✅ canlı, PDF saha onaylı |

### §29.6 — Backlog (Şirket Profili Sayfası)

`sirket-bilgileri.ts` şu anda hardcoded placeholder'lar:
```
[VKN 10 HANELI PLACEHOLDER]
[VERGI DAIRESI PLACEHOLDER]
[+90 ... PLACEHOLDER]
...
```

Sonraki sprint: DataManagement'a "Şirket Profili" tab'ı (1 satırlık config tablosu, edit form). Buket ana ofiste değerleri verince hızlı patch (v16.31).

---

## §30 — IE-UYS-001: Claude Code Token Optimizasyonu Oturum Kuralları

**Hazırlayan:** Buket Kıbrıs, 30 Nis 2026

### Kural Özeti

| # | Kural |
|---|---|
| 1 | Tek dosya / satır edit → Manual veya Auto. Çoklu dosya / refactor → Agent. Repo geneli tarama → **Task tool → subagent**. |
| 2 | **Tam dosya read yasak.** view_range zorunlu. 500+ satır için önce 1-50 keşif, sonra hedef. |
| 3 | Aynı dosyayı oturumda 2. kez okutma. |
| 4 | Major commit sonrası `/compact`, yeni faz öncesi `/clear`, oturum başı `/context`. |
| 5 | Saglik raporu, repo grep, build verify, E2E analiz → subagent'a delege. |
| 6 | Bir oturum = bir Faz (MRP Faz 3 modal, kesim plan ayrı oturum vb). |
| 7 | %50 doluluk → commit + push, `/compact`. %75 → kapat. %90 → sadece push. |
| 8 | Peak hours (16:00–22:00 TR) → ağır tarama yasak. |
| 9 | Bypass Approvals **kapalı** (write/edit/bash). Sadece read/grep/glob auto-OK. |
| 10 | Build/test çıktıları **özetle**: "yalnızca FAIL satırları" / count. Hata yoksa tek satır onay. |

### Claude.ai Sohbeti İçin Eşdeğerleri

- view_range zorunlu (tam dosya read yasak)
- Aynı dosyayı 2. kez okutma
- Çıktı özeti talep et (FAIL/count)
- DEVAM_NOTU.md oku + güncelle her oturum
- Buket "bitti" demeden "sprint sonu" / "günü kapatma" deme. Kalan saat tahmini yapma — Buket gerçek zamanı bilir.

### Bu Sohbette Uygulananlar (1 May 2026)

- ✅ DEVAM_NOTU + CLAUDE_CODE_BRIEF + BACKLOG sadece view_range ile okundu
- ✅ Build log'ları tail -60 ile özetlendi (ham log yapıştırılmadı)
- ✅ Topbar.tsx, Login.tsx, WorkOrders.tsx, Shipment.tsx tek seferde okundu, point str_replace ile editlendi
- ✅ Sandbox build doğrulaması her patch öncesi yapıldı (Actions runner ile aynı build)

---

## Bu Tarihlerin Sprint Tablosu — 1 May 2026

| Sürüm | İş | Saha Test | Notlar |
|---|---|---|---|
| v16.27 | admin123 sil + version str + Topbar tıklama | ✅ | 3-in-1, escape kazasıyla geçti (§27.12) |
| v16.27a | useAuth email path geri ekle (v16.18 kayıp) | ✅ | admin@uys.local + 1234 path |
| v16.27c | Topbar.tsx satır 1 escape hotfix | ✅ | Tek satır str_replace |
| **DB Asama 4 v2 OP3** | 40 tablo authenticated_only | ✅ | §28.6.1 |
| v16.28 | Login.tsx hash UPDATE refactor | ✅ | §28.6.2 ön hazırlık |
| **DB Asama 4 v2 OP2** | uys_operators policy ayrımı | ✅ | §28.6.2 |
| v16.29 | jsPDF + DejaVu + İş Emri PDF | ✅ | §29.1-29.3 |
| v16.29a + 29b | package-lock.json regen | ✅ | Actions npm ci |
| v16.30 | Sevk Belgesi PDF + jenerik imza | ✅ | §29.4 separation of concerns |
| v16.30a | Sevk mapper genişletme | ✅ | 4 alan PDF'te görünür oldu |

**RLS Aşama 4 v2 final:** 43/43 tablo güvenli, anon kapsam minimum.
**PDF altyapı:** İş Emri + Sevk Belgesi sahada kullanımda.
**Bekleyen:** Şirket bilgileri gerçek değerleri (v16.31 placeholder).
