# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.46 sonrası)
**Son canlı sürüm:** v15.46 (İş Emirleri arşivi repoya taşındı)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/UYS_v3_Is_Listesi.md + docs/is_emri/00_BACKLOG_Master.md oku.
Son iş: v15.46 iş emirleri arşivi repoya taşındı. Sıradaki: Faz B P2/P3 veya master backlog'tan biri.
```

---

## v15.46 — Ne Yapıldı

### `docs/is_emri/` klasörü oluşturuldu

7 dosya:
- `00_BACKLOG_Master.md` — özet + durum (21 madde + 10 öneri + 11 çıkarılan + gerekçeler)
- `01_OperatorPaneli.md` — production-blocker, /operator route, RBAC operator rolü, mobil-first
- `02_YedeklemeYonetimi.md` — production-blocker, /backup route, JSON snapshot, geri yükleme
- `03_UretimZinciri.md` — autoZincir + MRP modal + Kesim optimizasyon + Üst bar göstergeleri (4 büyük özellik tek iş emri, birbirine bağımlı)
- `04_Sevkiyat.md` — sevkiyat oluşturma formu, sipariş bazlı kalan, yasal irsaliye
- `05_VeriOperasyonlari.md` — Toplu Sipariş Excel + PDF çıktı + Stok Onarım (3 bölüm)
- `06_ProblemTakip.md` — KPI 4. kart, sekmeli modal (Form/Tarihçe/Yorum), Excel I/O

### Bilgi Bankası §17 güncel
Dosya yapısı şemasına `docs/is_emri/` ve `docs/faz_b_plan.md` eklendi.

---

## Sırada — İki Yol

### Yol A: Faz B kalan parçalar (Sipariş Termin Farkındalığı)
- **Parça 2: MRP termin-gruplu hesap** (1.5–2 saat) — `docs/faz_b_plan.md`
- **Parça 3: Kesim'de manuel kalem seçimi** (2–3 saat)

### Yol B: Master backlog'tan iş emirlerinden biri
Production-blocker'lar önce: `01_OperatorPaneli.md` veya `02_YedeklemeYonetimi.md`.

**ÖNEMLİ:** İş Emri #3 Faz 3 (MRP) ile Faz B Parça 2 (MRP termin-gruplu) **örtüşür** — birlikte yapılırsa daha verimli.

---

## Komutlar

**Apply** (kod-only doc patch):
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-46
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push:**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.46: is emirleri arsivi repoya tasindi (docs/is_emri/)"
git push
```

Pre-push hook 3/3 yesil bekleniyor.

**Push sonrasi temizlik (Hijyen Kuralı §18):**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-46.zip","$env:USERPROFILE\Downloads\patch-v15-46" -Recurse -Force -ErrorAction SilentlyContinue
```

---

**v15.46 patch'i hazır.**
