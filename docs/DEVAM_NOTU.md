# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 30 Nisan 2026 sabah-öğle (oturum, ~05:00–08:30)
**Son canlı sürüm:** v16.16 (DB migration, kod push'u yok)
**Bugün push edilen:** **14 sürüm** (v16.00 → v16.15) + 1 doc commit (e753e71) + **v16.16 DB migration** (updated_at trigger 30 tabloya).

---

## YENİ OTURUM AÇILIŞINDA İLK ADIM

```
UYS v3 devamı. Bilgi Bankası açılış kuralı (§0):
docs/UYS_v3_Bilgi_Bankasi.md (özellikle §0, §18 ailesi, §26 (29 Nis),
  §27 (30 Nis sabah) ⭐ YENİ — 8 alt bölüm) +
docs/saha_model_28nis2026.md (13 senaryo) +
docs/DEVAM_NOTU.md (bu dosya, 30 Nis 08:30 yenilendi) +
docs/is_emri/00_BACKLOG_Master.md (Son Sürümler v16.01-v16.15 dahil)
oku.

Önceki chat kapandı/kapanacak — tüm bilgi docs/'ta.
```

**Yeni ortam değişiklikleri (30 Nis):**
- Supabase MCP server bağlandı (Claude canlı DB'den SELECT/UPDATE/INSERT yapabilir)
- Claude Code VS Code uzantısı kuruldu (sabah rate limit oldu, gün ortasında PowerShell zip-apply'a geri dönüldü)
- localStorage debug flag (`UYS_DEBUG_MRP=true`) ile mrp.ts canlı log akışı

---

## 30 NİSAN ÖZETİ — 14 SÜRÜM + 1 DOC + 4 DB FIX

### Bugünün üç büyük başarısı

1. **Sağlık raporu 13 PASS · 2 WARN → 17 PASS · 0 WARN · 0 FAIL** ⭐ (tarihte ilk)
2. **Saha krizi: 3 sipariş × 5 Mayıs termin** kurtarıldı (S26A_03150 + 03146 + 03151), 4 hammadde tedariği açıldı, 7 yuvarlama hatası IE düzeltildi
3. **MRP cutting override mantığı kök çözümü** (LEVHA skip + max(BOM,plan) + camelCase mapping) — gizli kalan eksikleri açığa çıkardı

### Sürüm tablosu

| Sürüm | Konu | Kritiklik |
|---|---|---|
| v16.00 | Sağlık #15 sentinel `recipes`/`recs` tipo (ReferenceError → tüm rapor patladı) | 🔴 hotfix |
| v16.01 | MRP filtre `dbEksik` band-aid (`mrp_durum='eksik'` listede görünsün) | 🟡 ara çözüm |
| v16.02 | Cutting override LEVHA skip — yüzey kesim 1D plan adedi güvenilmez | 🔴 saha kritik |
| v16.03 | Sentinel #16 sipariş-toplam HM (cutting override bypass) | 🟢 koruma |
| v16.04 | Sentinel #23 — Hesapla UPDATE error/count=0 görünür olsun | 🟢 koruma |
| v16.05 | Sipariş-bütünü PlanBekliyor (#20) — `getEffectiveStatus` hammadde rekabet farkındalığı | 🟢 mimari |
| v16.07 | **KÖK ÇÖZÜM**: cutting override `max(BOM, plan)` — v16.02 LEVHA özel halinin genelleştirilmesi | 🔴 büyük etki |
| v16.08 | `buildWorkOrders` `Math.ceil` — IE.hm.miktarTotal yuvarlama hatası kalıcı fix | 🔴 saha kritik |
| v16.09 | Sentinel #17 — IE.hm.miktarTotal=0 + reçetede Hammadde varsa FAIL | 🟢 koruma |
| v16.11 | hesaplaMRP debug log altyapısı (localStorage flag) | 🛠 araç |
| v16.12 | Sağlık raporu camelCase mapping wrapper — `fetchAll` raw DB ile `hesaplaMRP` arasındaki snake/camel uyumsuzluğu | 🔴 +41 vakası kök neden |
| v16.13 | Sentinel #15 `recipes`→`recs` (v16.00 fix v16.12 base'imdeki eski snapshot'tan kazara silinmişti) | 🔴 kaza fix |
| v16.14 | Sentinel #16 + #17 geri eklendi (v16.12 patch'imde aynı kaza ile silinmişti) | 🔴 kaza fix |
| v16.15 (30 Nis öğle) | **`scripts/saglik-syntax-check.cjs`** — prebuild hook (kontroller.push>=17 + recipes referans yasağı) | 🟢 yapısal koruma |
| **v16.16 (30 Nis öğle, DB-only)** | **PostgreSQL `updated_at` trigger 30 tabloya yayıldı** — `set_updated_at()` fonksiyonu zaten vardı (sadece uys_hm_tipleri'nde aktifdi), 29 yeni trigger eklendi. Her UPDATE'te `updated_at = NOW()` otomatik. **#23 "bug değil" notu artık tamamen kapandı**, audit/debug gözlemi rahatlar. | 🟢 temizlik |

Doc commit: `e753e71` (DEVAM_NOTU + Backlog + Bilgi Bankası §27 ilk yazım — sonra §27 da kaybolmuştu, bu sefer v16.15 ile yeniden ve kalıcı yazıldı).

---

## ANA ÇIKTILAR

### 1. MRP Cutting Override mantığı (v16.02 + v16.07)

**Eski mantık:** Cutting plan varsa BOM patlatmasını **silip** plan satırlarındaki `hamAdet` toplamını yazar. Gizli problem: `boykesimOptimum` 1D bin-packing yapıyor, yüzey kesim (LEVHA) için yanıltıcı sayı üretiyor + plan stoğa kalibre tutulduğu için sahanın gerçek ihtiyacını yutuyor.

**v16.02:** LEVHA hammadde tipinde override skip → BOM korunur → plywood gerçek eksiği görünür hale geldi (saha vakası: S26A_03150 plywood 131 levha eksik).

**v16.07 (kök):** Tüm tipler için `max(BOM, plan)` mantığı. Plan optimize ettiyse onu kullan, BOM aşan vakalarda BOM'a güven. Profil/boru için de gizli eksikleri açığa çıkardı (PROFIL 75x50x2 +7, PROFIL 50x100x3 +4, BORU 6060 +3).

### 2. IE Yuvarlama Hatası (v16.08 + #17 sentinel)

**Saha vakası:** S26A_03151 IE-08 PLYWOOD 477×1477. Reçete miktar 1/6 = 0.16666 (ondalıklı). buildWorkOrders `2 × 0.16666 = 0.333`'ü integer'a yuvarladı = **0**. IE.hm.miktarTotal=0 → kesim algoritması "hammadde gerekmez" sandı, plansız kaldı.

**v16.08:** `miktarTotal: m > 0 ? Math.max(1, Math.ceil(t * m)) : 0`. Ondalıklı reçeteler artık her zaman en az 1 birim hammadde gerektirir.

**DB fix:** 7 mevcut etkilenen IE düzeltildi (Supabase MCP üzerinden tek SQL UPDATE).

**Sentinel #17:** Yeni IE'lerde aynı vaka olursa Sağlık raporunda **FAIL**.

### 3. Sağlık Raporu CamelCase Mapping (v16.12)

**Kök neden:** DataManagement.tsx'te `fetchAll('uys_recipes')` raw DB sonucu (snake_case). `hesaplaMRP` camelCase bekliyor (`r.mamulKod`). Sonuç: `recipes.find(r => r.mamulKod === ...)` her zaman undefined → fallback recursive yola düşüyor → çift sayım.

**Saha kanıtı:** PROFIL 75x50x4 doğrudan BOM 150, gerçek eksik 0. Sağlık #5 yanlış olarak **41 net** dedi → çift sayım. v16.12 sonrası: gerçek 0.

**v16.12:** wos/recs/orders/plans/stoks/teds için 5 mapping wrapper (...spread + alias).

### 4. Sipariş-Bütünü PlanBekliyor (v16.05 — #20)

**Eski mantık:** `getEffectiveStatus` her IE'yi bağımsız değerlendiriyor. Aynı siparişteki birden çok IE aynı hammaddeyi paylaşırken, sistem her birini tek tek stoğa karşılaştırıyor — toplam ihtiyacı görmüyor.

**v16.05:** `computeOrderHammaddeEksik` helper + `getEffectiveStatus` `orderHmEksikMap` parametresi. Topbar PlanBekleyen ve WorkOrders rozetleri sahaya gerçek durumu söyler.

### 5. Patch Hijyen (v16.15 — yapısal koruma)

`scripts/saglik-syntax-check.cjs` prebuild hook'a eklendi. DataManagement.tsx'te:
- `kontroller.push({` sayısı 17'den az ise build PATLAR
- `recipes` kelimesi kod referansı olarak (yorum/string sabiti hariç) varsa build PATLAR

Bu, bugünkü kazaları kalıcı engeller. Aynı tip yanlışlık bir daha imkansız.

---

## SENTINEL TOPLAM: 17

- #1-11 önceden vardı
- #12, #13, #14 (29 Nis, v15.89)
- #15 (29 Nis, v15.99)
- **#16 (30 Nis, v16.03)** — sipariş-toplam HM (cutting override bypass)
- **#17 (30 Nis, v16.09)** — hm.miktarTotal=0 yuvarlama hatası

---

## BUGÜNÜN KAZALAR ZİNCİRİ — DERS

`recipes` tipo bug'ı **3 kere** ortaya çıktı:
- v16.00: ben düzelttim
- v16.03: Claude Code Sentinel #16 yazarken eski snapshot'tan başladı, fix kayboldu
- v16.13: ben v16.12 patch'imi /home/claude'daki eski snapshot'tan kurarken yine fix kayboldu

Plus v16.12 patch'imde **#16 + #17 sentinel'leri kazara sildim** (eski snapshot'a mapping wrapper eklerken yeni kontrolleri unuttum). v16.14 ile geri eklendi.

**v16.15 ile yapısal koruma kalıcı.** Yeni patch hijyen kuralı Bilgi Bankası §27.7 + §27.8'de detaylı.

---

## YARIN İÇİN ÖNCELİKLER

### Kritik
- **#5 Sevkiyat Oluşturma Formu** — production-blocker, UYS v3'te liste var, oluşturma yok. 4-6 saat.
- **#21 2D bin-packing** — yüzey kesim için. Mevcut `boykesimOptimum` 1D, plywood %30-40 fire fazla. Hafta seviyesi tasarım iş.

### Orta
- **#23 "bug değil" kapanışı** — DB'ye trigger eklemek. Tüm UYS tabloları için BEFORE UPDATE → updated_at=NOW(). Bu olmadan "kim ne zaman değiştirdi" gözlemi zorlaşıyor (ama saha açısından zarar yok).
- **#7 Toplu Sipariş Excel İmport** — v15.98'de bulk fix yapıldı, polish gerek (durum/termin parser).
- **#8 PDF Çıktı (İş Emri + Sevk İrsaliyesi)** — Kalite Müdürü için zorunlu kağıt belge.
- **#12 RLS Tam Uygulama** — `allow_all` policy hala iç ağda gerçek koruma yok. v16.0.0 Faz 1.1a yapılmıştı, kalanı 1-2 hafta.

### Düşük
- **MRP Topbar tıklama filter** (v16.06 backlog) — Plan Bekleyen rozeti tıklayınca WorkOrders'a filtreli git. Şu an tüm 136 IE'yi gösteriyor.
- **Sağlık raporu version string** — DataManagement.tsx satır 848 hala `'v15.99'`. Kozmetik, saha etkisi yok.

---

## BUGÜNÜN BİLİNEN GERÇEK WARN'LARI (KOD DEĞİL, SAHA AKSİYON)

Hiçbiri kalmadı — saha temiz, tüm tedarikler açıldı, stok yeterli.

Topbar (sabah 08:30):
- KESİM 0 · MRP 0 · TEDARİK 0 · PLAN BEKLEYEN 0
- Sağlık: 17/17 PASS

---

## ÖNEMLİ KURALLAR (DEĞİŞMEDİ + 1 EKLENDİ)

- §18 Downloads hijyen
- §18.2 Yeni tablo konvansiyonu
- §18.3 Durum string normalize
- §18.4 Artık yönetimi havuz tek standart
- §18.5 SQL `public.` prefix
- §20 RLS allow_all (iç ağ kabul)
- §21 MRP formülü: Net = İhtiyaç − Stok − Yolda
- **§27 (YENİ):** Patch hijyen + 30 Nis dersleri (8 alt bölüm)

---

## SİL UYARISI

⚠️ **Bu chat 30 Nis 2026 öğlen kapanacak.** Bilgilerin tamamı:
- `docs/UYS_v3_Bilgi_Bankasi.md` §22-§26 + **§27 (8 alt bölüm) ⭐**
- `docs/saha_model_28nis2026.md`
- `docs/DEVAM_NOTU.md` (bu dosya — yenilendi)
- `docs/is_emri/00_BACKLOG_Master.md` (v16.01-v16.15 + #23 "bug değil" notu)
- `scripts/saglik-syntax-check.cjs` (YENİ — patch hijyen koruması)

Yarın yeni Claude oturumunda chat aramaya **gerek yok**.

İyi günler Buket. 🌞 — **14 sürüm + 4 DB fix + 5 saha krizi** tek günde rekor.
