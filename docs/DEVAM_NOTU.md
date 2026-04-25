# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.47.1 sonrası)
**Son canlı sürüm:** v15.47.1 (Hotfix: audit whitelist + Yeni Tablo Konvansiyonu §18.2)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §18.2) + docs/UYS_v3_Is_Listesi.md + docs/is_emri/03_UretimZinciri.md oku.
Son iş: v15.47 + v15.47.1 İş Emri #3 Faz 1+5 + audit hotfix TAMAM. Sıradaki: v15.48 Faz 2 (Kesim Optimizasyon).
```

---

## v15.47.1 — Ne Yapıldı

### Ne oldu, nereden çıktı?
v15.47'de yeni `uys_mrp_calculations` tablosu eklendi. Push'ta audit-schema FAIL verdi: tablo store ve DataManagement listesinde değil. Çünkü tablo Faz 3'te kullanılacak — Faz 1'de altyapı olarak yarattık.

### Hotfix
`scripts/audit-schema.cjs`:
- `STORE_WHITELIST`'e `uys_mrp_calculations` (yorumlu — Faz 3'te modal kendi fetch edecek)
- `DATA_MGMT_WHITELIST`'e `uys_mrp_calculations` (snapshot, yeniden hesaplanabilir, backup gereksiz)

### Konvansiyon (kalıcı çözüm) — Bilgi Bankası §18.2
Gelecekte 5+ tablo daha gelecek (İş Emri #2 → pt_yedekler, #4 → sevk_satirlari, #5 → stok_onar_logs, #6 → pt_tarihce + pt_yorumlar). Aynı sıkıntı tekrarlanmasın diye:

- 4 soru karar matrisi (UI fetch? Realtime? Backup? Runtime sürümü?)
- 4 tablo tipi (A: first-class / B: audit / C: snapshot / D: backup) ve nereye girdiği
- Migration başına 2 satırlık intent yorumu zorunlu
- Push öncesi 4 maddelik kontrol listesi
- Gelecek tabloların önceden tip ataması (5 tablo)

---

## ⚠️ Sıradaki Tabloyu Eklerken

Yeni migration yazmadan önce mutlaka §18.2'yi oku. Migration yorumu şablonu:

```sql
-- v15.XX — yeni_tablo_adi
-- TIP: A | B | C | D
-- BACKUP: evet | hayir
-- STORE: yapıldı | sürüm | hayir
CREATE TABLE IF NOT EXISTS public.yeni_tablo_adi ( ... );
```

Push öncesi:
- `npm run build` (TypeScript)
- `node scripts/audit-schema.cjs` (yeşil mi)
- `node scripts/audit-columns.cjs` (yeşil mi)

---

## Sırada — v15.48: Faz 2 Kesim Optimizasyon

(v15.47 DEVAM_NOTU'sundan değişmedi — bkz. iş emri 03)

`src/lib/cutting-optimizer.ts` (yeni, ~250 satır algoritma) + Cutting.tsx UI butonu + 5 senaryo birim test. BOM kuralı: en az fire/en çok parça. Greedy first-fit + 50 iterasyonlu fire optimize. Plan birleştirme + kesim artığı → otomatik malzeme kartı.

**Tahmini:** 2-3 saat.

---

## Komutlar

**Apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-47-1
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push** (kod-only, schema değişikliği YOK):
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.47.1: hotfix - audit whitelist + yeni tablo konvansiyonu (18.2)"
git push
```

3/3 yeşil bekleniyor (audit-schema artık geçecek çünkü whitelist güncel).

**Push sonrası temizlik:**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-47-1.zip","$env:USERPROFILE\Downloads\patch-v15-47-1" -Recurse -Force -ErrorAction SilentlyContinue
```

---

**v15.47.1 patch'i hazır.**
