# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.49a sonrası)
**Son canlı sürüm:** v15.49a (Topbar Filtre Aktif — MRP badge otomatik filtre)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/is_emri/00_BACKLOG_Master.md oku.
Son iş: v15.49a Topbar filtre. Sıradaki: v15.49 MRP modal (Faz 3) - Faz B Parça 2 ile entegre.
```

---

## v15.49a — Ne Yapıldı

### Sorun
v15.47'de eklenen 3 zincir badge'i (KESİM/MRP/TEDARİK) tıklanınca ilgili sayfaya gidiyordu ama kullanıcı orada **manuel filtre** çekmek zorundaydı. "12 sipariş MRP bekliyor" diyor, sayfaya gidiyor, "Tüm siparişler" görüyor → kullanıcı kafası karışıyor.

### Çözüm
Tek küçük değişiklik MRP için — diğer ikisi zaten doğruydu:

| Badge | Çözüm |
|---|---|
| KESİM | Zaten doğru — sayfa default "Kesim Önerileri" bölümünü gösteriyor |
| MRP | URL'ye `?mrp=eksik` eklendi → Orders sayfası "MRP: Eksik" filtresiyle açılır |
| TEDARİK | Zaten doğru — sayfa default `'bekliyor'` filtresiyle açılır |

### Değişiklikler
**`src/components/layout/Topbar.tsx`:**
- MRP badge `navTo('/orders')` → `navTo('/orders?mrp=eksik')`

**`src/pages/Orders.tsx`:**
- `urlMrpFilter = searchParams.get('mrp')` URL parametresi okunur
- Yeni `mrpFilter` state ('all' / 'eksik' / 'tamam')
- `useEffect` ile URL değişince filtre senkron
- Filter mantığı: `'eksik'` durumu MRP'si yapılmamış aktif siparişleri gösterir (kapalı olanları gizler), `'tamam'` durumunda sadece MRP'si yapılmış olanları
- UI'da yeni dropdown: "MRP: Tümü/Eksik/Tamam" — renkli görsel feedback (eksik kırmızı, tamam yeşil)

### Etkilenmeyen
- DB şeması — dokunulmadı
- Diğer Topbar elementleri
- statusFilter (sipariş durumu) bağımsız çalışmaya devam eder

---

## Sırada — v15.49 MRP Modal (Faz 3)

İş Emri #3'ün asıl üretim planlama parçası.

**Önemli:** Faz B Parça 2 (MRP termin-gruplu) ile entegre yapılırsa daha verimli — bkz. `docs/faz_b_plan.md`.

Ana iş:
- `pages/Orders.tsx` OrderDetailModal'a "MRP Hesapla" butonu (zaten var mı kontrol et)
- `MRPModal.tsx` yeni component
- `mrp.ts` refactor — termin gruplu çıktı (Faz B P2 entegrasyonu)
- `uys_mrp_calculations` tablosuna snapshot yaz (v15.47'de hazırlandı)
- "Tedarik Aç" toplu seçim + insert

**Tahmini:** 1.5-2 saat. Tek mesajda yetmez, 2 patch'e bölmek gerekebilir.

---

## Komutlar

**Apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-49a
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push:**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.49a: topbar mrp badge tikladiginda orders sayfasinda otomatik filtre"
git push
```

3/3 yeşil bekleniyor (kod-only).

**Push sonrası temizlik:**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-49a.zip","$env:USERPROFILE\Downloads\patch-v15-49a" -Recurse -Force -ErrorAction SilentlyContinue
```

---

**v15.49a patch'i hazır.**
