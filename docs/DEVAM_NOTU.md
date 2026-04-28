# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 28 Nisan 2026 öğlen (oturum kapanışı)
**Son canlı sürüm:** v15.81
**İş Emri #13 durum:** 19/22 madde TAMAM, sahada 0 FAIL · 1 WARN

---

## YENİ OTURUM AÇILIŞINDA İLK ADIM

```
UYS v3 devamı. Bilgi Bankası açılış kuralı (§0):
docs/UYS_v3_Bilgi_Bankasi.md (özellikle §0, §18 ailesi, §19, §20, §21 MRP Formülü, §22, §23 28 Nis sabah, §24 28 Nis öğlen) +
docs/DEVAM_NOTU.md +
docs/is_emri/00_BACKLOG_Master.md +
docs/is_emri/13_AnaAkisRefactor.md +
docs/atil_kod_analizi_20260427.md (A2 maddesi v15.78'de revize edildi — §23'te detay)
oku.

Önceki chat silindi/silinecek — bilgilerin tamamı docs'ta.

Bugünkü ilk iş: §22 yarın TODO listesinden seçim:
  1. MRP senaryoları konuşması (Buket anlatır, Claude sorar)
  2. Madde 15 onay sistemi (rezerve değil, planlama onayı) — 3 aşamalı
  3. Madde 16 kesim artık ürün sorma (havuz mantığı + UI onayı)
  4. Çoklu admin oturumu (28 Nis tespit, backlog)
  5. uys_mrp_rezerve DROP (atıl kod A3, 1-2 hafta gözlem sonrası)
  6. Senaryo 3 adet bağımlılığı (testRunner.ts:569 if tedarik===0 throw)

Buket önceliği belirler.
```

---

## BUGÜN YAPILANLAR (28 Nis sabah → öğlen)

### Sabah oturumu

- **v15.77:** Test Senaryo 7/8/9 — v15.74/75/76 test ispatı (8/8 PASS)
- **v15.78:** Manuel İE MRP görünürlüğü saha fix — IE-MANUAL-MO9SDW3A 6740 adet hard block veriyordu, MRP'de görünmüyordu. `mrp.ts` filtre + `MRP.tsx` tek liste UI + Senaryo 10 reproducible test.

### Öğlen oturumu

- **v15.79:** Plan Bekliyor/Üretilebilir efektif durum (#13 madde 8+9). `getEffectiveStatus()` saf-fonksiyon. DB'ye yazma yok. Operatör paneli sadece üretilebilir+üretimde gösteriyor. Topbar yeni `[PLAN BEKLEYEN N]` rozeti. Senaryo 11.
- **v15.80:** Sağlık raporu Kontrol 5/6/7 §21 sözleşmesine uygun revize (rezerve mantığı v15.70'te kalkmıştı).
- **v15.80a:** plans/orders/recs değişken adı hotfix (ilk patch'te yanlış değişken adı).
- **v15.80b:** Kontrol 11 legacy IE-MANUAL filtresi (v15.55 öncesi 2 satır).
- **v15.81 ⭐:** **MRP temel hesabı saha bug fix** — pre-existing 13+ sürümlük bug. `mrp.ts`'te `uretilen=0` hardcode'lu, `tamamlandi` filtresi yok. Sahada Kontrol 5 yanlış uyarılar veriyordu, MRP sayfası ↔ sağlık raporu çelişkisi.
  - logs parametresi eklendi (opsiyonel, geriye uyum)
  - Sipariş bazlı + manuel İE her ikisinde gerçek üretim ilerlemesi
  - tamamlandi filtresi eklendi
  - 7 dosya değişti (mrp.ts + 4 caller + 2 test)
  - Senaryo 12 saha bug fix kanıtı (6 alt-test)

### Test sonucu (TEST_20260428_05)

**12/12 senaryo PASS · ALL_PASS** (S3 yine pre-existing skip)

### Sahaya etki

| Sürüm öncesi | Sonrası |
|---|---|
| Kontrol 5: 7 eksik (FAIL) | **Kontrol 5: PASS** (tüm hammaddeler stok veya yolda) |
| Kontrol 7: WARN (rezerve yok mantığı) | Kontrol 7: WARN (gerçek tutarlılık testi — IE-AUTO-MOI5FZ2S mrp_durum stale) |
| Kontrol 11: FAIL (2 satır) | **Kontrol 11: PASS** (legacy filtre) |
| **9 PASS · 1 WARN · 1 FAIL** | **10 PASS · 1 WARN · 0 FAIL** |

---

## MULTI-MACHINE NOTU

NB081'de Node yok → npm/build doğrulanmadı, GitHub Actions build'e güveniliyor (push'lar yeşil geçti).

Çoklu admin oturumu sorunu (28 Nis tespit): aynı hesapla 2+ cihazdan login mümkün. Race condition + state senkronsuzluğu. Test Modu cross-device sorunu bunun parçası: localStorage cihaz bazlı, `uys_test_runs` DB tablosu paylaşılır. Bir cihazda kapatılınca diğeri görmüyor. Backlog'a eklendi.

---

## KRİTİK UYARILAR

### 1. MRP Formülü (§21) — Aynı

```
NET İHTİYAÇ = İHTİYAÇ - STOK - YOLDA
```

v15.81 bu formülü değiştirmedi. Sadece **İHTİYAÇ** hesabını doğrulttu — eski koddaki "tamamlanmış işler için sıfır olmadı" bug'ını giderdi.

### 2. logs Parametresi Geriye Uyumlu

`hesaplaMRP` imzasına `logs` opsiyonel olarak eklendi. Eski caller'lar (varsa) `logs` geçirmediğinde **eski davranış** (uretilen=0) korunur. Yeni hesaplar tüm caller'larda log bazlı.

### 3. uys_mrp_rezerve Tablosu

7 eski rezerve kaydı duruyor (sağlık raporu Kontrol 6: PASS — "DROP öncesi kalıntı, MRP'yi etkilemiyor"). Atıl Kod A3'e göre 1-2 hafta gözlem sonrası DROP edilecek.

### 4. Saha Bekleyen Tek WARN

IE-AUTO-MOI5FZ2S — `mrp_durum='tamam'` ama gerçekte 1 eksik. Bu kod bug değil — MRP sayfasında o siparişi seç + Hesapla → otomatik 'eksik'e döner.

---

## SİL UYARISI

⚠️ **Bu chat 28 Nis 2026 öğleden sonra silinecek.** Bilgilerin tamamı:
- `docs/UYS_v3_Bilgi_Bankasi.md` §22 (27 Nis) + §23 (28 Nis sabah) + §24 (28 Nis öğlen)
- `docs/DEVAM_NOTU.md` (bu dosya)
- `docs/is_emri/00_BACKLOG_Master.md`
- `docs/atil_kod_analizi_20260427.md` (A2 revizyonu §23'te)

Yarın yeni Claude oturumda chat'i aramaya **gerek yok**.

İyi öğleden sonralar Buket. ☕
