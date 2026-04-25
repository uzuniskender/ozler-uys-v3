# Faz B — Sipariş Termin Farkındalığı

**Başlangıç:** 20 Nisan 2026 · v15.21 sonrası
**Durum:** Planlandı, başlamadı

## Amaç

v15.21'de her sipariş kaleminin kendi termini oldu (`urunler[].termin`). Ama bu terminler şu an sadece sipariş listesinde rozet olarak görünüyor; üretim akışında (İE, MRP, kesim) kullanılmıyor.

Faz B'nin hedefi: **termin bilgisinin sipariş satırından aşağıya doğru yayılması.**

Sipariş kalemi → İş emri → Kesim planı → MRP → Tedarik

Her aşamada "ne zaman lazım" bilgisi korunacak, operatör planlama kararlarında bu bilgiye bakabilecek.

---

## Parça 1 — İş emri terminleri

**Kapsam:** En küçük ve en temel parça. Diğer iki parçanın altyapısı.

**DB değişikliği:**
- `uys_work_orders` tablosuna `termin text` kolonu ekle (nullable, mevcut kayıtlarda NULL kalır)
- Index gerekmez (kesim/MRP tablodan küçük aralıkla okur, termin üzerinde sorgu atılmaz)

**Kod değişikliği:**
- `src/features/production/autoChain.ts`
  - `buildWorkOrders(orderId, siparisNo, rcId, adet, recipes, **termin?**)` imzasına `termin` ekle
  - INSERT'te `termin` kolonu olarak yaz
- `src/pages/Orders.tsx`
  - OrderFormModal `save`: her kalem için `buildWorkOrders(..., kalem.termin)` geçir
  - OrderDetailModal `yenidenCalistir`: kalemleri dolaşırken kendi terminleriyle çağır
  - BulkOrderImportModal: kalem terminini propagate et
- `src/types/index.ts`
  - `WorkOrder` interface'ine `termin: string` (optional olmayan, '' default)
- `src/pages/WorkOrders.tsx`
  - Liste tablosuna Termin sütunu (Sipariş No'dan sonra)
  - Geciken İE'ler için kırmızı vurgulama (termin < bugün ve pct < 100)
  - Filtrelere "Geciken" seçeneği

**Test:**
- Çoklu kalem siparişi → her kalemin termin kendi İE'lerine yansımış mı?
- Eski İE'lerde termin NULL, UI'da "—" göstermeli
- "Yeniden Çalıştır" sonrası yeni İE'ler doğru termini almalı

**Tahmini süre:** 30-45 dakika

---

## Parça 2 — MRP termin-gruplu hesap

**Kapsam:** Orta zorluk. Üretim tedarik planlamasının temeli.

**Mevcut durum:**
`hesaplaMRP()` fonksiyonu şu an "tüm İE'leri topla, toplam ihtiyaç çıkar" mantığında. Örnek çıktı:
```
sac X: brüt 500 kg · stok 200 · net 300 kg
```

**Yeni hali:**
Terminlere göre gruplanmış çıktı:
```
sac X:
  2026-05-15 gerekli 300 kg
  2026-06-01 gerekli 200 kg
  stok 200 (ilk terminden düşer)
  → 15 Mayıs'a 100 kg net, 1 Haziran'a 200 kg net
```

**Kod değişikliği:**
- `src/features/production/mrp.ts`
  - `MrpRow` interface'ine `termin: string` alanı eklensin
  - Malzeme ihtiyaçları İE terminine göre gruplansın (aynı malkod + aynı termin tek satır)
  - Stok tahsisi **FIFO termin sırasına göre**: en yakın termine önce verilir
  - Sonuç termine göre sıralanmış döner
- `src/pages/Orders.tsx` — OrderDetailModal MRP sekmesi
  - Tabloda Termin sütunu ekle
  - Geciken satırları vurgula (termin < bugün)
  - Excel export'a termin sütunu ekle
- `src/features/production/mrp.ts` — `mrpTedarikOlustur`
  - Tedarik kaydına `teslim_tarihi = termin` yaz (uys_tedarikler zaten var)
- `src/pages/MRP.tsx` (varsa ayrı sayfa) — aynı görsel güncellemeler

**Test:**
- 2 kalemli sipariş, farklı terminli, ortak hammadde → MRP 2 satır dönmeli (kalem başı bir termin grup)
- Stok 1 kalemi karşılar, 1 kalemi karşılamaz → net ihtiyaç sadece eksik olan terminde

**Tahmini süre:** 1.5-2 saat (mrp.ts refactor ciddi iş)

**Riskler:**
- `hesaplaMRP` birden fazla yerden çağrılıyor — imza değişirse tüm çağrı yerleri güncellenmeli
- FIFO tahsis mantığı test edilmeli (yanlış tahsis stok yönetiminde sorun çıkarır)

---

## Parça 3 — Kesim planında manuel kalem seçimi

**Kapsam:** UI ağırlıklı. DB'ye dokunmaz.

**Mevcut durum:**
Kesim planı otomatik oluşturulur (açık İE'lerden), operatörün müdahale şansı sınırlı.

**Yeni hali:**
- "Kesim planına ekle" butonu → modal açılır
- Modal'da tüm açık İE'ler listelenir
- Her satır: checkbox | İE No | Ürün | Adet | **Termin** | Durum
- Filtreler: Termin aralığı, Ürün tipi, Tümünü seç
- Kırmızı: termini geçmiş | Sarı: termin yakın (≤7 gün) | Gri: ileride
- Operatör istediğini seçer → seçilenler kesim planına eklenir
- "İleri termin uyarısı": bugünden 30+ gün sonra termini olan bir İE seçilirse confirm modal çıkar ("bu İE 25 Haziran'a, bu kadar erken kesmek istediğinize emin misiniz?") — ama blokajlamaz

**Kod değişikliği:**
- `src/pages/CuttingPlans.tsx`
  - Yeni component: `CuttingPlanIeSelectorModal`
  - Mevcut "yeni plan oluştur" akışına entegre
- `src/features/production/cuttingPlan.ts` (varsa — yoksa CuttingPlans.tsx içinde)
  - `olusturCuttingPlan(...)` fonksiyonuna seçili İE ID listesi parametresi ekle
  - Otomatik topla modu geriye uyumlu: ID listesi boşsa eski mantıkla devam

**Test:**
- Çok kalemli sipariş oluştur, farklı terminlerle → kesim modal'da hepsi listelenmeli
- Sadece en yakın terminli olanı seç → plan sadece o İE'ye göre kurulmalı
- İleri termin seçince uyarı çıkmalı, onaylayınca eklenmeli

**Tahmini süre:** 2-3 saat

---

## Sıra ve önerilen oturum bölümü

| Oturum | İçerik | Süre |
|---|---|---|
| 1 | Parça 1 (İE terminleri) | 30-45 dk |
| 2 | Parça 2 (MRP gruplu) | 1.5-2 saat |
| 3 | Parça 3 (Kesim UI) | 2-3 saat |

Her oturum sonunda canlıda test + commit + push + tag. Yarım bırakmayız.

---

## Notlar

- DB değişikliği sadece Parça 1'de (tek kolon ekleme, idempotent SQL ile).
- Eski veriler (termin'i olmayan İE'ler, eski MRP sonuçları) UI'da "—" gösterecek, hata vermeyecek.
- Çoklu kalem + farklı termin senaryosu test veritabanında önceden hazır olmalı (v15.21 test ederken oluşturduğun test siparişleri kullanılabilir).
