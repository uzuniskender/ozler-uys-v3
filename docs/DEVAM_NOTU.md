# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.38 sonrası)
**Son canlı sürüm:** v15.38 (Parça 5 — Yasak Kontrolleri + Senaryo 6)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

Yeni Claude'a şu mesajı ver:

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/UYS_v3_Is_Listesi.md oku.
Son iş: v15.38 yasak kontrolleri (Parça 5 tamamlandı). Test et, geri bildirim var/yok.
```

---

## Son Durum (v15.38)

**Parça 5 TAMAM:**
- `src/features/production/validations.ts` (yeni) — `canProduceWO`, `canDurus`, `canDeleteWO` saf fonksiyonlar
- `OperatorPanel.save()` — YASAK 1 (stok) + YASAK 2 (duruş) sıkı kontrol (admin bypass YOK)
- `WorkOrders.topluSil / deleteWO / deleteLog` — YASAK 3 (silme) + password onay
- `testRunner.senaryo6` — 10 adımda 3 yasak + 3 pozitif kontrol
- `TestMode.tsx` — 6. buton (kırmızı, ⛔ ikon) + "Tümünü Ardışık" 1..6 güncellendi

**Doğrulama planı:**
1. Test Modu → Test Başlat
2. "🚀 Tümünü Ardışık Çalıştır" → 6 senaryo ALL_PASS beklenir
3. Senaryo 6 raporunda 10/10 OK + `engellendi: true` delilleri olmalı
4. Senaryo 5 hala `stokSnapshotBitis: -3` gösterecek (helper `_uretimGirisi` bypass'lı, bu kasıtlı — yasak testi sadece save() UI katmanında)

---

## Parça 5 — Tamamlandı ✅

Açık İş Kalan (backlog, §15 Öncelik 1):

- [ ] SR #11 havuz adaptasyonu (Sistem Sağlık Raporu Bar Model tutarlılık)
- [ ] Pre-push hook npm PATH fix (Git Bash)
- [ ] Stok anomalisi (Senaryo 5 -3 gösterim — rapor okunabilirliği)

Küçük iş:
- [ ] Havuz geri alma UI
- [ ] Manuel plan'da havuz önerisi
- [ ] Hurda geri alma UI (admin only)
- [ ] Toplu senaryo farklı reçetelerle

---

## Önemli Komutlar

**Patch uygulama:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-38
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Git push:**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git add -A src/ docs/
git commit -m "v15.38: Parça 5 — Yasak Kontrolleri (stok/duruş/silme) + Senaryo 6"
git push --no-verify
```

**Test Modu:**
1. Sol menü → Sistem → 🧪 Test Modu
2. Test Başlat (açıklama: "v15.38 Parça 5 doğrulama")
3. Reçete: YMH100265, Adet: 9999
4. 🚀 Tümünü Ardışık Çalıştır
5. 6/6 ALL_PASS bekleniyor
6. JSON rapor → Senaryo 6 adımlarında `engellendi: true` delili kontrol

---

## Senaryo 6 Beklenen Çıktı

| # | Adım | Beklenen |
|---|------|----------|
| 1 | YASAK 1 — Stok 0 | ENGEL ✓ |
| 2 | YASAK 1 — Kısmi stok | ENGEL ✓ |
| 3 | YASAK 1 — Stok yeterli | İZİN ✓ |
| 4 | YASAK 2 — Aşırı duruş | ENGEL ✓ |
| 5 | YASAK 2 — Çalışmasız duruş | ENGEL ✓ |
| 6 | YASAK 2 — Makul duruş | İZİN ✓ |
| 7 | YASAK 3 — Loglu İE silme | ENGEL ✓ |
| 8 | YASAK 3 — Stoklu İE silme | ENGEL ✓ |
| 9 | YASAK 3 — Fireli İE silme | ENGEL ✓ |
| 10 | YASAK 3 — Boş İE silme | İZİN ✓ |

---

**v15.38 patch'i hazır, repoda.**
