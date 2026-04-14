# ÖZLER UYS v3 — Bilgi Bankası v7
> Son güncelleme: 2026-04-14 (Dashboard + İzin Sistemi + Operatör Panel İyileştirmeleri)

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
  - Part 5 (bu chat): Dashboard + İzin Sistemi + Operatör İyileştirmeleri

---

## ✅ TAMAMLANAN (Onaylı)

### Dashboard (8 madde — Part 5'te tamamlandı)
1. **MRP ibaresi düzeltildi** — Koşul: `receteId + aktif + İE var + mrpDurum boş/bekliyor`. Eski null kayıtlar SQL ile `tamamlandi` yapıldı.
2. **Stat kartları tıklanabilir** — Her kart `navigate()` ile ilgili sayfaya gider. Koyu zemin (`bg-bg-1`), bold beyaz rakamlar, renkli etiketler.
3. **Giriş yapmayan operatörler** — Oran gösterimi (`12/45`), bölüm bilgisi. İzinli/raporlu operatörler filtreden çıkarılır.
4. **Duruşlu istasyonlar kutusu** — Bugünün loglarından `duruslar` → `istId` eşlemesi. İstasyon adı + duruş adı + İE bilgisi.
5. **Tedarik bekleyen** — Workflow bölümünde + Yapılması Gerekenler listesinde.
6. **Bu haftanın sevkleri** — Pazartesi–Pazar aralığındaki sevkler. Tarih + sipariş no + müşteri + kalem sayısı.
7. **Bölüm tanımlanmamış** — `operations.bolum` ve `operators.bolum` boş olanlar ayrı alt gruplarla gösterilir.
8. **Akıllı workflow yanıp sönen butonlar** — `@keyframes wfPulse` animasyonu. Kesim eksik → ✂️ pulse, MRP yapılmadı → 📊 pulse, Tedarik bekliyor → 📦 pulse.

### Dashboard — Ek Kutular (Part 5)
- **İzinli/Raporlu Personel kutusu** — `bugunIzinli` (onaylı izinler, bugün aralığında). Tip + tarih + onaylayan bilgisi.
- **Bekleyen İzin Talepleri** — `durum === 'bekliyor'` olanlar sarı badge ile. Tıklayınca Operatörler sayfasına.
- **gercekAktif filtre** — Tamamlanmış İE'lerin hayalet active_work kayıtları Dashboard'da gösterilmez.
- **Aktif Çalışmalar / 8+ saat açık** satırları tıklanabilir → Operatör Paneline auto-login ile yönlendirir.

### Operatör Paneli İyileştirmeleri (Part 5)
- **Kayıt butonu fix** — `aw.woId` → `aw.id` (WorkOrder'da `woId` yok, `id` var)
- **Aktif İE alt listeden gizle** — AKTİF İŞLER bölümündekiler alt listede tekrar gösterilmez
- **İşe Katıl** — Başka operatör aynı İE'de çalışıyorsa cyan kutu ile bilgi + "İşe Katıl" butonu
- **Auto-close** — Üretim kaydı sonrası `prod >= hedef` ise tüm active_work otomatik silinir + bitiş saatleri kaydedilir
- **Akıllı saat** — `stopWork` bitiş saatini localStorage'a kaydeder. Sonraki `startWork` bu saati kullanır.
- **OprEntryModal otomatik operatör ekleme** — Modal açıldığında aynı İE'de aktif diğer operatörler otomatik oprList'e eklenir
- **URL ile auto-login** — `/operator?oprId=xxx` ile Dashboard'dan direkt operatör paneline geçiş

### İzin Yönetim Sistemi (Part 5 — Yeni)
- **Supabase tablosu:** `uys_izinler` (id, op_id, op_ad, baslangic, bitis, tip, durum, saat_baslangic, saat_bitis, onaylayan, onay_tarihi, not_, olusturan)
- **Type:** `Izin` interface — types/index.ts
- **Store:** mapper + TABLE_MAP + state (`izinler: Izin[]`)
- **Operators.tsx:** Dropdown operatör seçimi, onay/red butonları, düzenle butonu, toplu izin (checkbox ile çoklu operatör), IzinFormModal
- **OperatorPanel.tsx:** 📅 İzin sekmesi (4. tab), IzinTalepForm (`olusturan: 'operator'`), admin oluşturmuş izin onayı, düzenlenen talep tekrar onayı
- **Dashboard:** İzinli/Raporlu kutusu, bekleyen izin talepleri badge, girmeyenlerden izinli çıkarma
- **İzin engeli:** Tam gün izin → İşe Başla tamamen engel + kırmızı banner. Saatlik izin → izin saatlerinde engel, dışında çalışabilir + sarı banner.

**İzin akışı:**
```
Operatör talep → durum: 'bekliyor', olusturan: 'operator' → Admin onaylar/reddeder/düzenler
Admin düzenlerse → durum: 'duzenlendi' → Operatör tekrar onaylar
Admin oluşturur → durum: 'bekliyor', olusturan: 'admin' → Operatör onaylar
Toplu izin → checkbox ile seçim → her birine ayrı kayıt → operatörler kendi panelinden onaylar
Onaylanan izin → düzenlenemez → "İptal edip yeniden oluşturun" uyarısı
Operatör onaylı izni düzenlemek isterse → "Kullanıcı yanına gidiniz" uyarısı
```

### Operatör Paneli (Önceki Part'lardan)
- **Operatör İE girişi** — İşe Başla + Üretim Kaydı butonları ayrı, çoklu aktif iş desteği
- **Duruş saati validasyonu** — Başlangıç/bitiş time picker, çalışma saatleri dışı engel
- **Admin duruş saatleri (#5)** — ProductionEntry.tsx'de de eklendi
- **Mesaj hata yakalama** — RLS hatası toast ile gösterilir
- **Admin→Operatör mesaj (chat)** — Çift yönlü: admin cevabı yeni satır (`op_ad='📋 Yönetim'`)
- **Bölüm bazlı İE eşleşme** — operasyon `bolum` alanını kullanır

### Kesim Planları
- **Tamamlanan toggle** — "Tamamlananları Göster/Gizle" butonu
- **Otomatik tamamlama** — Tüm İE'ler bitince plan durumu auto-update

### Excel & Veri
- **BOM Excel import/export** — MamulKod bazlı upsert
- **Reçete Excel yükleme** — MamulKod bazlı import
- **Seçimli silme** — Veri Yönetimi: 10 kategori accordion, kayıt bazlı checkbox seçim

### MRP & Siparişler
- **MRP uyarısı** — OrderDetailModal'dan MRP çalıştırınca `mrp_durum='tamamlandi'` yazılır
- **MRP %100 filtre** — Tamamlanmış siparişler MRP sayfasından çıkarıldı

### Misafir Modu
- **Sidebar** — Tüm menüler görünür, "MİSAFİR" badge
- **Global CSS koruması** — Layout'ta `data-guest` attribute
- **Banner** — "🔒 MİSAFİR MODU — Sadece görüntüleme" üst bar

---

## ⏳ TEST BEKLİYOR

| # | Madde | Detay |
|---|-------|-------|
| 4 | Log düzenleme | OprEntryModal'a `editLogId` prop, UPDATE modu |
| 15 | Artık plana ekleme | "♻ Fire Yönet" → "Plana Ekle" butonu |

---

## ❌ YAPILMADI — Sonraki Chat

| # | Madde |
|---|-------|
| R1 | **Detaylı Üretim Raporu** — Tarih/Operatör/Operasyon/Sipariş filtreleri, çalışma süresi, fire oranı, Excel export, toplam/ortalama satırı |
| D | Görsel tasarım iyileştirmeleri (ileride) |

---

## ÖNEMLİ TEKNİK NOTLAR

### Dosya Yapısı
```
src/
├── hooks/useAuth.ts — admin/guest/operator roles
├── components/layout/
│   ├── Layout.tsx — data-guest CSS koruması, misafir banner
│   └── Sidebar.tsx — NAV items with guest flag
├── features/production/
│   ├── cutting.ts — getHamBoy/getParcaBoy export
│   └── mrp.ts — bomPatlaNet
├── pages/
│   ├── OperatorPanel.tsx — 3-step login, URL auto-login (?oprId=), 4 tab (isler/mesaj/izin/ozet),
│   │   İşe Katıl, auto-close, akıllı saat, izin engeli, IzinTalepForm, OprEntryModal export
│   ├── ProductionEntry.tsx — bölüm=operations.bolum, duruş saatleri, stok hareketi oluşturur
│   ├── WorkOrders.tsx — admin entry (OprEntryModal), stok kontrollü
│   ├── CuttingPlans.tsx — tamamlanan toggle, ArtikOneriModal
│   ├── Orders.tsx — runMRP mrp_durum update
│   ├── Dashboard.tsx — useNavigate, gercekAktif, izinli/raporlu kutusu, bekleyen izinler,
│   │   workflow pulse, stat kartları koyu/bold, sevkler, duruşlu istasyonlar
│   ├── DataManagement.tsx — kayıt bazlı accordion seçimli silme
│   ├── Operations.tsx — bölüm dropdown
│   ├── Operators.tsx — İzin/Mesai tab, IzinFormModal (tekil/düzenle/toplu), Supabase CRUD
│   ├── MRP.tsx — %100 tamamlanmış sipariş filtresi
│   ├── Reports.tsx — 12 tab (özet, günlük, fire, operasyon, OEE, duruş, gecikme, operatör, malzeme, trend, istasyon, saat)
│   └── Materials.tsx — uzunluk, Excel upsert
├── store/index.ts — 21 tablo (izinler dahil), M mappers
├── types/index.ts — Izin interface (olusturan alanı dahil)
```

### Supabase Tabloları (21 tablo)
```
uys_orders, uys_work_orders, uys_logs, uys_malzemeler, uys_operations,
uys_stations, uys_operators, uys_recipes, uys_bom_trees, uys_stok_hareketler,
uys_kesim_planlari, uys_tedarikler, uys_tedarikciler, uys_durus_kodlari,
uys_customers, uys_sevkler, uys_operator_notes, uys_active_work,
uys_fire_logs, uys_checklist, uys_izinler
```

### uys_izinler Tablo Yapısı
```sql
CREATE TABLE uys_izinler (
  id text PRIMARY KEY,
  op_id text NOT NULL, op_ad text NOT NULL,
  baslangic text NOT NULL, bitis text NOT NULL,
  tip text DEFAULT 'yıllık', -- yıllık/mazeret/rapor/mesai/ücretsiz
  durum text DEFAULT 'bekliyor', -- bekliyor/onaylandi/reddedildi/duzenlendi
  saat_baslangic text DEFAULT '', saat_bitis text DEFAULT '',
  onaylayan text DEFAULT '', onay_tarihi text DEFAULT '',
  not_ text DEFAULT '', olusturan text DEFAULT 'admin' -- admin/operator
);
```

### Kritik Kurallar
- **Şifreler** conversation'da gösterilmez — sadece kodda referans
- **ProductionEntry.tsx** ayrı bir sayfa — OprEntryModal kullanmıyor
- **OprEntryModal** OperatorPanel.tsx'den export — WorkOrders admin "Kayıt Ekle" ile kullanır
- **entryWO state** `{ woId: string; logId?: string } | null` formatında
- **Supabase RLS** — tüm tablolar `allow_all` policy gerekli
- **MRP durum** — `mrp_durum='tamamlandi'` hem toplu MRP hem OrderDetailModal'dan yazılır
- **Bölüm eşleşme** — `operations.bolum` alanı kullanılır, `opAd` değil
- **İzin engeli** — OperatorPanel `izinEngel` computed: tam gün → full engel, saatlik → saat aralığında engel
- **Auto-close** — OprEntryModal save sonrası `prod >= hedef` ise tüm active_work silinir
- **Akıllı saat** — `localStorage uys_lastStop_{oprId}` ile önceki işin bitişi sonraki işin başlangıcı olur
- **gercekAktif** — Dashboard'da tamamlanmış İE'lerin active_work hayaletleri filtrelenir
- **URL auto-login** — `/operator?oprId=xxx` ile useSearchParams, operators yüklendikten sonra auto-login
- **Stok hareketleri** — Üretim kaydı girildiğinde hem mamul girişi hem HM çıkışı oluşturulur (ProductionEntry + OprEntryModal)

### Bilinen Sorunlar & Dikkat Edilecekler
- `{condition && <div>...</div>}` kapanmamış `}` hatası — her JSX expression kapatılmalı
- `l.operatorlar` bazı loglarda undefined — `Array.isArray()` kontrolü gerekli
- `o.aktif` bazı operatörlerde undefined — `o.aktif !== false` kontrolü kullan
- Eski versiyonda yapılan üretim kayıtlarında stok hareketi eksik kalabilir — toplu düzeltme SQL'i çalıştırılmalı
- `CalendarX2` kullanılır (`CalendarOff` lucide-react'ta yok)

### Veri Düzeltme SQL'leri (Bir kerelik, çalıştırıldı)
```sql
-- MRP eski null kayıtları
UPDATE uys_orders SET mrp_durum = 'tamamlandi'
WHERE (mrp_durum IS NULL OR mrp_durum = '' OR mrp_durum = 'bekliyor')
  AND recete_id IS NOT NULL AND id IN (SELECT DISTINCT order_id FROM uys_work_orders);

-- Hayalet active_work temizleme
DELETE FROM uys_active_work WHERE tarih < CURRENT_DATE::text;
DELETE FROM uys_active_work WHERE wo_id IN (
  SELECT w.id FROM uys_work_orders w
  WHERE w.hedef > 0 AND (SELECT COALESCE(SUM(l.qty),0) FROM uys_logs l WHERE l.wo_id = w.id) >= w.hedef
);

-- Eksik stok girişleri (eski kayıtlar)
INSERT INTO uys_stok_hareketler (id, malkod, malad, miktar, tip, aciklama, tarih, wo_id)
SELECT 'fix_' || w.id, w.malkod, w.malad,
  (SELECT COALESCE(SUM(l.qty),0) FROM uys_logs l WHERE l.wo_id = w.id),
  'giris', 'Stok düzeltme — ' || w.ie_no, CURRENT_DATE::text, w.id
FROM uys_work_orders w
WHERE (SELECT COALESCE(SUM(l.qty),0) FROM uys_logs l WHERE l.wo_id = w.id) > 0
  AND NOT EXISTS (SELECT 1 FROM uys_stok_hareketler s WHERE s.wo_id = w.id AND s.tip = 'giris');
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
