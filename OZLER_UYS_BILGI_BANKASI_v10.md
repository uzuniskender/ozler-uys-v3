# ÖZLER UYS v3 — Bilgi Bankası v10
> Son güncelleme: 2026-04-15 (Part 8: Login + Malzeme Revizyon + Reçete UX + BOM Zincir)

## Proje Bilgileri
- **Repo:** https://github.com/uzuniskender/ozler-uys-v3
- **URL:** https://uzuniskender.github.io/ozler-uys-v3/
- **Supabase:** kudpuqqxxkhuxhhxqbjw (Frankfurt)
- **Stack:** React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase
- **Önceki transcriptler:**
  - Part 1–4: `/mnt/transcripts/` altında mevcut
  - Part 5: Dashboard + İzin Sistemi + Operatör İyileştirmeleri
  - Part 6: Güvenlik + MRP + Kesim + UI İyileştirmeleri
  - Part 7: RBAC Yetki Sistemi + Bug Fix'ler + BOM Reçete Filtresi
  - Part 8: Login + Malzeme Revizyon Sistemi + Reçete UX + Zincirleme Güncelleme

---

## ✅ TAMAMLANAN (Part 8)

### Login Yeniden Tasarım
- **Buton standardizasyonu** — Tüm butonlar py-3, rounded-xl, font-bold
- **Sıralama:** 1) Kullanıcı Girişi (her zaman açık, en üstte) 2) Operatör Girişi 3) Misafir Girişi 4) Admin Girişi (Google, en altta, küçük)
- **Logo ikonu** — mavi "Ö" harfi, rounded-2xl kutu
- **Operatör girişi ayrı ekran** — tam sayfa, "← Giriş Ekranına Dön" butonu
- **Operatör paneli geri dön** — RBAC roller dahil tüm kullanıcılar için "← Yönetime Dön" butonu

### Malzeme Listesi İyileştirmeleri
- **Kompakt tablo** — py-[5px] satır, calc(100vh-160px) yükseklik, 300 satır limit
- **Aksiyon butonları** — hover'da görünür (opacity-0 → group-hover:opacity-100)
- **Yeni filtreler:**
  - HM Tipi (Boru, Profil, Levha, Sac, Çubuk...) — MultiCheckDropdown
  - Boy/Uz, Çap, Kalınlık — ayrı ayrı ölçü filtreleri
  - dimMatch: `String(value).startsWith(search)` mantığı (60 → 60, 60.3, 600 eşleşir; 160 eşleşmez)
  - inputMode="decimal" — Türkçe virgül desteği
  - ✕ Temizle butonu
  - Pasif malzeme toggle

### Malzeme Revizyon Sistemi (YENİ)
- **Supabase sütunları:** `revizyon` (int), `revizyon_tarihi` (text), `onceki_id` (text), `aktif` (boolean)
- **SQL dosyası:** revision_sql.sql — ALTER TABLE komutları
- **Düzenleme akışı:**
  - Ad/Kod/Ölçü değişikliği algılanır
  - Dialog: "Tümünü Güncelle" (EVET) vs "Yeni Revizyon" (HAYIR)
  - Tümünü Güncelle: ID aynı, tüm zincir (geçmiş dahil) güncellenir
  - Yeni Revizyon: eski malzeme aktif=false, yeni malzeme oluşturulur, sadece şablonlar + açık İE'ler güncellenir
- **Listede gösterge:** R1/R2 mor badge, PASİF etiketi, opacity-40

### Zincirleme Güncelleme Sistemi (YENİ)
- **Malzeme adı değişince:** BOM rows.malad + başlık → Reçete satirlar.malad + başlık → İE malad/mamulAd
- **Malzeme kodu değişince:** BOM rows.malkod + mamulKod → Reçete satirlar.malkod + mamulKod + rcKod → İE malkod/mamulKod
- **Malzeme ölçüleri değişince:** Reçetelerdeki kesim miktarları otomatik yeniden hesaplanır
- **BOM renameBom:** ad + mamul_ad + rows[0].malad → reçeteler → açık İE'ler
- **3 tetikleme noktası:** inline tıklama, MatFormModal, BomTrees renameBom
- **cascadeAdKod()** — ad/kod zincirleme fonksiyonu, mode='sadece_acik' parametresi
- **cascadeKesim()** — ölçü değişikliğinde kesim miktar yeniden hesaplama

### Reçete Düzenleme İyileştirmeleri
- **Hazırlık/İşlem sütunu:** w-28 → w-16
- **Varsayılan değer:** 0 → boş, onFocus select, placeholder "—"
- **Operasyon otomatik:** malzeme kartından opId pre-fill (onMalkodChange + bomDanReceteOlustur)
- **Malzeme kodu hücresi:** sadece kod görünür (displayValue prop), dropdown'da tam label

### Checklist Bug Fix
- **CLFormModal:** `useStore()` eklendi — `checklist` erişimi düzeltildi (ReferenceError)
- **showPrompt import** eklendi
- **"+ Yeni kişi..."** atanan seçeneği prompt ile çalışıyor

### SearchSelect displayValue
- **displayValue prop** — kapalıyken farklı metin gösterme (Recipes.tsx malzeme kodu)

### BOM Kopya/İsim Düzeltmesi
- **copyBom:** rows[0].malkod + malad güncellenir
- **renameBom:** zincirleme — reçete + açık İE'ler güncellenir

---

## ⏳ TEST BEKLİYOR

| # | Madde | Detay |
|---|-------|-------|
| 4 | Log düzenleme | OprEntryModal editLogId — Part 7 bug fix, test bekliyor |
| 6 | Kesim YM filtresi | cutting.ts + stokKontrol.ts — gerçek veriyle test |
| 15 | Artık plana ekleme | ArtikOneriModal — test bekliyor |
| P8 | Revizyon sistemi | SQL çalıştırılacak, tüm akış test edilecek |
| P8 | Zincirleme güncelleme | Ad/kod/ölçü değişikliğinde zincir testi |
| P8 | Ölçü filtreler | dimMatch startsWith mantığı test |

---

## ❌ YAPILMADI — Sonraki Chat

| # | Madde |
|---|-------|
| 12 | **Dashboard yeniden tasarım** — kart bazlı yönlendirme, hızlı erişim |
| D | Görsel tasarım iyileştirmeleri — Modal genişlikleri, kalan UI konuları |
| B1 | Kesim planı birleştirme |
| B2 | Realtime sync |
| B3 | Operatör mesajları paneli |
| B4 | ActiveWork canlı takip |
| B5 | Toplu sipariş girişi (Excel) |
| B6 | İşlem süre reçeteye ekleme |
| B7 | Fire → sipariş dışı İE |
| B8 | MRP stoktan ver |
| B9 | Test DB ayrı Supabase |

---

## ÖNEMLİ TEKNİK NOTLAR

### Dosya Yapısı
```
src/
├── hooks/useAuth.ts — admin/guest/operator + RBAC roller, can(), sessionStorage operatör
├── lib/
│   ├── permissions.ts — 80+ aksiyon, DEFAULTS, ACTION_GROUPS, ROLE_LIST, _overrides
│   ├── prompt.ts — showPrompt/showConfirm/showAlert
│   └── supabase.ts
├── components/layout/
│   ├── Layout.tsx — data-guest CSS, misafir banner, RBAC rol offset
│   └── Sidebar.tsx — NAV items with guest flag
├── components/ui/
│   ├── MultiCheckDropdown.tsx
│   └── SearchSelect.tsx — displayValue prop (Part 8)
├── features/production/
│   ├── cutting.ts, mrp.ts, stokTuketim.ts, stokTahsis.ts, stokKontrol.ts
├── pages/
│   ├── Login.tsx — Yeniden tasarım (Part 8): kullanıcı/operatör/misafir/admin sırası
│   ├── Materials.tsx — Revizyon sistemi + zincirleme güncelleme + ölçü filtreleri (Part 8)
│   ├── Recipes.tsx — Hazırlık/işlem UX + opId otomatik + displayValue (Part 8)
│   ├── BomTrees.tsx — copyBom/renameBom zincirleme güncelleme (Part 8)
│   ├── Checklist.tsx — CLFormModal useStore fix (Part 8)
│   ├── OperatorPanel.tsx — Geri dön butonu tüm roller (Part 8)
│   └── [diğer sayfalar değişmedi]
├── store/index.ts — 23 tablo
├── store/store_index.ts — material mapper: revizyon/aktif/uzunluk eklendi (Part 8)
├── types/index.ts — Material: revizyon/revizyonTarihi/oncekiId/aktif eklendi (Part 8)
```

### Supabase Tabloları (23 tablo)
```
uys_malzemeler — revizyon, revizyon_tarihi, onceki_id, aktif sütunları EKLENDİ (Part 8)
uys_orders, uys_work_orders, uys_logs, uys_operations,
uys_stations, uys_operators, uys_recipes, uys_bom_trees, uys_stok_hareketler,
uys_kesim_planlari, uys_tedarikler, uys_tedarikciler, uys_durus_kodlari,
uys_customers, uys_sevkler, uys_operator_notes, uys_active_work,
uys_fire_logs, uys_checklist, uys_izinler,
uys_kullanicilar, uys_yetki_ayarlari
```

### Kritik Kurallar
- Şifreler conversation'da gösterilmez
- Operatör oturumu sessionStorage — tab kapanınca silinir
- Admin oturumu localStorage — kalıcı
- RBAC: useAuth useStore import ETMİYOR (circular dep)
- Hedef aşım: Admin dahil ENGEL, fresh DB sorgusu
- Modal dış tıklama: Hiçbir modalda backdrop click kapatmaz
- **Malzeme düzenleme:** Ad/kod/ölçü değişikliğinde revizyon seçimi gösterilir
- **Revizyon:** aktif=false malzemeler varsayılan filtrede gizlenir
- **dimMatch:** String(value).startsWith(search) — virgül → nokta dönüşümü

### RBAC Yetki Akışı
```
Login → uys_kullanicilar → rol → App.tsx rol banneri
Her sayfada: can('action') → permissions.can(role, action) → _overrides || DEFAULTS
Yetki düzenleme: YetkiPanel → upsert → loadAll → tüm can() güncellenir
```

### Zincirleme Güncelleme Akışı (Part 8)
```
Malzeme değişti (MatFormModal)
  ├─ anyMeaningfulChange?
  │   ├─ EVET/Tümünü Güncelle → cascadeAdKod(mode=null) + cascadeKesim()
  │   └─ HAYIR/Yeni Revizyon → eski=pasif, yeni oluştur, cascadeAdKod(mode='sadece_acik')
  └─ Değişiklik yok → direkt kaydet

BOM Rename (BomTrees.tsx)
  └─ renameBom → BOM + Reçete + Açık İE güncelle
```

### RLS SQL (Tüm tablolar)
```sql
DO $$ DECLARE t text;
BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'uys_%'
LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON %I', t);
  EXECUTE format('CREATE POLICY "allow_all" ON %I USING (true) WITH CHECK (true)', t);
  EXECUTE format('GRANT ALL ON %I TO anon, authenticated', t);
END LOOP; END $$;
```
