# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.39 sonrası)
**Son canlı sürüm:** v15.39 (SR #11 havuz satırı adaptasyonu)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

Yeni Claude'a şu mesajı ver:

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/UYS_v3_Is_Listesi.md oku.
Son iş: v15.39 SR #11 havuz satırı adaptasyonu (TAMAM). Sırada pre-push hook fix.
```

---

## Son Durum (v15.39)

**SR #11 havuz adaptasyonu TAMAM:**
- `src/pages/DataManagement.tsx` — `saglikRaporuCalistir()` fonksiyonu güncellendi
- `fetchAll('uys_acik_barlar')` Promise.all listesine eklendi
- SR #11 kontrol mantığı 3 durum ayırıyor:
  1. **Normal satır** (havuzBarId yok) — eski mantık: hamAdet kadar bar_acilis stok hareketi
  2. **Havuz satırı — orphan** — satır.havuzBarId var ama `uys_acik_barlar`'da kayıt yok
  3. **Havuz satırı — açık kalmış** — kayıt var ama `durum='acik'` (acikBarTuket çağrılmamış)
- Mesaj üç parçalı birleşik string (örn: "2 normal satır bar_acilis eksik · 1 havuz satırı tüketildi işaretlenmemiş")
- Detay 3 ayrı dizi (normalEksikler, havuzOrphan, havuzAcikKalan) - her biri ilk 10 kayıt
- **Auto-fix eklenmedi** — havuz için yanlış bar 'tuketildi' işaretlemek kalıcı veri kaybıdır
- Rapor version string `v15.33` → `v15.39` güncellendi

**Doğrulama planı:**
1. Veri Yönetimi → 🩺 Rapor Oluştur
2. 11/11 PASS bekleniyor (canlı sistemde havuz kullanımı tutarlı ise)
3. Eğer FAIL dönerse detay içinde hangi satır/havuz problemli görünür — elle uys_acik_barlar karşılaştırması yapılır

**Not:** Test Modu çalıştırılırken `uys_acik_barlar` tablosunda test_run_id etiketli kayıtlar da olabilir. SR #11 raporu canlı tüm açık barları gördüğü için, test sonrası cascade delete ile temizlenmediyse false FAIL verebilir. Test bitiminde cleanup'ın çalıştığından emin ol.

---

## Sırada (Öncelik Sırasına Göre)

### 1. Pre-push hook npm PATH fix (Git Bash) 🟡
- **Dosya:** `.git/hooks/pre-push`
- **Sorun:** Git Bash `npm` PATH'ini bulamıyor → `git push` her seferinde `--no-verify` gerekiyor
- **Çözüm:** Hook başına explicit PATH satırı ekle:
  ```bash
  export PATH="$PATH:/c/Program Files/nodejs:/c/Users/Iskender/AppData/Roaming/npm"
  ```
  (İki makine için: iskender.uzun ve Iskender — paths kontrol edilsin)
- Alternatif: hook'u PowerShell çağıran wrapper'a çevir

### 2. Stok anomalisi raporu (Senaryo 5 -3 gösterimi) 🟢
- Rapor okunabilirliği için. Gerçek veri sorunu değil.
- `_uretimGirisi` helper'ı bypass ediyor → Senaryo 5'te `stokSnapshotBitis: -3` normal.
- Çözüm seçenekleri:
  - a) Senaryo 5 raporunda negatif stok notu ekle ("test bypass — UI katmanında koruma mevcut")
  - b) `_uretimGirisi` helper'ına `canProduceWO` çağrısı ekle (ama tüm senaryoları kırar — DİKKAT)
- Tavsiye: (a) — sadece rapor metnine açıklayıcı not.

### 3. Küçük işler (backlog)
- [ ] Havuz geri alma UI
- [ ] Manuel plan'da havuz önerisi
- [ ] Hurda geri alma UI (admin only)
- [ ] Toplu senaryo farklı reçetelerle

---

## Önemli Komutlar

**Patch uygulama:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-39
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Git push:**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git add -A src/ docs/
git commit -m "v15.39: SR #11 havuz satiri adaptasyonu (normal + havuzBarId)"
git push --no-verify
```

**Test Modu sonrası Sağlık Raporu:**
1. Test Modu → Tümünü Ardışık → 6/6 ALL_PASS (cleanup'ın çalıştığını doğrula)
2. Sol menü → Veri Yönetimi → 🩺 Rapor Oluştur
3. Kontrol #11 → "Bar Model tutarlılığı" → PASS beklenir
4. FAIL olursa JSON rapor indir, detay → normalEksikler / havuzOrphan / havuzAcikKalan

---

**v15.39 patch'i hazır, repoda.**
