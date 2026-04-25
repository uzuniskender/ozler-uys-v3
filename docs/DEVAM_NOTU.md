# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.47.2 sonrası)
**Son canlı sürüm:** v15.47.2 (Hotfix: durum string normalize + §18.3 Konvansiyonu)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §18.2 ve §18.3) + docs/UYS_v3_Is_Listesi.md + docs/is_emri/03_UretimZinciri.md oku.
Son iş: v15.47/v15.47.1/v15.47.2 trio TAMAM. Sıradaki: v15.48 Faz 2 (Kesim Optimizasyon).
```

---

## v15.47.2 — Ne Yapıldı

### Sorun
v15.47'de Topbar MRP badge'i 12 gösterdi ama gerçek 0 olmalıydı. SQL doğrulaması:

| tablo | durum | count |
|---|---|---|
| orders | kapalı | 10 |
| orders | (boş) | 2 |
| orders.mrp_durum | tamam | 6 |
| orders.mrp_durum | bekliyor | 6 |

Kodumda sadece `'iptal'/'tamamlandi'` filtresi vardı. `'kapalı'` ve `'tamam'` (kısa form) string'leri **tamamlanmamış** sanılıyordu → false positive.

### Çözüm
**`src/lib/statusUtils.ts`** yeni dosya — 5 helper:
- `isOrderActive(o)` — sipariş aktif mi
- `isOrderMrpPending(o)` — MRP bekleniyor mu (her iki form'u kabul eder)
- `isWorkOrderOpen(w)` — İE açık mı
- `isCuttingPlanActive(cp)` — kesim planı iptal değil mi
- `isProcurementPending(t)` — tedarik bekleniyor mu

Topbar artık bu helper'ları kullanıyor; mantık 2 satıra düştü.

### Konvansiyon — §18.3 Durum String Konvansiyonu
DB seviyesinde 4 farklı "tamamlandı" varyantı tespit edildi:
- `'tamamlandi'` (modern, work_orders ve kesim_planlari)
- `'tamam'` (kısa, sadece orders.mrp_durum)
- `'kapalı'` (sadece orders.durum)
- `'kapali'` (potansiyel)

DB-wide migrate riskli, kod seviyesinde normalize stratejisi belirlendi:
- Yeni filtre yazıyorsan `statusUtils.ts` helper'ından geç
- Yeni durum eklersen helper'ı güncelle
- Yeni tablolarda standart `'aktif'|'bekliyor'|'tamamlandi'|'iptal'` kullan (CHECK constraint düşün)

---

## Sırada — v15.48: Faz 2 Kesim Optimizasyon

(v15.47 DEVAM_NOTU'sundan değişmedi)

`src/lib/cutting-optimizer.ts` (~250 satır) + Cutting.tsx UI butonu + 5 senaryo birim test. BOM kuralı: en az fire/en çok parça. Tahmini 2-3 saat.

---

## Komutlar

**Apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-47-2
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push** (kod-only):
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.47.2: hotfix - durum string normalize + 18.3 konvansiyon"
git push
```

3/3 yeşil bekleniyor.

**Push sonrası temizlik:**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-47-2.zip","$env:USERPROFILE\Downloads\patch-v15-47-2" -Recurse -Force -ErrorAction SilentlyContinue
```

---

**v15.47.2 patch'i hazır.**
