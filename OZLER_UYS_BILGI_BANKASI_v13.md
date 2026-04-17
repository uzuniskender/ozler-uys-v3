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

### 🔧 "Stok Yok" Uyarıları Yumuşatıldı (Hem Admin Hem Operatör)

**Sorun:** İE'de HM DB stoğu 0 görününce hem operatör ekranı (OperatorPanel) hem admin ekranı (ProductionEntry) alarmlı kırmızı uyarılar gösteriyordu — bu iş kuralıyla çelişiyor:
> İE oluşturulduğunda HM tahsis edilmiş sayılır, hat kenarına geldi. Sadece `q + f ≤ hedef` hard constraint.

**Uygulanan Düzeltmeler:**

**1. OperatorPanel.tsx — Input blokajı kaldırıldı:**
- Önce: `mx = Math.min(kalan, maxUretim)` → stok 0 ise giriş yok
- Şimdi: Sadece `v > kalan` kontrolü. `save()`'deki `q+f > freshKalan` hard blokajı yeterli.
- "⛔ STOK YOK" kırmızı → "ℹ️ DB STOĞU GÖRÜNMÜYOR" amber bilgilendirme.

**2. ProductionEntry.tsx (admin ekranı) — Display yumuşatıldı:**
- Başlık: "Hammadde Stok Durumu — Max: X adet" → "Hammadde DB Stoğu · bilgi amaçlı — HM iş emrine tahsislidir"
- "Durum" sütunu (✓/✗ renkli) tamamen kaldırıldı
- Kırmızı/amber renkler → nötr zinc-400
- Input zaten doğruydu (`max={kalan}`, stok yok blokajı save()'de kaldırılmıştı satır 327'de)

**Sonuç:** Her iki ekranda da DB stoğu sadece bilgi olarak gözüküyor, alarmsız. Hard constraint sadece `q+f ≤ hedef`.

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
