# ÖZLER UYS v3 — Bilgi Bankası v6
> Son güncelleme: 2026-04-13 (Bugfix Marathon Part 3-4)

## Proje Bilgileri
- **Repo:** https://github.com/uzuniskender/ozler-uys-v3
- **URL:** https://uzuniskender.github.io/ozler-uys-v3/
- **Supabase:** kudpuqqxxkhuxhhxqbjw (Frankfurt)
- **Stack:** React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase
- **Önceki transcriptler:**
  - Part 1: `/mnt/transcripts/2026-04-13-05-12-00-ozler-uys-v3-major-upgrade.txt`
  - Part 2: `/mnt/transcripts/2026-04-13-07-00-49-ozler-uys-v3-major-upgrade.txt`
  - Part 3: `/mnt/transcripts/2026-04-13-08-37-44-ozler-uys-v3-malzeme-kesim-session.txt`
  - Part 4: `/mnt/transcripts/2026-04-13-12-26-44-ozler-uys-v3-bugfix-marathon.txt`

---

## ✅ TAMAMLANAN (Onaylı)

### Operatör Paneli
- **Operatör İE girişi** — İşe Başla + Üretim Kaydı butonları ayrı, çoklu aktif iş desteği
- **Duruş saati validasyonu** — Başlangıç/bitiş time picker, çalışma saatleri dışı engel, otomatik süre hesaplama, bas/bit loga kaydedilir
- **Admin duruş saatleri (#5)** — ProductionEntry.tsx'de de eklendi (ayrı sayfa — OprEntryModal kullanmıyor), qty=0 + duruş ile kayıt izni, save butonu stok yetersizliğinde disabled değil
- **Mesaj hata yakalama** — RLS hatası toast ile gösterilir
- **Admin→Operatör mesaj (chat)** — Çift yönlü: admin cevabı yeni satır (`op_ad='📋 Yönetim'`), operatör tarafında chat penceresi, kronolojik sıra
- **İşe Başla hata yakalama** — RLS hataları toast, `aw.woId` (aw.id değil)
- **Bölüm bazlı İE eşleşme** — ProductionEntry + OperatorPanel operasyon `bolum` alanını kullanır (opAd değil)

### Kesim Planları
- **Tamamlanan toggle** — "Tamamlananları Göster/Gizle" butonu, auto-update badge
- **Otomatik tamamlama** — Tüm İE'ler bitince plan durumu auto-update

### Excel & Veri
- **BOM Excel import/export** — MamulKod bazlı upsert
- **Reçete Excel yükleme** — MamulKod bazlı import
- **Seçimli silme** — Veri Yönetimi: 10 kategori accordion, kayıt bazlı checkbox seçim, "Tümünü Seç"/"Temizle" per kategori, log silinince stok hareketleri de silinir

### MRP & Siparişler
- **MRP uyarısı** — OrderDetailModal'dan MRP çalıştırınca `mrp_durum='tamamlandi'` yazılır
- **MRP %100 filtre** — Tamamlanmış siparişler MRP sayfasından + dashboard uyarısından çıkarıldı (gerçek üretim ilerlemesine göre)

### Operasyonlar
- **Bölüm dropdown** — Önceden tanımlı bölümler (PRES, KESME LAZER vb.) + mevcut bölümler, select + text input combo
- **SQL ile bölüm ataması** — `UPDATE uys_operations SET bolum='PRES' WHERE ad ILIKE '%PRES%'` vb.

### Misafir Modu
- **Sidebar** — Tüm menüler görünür, "MİSAFİR" badge
- **Global CSS koruması** — Layout'ta `data-guest` attribute, aksiyon butonları (bg-accent, bg-green, bg-red) `opacity:0.15 + pointer-events:none`
- **Banner** — "🔒 MİSAFİR MODU — Sadece görüntüleme" üst bar
- **Sayfa bazlı gizleme** — Orders, WorkOrders, CuttingPlans, Dashboard action butonları `{!isGuest &&}` ile gizli
- **Arama/filtre/navigasyon** çalışır kalır

---

## ⏳ TEST BEKLİYOR (Yapıldı ama onay yok)

| # | Madde | Detay |
|---|-------|-------|
| 4 | Log düzenleme | OprEntryModal'a `editLogId` prop, UPDATE modu, "✏ Düzenleme Modu" badge, stok hareketleri yeniden oluşturulur |
| 13 | Dashboard grafikleri | Boş durum mesajı, chart threshold düşürüldü |
| 15 | Artık plana ekleme | "♻ Fire Yönet" → "Plana Ekle" butonu, plan güncellenir, fire azalır, kalan artık stoka girer |

---

## ❌ YAPILMADI — Dashboard İstekleri (Sonraki Chat)

| # | Madde |
|---|-------|
| 1 | MRP Bekliyor ibaresi hâlâ yanlış gösteriyor — düzelt |
| 2 | Stat kartları tıklanabilir → ilgili sayfaya gitsin |
| 3 | Giriş yapmayan operatörler kutusu + izinli/raporlu kutusu |
| 4 | Arızalı istasyon kutusu |
| 5 | Tedarik bekleyen kutusu (tıkla → tedarik sayfası) |
| 6 | Bu haftanın sevkleri kutusu |
| 7 | Bölüm tanımlanmamış operasyon/operatör kutusu |
| 8 | Akıllı workflow: sipariş → "Kesim Planı Yap" yanıp sönsün, kesim planı → "MRP" yanıp sönsün, MRP → "Tedarik" yanıp sönsün |
| D | Görsel tasarım (ileride) |

---

## ÖNEMLİ TEKNİK NOTLAR

### Dosya Yapısı
```
src/
├── hooks/useAuth.ts — admin/guest/operator roles, isGuest/isAdmin/isOperator
├── components/layout/
│   ├── Layout.tsx — data-guest CSS koruması, misafir banner
│   └── Sidebar.tsx — NAV items with guest flag, GUEST_PATHS export
├── features/production/
│   ├── cutting.ts — getHamBoy/getParcaBoy export, fire doldurma 2 aşama
│   └── mrp.ts — bomPatlaNet
├── pages/
│   ├── OperatorPanel.tsx — 3-step login, multi-active, chat mesaj, OprEntryModal+editMode
│   ├── ProductionEntry.tsx — bölüm=operations.bolum, duruş saatleri, qty=0 izni
│   ├── WorkOrders.tsx — admin entry, stok kontrollü log, isGuest koruma
│   ├── CuttingPlans.tsx — tamamlanan toggle, ArtikOneriModal+planaEkle, isGuest koruma
│   ├── Orders.tsx — runMRP mrp_durum update, isGuest koruma
│   ├── Dashboard.tsx — StatCard gradient, MRP filtre, isGuest mesaj koruma
│   ├── DataManagement.tsx — kayıt bazlı accordion seçimli silme
│   ├── Operations.tsx — bölüm dropdown (önceden tanımlı + mevcut)
│   ├── MRP.tsx — %100 tamamlanmış sipariş filtresi (gerçek üretim)
│   └── Materials.tsx — uzunluk, Excel upsert
```

### Kritik Kurallar
- **Şifreler** conversation'da gösterilmez — sadece kodda referans
- **ProductionEntry.tsx** ayrı bir sayfa — OprEntryModal kullanmıyor
- **OprEntryModal** OperatorPanel.tsx'den export — WorkOrders admin "Kayıt Ekle" ile kullanır
- **entryWO state** `{ woId: string; logId?: string } | null` formatında (edit mode destekli)
- **cutting.ts** export: `getHamBoy`, `getParcaBoy`
- **Supabase RLS** — tüm tablolar `allow_all` policy gerekli
- **`uys_operations`** tablosunda `bolum` kolonu: `ALTER TABLE uys_operations ADD COLUMN IF NOT EXISTS bolum text DEFAULT ''`
- **MRP durum** — OrderDetailModal'dan çalıştırınca da `mrp_durum='tamamlandi'` yazılır (sadece toplu MRP değil)
- **Bölüm eşleşme** — `operations.bolum` alanı kullanılır, `opAd` değil. SQL: `UPDATE uys_operations SET bolum='PRES' WHERE ad ILIKE '%PRES%'`

### Bilinen Sorunlar & Dikkat Edilecekler
- Rolldown parser `{condition && <div>...</div>` satırlarında kapanmamış `}` hatası verir (TypeScript geçirir). Her yeni JSX expression'ın `}` ile kapatıldığından emin ol.
- `bg-cyan-500/8` gibi Tailwind sınıfları Rolldown'da regex olarak parse edilebilir — string içinde olduğundan sorun olmaz ama dikkat.
- `l.operatorlar` bazı loglarda undefined olabilir — `Array.isArray()` kontrolü gerekli
- `o.aktif` bazı operatörlerde undefined — `o.aktif !== false` kontrolü kullan
- Duruş kodları `uys_durus_kodlari` tablosunda

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

### Bölüm Atama SQL
```sql
ALTER TABLE uys_operations ADD COLUMN IF NOT EXISTS bolum text DEFAULT '';
UPDATE uys_operations SET bolum = 'PRES' WHERE ad ILIKE '%PRES%';
UPDATE uys_operations SET bolum = 'KESME LAZER' WHERE ad ILIKE '%LAZER%';
UPDATE uys_operations SET bolum = 'KESME SAC LAZER' WHERE ad ILIKE '%SAC LAZER%';
UPDATE uys_operations SET bolum = 'KESME TESTERE' WHERE ad ILIKE '%TESTERE%';
UPDATE uys_operations SET bolum = 'KAYNAK' WHERE ad ILIKE '%KAYNAK%';
UPDATE uys_operations SET bolum = 'MONTAJ' WHERE ad ILIKE '%MONTAJ%';
UPDATE uys_operations SET bolum = 'BOYA' WHERE ad ILIKE '%BOYA%';
UPDATE uys_operations SET bolum = 'PAKETLEME' WHERE ad ILIKE '%PAKET%';
```
