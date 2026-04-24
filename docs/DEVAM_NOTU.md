# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.40.1 hotfix sonrası)
**Son canlı sürüm:** v15.40.1 (Pre-push Hook Hotfix — tsc + .gitattributes)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/UYS_v3_Is_Listesi.md oku.
Son iş: v15.40.1 pre-push hook hotfix (tsc + .gitattributes) TAMAM. Sırada stok anomalisi raporu.
```

---

## v15.40.1 Hotfix — Neyin Düzeltildi

### Sorun 1: tsc çağrısı
`npx --no-install tsc` → npx "tsc" adını npm registry'deki eski bir pakete (`tsc@2.0.4`) çözümlüyordu, gerçek TypeScript değil. Çünkü TypeScript paketinin binary adı `tsc` ama paket adı `typescript`.

**Çözüm:** Hook artık `./node_modules/.bin/tsc` (veya `.cmd`) doğrudan çağırıyor. Fallback: global `tsc`.

### Sorun 2: CRLF bozulması
Git `core.autocrlf=true` (Windows varsayılan) hook dosyasını checkout'ta CRLF'ye dönüştürüyor → Git Bash bash shebang'i okuyamıyor → `\r: command not found` tarzı hatalar.

**Çözüm:** `.gitattributes` dosyası eklendi:
- `scripts/git-hooks/*` ve `*.sh` → `eol=lf`
- `*.ps1` → `eol=crlf`
- Binary uzantılar → `binary`

Apply scripti `git add --renormalize .` çağırır — mevcut dosyalar .gitattributes kurallarına göre normalize edilir.

---

## Doğrulama (Apply + push sonrası)

```powershell
git push --dry-run
```

Beklenen çıktı:
```
[pre-push] (1/3) audit-schema...
  ✓ AUDIT BAŞARILI
[pre-push] (2/3) audit-columns...
  ✓ TEMİZ
[pre-push] (3/3) tsc --noEmit...
  (no errors)
[pre-push] OK - all 3 checks passed.
```

---

## Sırada (Öncelik Sırasına Göre)

### 1. Stok anomalisi raporu (Senaryo 5 -3 gösterimi) 🟢
- Sadece rapor metni düzenleme. 15-30 dk.
- `src/lib/testRunner.ts` — Senaryo 5 adım raporunda `bypassNotu` meta alanı
- `TestMode.tsx` — bu notu info badge olarak göster

### 2. audit-columns trace edilemeyen 4 çağrı 🟢
Pre-push hook bu 4 noktayı trace edemiyor. Kolon mismatch var mı diye elle bakılmalı:
- `src\features\production\autoChain.ts:64` — `uys_work_orders [upsert]`
- `src\lib\testRun.ts:172` — `uys_orders [insert]`
- `src\pages\Operators.tsx:206` — `uys_izinler [insert]` (değişken başka modülden)
- `src\pages\Procurement.tsx:127` — `uys_tedarikler [update]` (değişken başka modülden)

### 3. Küçük işler
- Manuel plan'da havuz önerisi
- Hurda geri alma UI
- Havuz geri alma UI
- Toplu senaryo farklı reçetelerle

---

## Komutlar

**Hotfix apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-40-1
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push (`--no-verify` gerekli — hook henüz bozuk durumda):**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git add -A
git commit -m "v15.40.1: hotfix - pre-push tsc fix + .gitattributes LF enforce"
git push --no-verify
```

**Sonraki push test:**
```powershell
git push --dry-run   # 3/3 OK beklenir
```

---

**v15.40.1 patch'i hazır.**
