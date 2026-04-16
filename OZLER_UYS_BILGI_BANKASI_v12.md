# ÖZLER UYS v3 — BİLGİ BANKASI v12
**Son güncelleme:** 16 Nisan 2026

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
| **Çalışma dizini** | `/home/claude/` (konteynerde) |

**Operatör oturumu:** sessionStorage'da (tab kapanınca silinir). Supabase RLS şu an `allow_all` (USING true WITH CHECK true) — **güvenlik uyarısı:** anon key ile dışarıdan API erişimi mümkün. İleride `authenticated-only` policy veya Supabase Auth entegrasyonu ile ele alınacak.

**Son deploy hash:** `CC9mMAkG` (16 Nisan akşamı itibarıyla — bu bundle eski, birçok fix deploy bekliyor)

---

## 2. Bugün Yapılan İşler (16 Nisan 2026)

### Fire & Hammadde Hesap Modeli (Tamamlandı)

**Doğru iş mantığı (Buket'in tanımı):**
> İş emri = hammadde paketi tahsisi. Sipariş 5 için İE hedef=5 → hat kenarına 5 birim HM geldi. `q + f ≤ hedef` **hard constraint**, aşılamaz. Fire varsa sipariş eksik kapatılır, **admin onayı ile** telafi İE açılır.

**Uygulanan kurallar:**
- `q + f > freshKalan` → kayıt reddi (toast, override yok)
- Mamul stok girişi: sadece `q`
- HM tüketimi: `(q + f) × BOM` üzerinden
- Fire için mamul stok çıkışı kaldırıldı (fire zaten stoğa girmediği için çıkması anlamsızdı)
- Stok kontrolü kaldırıldı (İE oluşturma anında HM zaten tahsis edilmiş sayılıyor)
- Auto-close kriteri: `q + f ≥ hedef` (fire dahil İE kapanır)
- Fire kaydı olur, **telafi İE otomatik açılmaz** — Reports → Fire sekmesinde admin onayı ile açılır
- Dashboard'a "Telafi Onay Bekleyen" kartı (amber, adet bazlı)

**Düzenlenen yerler:**
- `ProductionEntry.tsx` (admin yığın girişi): 2 fire insert, stok kontrolü, hard block, auto-close, fireIEOlustur çağrısı kaldırıldı
- `OperatorPanel.tsx` (operatör kendi girişi): edit + new mode, aynı değişiklikler
- `Dashboard.tsx`: bekleyenTelafi hesabı + StatCard
- `Reports.tsx` → Fire tab: zaten B7'de var olan 🔁 Aç ve toplu butonlar
- `WorkOrders.tsx`: İE listesinde 🔁 Fire Telafisi (kırmızı) ve Sipariş Dışı (amber) rozetleri + detay modal'da 📝 Not kutusu

---

### Malzeme Cascade & Duplicate Temizlik (Tamamlandı)

**Bug 1:** `cascadeAdKod` state'ten stale data okuyordu → düzeltildi, artık Supabase'den fresh data çekiyor.

**Bug 2:** Excel toplu upload'da cascade hiç yoktu → düzeltildi, ad değişikliği BOM + Recipe + İE'lere yansıyor.

**Bug 3:** Case-sensitive kod karşılaştırması → "mm" / "MM" farklı kayıtlar oluşturuyordu → düzeltildi: `UPPER(TRIM())` ile eşleştirme.

**Bug 4:** YarıMamul için tip seçimi (Profil/Boru/Sac) yoktu → eklendi, hem UI hem kayıt.

**Bug 5:** Malzeme tablosunda kod + tip sütunlarında uzun kodlar iki satıra bölünüyordu → `whitespace-nowrap` ile tek satıra sabitlendi.

**DataManagement yeni butonlar:**
- 🗑 **Orphan Temizle** — silinmiş ana kayıtların (İE/log/fire) bağlıları tek tık temizleme
- 🔀 **Duplicate Malzeme Birleştir** — case-insensitive birleştirme, en eski ID korunur, BOM/Reçete/İE/Stok/Kesim planları cascade güncellenir
- **Cascade silme** — log/İE/sipariş silindiğinde bağlı kayıtlar (stok hareketleri, fire, aktif çalışma) otomatik silinir

---

### Backlog B1-B7 (Önceki oturumda bitti, bu oturumda pekiştirildi)

| # | İş | Durum |
|---|---|---|
| B1 | Kesim planı birleştirme (kilitli satır + bekliyor merge) | ✓ |
| B2 | Realtime sync (9 → 24 tablo, selective reload, debounce 800ms) | ✓ SQL deploy bekliyor |
| B3 | Operatör mesajları paneli (/messages, WhatsApp-style) | ✓ |
| B4 | ActiveWork canlı takip (30s tick, stagnation warnings) | ✓ |
| B5 | Toplu sipariş girişi Excel (BulkOrderImportModal) | ✓ |
| B6 | İşlem süresi → reçeteye (sureAnaliz.ts, inline badge) | ✓ |
| B7 | Fire → sipariş dışı İE (fireTelafi.ts, manuel onay) | ✓ |

---

## 3. Deploy Durumu

**ÖNEMLİ:** Son ZIP (`ozler-uys-v3-full.zip`) `/mnt/user-data/outputs/`'ta hazır. Tüm yukarıdaki değişiklikleri içeriyor ama **canlıya deploy edilmedi**. Canlı bundle hala `CC9mMAkG` hashli — eski kod çalışıyor.

**Deploy adımları:**
1. ZIP içeriğini repo'ya kopyala (dosyaların üstüne)
2. `git add -A && git commit -m "v12 kapsamlı fix" && git push`
3. GitHub Actions Pages build'i bekle (~1-2 dk)
4. Tarayıcıda Ctrl+Shift+R (hard refresh)
5. Konsolda doğrula: `fetch('./index.html').then(r=>r.text()).then(t=>console.log(t.match(/index-\w+\.js/)[0]))` — hash değişmeli

**Deploy sonrası çalıştırılacak SQL'ler:**
- `sql_realtime.sql` (24 tablo realtime publication'a ekleniyor)
- `sql_fire_telafi.sql` (uys_fire_logs.telafi_wo_id kolonu — büyük ihtimalle zaten çalıştırılmış)
- Gerekirse `NOTIFY pgrst, 'reload schema';`

**Deploy sonrası yapılacak tek seferlik işlemler:**
1. Veri Yönetimi → 🗑 **Orphan Temizle** (eski orphan fire/stok kayıtları)
2. Veri Yönetimi → 🔀 **Duplicate Malzeme Birleştir** (22 duplicate grup — listesi aşağıda)

---

## 4. Bilinen Duplicate Malzeme Listesi (16 Nisan)

Buket'in Excel yüklemesinden kaynaklı 22 grup var. Kod/ad kayıtları "mm" ↔ "MM" case farkıyla çoğaldı.

**Örnekler:**
- `40x40x2 120mm` + `40x40x2 120MM`
- `YMH100334-3000 mm - Ø60,3-2 mm` + `YMH100334-3000 MM - Ø60,3-2 MM`
- `ARTIK_H0102C030093044_175mm` + `ARTIK_H0102C030093044_175MM`
- `BORU Ø48,3x2,5 mm - 6000 mm` + `BORU Ø48,3x2,5 MM - 6000 MM`

**Tam listeyi almak için:**
```sql
SELECT UPPER(TRIM(kod)) AS norm_kod, COUNT(*) AS adet,
       array_agg(kod ORDER BY aktif DESC NULLS LAST) AS kodlar,
       array_agg(id ORDER BY aktif DESC NULLS LAST) AS ids
FROM uys_malzemeler
GROUP BY UPPER(TRIM(kod))
HAVING COUNT(*) > 1;
```

Birleştirme butonu en eski ID'yi (küçük mm'li, referanslı olan) tutar, yeni duplicate'leri siler, tüm referansları büyük MM'ye çevirir.

---

## 5. Bekleyen İşler / Not Alınanlar

1. **Cascade silme testi** — log sil → bağlılar da gitti mi doğrula
2. **Loglarda saat göstergesi** — şu an tarih var, saat yok
3. **Log'a tıklayınca ilgili kayda git** — detay/edit modalı veya İE ekranı
4. **Malzeme isim cascade testi** — YMH50x100x3-79 adını değiştir, BOM/Recipes'ta yansıdı mı kontrol
5. **Malzeme tablosu iyileştirmeleri (önerildi, seçim bekleniyor):**
   - Ölçü sütunlarını tek sütuna birleştir ("40×40×2 L50", "Ø48.3 L3000" formatı)
   - Sticky header
   - Sayfalama (50'şerli)
   - Tip rozetini kod altına taşı
   - Zebra satırlar
6. **B8 MRP stoktan ver** — MRP algoritması "önce stoktan, eksiği tedarik" mantığı
7. **B9 Test DB ayrı Supabase** — canlı veriyi korumak için
8. **Supabase RLS güvenlik** — `allow_all` policy'sinin `authenticated-only`'ye çevrilmesi ya da Supabase Auth entegrasyonu

---

## 6. RBAC Yetki Sistemi (Aktif)

**Tablolar:**
- `uys_kullanicilar` — kullanıcı + rol
- `uys_yetki_ayarlari` — aksiyon bazlı (permissions)

**Kod:**
- `permissions.ts` — 80+ aksiyon, modül-level `_overrides`
- `useAuth.ts` — `can()` fonksiyonu
- `KullaniciPanel` + `YetkiPanel` (checkbox matris editörü) DataManagement'ta

**Aksiyon bazlı yetki matrisi:** 4 rol için yaklaşık 25 sayfa × 80+ aksiyon satırı. Arayüzden düzenlenebilir.

---

## 7. Önceki Dönemden Devam Eden Projeler

- **CBAM compliance** — 2025 Q1-Q4 tamamen raporlandı. O3CI portal kayıt bekliyor
- **GFB/çevre izni (Dilovası)** — Kapasite raporu alındı (TOBB 47050), PTD ve motor gücü beyannamesi hazır
- **İSG machine instructions** — TL-ISG-001 → 016 tamamlandı. Sonraki: TL-ISG-017
- **Libya order documentation** — ürün detayları bekleniyor
- **Compaco Romania 8D** — RAPIDO-UNI Panel 150x270 D-Type keyhole positioning
- **Sertifikalar:** TS EN 12810-1, TS EN 74-3, EN 1090-2, ISO 45001, ISO 14001 (ISO 9001 yok)
- **Akkuyu NGS / IC İÇTAŞ:** DoC OZLER-2026-002, UNISCAFF sistemi
- **NETBİS, Tüpraş** — guidance verildi

---

## 8. Başlarken (Yeni Chat İçin Hızlı Giriş)

1. Bu dosyayı (`OZLER_UYS_BILGI_BANKASI_v12.md`) yeni chat'e yükle
2. `ozler-uys-v3-full.zip`'i de yükle (son kaynak kod)
3. İlk görev genelde: deploy kontrolü + test sonuçları + kalan bekleyen işler
4. Öncelik: yukarıdaki "Bekleyen İşler" listesinden sırayla, ya da yeni acil işe göre

**Uyarılar:**
- Passwords/credentials sohbette yazılmaz, sadece kodda
- Güvenlik katmanı (debugger trap, console disable) online modda kapalı
- ZIP her seferinde üzerine yazılır (`/mnt/user-data/outputs/ozler-uys-v3-full.zip`)
