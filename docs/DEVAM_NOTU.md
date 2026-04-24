# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.40 sonrası)
**Son canlı sürüm:** v15.40 (Pre-push Hook — core.hooksPath ile versiyonlu)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

Yeni Claude'a şu mesajı ver:

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/UYS_v3_Is_Listesi.md oku.
Son iş: v15.40 pre-push hook (TAMAM). Sırada stok anomalisi raporu (küçük iş).
```

---

## Son Durum (v15.40)

**Pre-push Hook TAMAM:**
- Yeni dosya: `scripts/git-hooks/pre-push` (bash, LF, executable)
  - 3 check: audit-schema, audit-columns, tsc --noEmit
  - PATH fix: `/c/Program Files/nodejs` + npm global (Iskender + iskender.uzun paths)
  - Başarısız olursa net hata + `--no-verify` bypass açıklaması
- Yeni dosya: `scripts/install-hooks.ps1` — `git config core.hooksPath scripts/git-hooks` çalıştırır
- Eski `.git/hooks/pre-push` artık kullanılmıyor (core.hooksPath baskın)

**Aktivasyon (her makinede bir kez):**
- `scripts/install-hooks.ps1` çalıştır, **veya**
- Manuel: `git config core.hooksPath scripts/git-hooks`

**Apply scripti v15.40 bunu otomatik yapıyor** — Iskender makinesinde hook aktif.
Diğer makinede (iskender.uzun): `git pull` + `scripts/install-hooks.ps1` bir kez.

**Doğrulama:**
```powershell
# Hook aktif mi?
git config --get core.hooksPath
# Beklenen: scripts/git-hooks

# Test (commit yok, dry-run):
git push --dry-run
# 3 check çalışmalı, OK dönmeli
```

---

## Sırada (Öncelik Sırasına Göre)

### 1. Stok anomalisi raporu (Senaryo 5 -3 gösterimi) 🟢
- **Sorun:** Senaryo 5 raporunda `stokSnapshotBitis: -3` görünüyor. Gerçek canlı stok etkilenmiyor (test izole, cascade delete temiz).
- **Kök neden:** `_uretimGirisi` test helper'ı UI save() yolundan geçmiyor → doğrudan DB insert. `canProduceWO` yasak kontrolü bypass'lı (kasıtlı — yoksa tüm senaryolar kırılırdı).
- **Çözüm:** Sadece rapor metnine açıklayıcı not eklemek:
  - `src/lib/testRunner.ts` içinde Senaryo 5'in adım raporunda ek bir meta alanı: `bypassNotu: "Test helper UI validation'ı bypass eder — gerçek üretim akışı yasak kontrollü"`
  - `TestMode.tsx` rapor gösteriminde bu notu küçük bir info badge olarak göster
- **Tahmini iş:** 15-30 dk. Kod değişikliği minimal.

### 2. Küçük işler (backlog)
- [ ] Manuel plan'da havuz önerisi (v15.35 eksik)
- [ ] Hurda geri alma UI
- [ ] Havuz geri alma UI (admin only)
- [ ] Toplu senaryo farklı reçetelerle

---

## Önemli Komutlar

**Patch uygulama:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-40
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Git push (bu sefer --no-verify gerekli — ilk commit hook'u kuruyor):**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git add -A scripts/ docs/
git commit -m "v15.40: pre-push hook versioned via core.hooksPath"
git push --no-verify
```

**Sonraki push'lar:** `--no-verify` GEREKMEZ. Hook otomatik çalışır.

**Hook bypass (acil durumlarda):** `git push --no-verify`

**Diğer makinede (iskender.uzun):**
```powershell
git pull --rebase
powershell -ExecutionPolicy Bypass -File .\scripts\install-hooks.ps1
```

---

**v15.40 patch'i hazır, repoda.**
