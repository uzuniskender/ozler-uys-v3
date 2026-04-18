# UYS v3 — E2E Test Altyapısı

## 🎯 Ne yapar?

Playwright ile gerçek tarayıcı açar, kullanıcı gibi davranır.
- Her sayfayı ziyaret eder, hatasız açıldığını kontrol eder
- İş emri oluşturma, üretim girişi, fire, telafi akışlarını test eder
- Ölçü filtreli malzeme arama modalını test eder
- Yardım + Notlar gibi yeni özellikleri doğrular

## 🛡 Güvenlik

Testler **SADECE** ayrı bir test Supabase projesine yazar.
Canlı DB'ye (kudpuqqxxkhuxhhxqbjw) dokunma riski **SIFIR** çünkü:
1. `.env.test` dosyasında test URL'i yer alır (canlı URL'den tamamen farklı)
2. `helpers.ts` başlangıçta canlı URL'i tespit ederse test'i durdurur
3. Her test öncesi + sonrası `E2E-` önekli tüm veriler temizlenir

## 🚀 Kurulum (İlk Kez)

### 1. Test Supabase Projesi Oluştur

`TEST_DB_KURULUM.md` dosyasındaki adımları takip et. Test projesi URL + anon key al.

### 2. `.env.test` Oluştur

```bash
cp .env.test.example .env.test
# Sonra içeriği doldur:
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

`.env.test` dosyası `.gitignore`'da, **asla commit edilmez**.

### 3. Bağımlılıkları Yükle

```bash
npm install
npx playwright install chromium   # Sadece chromium yeter
```

## 🧪 Test Çalıştırma

### Tüm testleri koş
```bash
npm run test:e2e
```

### UI modunda (adım adım görsel)
```bash
npm run test:e2e:ui
```

### Son raporu göster
```bash
npm run test:e2e:report
```

### Elle temizlik (test dışında)
```bash
npm run test:e2e:cleanup
```

## 📂 Test Dosyaları

```
tests/e2e/
├── helpers.ts              # Ortak yardımcılar: login, cleanup, safety check
├── fixtures.ts             # Test fixture (her test öncesi/sonrası)
├── run-cleanup.ts          # Standalone temizlik script
├── 01-smoke.spec.ts        # Tüm sayfalar yükleniyor mu
├── 02-materials.spec.ts    # Malzeme CRUD + ölçü arama
└── 03-work-order-flow.spec.ts  # İE + fire + telafi akışı
```

## 🔍 Test Verisi Nasıl Tanınır?

Tüm test kayıtları `E2E-` önekiyle başlar:
- IE No: `E2E-IE-abc123`
- Malzeme Kod: `E2E-MAT-xyz`
- Sipariş No: `E2E-SIP-def`

`cleanupTestData()` bu prefix'e sahip tüm kayıtları tablolardan siler.

## ⚠ Bir Şeyler Yanlış Giderse

### Test verisi kaldıysa
```bash
npm run test:e2e:cleanup
```

### .env.test canlıya işaret ediyorsa
`helpers.ts` uygulamayı durdurur, hata mesajı verir.

### Supabase auth error
1. `.env.test` doğru mu kontrol et
2. Test projesinde RLS policy `allow_all` aktif mi kontrol et
3. anon key geçerli mi kontrol et
