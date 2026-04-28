# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 28 Nisan 2026 sabahı (oturum kapanışı)
**Son canlı sürüm:** v15.78
**İş Emri #13 durum:** 17/22 madde TAMAM, **v15.74/75/76 test geçti (S7/8/9 ALL_PASS)**

---

## YENİ OTURUM AÇILIŞINDA İLK ADIM

```
UYS v3 devamı. Bilgi Bankası açılış kuralı (§0):
docs/UYS_v3_Bilgi_Bankasi.md (özellikle §0, §18 ailesi, §19, §20, §21 MRP Formülü, §22, §23 28 Nis özeti) +
docs/DEVAM_NOTU.md +
docs/is_emri/00_BACKLOG_Master.md +
docs/is_emri/13_AnaAkisRefactor.md +
docs/atil_kod_analizi_20260427.md (A2 maddesi v15.78'de revize edildi — Bilgi Bankası §23'te detay)
oku.

Önceki chat silindi/silinecek — bilgilerin tamamı docs'ta.

Bugünkü ilk iş: Buket'in §23 sonundaki TODO listesinden seçeceği:
  1. MRP senaryoları konuşması (Buket anlatır, Claude sorar) — §21'deki olası senaryolar
  2. Madde 15 onay sistemi (rezerve değil, planlama onayı) — 3 aşamalı
  3. Madde 8+9 resmi durum string'leri (Plan Bekliyor / Üretilebilir)
  4. Madde 16 kesim artık ürün sorma (havuz mantığı + UI onayı)
  5. Senaryo 10 koşturup S10 ALL_PASS doğrulama (yapılmadıysa)
  6. Senaryo 3 adet bağımlılığı düzeltmesi (testRunner.ts:569)

Buket önceliği belirler.
```

---

## DÜN GECE YAPILANLAR (28 Nis sabahı)

### v15.77 — Test Senaryo 7/8/9 (TEST_20260428_01 → ALL_PASS)

3 sürümün test ispatı için 3 yeni senaryo:
- **S7** Sipariş Delta saf-fonksiyon (`siparisDelta` 12 alt-test, 2ms)
- **S8** Fire Telafi Recursive gerçek DB (10 adım, 5.7sn)
- **S9** Loglar Sayfası DB akışı (6 alt-test, 1.1sn)

`uys_activity_log` `TABLE_CASCADE`'e eklendi (testRun.ts).

### v15.78 — Manuel İE MRP Saha Bug Fix

Buket "bu teste güvenmiyorum" dedi — IE-MANUAL-MO9SDW3A 6740 adet hard block veriyordu, MRP göstermiyordu.

**Kök neden** (iki katmanlı):
1. `mrp.ts` ~satır 240: `if (ordIdSet) { if (!w.orderId || ...) return false }` — manuel İE'ler sipariş bazlı çağrıda atlanıyordu
2. v15.59'da MRP.tsx "Bağımsız YM" UI bölümü atıl kod sayılıp kaldırılmıştı (yanlıştı — manuel İE'lerin görünür tek yoluydu)

**Düzeltme:**
- `mrp.ts`: `secilenYMIds` `ordIdSet`'i bypass edebilir → UI explicit seçim her zaman dahil
- `MRP.tsx`: Manuel İE'ler sipariş kartlarıyla **aynı listede** ("STOK" rozetli sarı kenar)
- `splitSelected()` yardımcısı, `selectedOrders` set'inde ID tipini ayırır
- `topluTedarikOlustur` manuel İE seçili ise `order_id=null, not_='MRP — Manuel İE: <ieNo>'` ile tedarik açar
- **Senaryo 10**: 7 adım, MOD D = saha bug fix kanıtı (sipariş + manuel İE birlikte hesap)

Detay: Bilgi Bankası §23.

---

## MULTI-MACHINE NOTU

NB081'de Node yok → npm/build doğrulanmadı, GitHub Actions build'e güveniliyor (push'lar yeşil geçti). Yeni makine açılırsa ilk iş `node --version; npm --version`.

---

## KRİTİK UYARILAR

### 1. Senaryo 10 Henüz Koşturulmadı

v15.78 patch'i sahaya çıktı, sözel doğrulama (manuel İE kart görünüyor mu) yapıldı ama Senaryo 10 otomatik test JSON'u alınmadı. Gelecek oturumun ilk işi olabilir.

### 2. MRP Formülü Kuralı (§21) — DEĞİŞMEDİ

```
NET İHTİYAÇ = İHTİYAÇ - STOK - YOLDA
```

v15.78 manuel İE'leri ihtiyaç hesabına dahil etti — formül aynı, sadece kapsam genişledi (manuel İE'ler de "İhtiyaç" toplamına girer).

### 3. Sipariş Bazlı Detay Görünümü Etkilenmedi

`Orders.tsx` MRP sekmesi gibi tek-sipariş detay görünümleri ymSet göndermez → manuel İE'ler eski davranışta atlanır. Bu **doğru** — sipariş detay sadece o siparişin ihtiyacını gösterir.

---

## SİL UYARISI

⚠️ **Bu chat 28 Nis 2026 sabahı silinecek.** Bilgilerin tamamı:
- `docs/UYS_v3_Bilgi_Bankasi.md` §22 (27 Nis) + §23 (28 Nis)
- `docs/DEVAM_NOTU.md` (bu dosya)
- `docs/is_emri/00_BACKLOG_Master.md`
- `docs/atil_kod_analizi_20260427.md` (A2 revizyonu §23'te)

Yarın yeni Claude oturumda chat'i aramaya **gerek yok**.

İyi günler Buket. ☀️
