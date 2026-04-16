# ÖZLER UYS v3 — Bilgi Bankası v11
> Son güncelleme: 2026-04-16 (Part 9: Dashboard + İE hm[] + Recipe Güncelle + HM Tipleri Yönetimi)

## 🎯 YENİ CHAT BAŞLANGIÇ NOTU
Yeni chat'te sadece bu bilgi bankasını yükle, kod bütünü zaten GitHub'da:
- **Repo:** https://github.com/uzuniskender/ozler-uys-v3
- **URL:** https://uzuniskender.github.io/ozler-uys-v3/
- **Son ZIP:** `/mnt/user-data/outputs/ozler-uys-v3-full.zip` indirilmiş olmalı

---

## Proje Bilgileri
- **Supabase:** kudpuqqxxkhuxhhxqbjw (proje: ozler-uys, Frankfurt)
- **Stack:** React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase
- **Container yol:** `/home/claude/ozler-uys-v3/`
- **Kullanıcı:** Buket Bıçakçı (Özler Kalıp ve İskele Sistemleri A.Ş.)

---

## ✅ PART 9 TAMAMLANANLAR

### Dashboard Yeniden Tasarım
- 2 satırlı üretim akış şeması: `Sipariş → Reçete → İş Emri → Kesim Planı` / `MRP → Üretim → Sevk`
- FLOW_COLORS static map (Tailwind v4 dinamik class sorunu çözümü)
- Rol bazlı hızlı erişim kartları (admin/planlama/uretim_sor/depocu)
- Durum bazlı renk (kesim planı: amber/green/zinc, stok: red/amber vb.)
- Mevcut alt kısım korundu (stat kartları, uyarılar, grafik, yapılması gerekenler, operasyon dağılımı, sistem durumu)

### İş Emri hm[] Temizleme — Kökten Çözüm
- Manuel İE oluşturmada filtre: `kirno !== '1'` + `malkod !== kendi malkod`
- Mapper seviyesinde (hem `store/index.ts` hem `store_index.ts`) self-reference otomatik temizleniyor
- WorkOrders görünümde `gercekHm = w.hm.filter(h => h.malkod !== w.malkod)` ve `min-w-[280px]` ile uzun ad okunabilir
- HM etiketlerinden `slice(0, 20)` kaldırıldı, `title` tooltip eklendi

### Reçete Güncelle — Akıllı Senkron (BOM → Reçete)
- Önce "üzerine yazılsın mı?" onaylı tam sıfırlama yapıyordu
- Şimdi:
  - BOM'da var, reçetede yok → EKLE (malzeme kartından opId pre-fill)
  - Reçetede var, BOM'da yok → SİL
  - İkisinde var → malad/tip/miktar/birim güncelle, opId + hazirlikSure + islemSure KORU
- Toast: "+N eklendi, M güncellendi, -K silindi · Operasyon ve süreler korundu"

### BOM Kök Bileşen Tipi Düzeltildi
- Yeni BOM oluşturulurken kök bileşen tipi malzeme kartındakini alıyor (hardcoded 'Mamul' değil)

### Malzeme Revizyon Sistemi (daha önce tamamlandı, test bekliyor)
- Supabase sütunları: `revizyon`, `revizyon_tarihi`, `onceki_id`, `aktif`, `uzunluk`
- MatFormModal save'de dialog: "Tümünü Güncelle" vs "Yeni Revizyon"
- Pasif malzemeler listeden gizleniyor, toggle ile gösterilir
- R1, R2 mor badge + PASİF gri badge

### Zincirleme Güncelleme (hm[] dahil)
- Malzeme ad/kod değiştiğinde: BOM → Reçete → İş Emri → **hm[] array içindeki referanslar** güncellenir
- 5 noktada: `renameMaterial`, `recodeMaterial`, `cascadeAdKod` (modal), `renameBom`, `createRecipeFromBom`
- Ölçü değişikliğinde: kesim miktarları reçetelerde otomatik yeniden hesaplanır

### Uzun Kenar / Kısa Kenar Terminolojisi
- DB sütun adları aynı (boy=uzun kenar, en=kısa kenar) — sadece UI etiketleri değişti
- Modal: "Uzun Kenar (mm)" / "Kısa Kenar (mm)"
- Otomatik swap: kaydederken kısa > uzun ise yer değiştir + toast
- Liste başlıkları: "Uzun K." / "Kısa K." + yeni Çap sütunu
- Kırmızı border + uyarı: kısa > uzun

### Hammadde Tipleri Yönetimi (YENİ)
- **Yeni DB tablosu:** `uys_hm_tipleri` (id, kod, ad, aciklama, sira, olusturma)
- Varsayılan 6 tip: BORU, PROFİL, LEVHA, SAC, ÇUBUK, NPU
- **Veri Yönetimi → 🏷️ Hammadde Tipleri paneli**:
  - Ekle (kod + ad), Düzenle (ad), Sil (onaylı), Sırala (▲▼)
  - Kod otomatik büyük harfe (Türkçe locale)
  - Duplikasyon engelleme
- Malzeme modalında dropdown — sadece tanımlı tipler seçilebilir
- Türkçe locale (`toLocaleUpperCase('tr-TR')`): iki PROFİL sorunu çözüldü (noktasız I vs noktalı İ)

### Materials Sütun Başı Filtreleri
- Her sütun başlığının altına ayrı filtre input'u: Kod, Ad, Tip, Birim, Uzun K., Kısa K., Kalınlık, Çap, Uzunluk, Operasyon
- Üst bar sadeleşti: MultiCheckDropdown'lar (Tip, HM Tipi, YM Reçete) + "✕ Tüm filtreleri temizle" + Pasif toggle
- `dimMatch` startsWith mantığı korundu (60 → 60, 60.3, 600 ✓; 160 ✗)

### Dashboard Akış Kartı Renk Mantığı
- Kesim Planı: kesimEksik>0 ise amber (uyarı), else bekleyenKP>0 ise green, else zinc

---

## ⏳ TEST BEKLİYOR (kullanıcı canlıya alacak)
- Revizyon sistemi (SQL çalıştırılacak)
- Zincirleme güncelleme (hm[] dahil)
- Uzun/Kısa kenar otomatik swap
- HM Tipleri panel
- Dashboard yeni düzeni
- Reçete akıllı senkron
- Sütun başı filtreler

---

## 📋 SQL DOSYASI (revision_sql.sql)
SQL Editor'da sırayla çalıştırılacak:
1. Revizyon sütunları (idempotent)
2. HM Tipi UPPER normalize
3. Uzun/Kısa kenar swap (en > boy ise)
4. `uys_hm_tipleri` tablosu + varsayılan 6 tip

---

## 🔄 BEKLEYEN BACKLOG
- B1 Kesim planı birleştirme (yeni sipariş mevcut plana eklensin)
- B2 Realtime sync
- B3 Operatör mesajları paneli
- B4 ActiveWork canlı takip
- B5 Toplu sipariş girişi (Excel)
- B6 İşlem süre reçeteye
- B7 Fire → sipariş dışı İE
- B8 MRP stoktan ver
- B9 Test DB ayrı Supabase

---

## 🗄️ Supabase Tabloları (24 tablo)
```
uys_malzemeler (revizyon, revizyon_tarihi, onceki_id, aktif, uzunluk eklendi)
uys_hm_tipleri (YENİ — Part 9)
uys_orders, uys_work_orders, uys_logs, uys_operations
uys_stations, uys_operators, uys_recipes, uys_bom_trees
uys_stok_hareketler, uys_kesim_planlari, uys_tedarikler, uys_tedarikciler
uys_durus_kodlari, uys_customers, uys_sevkler, uys_operator_notes
uys_active_work, uys_fire_logs, uys_checklist, uys_izinler
uys_kullanicilar, uys_yetki_ayarlari
```

---

## 🔐 Kritik Kurallar
- **Şifreler conversation'da gösterilmez**
- Operatör oturumu sessionStorage (tab kapanınca silinir)
- Admin oturumu localStorage (kalıcı)
- RBAC: useAuth useStore import ETMİYOR (circular dep)
- Modal dış tıklama kapatmaz
- `@/store` aktif (store_index.ts kullanılmıyor ama tutarlılık için güncel tutulur)
- **Supabase RLS:** allow_all (USING true) — anon güvenlik açığı var, ileride ele alınacak
- Türkçe metinlerde hep `.toLocaleUpperCase('tr-TR')` (noktalı İ için)
- Tailwind v4 dinamik class çalışmaz → FLOW_COLORS static map gerekir

---

## 📁 Dosya Yapısı (Part 9 değişenler)
```
src/
├── pages/
│   ├── Dashboard.tsx — yeniden tasarım (akış + rol kartları)
│   ├── Materials.tsx — sütun filtreleri + HM dropdown + Uzun/Kısa Kenar
│   ├── BomTrees.tsx — createRecipeFromBom smart merge, cascade hm[]
│   ├── WorkOrders.tsx — hm[] filter, min-w-[280px]
│   └── DataManagement.tsx — HmTipleriPanel eklendi (EN ALT)
├── store/index.ts — wo mapper hm self-ref filter, hmTip mapper, TABLE_MAP + interface + initial state
├── store/store_index.ts — aynı (mirror)
└── types/index.ts — HmTip interface eklendi
```

---

## 🚀 Deploy Sırası
1. `revision_sql.sql` Supabase SQL Editor'da çalıştır
2. ZIP deploy (GitHub Pages)
3. Veri Yönetimi'ne git → HM Tipleri panelde 6 varsayılan tip görünecek
4. Malzeme modalında HM Tipi dropdown'u çalışacak

