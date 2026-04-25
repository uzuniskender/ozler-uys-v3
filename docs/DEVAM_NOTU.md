# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.48 sonrası)
**Son canlı sürüm:** v15.48 (İş Emri #3 Faz 2 KAPANIŞ + §18.4 Artık Yönetimi)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §18.4) + docs/is_emri/00_BACKLOG_Master.md oku.
Son iş: v15.48 İş Emri #3 Faz 2 KAPANIŞ. Sıradaki: v15.49 MRP modal (Faz 3) - Faz B Parça 2 ile entegre.
```

---

## v15.48 — Ne Yapıldı

### Sürpriz Keşif
v15.48b2 (Artık Malzeme UI) tasarlanıyordu. Mevcut `ArtikOneriModal` incelenirken keşfedildi:
- v15.32'den itibaren kesim artıkları **otomatik** `uys_acik_barlar` havuzuna ekleniyor (`barModelSync`)
- Eski "Manuel stok girişi" akışı v15.32'de kasıtlı **deprecate** edilmiş
- Manuel material kartı + stok girişi yapsak → **çift kayıt**

### Karar
v15.48b2 iptal. v15.48a'da yazılan `artikMalzemelerOlustur()` saf-fonksiyon olarak kalıyor (raporlama, gelecek altyapı, birim test örneği).

### Değişiklikler
1. **`cuttingArtik.ts` başına ⚠️ uyarı bloğu** — "UI'a bağlama, çakışma yaratır"
2. **Bilgi Bankası §18.4 Artık Yönetimi Konvansiyonu** — yeni bölüm:
   - Tek kural: artıklar sadece `uys_acik_barlar` havuzunda
   - Yasak: manuel material kartı + stok girişi
   - Saf-fonksiyon ne için: raporlama, istatistik, gelecek altyapı
   - Kontrol listesi
3. **Master Backlog güncel** — İş Emri #3 Faz 2 (#4) ve Faz 5 (#10) → **🟢 TAMAM**

### İş Emri #3 Durumu
| Faz | Durum |
|---|---|
| Faz 1 (DB veri modeli) | ✅ v15.47 |
| Faz 5 (Üst bar göstergeleri) | ✅ v15.47 + 3 hotfix |
| Faz 2 (Kesim Optimizasyon) | ✅ v15.48 (algoritma + UI önizleme + test + §18.4) |
| Faz 3 (MRP Modal) | 🟡 v15.49 — sıradaki |
| Faz 4 (autoZincir) | 🟡 v15.50 |
| Faz 6 (Test) | 🟡 v15.50.1 |

---

## Sırada — v15.49 MRP Modal (Faz 3)

İş Emri #3'ün asıl üretim planlama parçası. **Faz B Parça 2 (MRP termin-gruplu) ile entegre yapılırsa daha verimli** (`docs/faz_b_plan.md`).

Ana iş:
- `pages/Orders.tsx` OrderDetailModal'a "MRP Hesapla" butonu (var mı kontrol et)
- `MRPModal.tsx` yeni component
- `mrp.ts` refactor — termin gruplu çıktı (Faz B P2 entegrasyonu)
- `uys_mrp_calculations` tablosuna snapshot yaz (v15.47'de hazırlandı)
- "Tedarik Aç" toplu seçim + insert

**Tahmini:** 1.5-2 saat. Tek mesajda yetmez muhtemelen, 2 patch'e bölmek gerekebilir (algoritma + UI).

---

## Komutlar

**Apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-48
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push:**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.48: Faz 2 KAPANIS + 18.4 artik yonetimi konvansiyonu"
git push
```

3/3 yeşil bekleniyor. Kod-only.

**Push sonrası temizlik:**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-48.zip","$env:USERPROFILE\Downloads\patch-v15-48" -Recurse -Force -ErrorAction SilentlyContinue
```

---

**v15.48 patch'i hazır.**
