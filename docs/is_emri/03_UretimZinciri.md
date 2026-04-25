# İŞ EMRİ #3 — UYS v3 Üretim Zinciri Otomasyonu

## Bağlam

Eski monolit UYS'te (`ozleruretim` repo) production planlamanın **kalbi** olan dört özellik UYS v3'e taşınmamış:

1. **autoZincir** — Sipariş → İE → Kesim Planı → MRP → Tedarik tek tıkla
2. **MRP Hesaplama Modal** — `renderMRPSonuc` (stok+açık tedarik brüt düşülerek net ihtiyaç)
3. **Kesim Planı Optimizasyon** — `_kesimPlanOlusturCore` (fire optimize, plan birleştirme, kesim artığı → otomatik malzeme kartı)
4. **Üst Bar Durum Göstergeleri** — `_updateZincirDurum` (KESİM 🔴/🟢, MRP 🔴/🟢, TEDARİK 🔴/🟢)

Bu dördü **birbirine bağımlı** — autoZincir MRP'yi çağırır, MRP kesim planını gerektirir, kesim planı durum göstergesini günceller. Tek iş emrinde toplandı.

UYS v3'te şu anda her adım manuel: sipariş gir → ayrı sayfada İE oluştur → ayrı sayfada kesim planı oluştur → ayrı sayfada MRP hesapla → ayrı sayfada tedarik aç. **Saatler süren bir iş**.

**Hedef:** Bu zinciri tek tıkla çalıştırmak ve her adımın durumunu üst barda görmek.

---

## EN ÖNEMLİ KURAL (BUKET'İN BOM REÇETE KURALI)

> **Hammadde seçimi:** En az fire, en çok parça. Her aday ham boy için:
> - `pieces = floor(raw_length / cut_length)`
> - `waste % = (raw_length - pieces × cut_length) / raw_length × 100`
> - **En çok parça veren** + **en az fire bırakan** seçilir.

Bu kural kesim planı optimizasyonunun temelidir — diğer chat bunu kesinlikle uygulamalı.

---

## KORUNACAK ÖZELLİKLER (DOKUNMA)

UYS v3'ün mevcut yapısı:
1. `pages/Cutting.tsx`, `pages/WorkOrders.tsx` mevcut — onların **üzerine** çalışılacak
2. `useStore` ve mapper'lar — yeni alanlar eklenebilir ama mevcut yapı bozulmaz
3. RBAC — yeni action'lar eklenecek ama eski yapı korunur
4. Realtime — `cuttingPlans`, `tedarikler` tabloları zaten subscription'da

---

## FAZ 1 — VERİ MODELİ + ALTYAPI

### Görev 1.1 — `cuttingPlans` Tablosu Genişletmesi

Mevcut `pt_kesim_planlari` (veya `cutting_plans`) tablosuna yeni alanlar:

```sql
ALTER TABLE cutting_plans ADD COLUMN ham_en numeric;            -- levha kesim için
ALTER TABLE cutting_plans ADD COLUMN ham_kalinlik numeric;
ALTER TABLE cutting_plans ADD COLUMN tip text DEFAULT 'boy';    -- 'boy' | 'levha'
ALTER TABLE cutting_plans ADD COLUMN durum text DEFAULT 'planlandi';  -- 'planlandi' | 'devam' | 'tamamlandi'
ALTER TABLE cutting_plans ADD COLUMN fire_kg numeric;
ALTER TABLE cutting_plans ADD COLUMN artik_malzeme_kod text;    -- artıktan oluşan malzeme kartı
```

Alt tablo: `cutting_plan_satirlar` (mevcut yapısı kontrol edilmeli, yoksa oluşturulacak):

```sql
CREATE TABLE IF NOT EXISTS cutting_plan_satirlar (
  id          uuid PRIMARY KEY,
  plan_id     uuid NOT NULL REFERENCES cutting_plans(id) ON DELETE CASCADE,
  ham_adet    integer NOT NULL,
  kesimler    jsonb NOT NULL,         -- [{parcaBoy, parcaEn, adet, woId}]
  fire_kg     numeric,
  durum       text DEFAULT 'planlandi'
);
```

### Görev 1.2 — `tedarikler` Tablosu Genişletmesi

```sql
ALTER TABLE tedarikler ADD COLUMN auto_olusturuldu boolean DEFAULT false;
ALTER TABLE tedarikler ADD COLUMN order_id uuid REFERENCES orders(id);  -- hangi sipariş için
ALTER TABLE tedarikler ADD COLUMN mrp_calculation_id uuid;              -- MRP run referansı
```

### Görev 1.3 — Yeni Tablo: `mrp_calculations`

MRP her çalıştığında bir snapshot saklanır:

```sql
CREATE TABLE mrp_calculations (
  id            uuid PRIMARY KEY,
  order_id      uuid REFERENCES orders(id),
  hesaplandi    timestamptz NOT NULL DEFAULT now(),
  hesaplayan    text NOT NULL,
  brut_ihtiyac  jsonb NOT NULL,         -- {malkod: miktar}
  stok_durumu   jsonb NOT NULL,         -- {malkod: stokta_olan}
  acik_tedarik  jsonb NOT NULL,         -- {malkod: acik_siparis}
  net_ihtiyac   jsonb NOT NULL,         -- {malkod: alinacak}
  durum         text NOT NULL DEFAULT 'beklemede'  -- beklemede | tamamlandi | iptal
);
CREATE INDEX idx_mrp_order ON mrp_calculations(order_id, hesaplandi DESC);
```

### Görev 1.4 — RBAC Permissions

```typescript
'mrp_calculate',     // MRP modal açma
'cutting_optimize',  // Kesim plan oluşturma
'auto_chain_run',    // autoZincir tetikleme
'tedarik_auto',      // Otomatik tedarik oluşturma
```

---

## FAZ 2 — KESİM PLANI OPTİMİZASYONU

### Görev 2.1 — Kesim Plan Algoritması (`src/lib/cutting-optimizer.ts`)

```typescript
interface CuttingInput {
  parcalar: Array<{
    woId: string
    boy: number      // mm
    en?: number      // levha için
    adet: number
    malkod: string
  }>
  hammaddeler: Array<{
    malkod: string
    boy: number
    en?: number
    stokAdet: number
  }>
}

interface CuttingPlan {
  satirlar: Array<{
    hammaddeKod: string
    hamAdet: number
    kesimler: Array<{ woId, parcaBoy, parcaEn?, adet }>
    fireMm: number
  }>
  totalFireKg: number
  artikMalzemeler: Array<{ kod, boy, en?, adet }>  // 50mm+ artık → yeni malzeme
}

export function optimizeCutting(input: CuttingInput): CuttingPlan
```

**Algoritma:**
1. Her parça için aday hammadde uzunluklarını listele
2. Her aday için `pieces = floor(raw_length / cut_length)` ve `waste %` hesapla
3. **En çok parça** veren + **en az fire** bırakanı seç
4. Greedy first-fit decreasing (büyükten küçüğe sıralayıp yerleştir)
5. **Fire optimize döngüsü** (max 50 iterasyon — `_maxLoop` sınırı):
   - Fire 50mm üzerinde olan satırlara, kalan parçalardan sığabilenleri ekle
6. Kalan **artık ≥ 50mm** ise → yeni malzeme kartı önerisi (örn. `ARTIK-{originalKod}-{boy}`)

**Kabul kriteri:** 5 farklı senaryo için birim test:
- 100 parça × 1m, hammadde 6m → fire % beklenen aralıkta
- Levha kesim (en × boy)
- Karışık boylar
- Stok yetersiz senaryosu
- Tek parça kalan artık (hesap doğru çalışmalı)

### Görev 2.2 — Kesim Plan Oluşturma UI

`pages/Cutting.tsx`'a yeni buton: **"⚙ Plan Oluştur"** (sayfa üstünde, mevcut listenin yanında).

Tıklanınca:
1. Sistem otomatik tarar: `wPct < 100` olan, kesim operasyonu içeren ve `planlananWoIds` listesinde olmayan WO'lar
2. Onay modal: "{N} adet WO için plan oluşturulacak" + örneklerin listesi
3. Onay → `optimizeCutting()` çalışır
4. Sonuç modal: planlanan satırlar + total fire % + artık malzeme önerileri
5. "Kaydet" → `cutting_plans` + `cutting_plan_satirlar` insert + WO'lar `_kesimPlanlandi=true` flag

### Görev 2.3 — Mevcut Plan ile Birleştirme

Yeni siparişler geldiğinde, **aynı hammaddeyi kullanan açık plan varsa** ona ekle (yeni plan açma).

`mevcutPlanCheck()` fonksiyonu:
1. Bu hammadde için durumu `planlandi` (henüz başlamamış) olan plan var mı?
2. Varsa → mevcut plana yeni satırlar ekle (CAPACITY check)
3. Kapasite yeterli değilse → ek satır olarak yeni plana

**Kabul kriteri:** Aynı hammaddeyle çalışan 3 farklı sipariş için 1 plan oluşur, 3 ayrı plan değil.

### Görev 2.4 — Kesim Artığı → Malzeme Kartı

Kesim tamamlandığında (durum `tamamlandi`):
- Plan satırlarındaki `fire_mm ≥ 50` olan parçalar → yeni malzeme kartı oluşturulur
- Kod formatı: `ARTIK-{originalMalkod}-{boyMm}` (örn. `ARTIK-S275-1240`)
- Otomatik `stokHareketler` INSERT (`tip='giris'`, `aciklama='Kesim artığı'`)

`syncKesimPlanlar()` fonksiyonu (eski sistemden):
- WO üretim loglarına bakarak plan satırlarının durumunu otomatik günceller
- Plan tüm satırları tamamlandıysa → `cutting_plans.durum = 'tamamlandi'` + artık malzemeler oluştur

---

## FAZ 3 — MRP HESAPLAMA

### Görev 3.1 — MRP Algoritması (`src/lib/mrp-calculator.ts`)

```typescript
interface MRPInput {
  orderId: string
  // BOM'lar, mevcut stok, açık tedarikler otomatik store'dan çekilir
}

interface MRPResult {
  brutIhtiyac: Map<string, number>   // BOM'dan patlatılmış tüm malzeme
  stokDurumu: Map<string, number>     // mevcut stok
  acikTedarik: Map<string, number>    // henüz gelmemiş tedarikler
  netIhtiyac: Map<string, number>     // alınacak miktar = brüt - stok - açık tedarik
  acikTedarikKalemler: Tedarik[]      // hangi sipariş bekliyor (referans)
}

export async function calculateMRP(orderId: string): Promise<MRPResult>
```

**Adımlar:**
1. Sipariş bul → urunler listesi
2. Her ürün için BOM patlat (`bomPatla()` mevcut → kullan)
3. Aynı malzemeyi kullanan farklı ürünler → topla (Map.merge)
4. Stok hareketlerini topla (giriş - çıkış) → her malzeme için anlık stok
5. Açık tedarikleri topla (durum != 'tamamlandi')
6. Net = max(0, Brüt - Stok - AçıkTedarik)

**Kabul kriteri:** Birim test ile doğrulama — 3 senaryo:
- Tüm malzemeler stokta → net = 0
- Hiç stok yok, tedarik yok → net = brüt
- Açık tedarik var → net düşüyor

### Görev 3.2 — MRP Modal (`components/MRPModal.tsx`)

Sipariş satırından "MRP Hesapla" butonu → modal açılır.

**Modal içeriği:**

A) **Üst sticky bar:** Sipariş no + müşteri + termin + "Yeniden Hesapla" butonu

B) **Sonuç tablosu:**

| Malkod | Adı | Brüt | Stokta | Açık Tedarik | Net | Aksiyon |
|--------|-----|------|--------|--------------|-----|---------|
| S275 | Profil 100×50×3mm | 250 m | 80 m | 50 m | **120 m** | ☑ Tedarik Aç |

- Net=0 olan satırlar yeşil (stok yeterli) — gizleme toggle'ı
- Net>0 olan satırlar — checkbox seçili gelir, "Tedarik Aç" butonuna bağlı

C) **Alt bar:**
- Toplam alınacak: X kalem, ~Y TL (eğer fiyat bilgisi varsa)
- "Seçilenler için Tedarik Aç" butonu

### Görev 3.3 — Otomatik Tedarik Oluşturma

`autoTedarikOlustur(mrpResult, selectedMalkods)`:
1. Her seçili malkod için `tedarikler` tablosuna INSERT
2. `auto_olusturuldu=true`, `order_id`, `mrp_calculation_id` referansları
3. Tedarikçi otomatik atama (varsayılan tedarikçi varsa) veya boş bırak (kullanıcı sonra atar)
4. Toast: "X kalem tedarik oluşturuldu"

**Kabul kriteri:** Aynı MRP iki kez çalıştırılırsa tedarik **çift oluşmaz** (önce mevcut açık tedarikler düşülür).

---

## FAZ 4 — autoZincir

### Görev 4.1 — `autoChain` Servisi (`src/lib/auto-chain.ts`)

```typescript
export async function autoChain(orderId: string, options?: {
  skipCutting?: boolean
  skipMrp?: boolean
  skipTedarik?: boolean
}): Promise<AutoChainResult>
```

Adımlar (sırayla):
1. **WO oluştur** — sipariş satırlarından WO'lar (mevcut `_buildWOs` mantığı)
2. **Kesim Planı** — `optimizeCutting()` + kaydet (skip varsa atla)
3. **MRP Hesapla** — `calculateMRP()` (skip varsa atla)
4. **Tedarik Aç** — `autoTedarikOlustur()` (skip varsa atla)

Her adımda:
- Hata olursa → diğer adımları çalıştırma, kullanıcıya hata göster
- İlerleme için event yayınla (UI bunu dinler)

### Görev 4.2 — autoZincir Progress Modal

Sipariş kaydedildikten sonra otomatik açılan modal:

```
⚙ Sipariş Zinciri Çalışıyor
Sipariş: SIP-2026-001

✅ 5 iş emri oluşturuldu
✅ Kesim planı: 2 plan oluşturuldu (fire %3.2)
⏳ MRP hesaplanıyor...
⏳ Tedarik bekliyor
```

Her adım sonunda ikon güncellenir (⏳ → ✅ veya ❌). Tüm adımlar bittiğinde modal kapanır + ana toast: "Zincir tamamlandı".

**Hata durumu:** Adım başarısız olursa modal açık kalır, "Devam Et" / "Atla" / "İptal" butonları çıkar.

### Görev 4.3 — Sipariş Kayıt Sonrası Tetikleme

`pages/Orders.tsx`'te yeni sipariş kaydedildiğinde:
- Mevcut: `INSERT INTO orders` → toast → liste yenilenir
- Yeni: `INSERT INTO orders` → modal: "autoZincir çalıştırılsın mı?" (Evet/Hayır + "Bu sipariş için sorma")
- Kullanıcı "Evet" → `autoChain(newOrderId)` tetiklenir

**Önemli:** "Bu sipariş için sorma" tercihi kullanıcı bazlı saklanır (`user_preferences` tablosu veya localStorage).

---

## FAZ 5 — ÜST BAR DURUM GÖSTERGELERİ

### Görev 5.1 — Üst Bar Component'i

`src/components/layout/Topbar.tsx`'a 3 badge eklenecek (sağ tarafta, kullanıcı adının solunda):

```
[ KESİM 🔴 3 ] [ MRP 🟢 0 ] [ TEDARİK 🔴 12 ]
```

Hesaplama mantığı (`useMemo` ile, store değişiminde otomatik recalc):

- **KESİM:** Kesim operasyonlu, `wPct < 100`, `iptal` değil, **planlanmış kesim planı yok** olan WO sayısı
- **MRP:** `mrpDurum != 'tamamlandi'` olan aktif sipariş sayısı  
- **TEDARİK:** `durum == 'beklemede'` olan tedarik kalemi sayısı

Renk:
- 🟢 (sayı = 0) → her şey yolunda
- 🟡 (sayı 1-5) → uyarı seviyesi
- 🔴 (sayı > 5) → acil dikkat

### Görev 5.2 — Tıklanabilir Badge'ler

- **KESİM** badge → `/cutting?filter=eksik` (planlanmamış WO'ları göster)
- **MRP** badge → `/orders?filter=mrp_eksik`
- **TEDARİK** badge → `/tedarikler?filter=beklemede`

### Görev 5.3 — Realtime Güncelleme

Topbar component'i `useStore`'a abone olur — `orders`, `workOrders`, `cuttingPlans`, `tedarikler` tablolarındaki her değişiklikte badge'ler otomatik güncellenir.

**Performans:** Badge hesaplama ağır olmamalı — `useMemo` ile cache'lenmeli, sadece ilgili tablolar değişince yeniden hesaplanmalı (deep comparison ile).

---

## FAZ 6 — TEST

### Görev 6.1 — Birim Testler

- `src/lib/cutting-optimizer.test.ts` — 5 senaryo (yukarıda belirtildi)
- `src/lib/mrp-calculator.test.ts` — 3 senaryo
- `src/lib/auto-chain.test.ts` — full chain senaryosu (mocked Supabase)

### Görev 6.2 — Playwright E2E

`test/e2e/auto-chain.spec.ts`:
1. Test sipariş oluştur (3 ürün, hepsi kesim gerektirir)
2. autoZincir tetikle
3. Progress modal ekran görüntüsü al
4. WO'ların oluştuğunu doğrula
5. Kesim planının oluştuğunu doğrula (fire % beklenen aralıkta)
6. MRP sonucunun doğruluğu (manuel hesaplanmış değerle karşılaştır)
7. Tedariklerin oluştuğunu doğrula
8. Üst bar badge'lerin güncel olduğunu doğrula

### Görev 6.3 — Performans Testi

100 WO'lu sipariş için autoZincir < 5 saniyede tamamlanmalı.

---

## GENEL UYARILAR

1. **Tek transaction değil**, ardışık async işlem. Her adımda hata olursa önceki adımlar geri alınmaz (rollback yok). Bunun nedeni: kullanıcı bazı adımları atlamak isteyebilir, transaction'a kilitlenmek isteyebilir. Hata durumu kullanıcıya net gösterilmeli.

2. **CLIENT_ID:** autoZincir'in tetiklediği INSERT'ler `__client: CLIENT_ID` taşımalı — diğer kullanıcıların ekranı realtime ile güncellenir, kendi başlatan da çift event almaz.

3. **MRP hesaplaması ağır olabilir** — büyük BOM'larda 1-2 saniye sürebilir. UI'da loading state göster.

4. **Concurrent autoZincir engelle:** Aynı sipariş için zincir çalışıyorken ikinci tetik atlatılmalı (lock mekanizması veya UI'da disabled).

5. **Yedek alma:** Bu kadar büyük değişiklik yapan bir özellik için kullanıcı **autoZincir öncesi otomatik manuel yedek** alma seçeneği sunulmalı (İş Emri #2 ile entegrasyon).

6. **Migration sırası:** Faz 1 (veri modeli) → Faz 5 (üst bar — sadece okuma) → Faz 2 (kesim) → Faz 3 (MRP) → Faz 4 (zincir). Üst bar erkenden görsel feedback verir.

---

## ÇIKTI BEKLENTİSİ

Her görev için:
- Migration SQL
- Tam dosya içerikleri (algoritma + UI + test)
- 5'er senaryolu birim test
- E2E test
- Performans benchmark sonuçları
- CHANGELOG

**Faz sırası:** 1 → 5 → 2 → 3 → 4 → 6

**Tag önerileri:**
- Faz 1+5 sonu: `v15.19.0`
- Faz 2 sonu: `v15.20.0` (kesim optimizasyonu)
- Faz 3 sonu: `v15.21.0` (MRP)
- Faz 4 sonu: `v15.22.0` (autoZincir tamamlandı)
- Faz 6 sonu: `v15.22.1` (test eklendi)
