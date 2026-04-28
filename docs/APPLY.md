# v15.81 Doc Patch (saha model) — 4 dosya

**Sürüm:** v15.81 doc-2 (kod değişikliği yok, tag bump yok)
**Kapsam:** 4 dosya (1 yeni + 3 güncellenen)

## Değişen dosyalar

| Dosya | Değişiklik |
|---|---|
| `docs/saha_model_28nis2026.md` | **YENİ — 516 satır.** 13 senaryo detaylı spec, Madde 15 onay sistemi girdisi |
| `docs/UYS_v3_Bilgi_Bankasi.md` | §25 eklendi (28 Nis öğleden sonra — saha model özeti, kod eksikleri listesi) |
| `docs/DEVAM_NOTU.md` | Yeniden yazıldı: 28 Nis öğleden sonra kapanışı, saha model referansı |
| `docs/is_emri/00_BACKLOG_Master.md` | Header güncellendi, saha_model dosyasına referans |

## Apply (manuel kopyalama önerisi)

Sohbet `[...]` parantezleri otomatik link'e çeviriyor — script kullanmak güvenli:

```powershell
$pwd_str = (Get-Location).Path
if ($pwd_str -notmatch '\\ozler-uys-v3$') { Write-Host "DURDUR" -F Red; return }
git pull origin main

$zip = "$env:USERPROFILE\Downloads\patch-v15-81-doc2.zip"
$dest = "$env:USERPROFILE\Downloads\patch-v15-81-doc2"

if (-not (Test-Path $zip)) {
  Write-Host "ZIP yok, tarayicidan indir: patch-v15-81-doc2.zip" -F Red
  return
}

Remove-Item $dest -Recurse -Force -EA SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $dest -Force

$src = Join-Path $dest 'patch-v15-81-doc2'
Copy-Item "$src\docs\saha_model_28nis2026.md"        "docs\saha_model_28nis2026.md"        -Force
Copy-Item "$src\docs\UYS_v3_Bilgi_Bankasi.md"        "docs\UYS_v3_Bilgi_Bankasi.md"        -Force
Copy-Item "$src\docs\DEVAM_NOTU.md"                  "docs\DEVAM_NOTU.md"                  -Force
Copy-Item "$src\docs\is_emri\00_BACKLOG_Master.md"   "docs\is_emri\00_BACKLOG_Master.md"   -Force

git add -A
git status   # 4 dosya
git commit -m "v15.81 doc-2: saha_model 28 Nis + Bilgi Bankasi 25 + DEVAM_NOTU"
git push origin main

Remove-Item $zip,$dest -Recurse -Force -EA SilentlyContinue
```

Tag bump yok — kod değişmedi.
