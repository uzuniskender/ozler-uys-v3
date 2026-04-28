# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 28 Nisan 2026 öğleden sonra (oturum kapanışı, ~16:00)
**Son canlı sürüm:** v15.81
**İş Emri #13 durum:** 19/22 madde TAMAM, sahada 0 FAIL · 1 WARN
**Ek çıktı:** docs/saha_model_28nis2026.md (13 senaryo, Madde 15 girdi)

---

## YENİ OTURUM AÇILIŞINDA İLK ADIM

```
UYS v3 devamı. Bilgi Bankası açılış kuralı (§0):
docs/UYS_v3_Bilgi_Bankasi.md (özellikle §0, §18 ailesi, §19, §20, §21 MRP Formülü, §22, §23 28 Nis sabah, §24 28 Nis öğlen) +
docs/saha_model_28nis2026.md (13 senaryo — Madde 15 onay sistemi girdisi) +
docs/DEVAM_NOTU.md +
docs/is_emri/00_BACKLOG_Master.md +
docs/is_emri/13_AnaAkisRefactor.md +
docs/atil_kod_analizi_20260427.md
oku.

Önceki chat silindi/silinecek — bilgilerin tamamı docs'ta.

Bugünkü ilk iş: saha_model_28nis2026.md sonundaki "ANA YAPISAL KARARLAR"
listesinden Buket öncelik belirler:

ÖNCELİK A — Madde 15 Onay Sistemi (mamul/hammadde aşamalı kontrol):
  - Mamul stok serbest/rezerv ayrımı (yeni veri modeli)
  - Manuel çıkış 2-aşama modalı (rezerv'e dokunma)
  - Hammadde tahsis dağılımı + manuel müdahale
  - 🔔 Bildirim merkezi altyapısı

ÖNCELİK B — Hızlı kazanım maddeleri:
  - Senaryo 1 modalı doğrulaması ("55 mi 50 mi?")
  - Manuel İE termin zorunlu (Senaryo 2 + 12)
  - v15.74 AZALIS BLOCK kuralı saha modeline aykırı, düzeltme

ÖNCELİK C — Yeni özellikler:
  - Malzeme kartı kalite/cins alanları + alternatifler (Senaryo 13)
  - 🔔 Bildirim merkezi (Senaryo 7'den çıktı)
  - Tedarik gecikme/yaklaşan termin tespiti

Buket önceliği belirler.
```

---

## BUGÜN YAPILANLAR (28 Nis sabah → öğlen → öğleden sonra)

### Sabah oturumu

- **v15.77:** Test Senaryo 7/8/9 — v15.74/75/76 test ispatı (8/8 PASS)
- **v15.78:** Manuel İE MRP görünürlüğü saha fix — IE-MANUAL-MO9SDW3A 6740 adet hard block bug'ı

### Öğlen oturumu

- **v15.79:** Plan Bekliyor/Üretilebilir efektif durum (#13 madde 8+9)
- **v15.80:** Sağlık raporu Kontrol 5/6/7 §21 sözleşmesine uygun revize
- **v15.80a:** plans/orders/recs değişken adı hotfix
- **v15.80b:** Kontrol 11 legacy IE-MANUAL filtresi
- **v15.81 ⭐:** MRP temel hesabı saha bug fix — 13+ sürümlük "uretilen=0 hardcode"
- **Test sonucu:** TEST_20260428_05 — 12/12 senaryo PASS · ALL_PASS

### Öğleden sonra oturumu (15:37 → ~17:00)

- **MRP saha modeli konuşması** — 13 senaryo soru-cevap formatında
- **Çıktı:** docs/saha_model_28nis2026.md (516 satır)
  - Senaryo 1-13 detaylı spec
  - Mamul/hammadde stok rezerv/tahsis simetrik modeli
  - Madde 15 onay sistemi tasarım girdisi
  - 🔔 Bildirim merkezi yeni özellik tanımı
  - Backlog senaryolar (iade, fire raporlama, çoklu admin, vs)

---

## BUGÜNÜN ANA YAPISAL ÇIKTILARI

| Konu | Karar | Kod durum |
|---|---|---|
| Mamul stok rezerv/serbest | Sipariş bazlı (order_id ile) | ❌ Eksik |
| Hammadde tahsis dağılımı | FIFO termin sırası | ❌ Eksik |
| Manuel müdahale (rezerv) | Sebep+açıklama zorunlu, ek İE/tedarik | ❌ Eksik |
| 🔔 Bildirim merkezi | Topbar yeni badge, sarı/kırmızı uyarılar | ❌ Yeni özellik |
| Manuel İE termin | Zorunlu yap | ❓ Kontrol |
| v15.74 AZALIS BLOCK | Saha modeline ters, kaldır | ⚠️ Düzeltme |
| Malzeme kalite/cins | Yeni alanlar gerek | ❌ Yeni alan |
| Malzeme alternatifleri | Manuel tanımlama, çift yönlü | ❌ Yeni özellik |

---

## MULTI-MACHINE NOTU

NB081'de Node yok → npm/build doğrulanmadı, GitHub Actions build'e güveniliyor.

Çoklu admin oturum sorunu (28 Nis tespit): aynı hesapla 2+ cihazdan login mümkün. Race condition + state senkronsuzluğu. Backlog'da.

---

## SİL UYARISI

⚠️ **Bu chat 28 Nis 2026 öğleden sonra silinecek.** Bilgilerin tamamı:
- `docs/UYS_v3_Bilgi_Bankasi.md` §22 (27 Nis) + §23 (28 Nis sabah) + §24 (28 Nis öğlen)
- `docs/saha_model_28nis2026.md` ⭐ (13 senaryo, Madde 15 girdi)
- `docs/DEVAM_NOTU.md` (bu dosya)
- `docs/is_emri/00_BACKLOG_Master.md`
- `docs/atil_kod_analizi_20260427.md`

Yarın yeni Claude oturumda chat'i aramaya **gerek yok**.

İyi akşamlar Buket. 🌙
