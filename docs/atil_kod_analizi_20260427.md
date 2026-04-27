# Atıl Kod Analizi — UYS v3 (27 Nisan 2026)

**Hazırlayan:** Claude (oturum sonu, İş Emri #13 14/22 madde sonrası)
**Amaç:** İş Emri #13 refactor'ünden sonra kod tabanında oluşan atıl kod, duplicate ve eski geriye uyumluluk kayıtlarının envanteri. Yarınki temizlik oturumuna referans.

---

## A) Saf Dead Code (silinebilir, ölü)

### A1. `WorkOrders.tsx` — `NewIEModal` component'i

- **Konum:** `src/pages/WorkOrders.tsx` line ~610-728 civarı (~120 satır)
- **Durum:** v15.57'de UI butonu kaldırıldı, render kaldırıldı, ama component tanımı dosyada kaldı
- **Üreten kod:** `IE-MANUAL-{Date.now().toString(36).toUpperCase()}` formatında manuel İE oluşturuyor
- **Kullanan yer yok**
- **Karar:** Sil. Eğer ileride Orders.tsx'in OrderFormModal'ında "Tekil İE" tikinin başka davranışa ihtiyacı olursa, mantığı oradan al.

### A2. `MRP.tsx` — Bağımsız YM İE state ve hesapları

- **Konum:** `src/pages/MRP.tsx` line ~22-106 arası
- **Durum:** v15.59'da UI render kaldırıldı, state/hesaplama bırakıldı (yorum: "ölü kod, ileride temizlenir")
- **Atıl olanlar:**
  - `selectedYMs`, `setSelectedYMs` state
  - `showYMTamamlanan`, `setShowYMTamamlanan` state
  - `mrpDoneYMs` useMemo
  - `ymIEs` useMemo
  - `ymTamamSayisi` useMemo
  - `toggleYM` fonksiyonu
- **Toplam:** ~30 satır
- **Karar:** Sil.

### A3. `mrp.ts` — Rezerve Sistemi (BÜYÜK)

**Bu en büyük atıl bölüm.** v15.63'te `stokPool` artık fiziksel stok kullanıyor — rezerve düşürmesi kaldırıldı. Ama rezerve kayıt mekanizması hala çalışıyor (DB'ye yazıyor ama kimse okumuyor).

**Atıl fonksiyonlar:**
- `rezerveYaz(orderId, mrpRows)` — Orders.tsx ve mrp.ts içinde çağrılıyor (içeride DB INSERT)
- `rezerveSil(orderId)` — sipariş silindiğinde
- `rezerveleriSenkronla()` — Topbar/Orders'tan tetikleniyor
- `triggerRezerveSync()` — store fonksiyonu
- Tüm `mrpRezerve` parametreleri (hesaplaMRP imzasında, getStok'ta vb.)

**DB tarafı atıl:**
- `uys_mrp_rezerve` tablosu — yazılıyor ama okuyan yok
- `uys_orders.mrp_durum` hala kullanılıyor (bu **kalsın**, rezerve sistemi değil)

**⚠️ Kaldırma stratejisi (geriye dönüş zor):**
1. Önce kod düzeyinde çağrıları kaldır (rezerveYaz/Sil/leriSenkronla call'larını sil)
2. Fonksiyonları gövdesi boş bırak (`return 0` veya `return`) — caller'lar kırılmasın diye
3. 1-2 hafta üretimde sorunsuz çalıştığını gör
4. Sonra fonksiyonları tamamen sil + `uys_mrp_rezerve` tablosunu DROP et
5. Plus `triggerRezerveSync` store fonksiyonunu da kaldır

**Tahmini kazanç:** Yaklaşık 200+ satır kod, 1 DB tablosu, MRP hesabında %5-10 hız artışı.

### A4. `mrp.ts` — `mrpRezerve` ve `currentOrderId` parametreleri

- `hesaplaMRP(orders, ..., mrpRezerve, ..., currentOrderId)` imzasındaki bu iki parametre artık kullanılmıyor (rezerve düşürmesi kaldırıldı)
- Caller'lar hala parametreyi geçiyor — imza temizlenebilir
- A3 ile birlikte yapılır.

---

## B) Duplicate / Tekrarlanan Kod

### B1. İş Emri Açma — 2 Sayfada Var

**Mevcut durum (v15.57+):**
- `Orders.tsx` → "Yeni İş Emri" butonu → OrderFormModal (modal aynı sayfada)
- `WorkOrders.tsx` → "Yeni İş Emri" butonu → `navigate('/orders?yeni=1')` (sayfa değiştir, sonra modal)

**Sorun:** WorkOrders'tan tıklarken sayfa değişimi yaşanıyor. UX gereksiz.

**Karar adayları:**
1. **Adayı 1:** WorkOrders.tsx'te de OrderFormModal'ı render et (modal direkt açılır, sayfa değişmez)
2. **Adayı 2:** Orders.tsx'teki butonu kaldır, sadece WorkOrders'ta dursun (mantıken İE = WorkOrder)
3. **Adayı 3:** Orders.tsx'i bırak, WorkOrders'taki butonu kaldır (sipariş listesinden başlamak daha doğal)

**Önerim:** Adayı 1 — iki yerde de modal direkt açılsın, sayfa değişimi olmasın.

### B2. statusUtils.ts vs Topbar.tsx — Kesim Hesabı Duplicate

- `getKesimEksikWoIds` (statusUtils.ts) — Orders.tsx'te v15.52b'de kullanıldı, doğru helper
- Topbar.tsx'te benzer mantık ayrı kod (memory'de "kod tekrarı kabul, ileride konsolide edilir")
- **Karar:** Topbar'ı statusUtils helper'larına taşı.

### B3. Topbar `FlowModal` vs `ActiveFlowDecisionModal`

- `FlowModal` (Topbar) — yarım iş listesini gösterir, devam/iptal aksiyonları
- `ActiveFlowDecisionModal` — yeni iş emri açılırken karar modalı
- İkisi farklı amaçla. **Kalsın**, duplicate sayılmaz.

---

## C) Eski / Geriye Uyumluluk Kod

### C1. `OrderFormModal` — Eski Tek-Kalem Desteği

- Konum: `Orders.tsx` line ~411-420
- `initial.urunler[]` yoksa `initial.receteId/adet` kullanır
- Çok eski sipariş kayıtları için
- **Karar:** Migration yapılırsa silinebilir. Kontrol: aktif siparişlerde `urunler[]` boş olan var mı?

### C2. `DataManagement.tsx` — Eski JSON Yedek Butonları

- v15.53 Adım 5'te `/backup` sayfasına yönlendirme banner'ı eklendi
- Eski "JSON Yedek" / "JSON Geri Yükle" butonları korundu
- Kullanıcı yeni sistemi tercih edecek
- **Karar:** 1-2 ay sonra (yeni sistem oturduğunda) eski butonları kaldır.

### C3. `uys_sevkler.kalemler` (jsonb) — Eski Sevk Modeli

- v15.54 Sevk Faz 1'de yeni `uys_sevk_satirlari` tablosu açıldı
- Eski `kalemler jsonb` kolonu dokunulmadı (geriye uyum)
- Yeni sevkler yeni tabloya yazılacak (Faz 2'de)
- **Karar:** Sevk Faz 2 UI yazıldıktan sonra eski kayıtları migration ile yeni tabloya taşı, jsonb kolon DROP.

### C4. `uys_operators.sifre` (plain text)

- v15.52a'da lazy migration başladı: her başarılı login plain → `cyrb53` hash dönüşümü
- 1-2 hafta sonra (lazy migration tamamlanınca) plain `sifre` kolonu DROP edilebilir
- **Kontrol sorgusu:**
  ```sql
  SELECT count(*) FROM uys_operators WHERE aktif IS NOT FALSE AND sifre IS NOT NULL AND sifre <> '';
  -- 0 ise plain sifre tamamen hash'lenmiş, DROP edilebilir.
  ```

---

## D) `#/test` Sayfası — Ne İşe Yarıyor?

URL: `https://uzuniskender.github.io/ozler-uys-v3/#/test`

### Gerçek Amacı

**Smoke test sayfası** — UYS'nin ana akışlarını otomatik test eden 12 adımlı senaryo:

1. Test sipariş aç (`test_run_id` ile işaretli)
2. Kesim planı oluştur
3. autoZincir çalıştır (MRP + tedarik)
4. Üretim girişi yap
5. Stok hareketlerini doğrula
6. Sevkiyat oluştur (Faz 2'de — şu an pasif)
7. Test verisini sil (`test_run_id` WHERE clause ile temizleme)

**Ne zaman eklendi:** v15.31 bar model migration audit sırasında (memory).

### `test_run_id` Kolonu

DB'de bazı tablolarda var: `uys_kullanicilar`, `uys_acik_barlar`, `uys_mrp_rezerve`, `uys_sevkler` vb. Test verisini gerçek sahaya karışmadan temizlemek için.

### Pasife Alma Sebebi

Buket'in dediği "kullanılmadığı için pasife alıyorlar":

- GitHub Pages'in pasife alma kuralı yoktur (sürekli deploy)
- En olası: smoke test sayfası UI'da görünmüyor (Sidebar'da menü yok), kullanıcılar sayfanın varlığından haberdar değil

### Kullanım Değeri

**KALMASINDA FAYDA VAR. Şunlar için:**

- Yeni sürüm push'tan sonra "her şey çalışıyor mu?" hızlı kontrolü (~2 dk)
- Yeni Claude oturumda smoke test çalıştırarak "kod sağlam mı?" doğrulaması
- Bug raporu varsa, smoke test ile tekrarlanabilir senaryo
- Playwright e2e zaten var ama bu **manuel + görsel**

### Karar

Sidebar'a "Test" menüsü ekle ama sadece **admin** rolüne göster (`can('admin_only')` benzeri). Production'da gizlenebilir ama URL'den erişim kalsın. **Tamamen kaldırma — değer üretiyor.**

---

## E) Yarın için Öncelik Sırası

| Sıra | İş | Süre | Risk |
|---|---|---|---|
| 1 | Sağlık raporu auto-fix (Kontrol 3, 5, 6) | 5 dk | Düşük |
| 2 | **Rezerve sistemini kod düzeyinde kapat** (A3) | 1 saat | Orta |
| 3 | `NewIEModal` component sil (A1) | 5 dk | Düşük |
| 4 | MRP.tsx — ymIEs vs state'leri sil (A2) | 10 dk | Düşük |
| 5 | Sağlık Raporu Kontrol 11 (bar_acilis eksik) — manuel İE'ler için elle SQL düzelt veya akış geliştir | 30 dk - 2 saat | Orta |
| 6 | İş Emri açma duplicate (B1) — WorkOrders.tsx'e modal direkt render | 30 dk | Düşük |
| 7 | Topbar → statusUtils helper'larına taşı (B2) | 20 dk | Düşük |
| 8 | `/test` sayfasını sidebar'a admin-only menü olarak ekle | 15 dk | Düşük |
| 9 | (1-2 hafta sonra) `uys_mrp_rezerve` tablo DROP | 10 dk | Yüksek (geri dönüş yok) |
| 10 | (1-2 hafta sonra) `uys_operators.sifre` kolonu DROP | 10 dk | Yüksek (geri dönüş yok) |

---

## F) Genel Kod Sağlığı — İyi Tarafları

Kod tabanı genel olarak **çok iyi durumda**:

- ✅ §18 hijyen kuralları takip ediliyor (audit-schema, audit-columns hooks)
- ✅ Versiyonlama disiplinli (her commit v15.X)
- ✅ Memory'de §20 Tehdit Modeli var (RLS gap'i belgelenmiş)
- ✅ İş emri spec'leri repoda yazılı (`docs/is_emri/`)
- ✅ Realtime subscription'ları temiz
- ✅ Idempotent kayıt mantığı (F-21 + barModelSync)
- ✅ Test sayfası var (gözden kaybolduysa bile kod sağlam)

**Endişe verici tek nokta:** Rezerve sisteminin kaldırılması mimari karar — yarın bunu doğru planlamalıyız (geriye dönülmez).

---

## G) Bu Dokümanın Kullanımı

Bu doküman İş Emri #13 sonrası geçici envanter. Yarınki temizlik oturumunda **referans olarak** kullanılır. Her madde tamamlandıkça bu dosyada `~~A1. NewIEModal~~` gibi üstü çizilir veya satır silinir.

Dokümanın kalıcı bir referans değildir — temizlik bittiğinde silinebilir.

---

*Hazırlanma tarihi: 27 Nisan 2026 (akşam, oturum sonu)*
*Versiyon: v15.69 sonrası*
