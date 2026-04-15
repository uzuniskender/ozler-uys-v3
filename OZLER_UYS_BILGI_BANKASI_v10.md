# ÖZLER UYS v3 — Bilgi Bankası v10
> Son güncelleme: 2026-04-15 (Part 8: Login + Malzeme + Reçete + BOM düzeltmeleri)

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
  - Part 8: Login standardizasyonu + Malzeme kompakt + Reçete UX + BOM kopya fix

---

## ✅ TAMAMLANAN (Onaylı)

### RBAC Yetki Sistemi (Part 7 — Ana Özellik)
- **4 rol:** Admin (tam yetki), Üretim Sorumlusu, Planlama, Depocu
- **permissions.ts** — 80+ aksiyon × 3 rol matrisi. Modül-level `_overrides` değişkeni ile DB'den yüklenen ayarlar desteklenir. `setYetkiOverrides()` ile store'dan set edilir, `can(role, action)` ile kontrol edilir.
- **useAuth.ts** — `can()` fonksiyonu her sayfada kullanılır. `useStore` import etmez (circular dep önlenir).
- **uys_kullanicilar tablosu** — Supabase'de. id, ad, kullanici_ad, sifre, rol, aktif. Login: önce bu tablodan kontrol, bulamazsa eski admin şifresi.
- **uys_yetki_ayarlari tablosu** — Supabase'de. Tek satır (id='rbac'), data=JSON. Yetki matrisi override'ları burada saklanır.
- **KullaniciPanel** — Veri Yönetimi'nde. Kullanıcı CRUD: ad, kullanıcı adı, şifre, rol dropdown, aktif/pasif toggle.
- **YetkiPanel** — Veri Yönetimi'nde. Checkbox matris editörü: 19 grup × ~80 aksiyon × 3 rol. Varsayılandan farklı olanlar amber ring ile işaretlenir. Kaydet → Supabase upsert. Varsayılana Dön → DB kaydı silinir.
- **20+ sayfa koruma** — Her sayfada `const { can } = useAuth()` ile butonlar sarmalandı: `{can('orders_add') && <button>...}` veya `disabled={!can('action')}`.
- **DataManagement bölüm koruması** — JSON import/export, Sistem Testi, Test Modu, Admin Şifre, Kullanıcı Yönetimi, Yetki Matrisi, Sıfırlama bölümleri `can()` ile korunuyor.
- **App.tsx rol banneri** — RBAC rolleri için üst barda renkli etiket (🔧 ÜRETİM SORUMLUSU / 📋 PLANLAMA / 📦 DEPOCU).
- **Layout.tsx offset** — Rol banner'ı olduğunda `pt-7` ile içerik kaydırılır.

### Log Düzenleme Bug Fix'leri (Part 7)
- **`tarih` UPDATE'e eklendi** — Düzenleme modunda tarih değişikliği DB'ye yazılıyor.
- **Fire log düzenlemede güncelleniyor** — Eski fire_log `log_id` ile silinip yeniden oluşturuluyor.
- **`logId` scope düzeltildi** — `const logId = editLogId || uid()` if/else öncesine hoist edildi. Fire log her bloğun içine alındı.
- **Yeni kayıtlarda fire_log'a `log_id` eklendi** — Daha önce yoktu.

### BOM Reçete Filtresi (Part 7)
- **BomTrees.tsx** — "Reçete: Hepsi / ✅ Var / ⚠ Yok" filtre dropdown'u eklendi.
- **RC badge** — Her satırda `RC ✓` (yeşil) veya `RC ✗` (kırmızı) badge.
- **Buton rengi** — Reçetesi var → yeşil "📋 Reçete Güncelle", yok → kırmızı bold "⚠ Reçete Oluştur".

### Önceki Part'lar (Part 5–6, özet)
- Operatör güvenlik sistemi, hedef aşım engeli, MRP düzeltmeleri, kesim YM filtresi
- Reçete/BOM/malzeme iyileştirmeleri (düzenleme, kopyalama, arama, süre birimleri)
- Dashboard, izin sistemi, operatör paneli, kesim planları, modal/UI iyileştirmeleri
- Detaylı Üretim Raporu (R1), üretim tarih seçici, aktif iş saat düzenleme
- Misafir modu, Excel BOM/reçete import/export, seçimli silme

---

## ⏳ TEST BEKLİYOR

| # | Madde | Detay |
|---|-------|-------|
| 4 | Log düzenleme | OprEntryModal editLogId — bug fix'ler yapıldı, test bekliyor |
| 6 | Kesim YM filtresi | cutting.ts + stokKontrol.ts — kod doğru, gerçek veriyle test |
| 15 | Artık plana ekleme | ArtikOneriModal — kod tamamlanmış, test bekliyor |

---

## ❌ YAPILMADI — Sonraki Chat

| # | Madde |
|---|-------|
| D | **Görsel tasarım iyileştirmeleri** — Modal genişlikleri, SearchSelect dropdown pozisyonu (kısmen çözüldü Part 8), Dashboard yeniden tasarım |
| B1 | Kesim planı birleştirme (yeni sipariş → mevcut plan güncelle) |
| B2 | Realtime sync |
| B3 | Operatör mesajları paneli |
| B4 | ActiveWork canlı takip |
| B5 | Toplu sipariş girişi (Excel) |
| B6 | İşlem süre reçeteye ekleme |
| B7 | Fire → sipariş dışı İE (İstek #18) |
| B8 | MRP stoktan ver (İstek #19) |
| B9 | Test DB ayrı Supabase (çalışmadı) |

---

## ÖNEMLİ TEKNİK NOTLAR

### Dosya Yapısı
```
src/
├── hooks/useAuth.ts — admin/guest/operator + RBAC roller, can(), sessionStorage operatör
├── lib/
│   ├── permissions.ts — 80+ aksiyon, DEFAULTS, ACTION_GROUPS, ROLE_LIST, _overrides, setYetkiOverrides(), can()
│   ├── prompt.ts — showPrompt/showConfirm/showAlert max-width 600px, dış tıklama kapalı
│   └── supabase.ts
├── components/layout/
│   ├── Layout.tsx — data-guest CSS, misafir banner, RBAC rol offset (pt-7)
│   └── Sidebar.tsx — NAV items with guest flag
├── components/ui/
│   ├── SearchSelect.tsx — inputClassName prop
│   ├── MultiCheckDropdown.tsx
│   └── SearchSelect.tsx — displayValue prop (Part 8)
├── features/production/
│   ├── cutting.ts — YM filtresi, konsol debug logları
│   ├── mrp.ts — bomPatlaNet
│   ├── stokKontrol.ts — YM filtresi, materials parametresi
│   └── stokTuketim.ts
├── pages/
│   ├── OperatorPanel.tsx — sessionStorage auth, log düzenleme (editLogId), fire log güncelleme
│   ├── ProductionEntry.tsx — hedef aşım hard block, fresh DB, tarih seçici, can() koruması
│   ├── WorkOrders.tsx — can() koruması (toolbar + detay modal + inline durum dropdown)
│   ├── Orders.tsx — can() koruması (tüm CRUD + MRP butonları)
│   ├── Materials.tsx — can() koruması + reçete filtresi
│   ├── BomTrees.tsx — can() koruması + reçete filtresi (Var/Yok) + RC badge
│   ├── Recipes.tsx — can() koruması
│   ├── CuttingPlans.tsx — can() koruması (Otomatik/Manuel Plan)
│   ├── MRP.tsx — can() koruması (Hesapla disabled)
│   ├── Warehouse.tsx — can() koruması (Onar + Manuel Giriş/Çıkış)
│   ├── Shipment.tsx — can() koruması
│   ├── Operators.tsx — can() koruması
│   ├── Suppliers.tsx — can() koruması
│   ├── Procurement.tsx — can() koruması (Geldi işaretleme dahil)
│   ├── Operations.tsx — can() koruması
│   ├── Stations.tsx — can() koruması
│   ├── DowntimeCodes.tsx — can() koruması
│   ├── Checklist.tsx — can() koruması
│   ├── Reports.tsx — 13 tab (detaylı rapor R1 dahil)
│   ├── DataManagement.tsx — can() bölüm koruması + KullaniciPanel + YetkiPanel
│   ├── Dashboard.tsx
│   └── Login.tsx — operatör + kullanıcı (uys_kullanicilar) + eski admin şifre
├── store/index.ts — 22 tablo (kullanicilar dahil), yetkiMap, setYetkiOverrides loadAll'da
├── types/index.ts — Kullanici interface
├── App.tsx — AdminRoutes/OperatorRoutes, RBAC rol banneri, tek useAuth
```

### Supabase Tabloları (23 tablo)
```
uys_orders, uys_work_orders, uys_logs, uys_malzemeler, uys_operations,
uys_stations, uys_operators, uys_recipes, uys_bom_trees, uys_stok_hareketler,
uys_kesim_planlari, uys_tedarikler, uys_tedarikciler, uys_durus_kodlari,
uys_customers, uys_sevkler, uys_operator_notes, uys_active_work,
uys_fire_logs, uys_checklist, uys_izinler,
uys_kullanicilar, uys_yetki_ayarlari
```

### Kritik Kurallar
- **Şifreler** conversation'da gösterilmez — sadece kodda referans
- **Operatör oturumu sessionStorage** — tab kapanınca silinir
- **Admin oturumu localStorage** — kalıcı
- **RBAC roller** — uys_kullanicilar'dan login, can() ile kontrol, useAuth useStore import ETMİYOR
- **Yetki override** — permissions.ts modül-level _overrides, store loadAll'dan setYetkiOverrides() ile set
- **App.tsx yapısı** — AdminRoutes (admin/guest/RBAC roller) ve OperatorRoutes tamamen ayrı
- **Hedef aşım** — Admin dahil ENGEL, fresh DB sorgusu
- **Modal dış tıklama** — Hiçbir modalda backdrop click kapatmaz
- **Kesim planı** — w.hm'den YarıMamul ve ürünün kendisi filtrelenir
- **Stok kontrol** — stokKontrolWO YarıMamul filtresi, materials parametresi gerekli
- **MRP durum** — Hesapla sonrası mrp_durum='tamamlandi' yazılır
- **Log düzenleme** — fire_log log_id ile silinip yeniden oluşturulur, tarih UPDATE'e dahil, logId hoist edilmiş
- **Supabase RLS** — tüm tablolar allow_all policy
- **BomTrees** — Reçete filtresi: receteKodSet ile Var/Yok, RC badge, buton rengi

### RBAC Yetki Akışı
```
Login → uys_kullanicilar (kullanici_ad + sifre) → rol belirlenir
     → bulunamazsa eski admin şifre → admin rolü
     
App yüklenirken:
  store.loadAll() → uys_yetki_ayarlari fetch → setYetkiOverrides(_overrides)
  
Her sayfada:
  const { can } = useAuth()
  can('orders_add') → permissions.can(role, action) → _overrides || DEFAULTS kontrol
  
Yetki düzenleme:
  Veri Yönetimi → YetkiPanel → checkbox matris → Kaydet → uys_yetki_ayarlari upsert
  → loadAll() → setYetkiOverrides() → tüm can() çağrıları güncellenir
```

### Bilinen Sorunlar & Dikkat Edilecekler
- `{condition && <div>...</div>}` kapanmamış `}` hatası — her JSX expression kapatılmalı
- `l.operatorlar` bazı loglarda undefined — `Array.isArray()` kontrolü gerekli
- `o.aktif` bazı operatörlerde undefined — `o.aktif !== false` kontrolü kullan
- `CalendarX2` kullanılır (`CalendarOff` lucide-react'ta yok)
- `cutting.ts` debug logları aktif — production'da kaldırılabilir
- JSX'te ternary içinde `{can() && <button>}` → fazla `{}` olmamalı (Orders.tsx build hatası düzeltildi)
- `.map()` içinde `<>` fragment key kabul etmez → `<Fragment key={...}>` kullanılmalı
- `useAuth` hook'unda `useStore` import edilMEMELİ — circular dep / runtime hatası riski

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

### Part 8 Değişiklikler (2026-04-15)

#### Madde 1 — Login Buton Standardizasyonu
- Tüm butonlar aynı boyut: `py-3`, `rounded-xl`, `font-bold`
- Google / Misafir / Operatör butonları hepsi `w-full` ve aynı yükseklik
- Logo ikonu eklendi (mavi "Ö" harfi, `rounded-2xl` kutu içinde)
- Alt bilgi: "Özler Kalıp ve İskele Sistemleri A.Ş."
- Şifre girişi ayırıcı çizgiyle ayrıldı (`border-t`), `▸/▾` ile toggle

#### Madde 2 — Operatör Geri Dön Butonu
- Operatör girişi artık **ayrı tam sayfa ekran** (login → operatör ekranı)
- Altta `← Giriş Ekranına Dön` butonu (border + hover efekti)
- Operatör girişi kendi ikonlu başlığa sahip (🏭 yeşil kutu)

#### Madde 4–5 — Malzeme Listesi Kompakt Görsel
- Satır yüksekliği: `py-1.5` → `py-[5px]` (yaklaşık %40 daha kompakt)
- Tablo max yükseklik: `65vh` → `calc(100vh-160px)` (ekranı dolduruyor)
- Görüntülenen satır limiti: 200 → 300
- Header: `text-[10px] uppercase tracking-wider` (daha profesyonel)
- Padding: `px-4` → `px-2/px-3` (alan kazanımı)
- Aksiyon butonları: `opacity-0 → group-hover/row:opacity-100` (sadece hover'da görünür)
- Kod sütunu: `break-all` ile uzun kodlar taşmaz
- Ad sütunu: `truncate` ile taşma engeli

#### Madde 6–7 — Reçete Hazırlık/İşlem Sütun Genişliği
- `w-28` → `w-16` (her iki sütun yarıya indi)
- Birim sütunu: `w-14` → `w-12`

#### Madde 8 — Hazırlık/İşlem Varsayılan Değer
- `value={r.hazirlikSure || 0}` → `value={r.hazirlikSure || ''}` (boş gelir)
- `value={r.islemSure || 0}` → `value={r.islemSure || ''}` (boş gelir)
- `onFocus={e => e.target.select()}` eklendi (tıklayınca tümünü seçer)
- `focus:bg-bg-2` eklendi (aktif hücre belirgin)
- `placeholder="—"` eklendi

#### Madde 9 — Operasyon Malzeme Kartından Otomatik
- `onMalkodChange`: `if (mat.opId && !r.opId) updated.opId = mat.opId` eklendi
- `bomDanReceteOlustur`: materials store'dan opId çekilerek pre-fill yapılıyor
- Recipes.tsx: `materials` store'a eklendi (destructuring güncellendi)

#### Madde 10 — Malzeme Kodu Hücresi Sadece Kod
- `SearchSelect` bileşenine `displayValue` prop eklendi
- Kapalıyken: sadece `r.malkod` gösteriliyor (font-mono, accent rengi)
- Açıkken (dropdown): tam `kod — ad` label ile arama yapılıyor

#### Madde 11 — BOM Kopya İsim Hatası
- `copyBom`: İlk satırın (kirno='1') `malkod` ve `malad` değerleri yeni isimle güncelleniyor
- `renameBom`: `rows[0].malad` da güncelleniyor → iş emrinde eski isim kalmaz
- Her iki fonksiyonda `rows` spread ile immutable güncelleme

### Değişen Dosyalar (Part 8)
- `src/pages/Login.tsx` — Tam yeniden yazıldı
- `src/pages/Materials.tsx` — Tablo kompaktlaştırıldı
- `src/pages/Recipes.tsx` — 5 düzeltme (sütun genişliği, default değer, opId otomatik, malkod display)
- `src/pages/BomTrees.tsx` — copyBom + renameBom rows[0] düzeltmesi
- `src/components/ui/SearchSelect.tsx` — displayValue prop eklendi
