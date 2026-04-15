# ÖZLER UYS v3 — Bilgi Bankası v8
> Son güncelleme: 2026-04-15 (Güvenlik + MRP + Kesim + UI İyileştirmeleri)

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
  - Part 5: Dashboard + İzin Sistemi + Operatör İyileştirmeleri
  - Part 6: Güvenlik + MRP + Kesim + UI İyileştirmeleri

---

## ✅ TAMAMLANAN (Onaylı)

### Operatör Güvenlik Sistemi (Part 6 — Kritik)
- **Operatör → Admin erişimi kesin engellendi** — `App.tsx` yeniden yazıldı: operatör girdiğinde `OperatorRoutes` render edilir, admin rotası hiç yok. `popstate` dinleyicisi geri tuşunu fiziksel olarak engelliyor.
- **Operatör oturumu `sessionStorage`** — Tab/pencere kapanınca oturum silinir. Her açılışta şifre gerekir. Admin oturumu `localStorage`'da kalıcı.
- **Çift giriş (double-login) düzeltildi** — OperatorPanel `useState` başlangıç değeri olarak auth'tan direkt okuyor, `useEffect` zamanlama sorunu yok.
- **useAuth tek kaynak** — `App` ve `AppContent` (artık `AdminRoutes`) ayrı `useAuth` çağırmıyor. Auth kontrolü sadece `App` seviyesinde.
- **Admin geri butonu** — Admin operatör paneline girdiğinde hem giriş ekranında hem panel header'da `← Yönetime Dön` butonu.
- **Uzaktan çıkış** — Operatörler sayfasında `🚪 Tüm Oturumları Kapat` butonu. Supabase broadcast (`uys-force-logout`) ile anlık sinyal → operatörlerin ekranında uyarı → 1.5sn sonra çıkış.

### Hedef Aşım Engeli (Part 6 — Güvenlik)
- **Hard block — herkes için** — Admin dahil hiç kimse hedeften fazla üretim giremez. `showConfirm` onay sistemi kaldırıldı.
- **Fresh DB sorgusu** — Kayıt öncesi Supabase'den güncel üretim sorgulanır (`freshLogs`). Eşzamanlı giriş / stale data riski ortadan kalktı.
- **3 yerde uygulandı:** ProductionEntry tekil save, ProductionEntry toplu save, OprEntryModal save.

### MRP Düzeltmeleri (Part 6)
- **Dashboard MRP ibaresi** — Eski: tam MRP hesabı çalıştırıp eksik malzeme sayıyordu. Yeni: `mrpDurum !== 'tamamlandi'` olan sipariş sayısı. `hesaplaMRP` import kaldırıldı.
- **MRP sayfası `mrp_durum` güncellemesi** — Hesapla sonrası seçili siparişlerin `mrp_durum = 'tamamlandi'` yazılır.
- **MRP tamamlanan siparişler gizlenir** — Varsayılan: sadece `mrpDurum !== 'tamamlandi'` görünür. `+ Tamamlananlar (N)` toggle ile tekrar gösterilir. `MRP ✓` badge + yeşil bordür.
- **YM İE seçimi** — MRP sayfasında bağımsız YM İE'ler ayrı bölümde checkbox ile seçilebilir. Sipariş seçmeden sadece YM İE ile MRP çalıştırılabilir.
- **YM İE MRP tamamlanan takibi** — `localStorage('uys_mrp_done_ym')` ile MRP yapılmış YM İE'ler gizlenir. `+ Tamamlananlar` toggle.

### Kesim Planı YarıMamul Filtresi (Part 6)
- **`cutting.ts` — `w.hm` filtresi** — Ürünün kendisi (`hm.malkod === w.malkod`) ve YarıMamul tipi (`mat?.tip === 'YarıMamul'`) kesim planından çıkarıldı. Sadece gerçek hammaddeler (ÇELİK PROFİL vb.) dahil.
- **Reçete fallback** — `rc.satirlar` filtresi `Hammadde + Sarf` olarak güncellendi (önceden `YarıMamul` da dahildi).
- **`stokKontrol.ts` — YarıMamul filtresi** — İE stok kontrolünde de aynı filtre: `hm.malkod === wo.malkod` ve `mat?.tip === 'YarıMamul'` atlanır. `materials` parametresi eklendi.
- **Konsol debug logları** — `kesimPlanOlustur` fonksiyonuna detaylı `console.group` logları eklendi (her İE için HM durumu, atlamalar, sonuçlar).

### Reçete İyileştirmeleri (Part 6)
- **Reçete adı düzenleme** — `RecipeEditor`'da `ad` ve `rcKod` state olarak tutulur, input ile düzenlenebilir, `save()` Supabase'e yazar.
- **Süre birimleri** — "İşlem dk" yerine 3 kolon: Hazırlık + İşlem + Birim (dk/sn). `sureBirim` alanı `RecipeRow` type'a eklendi. Excel import/export dahil.
- **Aranabilir malzeme kodu** — `RecipeEditor` ve `BomEditor` satırlarında malkod alanı `SearchSelect` ile aranabilir. `inputClassName` prop eklendi.

### BOM Ürün Ağacı İyileştirmeleri (Part 6)
- **Yeni BOM — aranabilir malzeme** — `NewBomModal`'da `SearchSelect` ile malzeme listesinden arama. Seçilince ürün adı otomatik dolar.
- **Aranabilir satır malzemesi** — `BomEditor` satırlarında malkod `SearchSelect` ile.
- **Arama kutusu** — BomTrees listesinde mamul kodu/ad arama.

### Dashboard Ek İyileştirmeler (Part 6)
- **YarıMamul reçetesiz uyarısı** — "Yapılması Gerekenler"de `materials.filter(tip === 'YarıMamul' && recipes'de mamulKod yok)` → `⚠ X yarı mamulün reçetesi tanımlı değil` → Malzeme sayfasına yönlendirir.

### Malzeme Listesi İyileştirmeleri (Part 6)
- **Reçete var/yok filtresi** — "Yarı Mamul Reçete" dropdown: Hepsi / ✅ Var / ⚠ Yok. `receteKodSet` useMemo.
- **YarıMamul reçete badge** — Tabloda `RC ✓` (yeşil) / `RC ✗` (amber).
- **Arama kutusu** — Reçeteler listesinde kod/ad/mamulKod arama.

### Kopyalama & İsim Değiştirme (Part 6)
- **Malzeme kopyalama** — `Copy` ikonu, kod: `ORIJINAL-KOPYA`, ad: `... (Kopya)`, tüm ölçüler kopyalanır.
- **BOM kopyalama** — Tüm alt bileşenler yeni ID'lerle kopyalanır.
- **Reçete kopyalama** — Tüm satırlar yeni ID'lerle, BOM bağlantısı kaldırılır.
- **Tıkla-değiştir** — Malzeme (kod+ad), BOM (mamulKod+ad), Reçete (rcKod+ad+mamulKod): tıklayınca `showPrompt` ile değiştir.

### Modal & UI İyileştirmeleri (Part 6)
- **Modal dış tıklama engeli** — 19 sayfadaki tüm modallardan `onClick={onClose}` backdrop kaldırıldı. Sadece İptal/✕/Kapat ile kapanır.
- **Prompt modalları genişletildi** — `showPrompt/showConfirm/showAlert/showMultiPrompt`: max-width 380→600px. Dış tıklama kaldırıldı.

### Üretim Kaydı Tarih Seçici (Part 6)
- **OprEntryModal** — `tarih` state (default: today), date picker eklendi. Farklı tarihte `⚠ Farklı tarih` uyarısı.
- **ProductionEntry tekil** — Aynı date picker, save'de `tarih` kullanır.
- **TopluUretimModal** — Operatör seçiminin yanında tarih seçici.

### Aktif İş Başlangıç Saati Düzenleme (Part 6)
- **Inline time picker** — Aktif iş kartında başlangıç saati `<input type="time">` ile düzenlenebilir. `onBlur` ile Supabase'e kaydedilir (her keystroke'da değil).

### Önceki Part'lardan (Part 5 ve öncesi)
- Dashboard (8 madde), İzinli/Raporlu kutusu, Bekleyen İzinler, gercekAktif filtre
- Operatör Paneli: İşe Başla/Katıl, Auto-close, Akıllı saat, URL auto-login, bölüm eşleşme
- İzin Yönetim Sistemi: uys_izinler tablosu, admin↔operatör akışı, izin engeli
- Kesim Planları: tamamlanan toggle, otomatik tamamlama
- Excel BOM/Reçete import/export, seçimli silme
- MRP & Siparişler: MRP uyarısı, %100 filtre
- Misafir Modu: sidebar, CSS koruması, banner, supabase proxy engeli

---

## ⏳ TEST BEKLİYOR

| # | Madde | Detay |
|---|-------|-------|
| 4 | Log düzenleme | OprEntryModal'a `editLogId` prop, UPDATE modu |
| 6 | Kesim YM filtresi | `cutting.ts` + `stokKontrol.ts` — YarıMamul filtreleme test edilecek |
| 15 | Artık plana ekleme | "♻ Fire Yönet" → "Plana Ekle" butonu |

---

## ❌ YAPILMADI — Sonraki Chat

| # | Madde |
|---|-------|
| R1 | **Detaylı Üretim Raporu** — Tarih/Operatör/Operasyon/Sipariş filtreleri, çalışma süresi, fire oranı, Excel export, toplam/ortalama satırı |
| RBAC | **Yetki Sistemi** — 4 rol (Admin/Üretim Sorumlusu/Planlama/Depocu), matris onaylı, 15+ sayfa izin kontrolü |
| D | Görsel tasarım iyileştirmeleri (ileride) |

---

## ÖNEMLİ TEKNİK NOTLAR

### Dosya Yapısı
```
src/
├── hooks/useAuth.ts — admin/guest/operator roles, sessionStorage operatör oturumu
├── components/layout/
│   ├── Layout.tsx — data-guest CSS koruması, misafir banner
│   └── Sidebar.tsx — NAV items with guest flag
├── components/ui/
│   ├── SearchSelect.tsx — inputClassName prop desteği
│   └── MultiCheckDropdown.tsx
├── features/production/
│   ├── cutting.ts — getHamBoy/getParcaBoy export, YM filtresi, konsol debug logları
│   ├── mrp.ts — bomPatlaNet
│   ├── stokKontrol.ts — YM filtresi, materials parametresi
│   └── stokTuketim.ts
├── lib/
│   └── prompt.ts — showPrompt/showConfirm/showAlert max-width 600px, dış tıklama kapalı
├── pages/
│   ├── OperatorPanel.tsx — sessionStorage auth, popstate engeli, tarih seçici, başlangıç saat düzenleme,
│   │   İşe Katıl, auto-close, akıllı saat, izin engeli, IzinTalepForm, OprEntryModal export,
│   │   uzaktan çıkış broadcast dinleyici, admin geri butonu
│   ├── ProductionEntry.tsx — hedef aşım hard block, fresh DB sorgu, tarih seçici, stok uyarısı
│   ├── WorkOrders.tsx — admin entry (OprEntryModal), stok kontrollü (materials parametreli)
│   ├── CuttingPlans.tsx — tamamlanan toggle, ArtikOneriModal
│   ├── Orders.tsx — runMRP mrp_durum update
│   ├── Dashboard.tsx — mrpDurum kontrol (hesaplaMRP değil), YarıMamul reçetesiz uyarısı,
│   │   workflow pulse, stat kartları, sevkler, duruşlu istasyonlar
│   ├── DataManagement.tsx — kayıt bazlı accordion seçimli silme
│   ├── Operations.tsx — bölüm dropdown
│   ├── Operators.tsx — İzin/Mesai tab, IzinFormModal, uzaktan çıkış butonu
│   ├── MRP.tsx — YM İE seçimi, mrpDurum güncelleme, tamamlanan gizleme/toggle
│   ├── Reports.tsx — 12 tab
│   ├── Materials.tsx — reçete filtre, RC badge, kopyalama, tıkla-değiştir (kod+ad)
│   ├── BomTrees.tsx — arama, kopyalama, tıkla-değiştir (mamulKod+ad), SearchSelect
│   ├── Recipes.tsx — arama, kopyalama, tıkla-değiştir (rcKod+ad+mamulKod), süre birimleri, SearchSelect
│   └── Login.tsx — operatör girişi
├── store/index.ts — 21 tablo (izinler dahil), M mappers
├── types/index.ts — Izin interface, RecipeRow sureBirim alanı
├── App.tsx — AdminRoutes / OperatorRoutes ayrımı, popstate engeli, tek useAuth
```

### Supabase Tabloları (21 tablo)
```
uys_orders, uys_work_orders, uys_logs, uys_malzemeler, uys_operations,
uys_stations, uys_operators, uys_recipes, uys_bom_trees, uys_stok_hareketler,
uys_kesim_planlari, uys_tedarikler, uys_tedarikciler, uys_durus_kodlari,
uys_customers, uys_sevkler, uys_operator_notes, uys_active_work,
uys_fire_logs, uys_checklist, uys_izinler
```

### Kritik Kurallar
- **Şifreler** conversation'da gösterilmez — sadece kodda referans
- **Operatör oturumu sessionStorage** — tab kapanınca silinir, localStorage kullanılmaz
- **Admin oturumu localStorage** — kalıcı
- **App.tsx yapısı** — `AdminRoutes` (admin/guest) ve `OperatorRoutes` (operatör) tamamen ayrı, tek `useAuth` App seviyesinde
- **Hedef aşım** — Admin dahil ENGEL, fresh DB sorgusu ile kontrol
- **Modal dış tıklama** — Hiçbir modalda backdrop click kapatmaz
- **Kesim planı** — `w.hm` dizisinden YarıMamul ve ürünün kendisi filtrelenir
- **Stok kontrol** — `stokKontrolWO` YarıMamul filtresi uygulanır, `materials` parametresi gerekli
- **MRP durum** — Hesapla sonrası `mrp_durum='tamamlandi'` yazılır, Dashboard bunu kontrol eder
- **ProductionEntry.tsx** ayrı bir sayfa — OprEntryModal kullanmıyor
- **OprEntryModal** OperatorPanel.tsx'den export — WorkOrders admin "Kayıt Ekle" ile kullanır
- **Supabase RLS** — tüm tablolar `allow_all` policy gerekli
- **Bölüm eşleşme** — `operations.bolum` alanı kullanılır
- **Auto-close** — OprEntryModal save sonrası `prod >= hedef` ise tüm active_work silinir
- **Akıllı saat** — `localStorage uys_lastStop_{oprId}` ile önceki işin bitişi sonraki başlangıcı
- **gercekAktif** — Dashboard'da tamamlanmış İE'lerin active_work hayaletleri filtrelenir
- **Stok hareketleri** — Üretim kaydı girildiğinde hem mamul girişi hem HM çıkışı oluşturulur
- **Tarih seçici** — OprEntryModal, ProductionEntry, TopluUretimModal'da tarih değiştirilebilir

### Bilinen Sorunlar & Dikkat Edilecekler
- `{condition && <div>...</div>}` kapanmamış `}` hatası — her JSX expression kapatılmalı
- `l.operatorlar` bazı loglarda undefined — `Array.isArray()` kontrolü gerekli
- `o.aktif` bazı operatörlerde undefined — `o.aktif !== false` kontrolü kullan
- `CalendarX2` kullanılır (`CalendarOff` lucide-react'ta yok)
- `cutting.ts` debug logları aktif — production'da kaldırılabilir

### RBAC Matris (Onaylı — Henüz Uygulanmadı)
```
Sayfa               Admin  ÜretimSor  Planlama  Depocu
──────────────────────────────────────────────────────
Dashboard            ✅      ✅         ✅        ✅ (view)
Siparişler           ✅      view       ✅        view
İş Emirleri          ✅      ✅         view      view
Üretim Girişi        ✅      ✅         view      view
Kesim Planları       ✅      view       ✅        view
MRP                  ✅      view       ✅        view
Depo/Stok            ✅      view       ✅        ✅
Sevkiyat             ✅      view       ✅        ✅
Ürün Ağaçları        ✅      view       ✅        view
Reçeteler            ✅      view       ✅        view
Malzemeler           ✅      view       ✅        ✅
Operasyonlar         ✅      view       view      view
İstasyonlar          ✅      view       view      view
Operatörler          ✅      view       view      ✅
Tedarikçiler         ✅      view       ✅        ✅
Duruş Kodları        ✅      view       view      view
Raporlar             ✅      ✅         ✅        view
Veri Yönetimi        ✅      ❌         ❌        ❌
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
