# UYS v3 — Master Backlog (İş Emri Listesi)

**Son güncelleme:** 30 Nisan 2026 sabah (v16.02 hotfix serisi · 4 yeni istek eklendi)
**Kaynak oturum:** "Günaydın" chat — eski monolit UYS (`ozleruretim` repo) ile karşılaştırma

📖 **YENİ:** `docs/saha_model_28nis2026.md` — 13 senaryo, Madde 15 onay sistemi mimarisi (TAM TUR ✅ 29 Nis)

---

## 📊 Genel İlerleme — 7/10 büyük öneri tamam · 1/10 kısmi · 2/10 backlog · +1 yeni

```
✅ TAMAM    ███████░░░  7/10  (#1 Operatör · #2 Yedek · #3 MRP · #4 Kesim · #6 autoZincir · #10 Üst Bar · #11 Problem Takip kısmi)
🟢 KISMİ    █░░░░░░░░░  1/10  (#11 Problem Takip — UI v15.x'te mevcut)
🟡 BACKLOG  ░░░░░░░░██  2/10  (#5 Sevk · #7 Excel · #8 PDF · #9 Stok)
➕ YENİ     ░░░░░░░░░░  +1    (#12 Güvenlik Refactoru — Faz 1.1a yapıldı, kalanı 1-2 hafta)
```

> **Not:** v15.46'da master backlog repoya taşındı. **27 Nisan gecesi 17 commit ile 3 İş Emri tek günde kapandı: #1 Operatör (v15.52a.1) + #2 Yedekleme (v15.53) + #3 Üretim Zinciri Faz 4 (v15.51).** Yedekleme dahil tüm production-blocker'lardan #5 Sevkiyat Formu kaldı.

---

## 📅 Son Sürümler (25 Nisan – 30 Nisan 2026)

Bu master backlog'a doğrudan etki eden sürümler:

| Sürüm | Etki |
|---|---|
| **v15.46** | Master backlog repoya taşındı (bu dosya yaratıldı) |
| **v15.47** | İş Emri #3 Faz 1+5 → DB veri modeli + Topbar göstergeleri |
| **v15.47.1-3** | 3 hotfix: §18.2 + §18.3 + statusUtils yayılım |
| **v15.48a** | Vitest + cuttingArtik — birim test altyapısı |
| **v15.48b1** | Otomatik Plan önizleme modal'ı |
| **v15.48** | Faz 2 KAPANIŞ + §18.4 (artık yönetimi konvansiyonu) |
| **v15.49a** | Topbar Filtre Aktif (MRP badge → otomatik filtre) |
| **v15.49b** | Master backlog ilerleme paneli (sadece doc) |
| **v15.50a (× ~7 hotfix)** | MRP termin gruplama → §19 sözleşmesi netleşti |
| **v15.50b** | İş Emri #3 Faz 3 KAPANIŞ → MRP Modal snapshot + RBAC + isOrderArchived |
| **v15.51** | İş Emri #3 Faz 4 KAPANIŞ → autoZincir Faz 3 standardına hizalama |
| **v15.52a** | İş Emri #1 KAPANIŞ → Operatör güvenlik (sicil hash + RBAC operator actions) |
| **v15.52a.1** | Hotfix: SQL `public.` prefix (audit-columns regex uyumu, yeni §18.5 kuralı) |
| **v15.52b** | Topbar Kesim kolonu Orders.tsx'e eklendi (statusUtils helper'ları) |
| **v16.0.0 Faz 1.1a** | İş Emri #12 başlangıç (DB altyapı: auth_user_id + current_user_role helper) — saha etki sıfır |
| **v15.53 Adım 1-5** | **İş Emri #2 KAPANIŞ → Yedekleme tam pakedi** (tablo + servis + UI + restore + otomatik) |
| **v15.77** | Test Senaryo 7/8/9 (sipariş delta, fire telafi recursive, loglar DB) — v15.74/75/76 test ispatı (8/8 PASS) |
| **v15.78** | Manuel İE MRP görünürlüğü saha fix (IE-MANUAL-MO9SDW3A 6740 adet bug'ı) + Senaryo 10 reproducible test |
| **v15.79** | Plan Bekliyor/Üretilebilir efektif durum (#13 madde 8+9) — UI türetimi, Topbar [PLAN BEKLEYEN N] rozeti, Senaryo 11 |
| **v15.80** | Sağlık raporu Kontrol 5/6/7 §21 sözleşmesine uygun revize (rezerve mantığı kalktı) |
| **v15.80a** | plans/orders/recs değişken adı hotfix |
| **v15.80b** | Sağlık raporu Kontrol 11 legacy IE-MANUAL filtresi |
| **v15.81** | **MRP temel hesabı saha bug fix** — `uretilen=0` hardcode'u (v2 port'tan beri 13+ sürüm) düzeltildi. logs parametresi eklendi, tamamlandi filtresi, Senaryo 12 saha bug fix kanıtı |
| **v15.82-v15.96 (29 Nis)** | **15 sürüm tek günde rekor + Madde 15 tam tur** — Detay: §26 Bilgi Bankası |
| | • v15.82: Saha model uyum (AZALIS BLOCK + manuel İE termin) |
| | • v15.83-84: Senaryo 1 modal Faz 1 + otomatik test (Senaryo 13) |
| | • v15.85: Test cleanup bug fix (3 katmanlı) |
| | • v15.86-87: IE--01 boş prefix + buildWorkOrders idempotency |
| | • v15.88: MRP "0 aktif" UX bug |
| | • v15.89: Sağlık raporu 3 yeni kontrol (#12, #13, #14) |
| | • **v15.90: Madde 15 P1** (veri modeli) |
| | • v15.91: Sipariş no UNIQUE + UI duplicate koruması |
| | • **v15.92: Madde 15 P2** (mamul rezerv UI + 2-aşama çıkış) |
| | • v15.93-94: Audit schema + senkronizasyon |
| | • **v15.95: Madde 15 P3** (hammadde FIFO tahsis + MRP rozetleri) |
| | • **v15.96: Madde 15 P4** (bildirim merkezi — Topbar Bell) |
| **v15.97-99 (29 Nis akşam)** | Doc kalıcı kayıt + bulk import çoklu kalem + Sağlık #15 reçete iç tutarlılık sentinel |
| **v16.00 (30 Nis sabah)** | **Sağlık raporu hotfix** — `DataManagement.tsx` #15 sentinel'inde `recipes` referansı yerel scope'taki `recs` değişkenine uydurulmamıştı (ReferenceError → tüm rapor patladı). 2 satır tipo. JSON çıktısı: 13 PASS · 2 WARN · 0 FAIL (gerçek tedarik WARN'ları, kod sorunu değil). |
| **v16.01 (30 Nis sabah)** | MRP filtre `dbEksik` band-aid — `mrp_durum='eksik'` DB görünür hale getirildi. |
| **v16.02 (30 Nis sabah)** | `mrp.ts` LEVHA cutting override skip kök fix — yüzey kesim 1D mantığı kapatıldı. |

---

## 📚 4 Kalıcı Operasyonel Kural — Bilgi Bankası §18 Ailesi

Bu kurallar tüm gelecek patch'lerde işleyecek. Yeni bir iş başlamadan önce kontrol edilir:

| Bölüm | Kural | Sürüm |
|---|---|---|
| **§18** | İndirilenler Hijyen Kuralı (Downloads temiz) | v15.45 |
| **§18.2** | Yeni Tablo Konvansiyonu (audit FAIL önler) | v15.47.1 |
| **§18.3** | Durum String Konvansiyonu (statusUtils ile normalize) | v15.47.2 |
| **§18.4** | Artık Yönetimi Konvansiyonu (havuz sistemi tek standart) | v15.48 |
| **§18.5** | SQL Migration `public.` Prefix (audit-columns regex uyumu) | v15.52a.1 |

---

## 📋 Kullanım

Bu dosya **iki kapsamı** birden tutar:

1. **Orijinal 21 maddelik backlog** — eski sistemde olup UYS v3'te olmayan tüm özellikler (4 kategori altında)
2. **Süzülmüş 10 öneri** — Claude'un production-blocker + kalite açısından önerdiği şortlist

Detaylı iş emirleri `docs/is_emri/01_*.md` ... `06_*.md` dosyalarındadır. Her dosya **bir veya birden fazla** öneriyi paketliyor — o yüzden 10 öneri 6 iş emrinde toplanıyor.

---

## 🟢 SÜZÜLMÜŞ 10 ÖNERİ — DETAYLI İŞ EMİRLERİ

### Production-Blocker (UYS v3 eski sistemin yerini alabilmesi için ZORUNLU)

| # | Özellik | İş Emri | Tag | Durum |
|---|---------|---------|-----|-------|
| 1 | **Operatör Paneli** (`/operator` route) | `01_OperatorPaneli.md` | v15.17.0 | 🟢 **TAMAM** (v15.52a.1: panel zaten %95 yapılmıştı, güvenlik gap'leri kapatıldı — sicil hash lazy migration + RBAC actions) |
| 2 | **Yedekleme Yönetimi** (`/backup` route) | `02_YedeklemeYonetimi.md` | v15.18.0 | 🟢 **TAMAM** (v15.53 Adım 1-5: tablo + servis + UI + merge/replace restore + otomatik günlük yedek + 30 gün temizleme) |
| 3 | **MRP Hesaplama Modal** | `03_UretimZinciri.md` Faz 3 | v15.21.0 | 🟢 **TAMAM** (v15.50b: snapshot + RBAC + isOrderArchived; Faz B P2 termin gruplama §19'a entegre) |
| 4 | **Kesim Planı Optimizasyon** | `03_UretimZinciri.md` Faz 2 | v15.20.0 | 🟢 **TAMAM** (v15.48: algoritma + UI önizleme + birim test) |
| 5 | **Sevkiyat Oluşturma Formu** | `04_Sevkiyat.md` | v15.23.0 | 🟡 Backlog |
| 6 | **autoZincir** (Sipariş→İE→Kesim→MRP→Tedarik) | `03_UretimZinciri.md` Faz 4 | v15.22.0 | 🟢 **TAMAM** (v15.51: snapshot + mrpTedarikOlustur delege + RBAC + lock) |
| 7 | **Toplu Sipariş Excel İmport** | `05_VeriOperasyonlari.md` Bölüm 1 | v15.24.0 | 🟡 Backlog |

### Kalite/Audit/Operasyonel İhtiyaç

| # | Özellik | İş Emri | Tag | Durum |
|---|---------|---------|-----|-------|
| 8 | **PDF Çıktı (İş Emri + Sevk İrsaliyesi)** | `05_VeriOperasyonlari.md` Bölüm 2 | v15.25.0 | 🟡 Backlog |
| 9 | **Stok Onarım** | `05_VeriOperasyonlari.md` Bölüm 3 | v15.24.1 | 🟡 Backlog |
| 10 | **Üst Bar Durum Göstergeleri** (KESİM/MRP/TEDARİK 🔴/🟢) | `03_UretimZinciri.md` Faz 5 | v15.19.0 | 🟢 **TAMAM** (v15.47 + 3 hotfix: statusUtils ile sağlam) |

### Bonus İş Emri (10 öneri dışı)

| # | Özellik | İş Emri | Tag | Durum |
|---|---------|---------|-----|-------|
| 11 | **Problem Takip Geliştirme** (KPI, sekmeler, tarihçe, yorum) | `06_ProblemTakip.md` | v15.17–v15.18 | 🟢 **Kısmi yapıldı** (UI v15.x'te mevcut) |

### Sonradan Eklenen İş Emirleri

| # | Özellik | İş Emri | Tag | Durum |
|---|---------|---------|-----|-------|
| 12 | **Güvenlik Refactoru — RLS Tam Uygulama** (Supabase Auth + RLS policy yayılımı) | `12_GuvenlikRefactor.md` | v16.0.0 | 🟡 Backlog (27 Nis 2026 keşfedildi — `allow_all` policy ile gerçek koruma yok) |
| 13 | **Ana Akış Refactoru (Sipariş↔İE↔Kesim↔MRP↔Tedarik)** — 22 madde | `13_AnaAkisRefactor.md` | v15.55-v15.96 | 🟢 **20/22 TAMAM** (1-7, 8, 9, 10, 11, 13, 14, **15**, 17, 18, 19, 20, 21, 22). Kalan: 12 (kısmi), 16. **v15.90-v15.96: Madde 15 TAM TUR** (P1 veri modeli + P2 mamul rezerv UI + P3 hammadde FIFO + P4 bildirim merkezi). v15.79: madde 8+9. v15.81: MRP saha bug fix. |

---

## 📚 ORİJİNAL 21 MADDELİK BACKLOG (Referans)

10 önerinin nereden geldiğini görmek için orijinal liste de korundu. Çıkarılan 11 maddenin gerekçesi de aşağıda.

### 🔵 Kategori A — Yönetimsel
| # | Özellik | Karar | Gerekçe |
|---|---------|-------|---------|
| A1 | Operatör Paneli | ✅ **TAMAM** (v15.52a.1, #1) | Sahada zaten %95 yapılmıştı; güvenlik gap'leri kapatıldı |
| A2 | Yedekleme Yönetimi | ✅ **TAMAM** (v15.53, #2) | 4 fazlık paket — listede + manuel + restore + otomatik |
| A3 | İstek Takip Sistemi | ❌ Çıkarıldı | GitHub Issues bu işi yapar |
| A4 | Görev Listesi | ❌ Çıkarıldı | GitHub Issues bu işi yapar |
| A5 | Sistem Test Motoru | ❌ Çıkarıldı | UYS v3'te Playwright E2E (9/9 green) zaten var |

### 🟠 Kategori B — Üretim Zinciri
| # | Özellik | Karar | Gerekçe |
|---|---------|-------|---------|
| B6 | autoZincir | ✅ Önerildi (#6) | Production-blocker |
| B7 | MRP Hesaplama Modal | ✅ Önerildi (#3) | Üretim planlamanın kalbi |
| B8 | Kesim Planı + Optimizasyon | ✅ Önerildi (#4) | BOM kuralı: en az fire, en çok parça |
| B9 | Sevkiyat Oluşturma Formu | ✅ Önerildi (#5) | UYS v3'te liste var, oluşturma yok |
| B10 | Üst Bar Durum Göstergeleri | ✅ Önerildi (#10) | Düşük çaba, yüksek değer |
| B11 | Fire → Sipariş Dışı İE Teklifi | 🟢 **Yapıldı** | v15.x fireTelafi.ts mevcut |
| B12 | Toplu Tedarik Modal | ❌ Çıkarıldı | UYS v3'te tedarik akışı zaten yapılandırılmış |

### 🟡 Kategori C — Veri İşlemleri
| # | Özellik | Karar | Gerekçe |
|---|---------|-------|---------|
| C13 | Toplu Sipariş Excel İmport | ✅ Önerildi (#7) | Günlük sipariş hacmine pratik |
| C14 | PDF Çıktı | ✅ Önerildi (#8) | Kalite Müdürü için zorunlu kağıt belge |
| C15 | Stok Onarım | ✅ Önerildi (#9) | Audit için kritik |
| C16 | Stok Sayım | ❌ Çıkarıldı | Yıllık 1-2 kez kullanım |
| C17 | BOM PDF Doğrulama | ❌ Çıkarıldı | Düşük frekans + ayrı bir araç (BOM-Mavvo) zaten yapıyor |
| C18 | JSON Veri Aktar | ❌ Çıkarıldı | UYS v3'te Veri Yönetimi sayfası zaten var |

### 🟢 Kategori D — UI / Mod
| # | Özellik | Karar | Gerekçe |
|---|---------|-------|---------|
| D19 | Misafir Modu | ❌ Çıkarıldı | UYS v3 RBAC'a "viewer" rolü eklemek 5 dakika |
| D20 | Çakışma Yönetimi | ❌ Çıkarıldı | UYS v3 realtime sync (CLIENT_ID + 7 tablo) yeterli |
| D21 | Raporlara Grafik (Recharts) | ❌ Çıkarıldı | Nice-to-have, tablolar okunabilir |

---

## 🎯 ÖNERİLEN İŞLEM SIRASI

Production-blocker olduğu için **Operatör Paneli (#1)** ve **Yedekleme (#2)** en öncelikli. Sonrasında üretim zinciri (#3-#6-#10), sonra sevk (#5), en son veri operasyonları (#7-#8-#9).

```
Faz 1 (Production-Blocker):
  01 → Operatör Paneli (v15.17.0)
  02 → Yedekleme Yönetimi (v15.18.0)

Faz 2 (Üretim Zinciri — birbirine bağlı):
  03 → Üretim Zinciri (v15.19 → v15.22)
       ├─ Faz 1+5: Veri modeli + Üst Bar (v15.19.0)
       ├─ Faz 2: Kesim Optimizasyon (v15.20.0)
       ├─ Faz 3: MRP Modal (v15.21.0) ← Faz B Parça 2 ile entegre
       ├─ Faz 4: autoZincir (v15.22.0)
       └─ Faz 6: Test (v15.22.1)

Faz 3 (Sevk):
  04 → Sevkiyat Formu (v15.23.0)

Faz 4 (Veri Operasyonları):
  05 → Bölüm 1 Toplu Sipariş (v15.24.0)
  05 → Bölüm 3 Stok Onarım (v15.24.1)
  05 → Bölüm 2 PDF (v15.25.0)
```

**NOT:** Bu sıralama zorunlu değil. Buket önceliği değiştirebilir; her iş emri **bağımsız apply edilebilir**.

---

## 🔗 İLİŞKİLİ DOSYALAR

- **`docs/faz_b_plan.md`** — Sipariş Termin Farkındalığı (3 parça, P1 v15.42'de yapıldı, P2/P3 backlog)
- **`docs/UYS_v3_Bilgi_Bankasi.md`** — Sürüm geçmişi + mimari + öğrenilenler
- **`docs/UYS_v3_Is_Listesi.md`** — Test senaryoları + yasak kontrolleri (operasyonel)

İş emirleri ile Faz B arasında örtüşme noktaları:
- **İş Emri #3 Faz 3 (MRP)** ↔ **Faz B Parça 2 (MRP termin-gruplu)** — birlikte yapılırsa MRP hem termin gruplu hem de net ihtiyaç gösterir.
- **İş Emri #3 Faz 2 (Kesim)** ↔ **Faz B Parça 3 (Kesim manuel kalem seçimi)** — UI bileşeni paylaşılabilir.

---

## ⏱ TAHMİNİ TOPLAM SÜRE

| Faz | Süre |
|---|---|
| Faz 1: Operatör + Yedek | 1.5–2 hafta |
| Faz 2: Üretim Zinciri | 2–3 hafta |
| Faz 3: Sevk | 1 hafta |
| Faz 4: Veri Op. | 1.5–2 hafta |
| **Toplam** | **6–8 hafta** (full-time) |

Bu tahminler diğer bir Claude oturumunun (paralel chat / Claude Code) yapacağı varsayımıyla. Buket'in mevcut iş yükü düşünülürse 3-4 ay'a yayılır.

---

## 🌱 YENİ İSTEKLER (30 Nisan 2026 — S26A_03150 plywood saha vakası)

S26A_03150 (MV GRUP, 5 Mayıs termin) plywood İE'lerini analiz ederken **3 boşluk** tespit edildi. Saha aksiyonu (MRP Hesapla → Toplu Tedarik 131 levha) ayrı; aşağıdakiler kod tarafındaki yapısal eksiklikler.

| # | İstek | Etki | Tahmini Çaba |
|---|-------|------|---|
| **#20** | **Sipariş-bütünü PlanBekliyor** (`getEffectiveStatus` refactor) | Topbar [PLAN BEKLEYEN N] sahaya gerçeği söylesin | ~30 satır, 1 dosya |
| **#21** | **2D bin-packing (yüzey kesim)** | Plywood/levha kesimde ~%30-40 hammadde tasarrufu | Hafta seviyesi (yeni algoritma + reçete grup) |
| **#22** | **Sağlık #16 sentinel — sipariş-toplam hammadde** | Gizli hammadde rekabeti yakalansın | ~50 satır (sentinel pattern) |
| **#23** | **Hesapla butonu mrp_durum DB UPDATE'ini yazmıyor** | MRP görünürlüğü ve sağlık raporu tutarlılığı | Yarım gün + belirsiz fix |

### #20 — Sipariş-bütünü PlanBekliyor (mimari boşluk, küçük)

**Kök neden:** `src/lib/statusUtils.ts:getEffectiveStatus` her İE'yi **bağımsız** değerlendiriyor. Aynı sipariştaki birden çok İE aynı hammaddeyi paylaşırken, sistem her birinin tek başına stoğu yetiyor mu diye bakar — toplam ihtiyacı görmez.

**Saha vakası:** S26A_03150'de 5 plywood İE'si (sira 10/11/12/13/14) toplam 214 levha gerektiriyor; stok 83. Sistem sadece tek başına aşan IE-14'ü "PlanBekliyor" gösterdi (1 sayısı). Gerçek: IE-11, IE-12, IE-13 de aynı stoğun aynı havuzdan tüketileceğini bilince eksik.

**Çözüm önerisi:** `getEffectiveStatus` parametre olarak `mrp_durum` alanını da alsın. Sipariş `mrp_durum='eksik'` ise ve İE kesim opsiyonlu ise — kalan stok ihtiyacı karşılamasa bile — `PlanBekliyor + tedarik_yok` döndür. Alternatif: order-level cache hesabı (her sipariş için bir kez aggregated stok tüketimi simüle et, sonra İE'leri etiketle).

**Bağlam:** Bu refactor v15.79 madde 8+9 üzerine inşa olur. Mevcut "İE-bazlı bağımsız" mantık değil, "sipariş-bağlamında" mantık.

---

### #21 — 2D bin-packing (büyük, plywood/levha kesim)

**Kök neden:** `src/features/production/cutting.ts:boykesimOptimum` 1 boyutlu (sadece `parcaBoy`). Plywood gibi yüzey kesim parçaları (`parcaEn` dolu) için `kesimTip='yuzey'` etiketi atılıyor ama optimizasyon hala 1D — `parcaEn` göz ardı ediliyor.

**Saha kanıtı:** PLY15X877X2677 yarı mamulü için reçete `1 levha = 1 parça` (1500/877=1.7 → tek sığar, doğru). Ama aynı levhada **877+577=1454mm** veya **877+427=1304mm** **yan yana** kesilebilir. Mevcut sistem her yarı mamulü ayrı reçete + ayrı İE olarak tutuyor → birleşik kesim imkansız → ~%30-40 fire fazla.

**Çözüm önerisi:** İki yol mümkün, biri Mavvo BOM tarafında reçete birleştirme, biri sistem içi 2D packer. İkincisinde `boykesimOptimum`'un yerine geçecek `yuzeyKesimOptimum(grup, hamBoy, hamEn, ihtiyaclar)`: First-Fit Decreasing Height (FFDH) veya Guillotine cut benzeri klasik 2D packer. Aynı `KesimSatir` veri modeline çıktı vermeli — UI değişmesin.

**Geniş etki:** Yarı mamul reçete sistemi yeniden yorumlanabilir (PLY15X{X}X2677 ailesi tek "kesim grubu" olarak modellenir). Bu Mavvo tarafında reçete üretimi ile koordinasyon ister.

---

### #22 — Sağlık #16 sentinel: sipariş-toplam hammadde

**Kök neden:** Mevcut Sağlık #5 (MRP §21) sadece MRP `hesaplaMRP` çıktısını okuyor. Ama `mrp_durum` bayatsa (#7'nin yakaladığı durum) plywood gibi gerçek eksikler #5'te görünmüyor. Yani #5 + #7 birbirini koşumlu sistemli düzelte rağmen sahanın "toplam ihtiyaç ⇄ stok" gerçeğini kapsamıyor.

**Çözüm önerisi:** Yeni kontrol — her aktif sipariş için, açık (`durum != tamamlandi/iptal`) İE'lerin `hm[].malkod` listesini grupla; her hammadde için `Σ miktarTotal` hesapla; `Σ ihtiyaç > stok + açık_tedarik` ise WARN. Mesaj: "S26A_03150 H0311P010446412 → 214 ihtiyaç · 83 stok · 0 yolda · **131 eksik**".

**Auto-fix yok** — sadece sentinel. Aksiyon: kullanıcı MRP Hesapla + Toplu Tedarik akışını çalıştırsın.

**Pattern:** v15.89'da eklenen #12, #13, #14'ün benzeri; ~50 satır kod, mevcut `kontroller.push({...})` formatına uyar.

---

### #23 — Hesapla butonu `mrp_durum` DB UPDATE'ini DB'ye yazmıyor (kronik)

**Kök neden:** `MRP.tsx` Hesapla handler'ı güncelleme payload'u ile `supabase` PATCH çağırıyor, ancak `updated_at` değişmiyor. Yani işlem UI tarafında veya store'da tamamlanmış gibi görünse de DB'ye ulaşmıyor.

**Saha kanıtı:** 30 Nis 06:00 — Buket Hesapla bastı, eksik 131 plywood ekranda görüntülendi, fakat `mrp_durum` DB'de hâlâ `tamam` olarak kaldı ve `updated_at` 17 saat önceydi.

**Çözüm önerisi:** Network tab'dan `PATCH /uys_orders` çağrısı atılıyor mu kontrol et. `v16.04` için post-condition sentinel ekle: `updated_at` 5 sn içinde değişmediyse `toast.error` göster.

**Tahmin çaba:** Tanı yarım gün, fix değişken olabilir (RLS / await / cache problemi olabilir).

---

*Bu Master Backlog v16.00 itibariyle günceldir. 27 Nisan gecesi 17 commit ile 3 İş Emri tek günde kapandı (#1, #2, #3). 29 Nisan'da 18 sürümle Madde 15 tam tur kapandı + Sağlık #15 sentinel eklendi. 30 Nisan sabahı v16.00-v16.02 hotfix serisi + 4 yeni istek (#20-23) eklendi. Her iş emri tamamlandıkça yukarıdaki "Durum" kolonu güncellenmelidir.*
