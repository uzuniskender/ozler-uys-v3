# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.45 sonrası)
**Son canlı sürüm:** v15.45 (İndirilenler Hijyen Kuralı + Faz B planı repoya taşındı)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/UYS_v3_Is_Listesi.md + docs/faz_b_plan.md oku.
Son iş: v15.45 hijyen kuralı + faz B planı taşındı. Sıradaki: Faz B Parça 2 veya Parça 3.
```

---

## v15.45 — Ne Yapıldı

### 1. İndirilenler Hijyen Kuralı (yeni Bilgi Bankası §18)
Buket Downloads klasöründe 13+ patch zip + duplicate `GitHub\ozler-uys-v3\` klasörü kalıntısı tespit etti. Bundan sonra:
- Her patch teslim mesajının SONUNDA Claude bir cleanup komutu verir
- Apply + push doğrulandıktan sonra kullanıcı çalıştırır → ilgili Downloads dosyaları silinir
- Repo dosyaları ASLA Downloads'a kopyalanmaz (duplicate riski)
- Bilgi bankası tek yerde: `docs/UYS_v3_Bilgi_Bankasi.md`

### 2. Faz B planı repoya taşındı
Downloads kalıntılarında bulunan v15.21 dönemi `faz_b_plan.md` (Sipariş Termin Farkındalığı) artık `docs/faz_b_plan.md`. Plan 3 parçalı:
- **Parça 1: İE terminleri** — ✅ v15.42 ile yapıldı (uys_work_orders.termin kolonu)
- **Parça 2: MRP termin-gruplu hesap** — 🟡 backlog (1.5–2 saat)
- **Parça 3: Kesim'de manuel kalem seçimi** — 🟡 backlog (2–3 saat)

---

## Sırada — Faz B Parça 2 veya Parça 3

### Parça 2: MRP termin-gruplu hesap (1.5–2 saat)
**Mevcut:** `hesaplaMRP()` toplam ihtiyaç çıkarıyor → "sac X: 500kg net 300kg"
**Yeni:** Termin gruplu çıktı → "sac X: 15 Mayıs 100kg, 1 Haziran 200kg"
**Dosyalar:** `mrp.ts` (refactor), `Orders.tsx` (OrderDetailModal MRP sekmesi), `MRP.tsx`, `mrpTedarikOlustur` (teslim_tarihi=termin)
**Risk:** `hesaplaMRP` birden fazla yerden çağrılıyor — imza değişirse tüm çağrıları güncelle. FIFO tahsis test edilmeli.

### Parça 3: Kesim'de manuel kalem seçimi (2–3 saat)
**Mevcut:** Kesim planı otomatik (açık İE'lerden), operatör müdahalesi sınırlı
**Yeni:** "Kesim planına ekle" butonu → modal → checkbox+termin renk kodlu (kırmızı: geçmiş, sarı: ≤7 gün, gri: ileri) → seçilenler plana eklenir
**Dosyalar:** `CuttingPlans.tsx` (yeni `CuttingPlanIeSelectorModal`), `cutting.ts` (`olusturCuttingPlan`'a seçili ID listesi parametresi)
**Risk:** UI ağırlıklı, DB'ye dokunmaz. Geriye uyumlu (boş ID listesi = otomatik mod).

### Diğer küçük işler
- audit-columns iyileştirmesi (zaten v15.43'te yapıldı, JSDoc skip)
- Toplu senaryo farklı reçetelerle çalıştırılabilir
- Operator + Admin için test kapsamı

---

## Komutlar

**Apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-45
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push:**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.45: indirilenler hijyen kurali + faz B plani repoya tasindi"
git push
```

Pre-push hook 3/3 yeşil bekleniyor. Kod değişikliği YOK, sadece docs.

**Push sonrası — TEMİZLİK (yeni kuralın ilk testi):**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-45.zip","$env:USERPROFILE\Downloads\patch-v15-45","$env:USERPROFILE\Desktop\faz_b_plan.md" -Recurse -Force -ErrorAction SilentlyContinue
```

---

**v15.45 patch'i hazır.**
