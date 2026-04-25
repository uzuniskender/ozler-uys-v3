# İŞ EMRİ #5 — UYS v3 Veri Operasyonları (Toplu Sipariş + PDF + Stok Onarım)

## Bağlam

Üç bağımsız ama "veri operasyonu" başlığı altında toplanan özellik:

1. **Toplu Sipariş Excel İmport** — Eski UYS'te `_showTopluUretimModal` + `applySiparisImport` (reçete otomatik eşleme, önizleme, mevcut atlama, İE otomatik oluşturma). UYS v3 backlog'unda var.

2. **PDF Çıktı (İş Emri + Sevk İrsaliyesi)** — Eski UYS'te varsayılan tarayıcı yazdırma kullanılıyordu (görsel olarak yetersiz). UYS v3 backlog'unda profesyonel PDF.

3. **Stok Onarım** (`stokOnar`) — Üretim loglarına bakarak eksik stok hareketlerini geriye dönük oluşturma. Audit/kalite kayıtları için kritik. Eski UYS'te var.

Bu üçü ortak özellik: **mevcut veriler üzerinde toplu/teknik işlem**. Ayrı sayfalar değil, mevcut sayfalara entegre edilecek.

**Hedef:** UYS v3'e bu üç işlevselliği eklemek.

---

## YAKLAŞIM

| Özellik | Yer | Tetikleme |
|---------|-----|-----------|
| Toplu Sipariş Excel | `pages/Orders.tsx` header'a buton | "📤 Toplu Yükle" |
| PDF İş Emri | `pages/WorkOrders.tsx` satır aksiyonu | "🖨 PDF" butonu |
| PDF Sevk İrsaliyesi | `pages/Shipment.tsx` detay modal | "🖨 İrsaliye" butonu |
| Stok Onarım | `pages/Data.tsx` (Veri Yönetimi) | "🛠 Stok Onar" butonu (admin only) |

---

## KORUNACAK ÖZELLİKLER (DOKUNMA)

1. UYS v3'ün mevcut Orders/WorkOrders/Shipment sayfaları — sadece buton/aksiyon eklenecek
2. Mevcut Excel import altyapısı (`xlsx` dynamic import — backlog'a göre var olmalı)
3. RBAC sistemi — yeni action'lar eklenecek
4. Mevcut `stokHareketler` tablosu — sadece INSERT yapılacak, mevcut kayıt silinmeyecek

---

# BÖLÜM 1: TOPLU SİPARİŞ EXCEL İMPORT

## Faz 1.1 — Excel Şablonu

### Görev 1.1.1 — Şablon Tasarımı

Excel formatı (sabit kolon sırası):

| Sipariş No | Müşteri | Termin | Mamul Kod | Mamul Adı | Adet | Birim | Açıklama |
|------------|---------|--------|-----------|-----------|------|-------|----------|
| SIP-2026-001 | ABC İnşaat | 30.04.2026 | UNI-150-270 | RAPIDO-UNI Panel 150×270 | 50 | adet | D-Type |

**Kurallar:**
- Aynı sipariş no'nun birden fazla satırı olabilir (multi-line sipariş)
- Mamul Kod malzeme listesinde olmak zorunda → eşleşme sırasında kontrol
- Termin formatı: `DD.MM.YYYY`

### Görev 1.1.2 — Şablon İndirme

`pages/Orders.tsx`'e ek buton: "📥 Şablon İndir"

İçeriği `xlsx` ile dinamik üretilir (`generateOrderTemplate()`):
- Üst satırda kolonlar (bold)
- 2. satır örnek veri (renkli, kullanıcı silmeli)
- 3+ satır boş

Dosya adı: `Ozler_Siparis_Sablonu.xlsx`

---

## Faz 1.2 — Import Akışı

### Görev 1.2.1 — Toplu Yükle Modal'ı (3 adımlı)

**Adım 1: Dosya Yükle**

Drag & drop / dosya seç → `xlsx` ile parse.

İlk satırı otomatik başlık olarak algıla. "Sipariş No" kolonu yoksa → hata.

**Adım 2: Önizleme + Eşleştirme**

Tablo formatında okunan veri gösterilir. Her satır için:

| ✓ | Sipariş No | Müşteri | Termin | Mamul | Adet | Durum | Aksiyon |
|---|------------|---------|--------|-------|------|-------|---------|
| ☑ | SIP-2026-001 | ABC İnşaat | 30.04.2026 | UNI-150-270 ✅ | 50 | Yeni | — |
| ☑ | SIP-2026-002 | XYZ Ltd | 02.05.2026 | UNI-100-200 ⚠️ | 30 | Mamul kod bulunamadı | Eşle / Atla |
| ☐ | SIP-2025-099 | DEF | 15.04.2026 | UNI-150-270 ✅ | 20 | **Mevcut sipariş!** | Atla / Üzerine yaz |

**Otomatik kontroller:**
- Mamul Kod `materials` tablosunda var mı? (yoksa "Eşle" modal'ı: benzer kod öner)
- Sipariş No zaten var mı? ("Mevcut sipariş!" — atla / üzerine yaz seçeneği)
- Müşteri kayıtlı mı? (yoksa otomatik eklensin? checkbox ile karar)

**Toolbar:**
- Tümünü Seç / Hiçbirini Seçme
- Sadece "Yeni" olanları göster
- Eşleşmeyen mamul satırları gizle

**Adım 3: Onay**

- Kaç sipariş eklenecek (X)
- Kaç sipariş atlanacak (Y) — neden?
- Kaç İE oluşturulacak (Z) — checkbox: "Sipariş başına otomatik İE oluştur"
- ☑ "autoZincir çalıştır" (İş Emri #3 ile entegre — eğer kuruluysa)

"Yükle" butonu → batch insert + İE oluşturma.

### Görev 1.2.2 — Mamul Eşleme Modal'ı

Eşleşmeyen mamul kod için kullanıcıya sunulan modal:

```
"UNI-100-200" mamul listesinde bulunamadı.

Benzer kayıtlar:
○ UNI-100-205 (RAPIDO-UNI Panel 100×205)
○ UNI-100-200B (RAPIDO-UNI Panel 100×200B)
○ Yeni mamul olarak ekle
○ Bu satırı atla

[İptal] [Tamam]
```

Algoritma: Levenshtein distance ile en yakın 5 kayıt önerilir.

### Görev 1.2.3 — Batch Insert

`applyBatchOrderImport(rows, options)`:

```typescript
interface BatchOptions {
  createWorkOrders: boolean
  createMissingCustomers: boolean
  triggerAutoChain: boolean
  overwriteExisting: boolean
}
```

Mantık:
1. Müşteri eksikse → `customers` tablosuna ekle (eğer izin varsa)
2. Sipariş başına `orders` insert
3. Her sipariş satırı için `order_satirlari` insert
4. `createWorkOrders=true` ise → `_buildWOs` mantığı (mevcut kod)
5. `triggerAutoChain=true` ise → her sipariş için `autoChain()` (İş Emri #3)

Progress bar gösterilir (her N kayıtta progress event).

**Kabul kriteri:** 100 satırlık Excel < 30 saniyede yüklenir.

---

## Faz 1.3 — Test

### Görev 1.3.1 — Playwright E2E

`test/e2e/toplu-siparis.spec.ts`:
1. Test Excel dosyası hazırla (5 sipariş, 1 mamul kod yanlış)
2. Toplu yükle modal aç → dosyayı yükle
3. Önizleme → mamul eşleme modal görünür mü?
4. Eşle → onayla → yükle
5. Sipariş sayısının doğru olduğunu kontrol et

---

# BÖLÜM 2: PDF ÇIKTI

## Faz 2.1 — PDF Altyapısı

### Görev 2.1.1 — Kütüphane Seçimi

Önerilen: **`@react-pdf/renderer`** (server-side render gerektirmez, tarayıcıda PDF üretir).

Alternatif: `jsPDF + html2canvas` (daha basit ama görsel kalite düşük).

→ `@react-pdf/renderer` tercih edilir, modern + native React.

```bash
npm install @react-pdf/renderer
```

### Görev 2.1.2 — Ortak PDF Komponenti

`src/components/pdf/Header.tsx` — tüm PDF'lerde kullanılacak:
- Sol üst: Şirket logosu (`public/ozler-logo.png` — Buket'ten alınacak)
- Sağ üst: Şirket adı + adres + iletişim
- Alt çizgi

`src/components/pdf/Footer.tsx`:
- Sayfa numarası (X/Y)
- Tarih + zaman
- "Özler Kalıp ve İskele Sistemleri A.Ş." metni

### Görev 2.1.3 — Türkçe Karakter Desteği

`@react-pdf/renderer` default Helvetica → Türkçe karakter (ş, ç, ğ, ü) bozar.

Çözüm: **Inter** veya **Open Sans** font'unu register et:

```typescript
Font.register({
  family: 'Inter',
  src: '/fonts/Inter-Regular.ttf',  // public/fonts/ klasörüne konur
})
```

**Kabul kriteri:** PDF içinde "İSKELE", "KALİTE", "ÇEVRE" gibi Türkçe kelimeler doğru render edilmeli.

---

## Faz 2.2 — İş Emri PDF

### Görev 2.2.1 — PDF Layout

Komponent: `src/components/pdf/IsEmriPDF.tsx`

İçerik:
- **Header** (ortak)
- **Başlık:** İŞ EMRİ — WO No
- **Müşteri / Sipariş bilgisi** (eğer sipariş bağlıysa)
- **Ürün bilgisi** (kod, adı, miktar, termin)
- **BOM listesi** (tablo: malkod, ad, ihtiyaç miktarı, birim)
- **Operasyonlar** (sıralı liste, istasyon, tahmini süre)
- **Üretim alanı** (boş — operatör elle dolduracak: gerçek miktar, fire, başlangıç/bitiş)
- **İmza alanı** (Operatör + Vardiya Amiri)
- **Footer** (ortak)

Format: A4 portrait.

### Görev 2.2.2 — "PDF" Butonu

`pages/WorkOrders.tsx`'e satır aksiyonu:

```tsx
{can('wo_print') && (
  <button onClick={() => downloadPDF(wo)}>
    <Printer size={12} />
  </button>
)}
```

`downloadPDF` mantığı: `@react-pdf/renderer`'in `pdf()` fonksiyonu ile blob üret → `URL.createObjectURL` → indirme.

Dosya adı: `IsEmri_{WO-NO}_{DDMMYYYY}.pdf`

---

## Faz 2.3 — Sevk İrsaliyesi PDF

### Görev 2.3.1 — PDF Layout

Komponent: `src/components/pdf/SevkIrsaliyesiPDF.tsx`

İçerik:
- **Header** (ortak)
- **Başlık:** SEVK İRSALİYESİ — Sevk No
- **Sol blok:** Gönderen (Özler bilgileri)
- **Sağ blok:** Alıcı (müşteri bilgileri)
- **Üst bilgi:** Sevk tarihi, taşıyıcı, plaka
- **Kalemler tablosu:** Sıra, Malkod, Adı, Miktar, Birim, Açıklama
- **Toplam satırı:** Toplam kalem, toplam miktar
- **CBAM bilgisi** (varsa): CN Code, toplam ağırlık (kg) — ihracat için
- **İmza alanları:** Gönderen / Alıcı / Taşıyıcı
- **Yasal metin:** İrsaliye sıra no, Vergi dairesi/numarası
- **Footer** (ortak)

Format: A4 portrait.

### Görev 2.3.2 — "İrsaliye" Butonu

`pages/Shipment.tsx` detay modal'ında (İş Emri #4'tekine eklenecek):

```tsx
{can('sevk_print') && (
  <button onClick={() => downloadIrsaliye(sevk)}>
    <Printer size={14} /> İrsaliye Yazdır
  </button>
)}
```

Dosya adı: `Irsaliye_{SEV-NO}_{DDMMYYYY}.pdf`

### Görev 2.3.3 — Yasal Gereksinimler

**ÖNEMLİ:** Türkiye'de sevk irsaliyesi resmi belge — Maliye Bakanlığı standartlarına uygun olmalı:
- Sıra numarası kesintisiz olmalı (boşluk yok)
- Tarih + saat
- Vergi dairesi + vergi numarası
- "İrsaliye" yazısı belirgin
- Kâğıt/dijital her iki formatta da geçerli

→ Buket bu noktayı **muhasebe/mali müşavir ile teyit etmeli** PDF'i kullanıma sokmadan.

---

# BÖLÜM 3: STOK ONARIM

## Faz 3.1 — Stok Onarım Servisi

### Görev 3.1.1 — Algoritma

`src/lib/stok-onar.ts`:

```typescript
interface StokOnarRapor {
  taranLogSayisi: number
  eksikGirisSayisi: number
  eksikCikisSayisi: number
  eklenenHareketler: Array<{
    tip: 'giris' | 'cikis'
    malkod: string
    miktar: number
    aciklama: string
    woId: string
  }>
}

export async function stokOnar(opts: { 
  dryRun: boolean,           // gerçekten kaydetmeden tara
  onlyMissing: boolean,      // sadece eksik olanlar (default true)
}): Promise<StokOnarRapor>
```

Mantık (eski sistemden uyarlanmış):

1. **Üretim girişleri:** Her `logs` kaydı için:
   - WO bul → mamul (`w.malkod`)
   - `stokHareketler`'da bu log için `tip='giris', logId=l.id` var mı?
   - Yoksa → eksik kayıt → ekle

2. **Stok çıkışları:** Her `logs` kaydı için:
   - WO'nun reçetesinden BOM patlat
   - Her hammadde için ihtiyaç miktarını hesapla (üretilen × BOM ratio)
   - `stokHareketler`'da bu log için `tip='cikis', logId=l.id, malkod=hammadde` var mı?
   - Yoksa → eksik kayıt → ekle

3. **Fire kayıtları:** Her `fireLogs` için:
   - `stokHareketler`'da `fireId=f.id` var mı?
   - Yoksa → ekle

**Kabul kriteri:** `dryRun=true` ile çalışıp raporu önizleyebilmeli. Onaydan sonra `dryRun=false` ile gerçek insert.

### Görev 3.1.2 — Mevcut Hareketleri Silme YASAK

**Önemli kural:** Bu fonksiyon mevcut stok hareketlerini **silmez veya değiştirmez**. Sadece **eksik olanları ekler**.

Çift kayıt riski: Aynı log için zaten hareket varsa atla. Kontrol: `logId` + `tip` kombinasyonu kontrolü.

### Görev 3.1.3 — Audit Log

Her `stokOnar()` çalıştırıldığında bir kayıt:

```sql
CREATE TABLE stok_onar_logs (
  id           uuid PRIMARY KEY,
  calistirildi timestamptz DEFAULT now(),
  calistiran   text NOT NULL,
  taran_log    integer,
  eklenen_giris integer,
  eklenen_cikis integer,
  detay        jsonb           -- StokOnarRapor.eklenenHareketler
);
```

---

## Faz 3.2 — UI

### Görev 3.2.1 — "Stok Onarım" Butonu

`pages/Data.tsx` (Veri Yönetimi sayfası) — sadece admin'e görünür.

Yeni section:
```
🛠 Stok Onarım

Üretim loglarına bakarak eksik stok hareketlerini geriye dönük oluşturur.
Mevcut kayıtlar etkilenmez.

Son çalıştırma: 15.04.2026 14:30 — buket
   → 142 log tarandı, 8 eksik kayıt eklendi.

[Önizleme (Dry Run)]   [Çalıştır]
```

### Görev 3.2.2 — Önizleme Modal'ı

Dry run sonucu modal'da gösterilir:

```
Tarama tamamlandı.

📊 Sonuç:
   Taran log: 1,247
   Eksik giriş: 3
   Eksik çıkış: 8
   Toplam: 11 hareket eklenecek

📋 Detay:
   ✓ M-2026-001 — Üretim girişi (50 adet) — eklenecek
   ✓ S275 — Stok çıkışı (12.5 m) — eklenecek
   ...

[İptal]   [Onayla ve Çalıştır]
```

### Görev 3.2.3 — Çalıştırma Sonrası

İşlem tamamlanınca toast: "✓ X hareket eklendi" + audit log'a kayıt + sayfa yenilenir.

**Geri alma yok:** Kullanıcı yanlışlıkla çalıştırırsa → İş Emri #2 ile yedekten geri alır.

---

## Faz 3.3 — Test

### Görev 3.3.1 — Birim Test

`src/lib/stok-onar.test.ts`:
- Mock veri: 5 log + 3 eksik hareket
- `stokOnar({ dryRun: true })` → 3 hareket önizlemesi
- `stokOnar({ dryRun: false })` → 3 insert
- Tekrar çalıştır → 0 yeni hareket (idempotent)

### Görev 3.3.2 — E2E

`test/e2e/stok-onar.spec.ts`:
- Test verisi: 1 üretim log (manuel insert), `stokHareketler` boş
- Stok Onarım çalıştır → 1 giriş, N çıkış kaydı oluşmuş mu?

---

## GENEL UYARILAR (HER ÜÇ BÖLÜM İÇİN)

1. **CLIENT_ID:** Tüm INSERT'lerde `__client: CLIENT_ID` (realtime echo prevention).

2. **RBAC:**
   ```typescript
   'order_bulk_import',  // Toplu sipariş yükleme
   'wo_print',           // İş emri PDF
   'sevk_print',         // Sevk irsaliyesi PDF (#4'te de var, yine eklenebilir)
   'stok_onar',          // Stok onarım (sadece admin)
   ```

3. **PDF font dosyaları:** `public/fonts/` klasörüne Inter veya Open Sans Regular + Bold konacak. Lisans Apache 2.0 / SIL OFL — kullanım serbest.

4. **Excel kütüphanesi:** UYS v3'te `xlsx` (SheetJS) zaten dynamic import edilmiş olmalı. Yeni kütüphane eklenmemeli.

5. **Migration sırası:**
   - Bölüm 1: Yeni tablo yok, sadece kod
   - Bölüm 2: Yeni tablo yok, font dosyası ekleme
   - Bölüm 3: `stok_onar_logs` tablosu

6. **Stok Onarım çok dikkatli kullanılmalı** — başlamadan önce manuel yedek alınmalı (İş Emri #2).

---

## ÇIKTI BEKLENTİSİ

Her bölüm/görev için:
- Tam dosya içerikleri (algoritma + UI + PDF komponenti + test)
- Migration SQL (sadece Bölüm 3)
- Birim test + E2E test
- CHANGELOG

**Faz sırası önerisi:** 
1. Bölüm 1 (Toplu Sipariş — bağımsız, hızlı kazanım)
2. Bölüm 3 (Stok Onarım — küçük ama önemli)
3. Bölüm 2 (PDF — zaman alıcı, en sona)

**Tag önerileri:**
- Bölüm 1: `v15.24.0`
- Bölüm 3: `v15.24.1`
- Bölüm 2: `v15.25.0` (PDF tamamlandı)
