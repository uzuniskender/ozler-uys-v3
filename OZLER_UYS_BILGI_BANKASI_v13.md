# ÖZLER UYS v3 — BİLGİ BANKASI v13
**Son güncelleme:** 2026-04-13
**Oturum özeti:** 20 dosya, +1458 / -779 satır, 44 TS/TSX dosya, 8.671 satır, 22 sayfa

## Proje
- **Repo:** https://github.com/uzuniskender/ozler-uys-v3
- **URL:** https://uzuniskender.github.io/ozler-uys-v3/
- **Operatör URL:** https://uzuniskender.github.io/ozler-uys-v3/#/operator
- **v2 (eski):** https://uzuniskender.github.io/ozleruretim/ (repo: ozleruretim, 15.696 satır)
- **Stack:** React 19 + Vite + TS + Tailwind v4 + Zustand + Supabase + Recharts + Sonner
- **Supabase:** kudpuqqxxkhuxhhxqbjw (Frankfurt)
- **Build:** `tsc --noEmit && vite build`

## Kimlik Doğrulama
- **admin** → Google OAuth (Supabase Auth), whitelist: uzuniskender@gmail.com
  - Google Cloud proje: Ozler UYS (ozler-uys), Client ID: 280322174634-...
  - Supabase: Google provider aktif, Site URL: uzuniskender.github.io/ozler-uys-v3/
  - Fallback: şifre ile giriş (gizli buton), varsayılan: admin123
  - signOut: supabase.auth.signOut + localStorage temizle + reload
  - Topbar: kullanıcı adı + e-posta gösterimi
- **operator** → Bölüm → Operatör → Şifre
- **guest** → Salt okunur

## Çekirdek Modüller (features/production/)

### mrp.ts (280 satır) — v2 Tam Port ✅
- `bomPatlaNet()` — recursive BOM explosion (v2 satır 12107-12250)
  - YM stok netting: her YM seviyesinde stok düşülür
  - Kaskad net ihtiyaç: kirno bazlı üst→alt zincir çarpan
  - Flat ve kirno bazlı reçeteler, üst reçetelerden alt kirno tarama
- `hesaplaMRP()` — ana MRP (v2 satır 12350-12427)
  - **Kesim planı override:** plan varsa BOM brüt → gerçek bar sayısı
  - **Tüm açık tedarikler** hesaba katılır
  - **YM İE desteği:** bağımsız iş emirleri
  - **YarıMamul filtre:** sonuçlardan çıkarılır

### cutting.ts (285 satır) — v2 Tam Port ✅
- `kesimPlanOlustur()` — v2 `_kesimPlanOlusturCore` portu
  - Tüm açık İE tarama → kesim operasyonu → hamMalkod gruplama
  - **woId/ieNo referansları** her kesim kaydında
  - Mevcut planla merge (duplikasyon önleme)
- `boykesimOptimum()` — Best-Fit Decreasing + **fire doldurma** (2. geçiş)
  - Aynı düzendeki barları gruplama

### autoChain.ts (177 satır) — v2 Tam Port ✅
- `buildWorkOrders()` — reçeteden İE (zincir çarpan, HM bileşenleri, opAd doldurma)
- `autoZincir()` — **İE → Kesim → MRP → Tedarik** tam zincir
  - Progress callback, fresh data fetch, duplikasyon kontrolü

## Sayfa Detayları

### Dashboard (383 satır)
- 6 stat kartı
- **Üretim Zinciri Özet widget'ları:** MRP bekliyor / Kesim planlanmamış / Kesim bekliyor / Tedarik bekliyor (tıklanabilir navigasyon)
- Termin geçmiş uyarısı, min stok uyarısı + tedarik oluştur, yedek uyarısı
- 7 gün üretim grafiği (Recharts), aktif çalışmalar, operatör mesajları (cevapla/okundu)

### Siparişler (474 satır)
- **MRP badge** sipariş listesinde: 📊/⚡/✓
- Sipariş detay modal:
  - **⚙ Tam Zincir** → Progress modal (4 adım + sonuç özeti + eksik malzeme tablosu + navigasyon butonları)
  - ⛓ Yeniden Çalıştır, + Eksik İE Tamamla
  - MRP tab: hesapla → sonuç → tekli/toplu tedarik → Excel export
- Toplu MRP (kesim planı override dahil)
- Excel import/export

### İş Emirleri (453 satır)
- Collapsible gruplar, zengin başlık (hedef/üretim/%, stok uyarı, müşteri/termin)
- Grup checkbox, tip filtresi (Sipariş/YM), toplu kopyalama (-K)
- Zengin satır: sipariş no, malzeme kodu, HM tag, whAlloc, stok badge (tıklanabilir detay)
- İstasyon sütunu
- Detay: reçete zinciri, kesim planı, stok kontrol, HM bileşenleri, log operatör saat/duruş

### Kesim Planları (287 satır)
- **⚡ Otomatik Plan** — İE'lerden otomatik (kesimPlanOlustur)
- **Manuel Plan** — kullanıcı seçimli (optimizeKesim)
- Kesim önerileri paneli (planlanmamış İE listesi)
- **Detay görünümü:** collapsible satırlar, bar tipi kartları
  - **Bar SVG:** her parça ayrı renk, hover'da ieNo + malzeme + boy
  - Kesim listesi: ■ renk + İE No + malzeme + boyxadet
  - ♻ Artık + Durum + Sil

### MRP (245 satır)
- Çoklu sipariş seçimi + **tarih filtre** (Termin ≤ tarih)
- YM İE bilgisi gösterimi
- Kesim planı override uyarısı
- **Tedarik Şablonu Excel** indir (eksikleri doldurmaya hazır format)
- Toplu tedarik (duplikasyon kontrolü)

### Tedarik (218 satır)
- markGeldi: **stok girişi otomatik** (uys_stok_hareketler tip:giris)
- **Excel import** (toplu tedarik yükleme — MRP şablonu uyumlu)
- Tedarik formu (SearchSelect ile malzeme/tedarikçi)

### Depolar (Warehouse) (310 satır)
- Stok tablosu: Kod, Malzeme, **Tip**, **Stok**, **Birim**, **MinStok** sütunları
- MinStok altındaki satırlar kırmızı vurgulu
- Stok hareketleri tab (düzenleme/silme)
- Sayım tab, stok onarım, toplu giriş, Excel import/export

### Veri Yönetimi (DataManagement) (300 satır)
- JSON yedek/geri yükle
- **Excel Aktar** (tüm tablolar tek Excel'e)
- **Sistem Testi:** orphan İE, negatif stok, reçetesiz sipariş, İE'siz sipariş, hedef 0, **bölümsüz operasyon**, **orphan kesim referansı**, **gelmiş-ama-stok-girişi-yok tedarik**
- **Kesim Planlarını Sıfırla** butonu eklendi
- Test modu, admin şifre, işlem geçmişi

### Operatör Paneli (555 satır)
- Loading guard (race condition fix)
- İşlerim/Mesajlar/Özet tabları
- OprEntryModal: HM stok kontrol, çoklu operatör, duruş

## Sidebar Navigasyon
```
GENEL:    Genel Bakış (mesaj badge)
ÜRETİM:  Siparişler → İş Emirleri → Üretim Girişi → Kesim Planları → MRP → Tedarik → Depolar → Sevkiyat
TANIMLAR: Ürün Ağaçları → Reçeteler → Malzeme Listesi → Operasyonlar → İstasyonlar → Operatörler → Tedarikçiler → Duruş Kodları
SİSTEM:   Raporlar → Veri Yönetimi → Operatör Paneli → Checklist
```
Badge renkleri: mesaj→red, İE→accent, tedarik→amber, kesim→green

## CuttingItem Alanları
`woId, ieNo, malkod, malad, parcaBoy, parcaEn, adet, tamamlandi`

## Dosya Yapısı
```
src/ (8.671 satır, 44 dosya)
├── App.tsx — Google OAuth prop
├── components/layout/
│   ├── Layout.tsx
│   ├── Sidebar.tsx — İstasyonlar eklendi, badge renkleri, akış sırası
│   └── Topbar.tsx — Google e-posta gösterimi
├── hooks/
│   ├── useAuth.ts — Google OAuth + signOut + SIGNED_OUT event
│   └── useRealtime.ts
├── lib/ (supabase, utils, activityLog, prompt)
├── store/index.ts — Zustand, 20+ tablo mapper
├── types/index.ts — CuttingItem.ieNo
├── features/production/
│   ├── autoChain.ts — buildWO + autoZincir (tam zincir)
│   ├── cutting.ts — kesimPlanOlustur + boykesim + fire doldurma
│   ├── mrp.ts — bomPatlaNet + hesaplaMRP
│   ├── stokKontrol.ts, stokTahsis.ts, stokTuketim.ts
└── pages/ (22 sayfa)
```

## Zip Kullanımı
`src/` + `tsconfig.app.json` + `package.json` kopyala → Fetch → Pull → Push
