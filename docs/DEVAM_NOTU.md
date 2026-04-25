# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.47 sonrası)
**Son canlı sürüm:** v15.47 (Üretim Zinciri Faz 1+5 — veri modeli + Topbar göstergeleri)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/UYS_v3_Is_Listesi.md + docs/is_emri/03_UretimZinciri.md oku.
Son iş: v15.47 İş Emri #3 Faz 1+5 TAMAM. Sıradaki: v15.48 Faz 2 (Kesim Optimizasyon).
```

---

## v15.47 — Ne Yapıldı

### 1. DB Veri Modeli (Faz 1)
Migration: `sql/20260425_v15_47_uretim_zinciri_faz1.sql`
- `uys_kesim_planlari`: 4 yeni kolon (`ham_en`, `ham_kalinlik`, `fire_kg`, `artik_malzeme_kod`)
- `uys_tedarikler`: 2 yeni kolon (`auto_olusturuldu`, `mrp_calculation_id`) — `order_id` zaten vardı
- Yeni tablo: `uys_mrp_calculations` (her MRP run snapshot için: brut/stok/açık tedarik/net JSONB alanları)

Idempotent + RAISE NOTICE ile doğrulama.

### 2. RBAC (2 yeni aksiyon)
`permissions.ts`:
- `tedarik_auto` — autoZincir tetiklediğinde otomatik tedarik (planlama default)
- `auto_chain_run` — autoZincir başlatma yetkisi (planlama default)

`mrp_calc` ve `cutting_add` zaten vardı, duplicate yaratmadık.

### 3. Topbar Zincir Göstergeleri (Faz 5)
`Topbar.tsx`'e useMemo cache'li 3 tıklanabilir badge:
- **KESİM** (Scissors ikonu) — kesim operasyonlu, plana atanmamış İE sayısı
- **MRP** (Calculator ikonu) — `mrpDurum != 'tamamlandi'` aktif sipariş sayısı
- **TEDARİK** (Truck ikonu) — `geldi=false`, `durum != 'iptal'/'tamamlandi'` tedarik sayısı

Renk eşiği: 0=yeşil, 1-5=sarı, 6+=kırmızı. Tıklayınca `#/cutting`, `#/orders`, `#/procurement`'e gider. `hidden md:flex` — mobil'de gizli (yer kalmıyor).

---

## ⚠️ ÖNEMLİ — Schema Değişikliği Var

Bu patch'te SQL migration var. v15.42 deneyimi gibi:
1. Apply (dosyaları kopyala)
2. **Supabase Studio'da SQL çalıştır**
3. Push

SQL çalıştırılmadan push edilirse runtime'da insert silent reject olur (yeni kolonlar şemada yok).

---

## Sırada — v15.48: Faz 2 Kesim Optimizasyon

### Plan
- `src/lib/cutting-optimizer.ts` (yeni dosya, ~250 satır)
  - `optimizeCutting(input): CuttingPlan` — algoritma
  - **BOM kuralı:** `pieces = floor(raw / cut)`, `waste %` hesapla, en çok parça + en az fire seç
  - Greedy first-fit decreasing (büyükten küçüğe)
  - Fire optimize döngüsü (max 50 iterasyon, `_maxLoop`)
  - Kalan ≥50mm → artık malzeme kartı önerisi
- `pages/Cutting.tsx`'e "⚙ Plan Oluştur" butonu
- 5 senaryolu birim test (`cutting-optimizer.test.ts`):
  - 100 parça × 1m, 6m hammadde — fire % beklenen aralıkta
  - Levha kesim (en × boy)
  - Karışık boylar
  - Stok yetersiz
  - Tek parça kalan artık
- Plan birleştirme (aynı hammadde için açık plan varsa ona ekle, yeni açma)
- Kesim artığı → otomatik malzeme kartı (durum=tamamlandi olunca)

**Tahmini süre:** 2-3 saat (algoritma + UI + test)

---

## Sonraki Sürümler

- **v15.48** — Faz 2 (Kesim Optimizasyon)
- **v15.49** — Faz 3 (MRP Modal) — Faz B Parça 2 ile entegre yapılırsa daha verimli
- **v15.50** — Faz 4 (autoZincir orchestration)
- **v15.50.1** — Faz 6 (Test + benchmark)

---

## Komutlar

**Apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-47
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Supabase'de SQL çalıştır** (kritik adım):
- Supabase Studio → SQL Editor: https://supabase.com/dashboard/project/lmhcobrgrnvtprvmcito/sql
- `sql\20260425_v15_47_uretim_zinciri_faz1.sql` içeriğini yapıştır
- RUN
- Output'ta 3 NOTICE satırı görmelisin: `[v15.47] uys_kesim_planlari yeni kolonlar: 4/4`, `[v15.47] uys_tedarikler yeni kolonlar: 2/2`, `[v15.47] uys_mrp_calculations tablosu: 1`

**Commit + push:**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.47: uretim zinciri faz 1+5 - veri modeli + topbar gostergeleri"
git push
```

3/3 yeşil bekleniyor (audit-schema yeni SQL'i okuyacak).

**Push sonrası temizlik (Hijyen Kuralı §18):**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-47.zip","$env:USERPROFILE\Downloads\patch-v15-47" -Recurse -Force -ErrorAction SilentlyContinue
```

---

**v15.47 patch'i hazır.**
