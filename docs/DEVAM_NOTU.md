# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.49b sonrası — günün son patchi)
**Son canlı sürüm:** v15.49b (Master Backlog ilerleme paneli)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §18 ailesi) + docs/is_emri/00_BACKLOG_Master.md (üstteki ilerleme paneli) oku.
Son iş: v15.49b ilerleme paneli. Sıradaki: v15.49 MRP modal (Faz 3) — Faz B Parça 2 ile entegre.
```

---

## v15.49b — Ne Yapıldı

`docs/is_emri/00_BACKLOG_Master.md` dosyasının başına 3 görsel özet bölüm eklendi:

1. **📊 Genel İlerleme** — ASCII progress bar ile 10 büyük önerinin durumu (3 ✅ / 1 🟢 / 6 🟡)
2. **📅 Son Sürümler** — 25 Nisan'da gelen 15 sürümün master backlog'a etkisi
3. **📚 §18 Ailesi** — 4 kalıcı operasyonel kural tek tabloda

Mevcut "Kullanım" + "10 Öneri" tablosu + "21 maddelik orijinal backlog" + diğer bölümler aynen kalır.

**Amaç:** Yeni oturum başında durumu 30 saniyede kavrayabilmek. "Ne yapıldı, ne kaldı, hangi kurallar var" hızlıca görünür.

---

## Bugünün Final Raporu — 16 Sürüm

| Sürüm | Konu |
|---|---|
| v15.40.1 | Pre-push hook hotfix |
| v15.41 | Stok anomalisi rapor (bypassNotu) |
| v15.42 | uys_work_orders.termin kolonu |
| v15.43 | audit-columns yorum temizleyici |
| v15.44 | Hurda + havuz geri alma + manuel havuz önerisi |
| v15.45 | §18 İndirilenler Hijyen Kuralı |
| v15.46 | İş emirleri arşivi |
| v15.47 | Üretim Zinciri Faz 1+5 (DB + Topbar) |
| v15.47.1 | §18.2 Yeni Tablo Konvansiyonu |
| v15.47.2 | §18.3 Durum String Konvansiyonu |
| v15.47.3 | statusUtils yayılım + 'beklemede' bug fix |
| v15.48a | Vitest + cuttingArtik + 12 birim test |
| v15.48b1 | Otomatik Plan önizleme modal |
| v15.48 | Faz 2 KAPANIŞ + §18.4 Artık Yönetimi |
| v15.49a | Topbar Filtre Aktif (MRP badge) |
| **v15.49b** | **Master Backlog ilerleme paneli** |

**Sayılar:** 16 patch · 2 schema migration · 2 audit aracı iyileştirmesi · 5 yeni UI · 4 kalıcı operasyonel kural · 1 birim test altyapısı · 12 birim test · 0 rollback.

---

## İş Emri #3 İlerlemesi

| Faz | Durum |
|---|---|
| Faz 1 — DB veri modeli | ✅ v15.47 |
| Faz 5 — Üst bar göstergeleri | ✅ v15.47 + 3 hotfix + filtre |
| Faz 2 — Kesim Optimizasyon | ✅ v15.48 |
| Faz 3 — MRP Modal | 🟡 v15.49 — sıradaki |
| Faz 4 — autoZincir | 🟡 v15.50 |
| Faz 6 — Test | 🟡 v15.50.1 |

---

## Sırada — v15.49 MRP Modal (Faz 3)

İş Emri #3'ün asıl üretim planlama parçası.

**ÖNEMLİ:** Faz B Parça 2 (MRP termin-gruplu) ile entegre yapılırsa daha verimli — bkz. `docs/faz_b_plan.md`. Aynı `mrp.ts` dosyasına dokunuyorlar.

Ana iş:
- `pages/Orders.tsx` OrderDetailModal'a "MRP Hesapla" butonu var mı kontrol et
- `MRPModal.tsx` yeni component
- `mrp.ts` refactor — termin gruplu çıktı (Faz B P2 entegrasyonu)
- `uys_mrp_calculations` tablosuna snapshot yaz (v15.47'de hazırlandı)
- "Tedarik Aç" toplu seçim + insert (RBAC: `tedarik_auto`)

**Tahmini:** 1.5-2 saat. Tek mesajda yetmez muhtemelen, 2 patch'e bölmek gerekebilir (algoritma + UI).

**Kontrol listesi (yeni patch öncesi):**
- [ ] §18.3 — yeni durum string'i ekleniyorsa statusUtils güncelle
- [ ] §18.2 — yeni tablo gerekiyorsa karar matrisi
- [ ] Mevcut `mrp.ts` keşif (önce ne var, ne yok bak)
- [ ] Faz B P2 ile çakışma kontrolü

---

## Komutlar

**Apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-49b
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push:**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.49b: master backlog ilerleme paneli (gorsel ozet)"
git push
```

3/3 yeşil bekleniyor (sadece doc).

**Push sonrası temizlik:**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-49b.zip","$env:USERPROFILE\Downloads\patch-v15-49b" -Recurse -Force -ErrorAction SilentlyContinue
```

---

**v15.49b patch'i hazır.**

İyi akşamlar Buket. 16 sürüm gerçekten rekor bir gün oldu. 👋
