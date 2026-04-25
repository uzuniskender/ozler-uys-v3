# İŞ EMRİ #4 — UYS v3 Sevkiyat Oluşturma Formu

## Bağlam

UYS v3'te `/shipment` sayfası mevcut (Sevkiyat → liste görünümü). Ancak **yeni sevkiyat oluşturma formu YOK**. Eski monolit UYS'te (`ozleruretim` repo) sevkiyat oluşturma çalışıyor:
- Sipariş bazlı miktar kontrolü (siparişten ne kadar sevk edildi, kalan ne)
- Aşım engeli (sipariş miktarını aşan sevkiyat reddedilir)
- Siparişsiz sevk uyarısı (mamul stoktan + sipariş bağlantısız sevk)
- Otomatik stok çıkışı (`stokHareketler` insert)
- Sevk irsaliyesi numarası otomatik

Bu olmadan UYS v3'ten sevkiyat yapılamaz — kullanıcı sevkiyatı eski sistemde oluşturup v3'te listeleyemez (iki sistem ayrı veritabanı).

**Hedef:** UYS v3 `/shipment` sayfasına "Yeni Sevkiyat" formu eklemek + sipariş bazlı miktar kontrolü ile entegre etmek.

---

## YAKLAŞIM

İki farklı sevkiyat tipi destek olmalı:
1. **Sipariş bazlı sevk** — bir veya daha fazla siparişin satırlarından mamul gönderme
2. **Siparişsiz sevk** — mamul stoktan doğrudan müşteriye (örn. iade, numune, demo)

Her sevkiyat → ilgili stoklardan otomatik **çıkış hareketi** oluşturulur. Stok yetersizse engellenir.

---

## KORUNACAK ÖZELLİKLER (DOKUNMA)

1. UYS v3'ün mevcut `/shipment` sayfası (liste görünümü, filtreler) — üstüne "Yeni Sevkiyat" butonu eklenecek
2. `sevkler` tablosu mevcut — yeni alanlar eklenecek ama mevcut yapı bozulmaz
3. RBAC — yeni action eklenecek
4. Realtime — `sevkler` ve `stokHareketler` zaten subscription'da

---

## FAZ 1 — VERİ MODELİ

### Görev 1.1 — `sevkler` Tablosu Genişletmesi

```sql
ALTER TABLE sevkler ADD COLUMN sevk_no text UNIQUE;          -- otomatik: SEV-2026-0001
ALTER TABLE sevkler ADD COLUMN tip text DEFAULT 'siparis';   -- 'siparis' | 'siparissiz'
ALTER TABLE sevkler ADD COLUMN musteri_kod text;
ALTER TABLE sevkler ADD COLUMN musteri_ad text;
ALTER TABLE sevkler ADD COLUMN sevk_tarihi date NOT NULL;
ALTER TABLE sevkler ADD COLUMN tasiyici text;                -- nakliyeci
ALTER TABLE sevkler ADD COLUMN plaka text;
ALTER TABLE sevkler ADD COLUMN aciklama text;
ALTER TABLE sevkler ADD COLUMN olusturan text;
ALTER TABLE sevkler ADD COLUMN olusturma timestamptz DEFAULT now();
```

### Görev 1.2 — Yeni Tablo: `sevk_satirlari`

Sevkiyatın hangi mamulden, hangi siparişe ait olduğunu satır bazında tutar:

```sql
CREATE TABLE sevk_satirlari (
  id            uuid PRIMARY KEY,
  sevk_id       uuid NOT NULL REFERENCES sevkler(id) ON DELETE CASCADE,
  order_id      uuid REFERENCES orders(id),       -- siparişsiz ise NULL
  order_satir_id uuid,                             -- sipariş içindeki satır
  malkod        text NOT NULL,
  malad         text NOT NULL,
  miktar        numeric NOT NULL CHECK (miktar > 0),
  birim         text DEFAULT 'adet',
  __client      text
);
CREATE INDEX idx_sevk_satir_sevk ON sevk_satirlari(sevk_id);
CREATE INDEX idx_sevk_satir_order ON sevk_satirlari(order_id);
```

### Görev 1.3 — Sipariş Bazlı Kalan Hesabı (View)

Performans için view:

```sql
CREATE OR REPLACE VIEW v_order_sevk_kalan AS
SELECT 
  o.id AS order_id,
  o.siparis_no,
  o.musteri,
  m.malkod,
  m.malad,
  SUM(m.adet) AS siparis_miktari,
  COALESCE(SUM(s.miktar), 0) AS sevk_edilen,
  SUM(m.adet) - COALESCE(SUM(s.miktar), 0) AS kalan
FROM orders o
JOIN order_satirlari m ON m.order_id = o.id
LEFT JOIN sevk_satirlari s ON s.order_id = o.id AND s.malkod = m.malkod
GROUP BY o.id, o.siparis_no, o.musteri, m.malkod, m.malad;
```

**Kabul kriteri:** View'den okunan kalan miktar, manuel hesaplanan miktarla eşleşmeli (3 örnek senaryoda doğrulama).

### Görev 1.4 — RBAC

```typescript
'sevk_create',     // sevkiyat oluşturma
'sevk_edit',       // mevcut sevkiyat düzenleme
'sevk_delete',     // sevkiyat silme (stok geri alımı dahil)
'sevk_print',      // irsaliye yazdırma (PDF — İş Emri #5'le entegrasyon)
```

### Görev 1.5 — Sevk No Generator

`src/lib/sevk-utils.ts`:

```typescript
export async function nextSevkNo(): Promise<string>
// Format: SEV-{YYYY}-{NNNN} (örn. SEV-2026-0042)
// Yıl başında sayaç sıfırlanır
```

Mantık: O yıla ait son sevk numarasını bul → +1 → 4 hane padding.

---

## FAZ 2 — UI: SEVKİYAT OLUŞTURMA FORMU

### Görev 2.1 — "Yeni Sevkiyat" Butonu

`pages/Shipment.tsx`'e header'a buton eklenecek:

```tsx
{can('sevk_create') && (
  <button onClick={() => setShowForm(true)}>
    <Plus size={14} /> Yeni Sevkiyat
  </button>
)}
```

### Görev 2.2 — Sevkiyat Formu Modal

`components/SevkiyatModal.tsx` — büyük modal (max-w-4xl, full height responsive).

**Form akışı 3 adımlı stepper:**

#### **Adım 1: Genel Bilgiler**

- **Sevkiyat tipi** (radio): "Sipariş Bazlı" / "Siparişsiz (Stok Çıkışı)"
- **Müşteri** (sipariş bazlı seçildiğinde otomatik dolar; siparişsizde manuel arama)
- **Sevk tarihi** (date — default bugün)
- **Taşıyıcı** (text)
- **Plaka** (text)
- **Açıklama** (textarea — opsiyonel)

#### **Adım 2: Kalemler**

**A) Sipariş bazlı seçildiyse:**

Üst kısım: Müşterinin **açık siparişleri** listelenir (kalanı > 0 olanlar).

```
☐ SIP-2026-001 — Müşteri X — Termin: 30.04.2026
   ├ Profil 100×50×3mm — Sipariş: 100, Sevk: 40, Kalan: 60
   └ Profil 80×40×2mm — Sipariş: 50, Sevk: 0, Kalan: 50
```

Kullanıcı checkbox ile satır seçer + miktar girer.

**Validasyon:**
- Girilen miktar > kalan → kırmızı hata
- Girilen miktar > anlık stok → kırmızı hata + "Stokta sadece X var"

**B) Siparişsiz seçildiyse:**

Mamul arama input'u + dropdown (mamul stoklu malzemeler arasından seçim).

Eklenen her kalem:
- Malkod + adı (otomatik)
- Miktar input
- Anlık stok bilgisi (yanında)
- Sil butonu

#### **Adım 3: Önizleme + Onay**

- Sevkiyat özeti (irsaliye taslağı görünümünde)
- Toplam kalem sayısı + toplam miktar
- ⚠️ **Siparişsiz sevkiyat ise:** "Bu sevkiyat herhangi bir siparişe bağlı değil. Stok doğrudan düşülecek. Devam etmek istiyor musunuz?" uyarısı
- "Onayla ve Kaydet" butonu

### Görev 2.3 — Submit Mantığı

`saveSevkiyat()` fonksiyonu:

1. **Sevk no üret:** `nextSevkNo()`
2. **Stok kontrolü:** Her kalem için anlık stok ≥ miktar mı?
   - Hayır → işlemi iptal et + hata mesajı
3. **Atomic insert:**
   - `sevkler` tablosu → INSERT (ana kayıt)
   - `sevk_satirlari` → INSERT (her kalem için)
   - `stokHareketler` → INSERT (her kalem için `tip='cikis', aciklama='Sevkiyat: SEV-YYYY-NNNN'`)
4. **Realtime event:** `__client: CLIENT_ID` her insert'te

**Kabul kriteri:** İşlem yarıda kesilirse (network) sevk kaydı olup stok hareketi olmaması durumu YASAK. İdeal: tek RPC fonksiyonu (Supabase `rpc('create_sevk', ...)`) ile transactional.

### Görev 2.4 — Sevk No Formatı + Sıralama

Liste sayfasında sevk no görünür (kolon eklenecek). Sıralama default: tarih desc.

---

## FAZ 3 — DETAY VE DÜZENLEME

### Görev 3.1 — Sevkiyat Detay Görünümü

Liste'de bir satıra tıklanınca **detay modal** açılır (düzenleme yerine önce read-only):

- Sevk no + tarih + müşteri + tip
- Kalemler tablosu (malkod, ad, miktar)
- Hangi siparişlerden geldiği (sipariş bazlı ise)
- Oluşturan + oluşturma tarihi
- Açıklama, taşıyıcı, plaka

Sağ üstte aksiyonlar:
- **İrsaliye Yazdır** (PDF — İş Emri #5'in çıktısı)
- **Düzenle** (`can('sevk_edit')` + sadece bugün oluşturulmuşsa)
- **İptal Et** (`can('sevk_delete')` + onay + stok geri alımı)

### Görev 3.2 — Sevkiyat Düzenleme

**Kısıt:** Bir sevkiyat ancak **24 saat içinde** ve **henüz fatura kesilmemişse** düzenlenebilir.

Düzenleme modal'ı oluşturma modal'ının aynısı + farkı:
- Tip değiştirilemez
- Miktar değiştirilebilir → stok hareketleri güncelleştirilir
- Yeni kalem eklenebilir → ek stok çıkışı
- Kalem silinebilir → ilgili stok hareketi geri alınır

**Kabul kriteri:** Düzenleme sonrası stok dengesi tutarlı olmalı (eski miktar geri alındı + yeni miktar düşüldü).

### Görev 3.3 — Sevkiyat İptali

İptal modal'ı:
- "Bu sevkiyat iptal edilecek. Stok hareketleri geri alınacak. Onaylıyor musunuz?"
- İptal nedeni textarea (opsiyonel)
- Onay → `sevkler` durumu `iptal` + `stokHareketler` ters insert (`tip='giris', aciklama='Sevkiyat iptal: SEV-...'`)

**Önemli:** Soft delete yapılmıyor — iptal de bir kayıt (`durum='iptal'`). Geri alınabilir tarih izlemesi için.

---

## FAZ 4 — TEST

### Görev 4.1 — Playwright E2E

`test/e2e/sevkiyat.spec.ts`:

**Senaryo 1 — Sipariş Bazlı:**
1. Test siparişi oluştur (2 ürün, mamul stoklarına test verisi)
2. Sevkiyat formu aç → sipariş bazlı seç
3. Müşteriyi seç → sipariş listesi yüklenir
4. Bir satırı seç + miktar gir
5. Önizleme → Onayla
6. `sevkler` ve `sevk_satirlari` insert'lerini doğrula
7. `stokHareketler` çıkış kayıtlarını doğrula
8. Sipariş kalan miktarı güncellendi mi?

**Senaryo 2 — Siparişsiz:**
1. Mamul stoklu malzeme seç
2. Miktar gir → kaydet
3. Stok düştü mü?
4. Sipariş bağlantısı NULL mu?

**Senaryo 3 — Aşım Engeli:**
1. Sipariş kalan: 50
2. Sevk miktarı: 60
3. Form submit → hata mesajı görünmeli, kayıt oluşmamalı

**Senaryo 4 — İptal:**
1. Sevkiyat oluştur → stok düştü
2. İptal et
3. Stok geri geldi mi?
4. Sipariş kalan miktarı geri yükseldi mi?

### Görev 4.2 — Birim Test

`src/lib/sevk-utils.test.ts`:
- `nextSevkNo()` — sıralı, 4 hane, yıl bazlı reset
- View hesaplaması — örnek veri ile

---

## GENEL UYARILAR

1. **Stok kontrolü submit ANINDA tekrar yapılmalı** — kullanıcı formu açtıktan sonra başka biri stoktan çıkarmış olabilir (race condition). RPC fonksiyonu içinde son stok kontrolü.

2. **Müşteri kayıtları:** UYS v3'te `customers` tablosu zaten var. Yeni müşteri eklenebiliyor mu kontrol et — yoksa hızlı ekleme butonu (formdan ayrılmadan).

3. **Birim:** Mamul birimleri farklı olabilir (adet, kg, m). `materials` tablosundaki `birim` alanı kullanılmalı. UI'da birim göster.

4. **Sevk irsaliyesi PDF:** İş Emri #5'in kapsamında. Bu iş emrinde sadece "İrsaliye Yazdır" butonu placeholder olarak konsun, PDF üretimi ayrı.

5. **Çoklu para birimi yok** — şu an TRY varsayılıyor. İhracat sevkiyatları için EUR/USD desteği gelecekte eklenebilir, şimdilik kapsam dışı.

6. **CBAM verileri:** İhracat sevkiyatlarında CBAM raporlama için CN code, ağırlık (kg) gibi bilgiler gerekiyor (Buket'in çalıştığı konu). Bu alanlar **opsiyonel** olarak eklenmeli, dolu ise CBAM raporuna otomatik akar:

```sql
ALTER TABLE sevkler ADD COLUMN cn_code text;        -- 73084000 vb.
ALTER TABLE sevk_satirlari ADD COLUMN agirlik_kg numeric;
```

7. **Migration sırası:** 1.1 → 1.2 → 1.3 → 1.5 → 1.4 → Faz 2 → Faz 3 → Faz 4

---

## ÇIKTI BEKLENTİSİ

Her görev için:
- Migration SQL (RPC fonksiyonu dahil)
- Tam dosya içerikleri
- View doğrulama testi
- E2E test (4 senaryo)
- Birim test
- CHANGELOG

**Tag önerisi:** `v15.23.0` (bu iş emri tamamlandığında).
