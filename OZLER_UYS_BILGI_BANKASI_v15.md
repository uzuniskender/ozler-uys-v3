# ÖZLER UYS v3 — BİLGİ BANKASI v15
**Son güncelleme:** 17 Nisan 2026 (gece)

---

## 1. Temel Bilgiler

| | |
|---|---|
| **Repo** | https://github.com/uzuniskender/ozler-uys-v3 |
| **Canlı URL** | https://uzuniskender.github.io/ozler-uys-v3/ |
| **Canlı Supabase** | `kudpuqqxxkhuxhhxqbjw` (Frankfurt) — CANLI, dokunmayın |
| **Test Supabase** | Kurulum aşamasında (ayrı proje olacak, E2E testler için) |
| **Stack** | React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase |
| **Test sayfası (DB-only)** | `#/test` — 12 adımlı basit smoke |
| **E2E test altyapısı (yeni)** | Playwright + ayrı test Supabase projesi |

---

## 2. 17 Nisan'da Yapılan İşler

### Sabah (v14 serisi — 9 bug fix)

| # | Bug | Root cause | Fix |
|---|---|---|---|
| 1 | Fire-only giriş reddediliyordu | `q<=0 && !durus` kontrolü fire'ı yoksayıyordu | 4 yerde `q<=0 && f<=0 && !durus` |
| 2 | Üretim girişi stok hareketi yazmıyor | DB'de `kaynak` kolonu yok → Supabase sessiz reddediyor | 6 insert'ten `kaynak` çıkarıldı |
| 3 | Fire girişinde auto-close çalışmıyor | DB'de `tamamlanma_tarih` kolonu yok → sessiz reddediyor | 3 yerden çıkarıldı |
| 4 | Log saat görünmüyor | Store log mapper'da `saat` alanı okunmuyor | `ProductionLog.saat` + mapper |
| 5 | Reports detay tıklama çalışmıyor | Route path `/work-orders` vs `/workorders` uyumsuz | Path düzeltildi |
| 6 | Negatif değer girilebiliyor | min=0 + save validasyonu yok | Eklendi |
| 7 | Sipariş modalı ürün arama yok | Klasik select dropdown | SearchSelect |
| 8 | "Yeni BileşenÇELİK" prefix bug | Default malad='Yeni Bileşen' | Default boş |
| 9 | **İE listesinde durum hep "Başlamadı"** | UI `pct`'ye bakıp kendi türetiyor, DB'deki `durum` ignore + pct fire'ı saymıyor | `wKapasite` helper (fire dahil), 3 yerde DB durumu önceliklendirildi |

### Öğleden sonra (v14.10+ iyileştirmeler)

- **v14.10 Stok hareketi fix**: ProductionEntry'de `q=0` olsa bile `tip=giris` yazılıyordu. `if (q>0)` koşulu eklendi.
- **v14.11 Orphan Temizle güçlendirildi**: Fresh DB okuma, 5 kategori (log/fire/stok/telafi/tedarik), batch 50, özet modal
- **v14.12 Build tertemiz**: `mrp.ts` dynamic→static, `prompt.ts` sonner static, vite manualChunks → bundle 1.4MB→683KB

### Akşam (v15 serisi — yeni özellikler)

- **v15.0 Sipariş sevk durumu + Yardım + Ekip Notları**
  - `uys_orders.sevk_durum` kolonu (sevk_yok / kismi_sevk / tamamen_sevk)
  - Orders listesinde "Sevk" sütunu + renk kodlu badge
  - Topbar'da 📖 Yardım (14 sayfa için) + 📝 Ekip Notları butonu
  - Markdown destekli sade zengin metin editörü
  - `uys_notes` tablosu, realtime
- **v15.1 Recursive Stok Kontrol** (kullanıcı kuralı: "Alt kırılımda hiçbiri yoksa uyarı")
  - `stokKontrolWO` yeniden yazıldı — reçete ağacını recursive inceler
  - "A3 için A2, A1 veya A'dan birinin stokta olması yeter"
- **v15.2-v15.4 Ölçü Filtreli Malzeme Arama Modalı** — ortak component, 8 yerde:
  1. Reçete satırları
  2. BOM satırları
  3. BOM yeni ekleme (kök mamul)
  4. Yeni İE modalı
  5. Tedarik kaydı
  6. Sevkiyat kalemi
  7. Manuel stok girişi
  8. Manuel kesim planı (hammadde, allowedTypes=['Hammadde'])
  - 6 ölçü filtresi (Boy/En/Kalınlık/Uzunluk/Çap/İç Çap)
  - Akıllı default: parent satırın ölçüleri otomatik
  - "Varsayılan ölçülere dön" + "Tüm filtreleri temizle"
- **v15.5 Playwright E2E Test Altyapısı**
  - Ayrı test Supabase projesi (izole, canlıya risk=0)
  - `E2E-` önekli veriler, otomatik temizlik
  - Güvenlik: canlı URL tespit edilirse durur
  - 3 test: smoke (13 sayfa) + malzeme CRUD + IE/fire/telafi akışı

---

## 3. Kritik Öğrenilen Kurallar

**Supabase silent reject** — Insert/update'te var olmayan kolon gönderilince sessizce yok sayılır, hata dönmez. Bu yüzden 2 büyük bug (kaynak, tamamlanma_tarih) saatlerce sürdü. **Kural:** Yeni bir kolon adı kullanmadan önce `information_schema.columns` ile DB'de var mı doğrula.

**UI'da hesaplanan durum + DB'de yazılan durum çakışırsa UI hep haklı sanılır** — Bug #9 tam böyleydi: DB tamamlandi yazsa da UI `pct=0` diye "Başlamadı" gösteriyordu. **Kural:** Durum gibi kritik statüleri tek noktada yönet — ya hep DB alanı, ya hep türetilmiş, karma değil.

**DB-only testler UI bug'larını yakalayamaz** — `/test` sayfası 12/12 yeşil geçti ama canlı UI'da bug sürdü, çünkü React kod yolunu değil Supabase tablosunu test ediyordu. Bu yüzden Playwright E2E kuruldu.

**Kullanıcı asıl yazdığını dinle, "anladım" deme** — User "ne demek anlamadım" dedi, sen dinleyip açıkladın. Tek bir kural doğru anlaşıldığında 3 farklı kural yazmaya gerek kalmıyor. Recursive stok kontrol örneği.

---

## 4. Dosya Yapısı — Yeni Eklenenler

```
src/
├── components/
│   ├── MaterialSearchModal.tsx   # YENİ — ortak ölçü filtreli arama
│   └── HelpNotesButtons.tsx      # YENİ — yardım + ekip notları
├── lib/
│   └── helpContent.ts            # YENİ — 14 sayfa için yardım içeriği
├── features/production/
│   └── stokKontrol.ts            # YENİDEN YAZILDI — recursive BOM traversal
└── pages/
    ├── Shipment.tsx              # GÜNCELLENDİ — sevk_durum hesabı
    ├── Orders.tsx                # GÜNCELLENDİ — Sevk sütunu
    └── (8 sayfa — malzeme arama butonu)

tests/e2e/                        # YENİ — Playwright E2E
├── helpers.ts
├── fixtures.ts
├── run-cleanup.ts
├── README.md
├── 01-smoke.spec.ts
├── 02-materials.spec.ts
└── 03-work-order-flow.spec.ts

playwright.config.ts              # YENİ
.env.test.example                 # YENİ (gerçek .env.test gitignore'da)
.gitignore                        # YENİ
```

---

## 5. Bekleyen İşler

### 🚧 Devam eden
- **E2E test altyapısı** — test Supabase projesi kurulumu bekliyor
  - Kullanıcı v2 projesini silip yerine `ozler-uys-v3-test` açacak
  - Canlıdan şema kopyalayacak, RLS + realtime açacak
  - URL + anon key gelecek
  - `.env.test` dosyası oluşacak
  - `npm run test:e2e` çalışacak

### 📋 Sıradaki adaylar (kullanıcı seçecek)
- Malzeme tablosu iyileştirmeleri (sticky header, sayfalama, zebra, ölçü birleştirme)
- B8 stok kontrol — canlıda IE-MANUAL-MO0Z3Z1Z ile test
- RLS güvenlik (allow_all → authenticated-only)
- Kesim planı merging
- Operator mesajları paneli
- Bulk order entry via Excel
- MRP iyileştirmeleri (İstek #18, #19)

### 🔒 Uzun dönem
- NETBIS (nuclear supplier) registration
- ISG TL-ISG-017 ve sonrası
- Libya order documentation paketi
- Compaco Romania 8D raporu (RAPIDO-UNI Panel 150x270 keyhole)
- CBAM O3CI portal erişim sorunu
- GFB/çevre izni Dilovası (kapasite raporu)

---

## 6. RBAC + Altyapı (Değişmeyenler)

- **4 rol:** Admin, ÜretimSor, Planlama, Depocu
- **80+ aksiyon** — her sayfada her aksiyon yetkisi ayrı
- `uys_kullanicilar` + `uys_yetki_ayarlari` — canlıda aktif
- KullaniciPanel + YetkiPanel → DataManagement sayfasında

**Supabase güvenlik uyarısı:** RLS policy `allow_all` (USING true WITH CHECK true) — anon key ile dışarıdan erişim mümkün. Kendi RBAC kullanılıyor. İleride authenticated-only veya Supabase Auth.

---

## 7. Çalışma Tarzı

- Türkçe iletişim, özlü yanıt
- "Sen karar ver, en doğrusunu yap" → analitik karşılaştırma sun, net öneri ver, gerekçeyle
- Manuel test yorucu, otomatikleştirilsin
- `ask_user_input_v0` kullanırken seçenekleri MUTLAKA mutually-exclusive yap
- User'ın yazdığı detayları 2. kez sormadan anla — okumadan sorma
- Kritik adımlarda uyarı ver (örneğin "canlıyı silecek misin" gibi), ama saygı sınırını koru
- Şifreleri (admin, operatör vs.) ASLA yazma/gösterme
- Supabase'de yeni kolon kullanmadan önce `information_schema.columns` ile doğrula

---

## 8. Yeni Chat İçin Giriş Prosedürü

1. Bu dosyayı (`OZLER_UYS_BILGI_BANKASI_v15.md`) yükle
2. `ozler-uys-v3-full.zip`'i yükle (son kaynak kod)
3. `TEST_DB_KURULUM.md`'yi yükle (test projesi kurulum aşamasında)
4. İlk olarak kullanıcıya sor: test Supabase projesi kuruldu mu? URL + anon key var mı?
5. Varsa `.env.test` oluşturulup Playwright testleri koşulur
6. Yoksa kurulum yardımı verilir, sonra devam edilir

### Hızlı komutlar
```bash
# Proje başlat
npm install

# Normal geliştirme (canlı DB)
npm run dev

# Test modunda geliştirme (.env.test'e bağlanır)
npm run dev:test

# E2E test
npm run test:e2e

# E2E test UI modda
npm run test:e2e:ui

# Temizlik (test verisi)
npm run test:e2e:cleanup
```

---

## 9. Son Bundle Durumu

- Build: tertemiz, warning yok
- Bundle: 718KB ana + 6 vendor chunk (toplam ~1.5MB, gzip ~550KB)
- TS: `tsc --noEmit` hatasız
- vite.config: GitHub Pages path'i sadece production build'te, dev/test'te root
