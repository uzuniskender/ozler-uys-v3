# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.47.3 sonrası)
**Son canlı sürüm:** v15.47.3 (statusUtils yayılım + 'beklemede' bug fix + §18.3 güncellemesi)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §18, §18.2, §18.3) + docs/UYS_v3_Is_Listesi.md + docs/is_emri/03_UretimZinciri.md oku.
Son iş: v15.47 + 3 hotfix (47.1/47.2/47.3) TAMAM. Sıradaki: v15.48 Faz 2 (Kesim Optimizasyon).
```

---

## v15.47.3 — Ne Yapıldı

### Gerçek Bug Fix
WorkOrders.tsx'te `'beklemede'` (paused) durumu kullanılıyor — operatör İE'yi duraklatabiliyor. Topbar `isWorkOrderOpen` helper'ı sadece `'tamamlandi'/'iptal'` filtreliyordu, paused İE'leri "açık" sayıyordu → KESİM badge'inde false positive.

`WO_CLOSED_OR_PAUSED_STATES` set'i 3'lü oldu: `'tamamlandi'`, `'iptal'`, `'beklemede'`. Paused İE'ler artık plana alınmıyor, badge sayımına girmiyor.

### 2 Yeni Helper
- `isCuttingPlanPending(cp)` — `'tamamlandi'/'iptal'` dışı her şey pending sayılır
- `isAcikBarAvailable(b)` — `b.durum === 'acik'` (havuz önerisi için)

### 2 Sayfa Refactor
- **Procurement.tsx** (5 yer): `!t.geldi` → `isProcurementPending(t)` — filtered, markGeldiBulk, toggleSelectAll, toplamBekleyen, bulk select checkbox
- **CuttingPlans.tsx** (7 yer):
  - 3 wo durum filtresi → `!isWorkOrderOpen(w)` — bekliyor/oneriler/uygunIEler
  - 3 acikBar durum kontrolü → `isAcikBarAvailable(a)` — havuzAcik/havuzBarlari
  - 1 plan durum filtresi → `isCuttingPlanPending` — bekleyen liste

### §18.3 Güncelleme — DB snapshot tablosu genişledi
3 yeni keşif:
- `uys_work_orders.durum`'a **`'beklemede'`** eklendi (paused — Devam Et butonu var)
- `uys_orders.mrp_durum`'a `'eksik'` ve `'calistirildi'` (Orders.tsx:281'de görüldü)
- `uys_acik_barlar.durum` (yeni satır): `'acik'` / `'tuketildi'` / `'hurda'`

### Etkilenmeyen
- DB şeması — dokunulmadı
- Orders.tsx ve WorkOrders.tsx çoğunlukla insert/update payload veya UI eşleştirme — bilerek dokunulmadı (helper'a sokmak gereksizdi)

---

## Sırada — v15.48: Faz 2 Kesim Optimizasyon

(v15.47 DEVAM_NOTU'sundan değişmedi)

`src/lib/cutting-optimizer.ts` (~250 satır) + Cutting.tsx UI butonu + 5 senaryo birim test. BOM kuralı: en az fire/en çok parça. Tahmini 2-3 saat.

---

## Komutlar

**Apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-47-3
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push** (kod-only):
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.47.3: statusUtils yayilim + beklemede bug fix + 18.3 guncelle"
git push
```

3/3 yeşil bekleniyor.

**Push sonrası temizlik:**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-47-3.zip","$env:USERPROFILE\Downloads\patch-v15-47-3" -Recurse -Force -ErrorAction SilentlyContinue
```

---

**v15.47.3 patch'i hazır.**
