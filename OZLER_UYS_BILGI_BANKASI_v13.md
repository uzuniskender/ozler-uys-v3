# ÖZLER UYS v3 — BİLGİ BANKASI v13
**Son güncelleme:** 17 Nisan 2026

---

## 1. Temel Bilgiler

| | |
|---|---|
| **Repo** | https://github.com/uzuniskender/ozler-uys-v3 |
| **Canlı URL** | https://uzuniskender.github.io/ozler-uys-v3/ |
| **Supabase Project** | `kudpuqqxxkhuxhhxqbjw` (Frankfurt) |
| **Stack** | React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase |
| **Tablolar** | 21 ana tablo (uys_ öneki) |
| **RBAC** | 4 rol — Admin, Üretim Sorumlusu, Planlama, Depocu |

**Operatör oturumu:** sessionStorage'da (tab kapanınca silinir). Supabase RLS şu an `allow_all` — güvenlik uyarısı anon key'le dışarıdan API erişimi mümkün.

---

## 2. Bugün Yapılan İşler (17 Nisan 2026)

### 🔧 "Stok Yok" Blokajı Kaldırıldı (OperatorPanel)

**Sorun:** Operatör kendi giriş ekranında (OperatorPanel.tsx) DB stoğu 0 göründüğünde adet girişi yapamıyordu — "Max: 0" toast'u çıkıp değer otomatik 0'a düşüyordu.

**Kök Neden:** Input onChange'de `mx = Math.min(kalan, maxUretim)` kullanılıyordu. `maxUretim` DB stoğuna göre hesaplandığı için stok 0 ise girişi bloklıyordu. Oysa iş kuralı:
> İE oluşturulduğunda HM tahsis edilmiş sayılır, hat kenarına geldi. Sadece `q + f ≤ hedef` hard constraint.

**Uygulanan Düzeltme (src/pages/OperatorPanel.tsx):**

1. **Input blokajı kaldırıldı** (satır ~1015):
   - Önce: `mx = hmSatirlar.length > 0 ? Math.min(kalan, maxUretim) : kalan`
   - Şimdi: Sadece `v > kalan` kontrolü. `save()` içindeki `q+f > freshKalan` hard blokajı zaten mevcut (satır 798).

2. **"STOK YOK" kırmızı alarmı yumuşatıldı** (satır ~967):
   - Başlık: `⛔ STOK YOK` → `ℹ️ DB STOĞU GÖRÜNMÜYOR`
   - Renk: red → amber
   - Alt not: "HM iş emrine tahsisli — bilgi amaçlı"
   - Kısmi uyarı bilgilendirici: "DB stoğuna göre X adet yapılabilir görünüyor. Gerçek hat kenarındaki HM ile üretime devam edebilirsin."

**Not:** ProductionEntry.tsx (admin yığın girişi) zaten doğruydu — stok sadece göstergeydi, blokaj yoktu. Sorun yalnızca OperatorPanel'deydi.

---

## 3. Önceki Oturumdan Devam Edenler

### Fire & Hammadde Hesap Modeli (16 Nisan — Tamamlandı)

**İş mantığı:**
- `q + f ≤ hedef` hard constraint (save'de)
- Mamul stok girişi: sadece `q`
- HM tüketimi: `(q + f) × BOM`
- Fire için mamul stok çıkışı kaldırıldı
- Auto-close: `q + f ≥ hedef`
- Fire kaydı olur, telafi İE **otomatik açılmaz** — Reports → Fire → admin onayı
- Dashboard'a "Telafi Onay Bekleyen" kartı

### Malzeme Cascade & Duplicate Temizlik (16 Nisan — Tamamlandı)

- `cascadeAdKod` stale state → fresh DB okuma
- Excel toplu upload'da cascade eksikti → eklendi
- Case-insensitive kod eşleştirme (UPPER(TRIM()))
- YarıMamul için Profil/Boru/Sac tip seçimi
- Malzeme tablosunda `whitespace-nowrap` (iki satıra bölünme fix)
- DataManagement: 🗑 Orphan Temizle + 🔀 Duplicate Malzeme Birleştir

### Backlog B1-B7 (Tamamlandı)

| # | İş | Durum |
|---|---|---|
| B1 | Kesim planı birleştirme | ✓ |
| B2 | Realtime sync 24 tablo | ✓ SQL deploy bekliyor |
| B3 | Operatör mesajları (/messages) | ✓ |
| B4 | ActiveWork canlı takip | ✓ |
| B5 | Toplu sipariş Excel girişi | ✓ |
| B6 | İşlem süresi → reçeteye | ✓ |
| B7 | Fire → sipariş dışı İE (manuel onay) | ✓ |

---

## 4. Deploy Durumu

**Son ZIP:** `/mnt/user-data/outputs/ozler-uys-v3-full.zip` (17 Nisan, stok blokajı fix dahil)

**Build:** Yerel `vite build` temiz (19.58s, bundle `index-BVsgdg_j.js`). TS errors var ama pre-existing (w possibly undefined, kullanılmayan importlar). CI'ı etkilemiyor.

**Deploy Adımları:**
1. ZIP'i repo'ya kopyala
2. `git add -A && git commit -m "v13 stok yok blokaj fix" && git push`
3. GitHub Actions build (~1-2 dk)
4. Hard refresh (Ctrl+Shift+R)

**Deploy Sonrası SQL'ler (hâlâ bekleyen):**
- `sql_realtime.sql` (24 tablo realtime)
- `sql_fire_telafi.sql` (uys_fire_logs.telafi_wo_id)

**Tek Seferlik İşlemler (hâlâ bekleyen):**
1. Veri Yönetimi → 🗑 Orphan Temizle
2. Veri Yönetimi → 🔀 Duplicate Malzeme Birleştir (22 grup)

---

## 5. Bekleyen İşler

1. **Cascade silme testi** — log sil → bağlılar gitti mi
2. **Loglarda saat göstergesi** (şu an sadece tarih)
3. **Log'a tıklayınca ilgili kayda git**
4. **Malzeme isim cascade testi** (YMH50x100x3-79 adını değiştir, BOM/Recipes'ta yansıdı mı)
5. **Malzeme tablosu iyileştirmeleri:**
   - Ölçü sütunlarını tek sütuna birleştir ("40×40×2 L50")
   - Sticky header, sayfalama, zebra satırlar
   - Tip rozetini kod altına taşı
6. **B8 MRP stoktan ver** — önce stoktan, eksiği tedarik
7. **B9 Test DB ayrı Supabase**
8. **Supabase RLS** — allow_all → authenticated-only
9. **TS errors temizliği** (w possibly undefined, kullanılmayan importlar)

---

## 6. RBAC Yetki Sistemi (Aktif)

- `uys_kullanicilar` + `uys_yetki_ayarlari`
- `permissions.ts` (80+ aksiyon, modül-level `_overrides`)
- `useAuth.ts` → `can()`
- KullaniciPanel + YetkiPanel (checkbox matris) → DataManagement

---

## 7. Devam Eden Diğer Projeler

- CBAM Q1-Q4 2025 raporlandı, O3CI bekliyor
- GFB/çevre izni — Kapasite raporu alındı, PTD hazır
- İSG machine instructions TL-ISG-001 → 016, sonraki: 017
- Libya order documentation — ürün detayı bekleniyor
- Compaco Romania 8D — keyhole positioning
- Sertifikalar: TS EN 12810-1, TS EN 74-3, EN 1090-2, ISO 45001, ISO 14001
- Akkuyu NGS / IC İÇTAŞ DoC OZLER-2026-002

---

## 8. Yeni Chat İçin Hızlı Giriş

1. Bu dosyayı (`OZLER_UYS_BILGI_BANKASI_v13.md`) yükle
2. `ozler-uys-v3-full.zip`'i yükle
3. İlk görev: deploy kontrolü + test sonuçları + stok yok fix test
