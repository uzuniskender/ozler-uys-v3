# UYS v3 — v15.30 Patch Notları (F: Dashboard Redesign)

**Tarih:** 22 Nisan 2026 gece 4. oturum
**Kapsam:** F (ÜYSREV1'den kalan Dashboard redesign, IFS tarzı)
**Bilgi Bankası güncellemesi:** §6, §14 Öncelik 3 F maddesi kapanışı

---

## 1. Ne Değişti

`src/pages/Dashboard.tsx` tamamen yeniden yazıldı (979 → 756 satır). **Veri hesaplamaları birebir aynı — sadece görsel ve layout yenilendi.** Tüm navigation bağlantıları korundu.

### Ana değişiklikler

- **Light "ada" yaklaşımı:** Dashboard sayfası kendi `bg-gray-50` konteyneri içinde light tema. App shell (topbar, sidebar) dark kalır. Layout'un `p-4 lg:p-6` padding'i `-m-4 lg:-m-6` ile negate edilip Dashboard kendi padding'ini veriyor → tam genişlik light ada görünümü.
- **6 KPI tile:** Önceki 7 StatCard yerine 6 büyük KPI (Aktif Sipariş, Açık İE, Aktif Çalışma, Bugün Fire, Min Stok Altı, Bu Hafta Sevk). Uyarı varsa tile'ın tamamı kırmızı/sarı background (önceki renkli icon + beyaz rakam yerine tile'ın state'i gösteriyor).
- **Workflow tek satır:** Önceki 2-satır/12 kart yapısı (Sipariş→Reçete→İE→Kesim + MRP→Üretim→Sevk) → 7 adım tek compact flow'a indirildi. Warn olan adım turuncu border + üst sağda `!` badge.
- **Konsolide Uyarılar paneli:** Termin, min stok, kesim eksik, MRP, tedarik, izin, yedek — hepsi tek panelde satır-satır (border-left renkli) + her satırda aksiyon butonu. Önceki yanıp sönen WorkflowBtn bölümü kaldırıldı (duplicate oluyordu).
- **3-sütun personel satırı:** Önceki ayrı bölümler (İzinli + Duruş + InactiveOps) tek satıra sığdı.
- **Chart light tema:** Recharts tooltip beyaz + gri border, axis text gri-500. Bar renkleri aynı (yeşil/kırmızı).
- **Aktif Çalışma kartları:** Uzun açık → kırmızı bg, durgun → sarı bg, normal → beyaz. Progress bar rengi state'e göre.

### Kaldırılanlar

- `FLOW_COLORS` object (48 satır) + `flowColor()` helper
- `FlowCard`, `QuickCard`, `StatCard`, `WorkflowBtn` eski component'leri
- Akıllı Workflow yanıp sönen butonlar bölümü (Uyarılar paneli bu işi yapıyor)
- Gradient başlık (`from-white to-zinc-400 bg-clip-text text-transparent`) → sade gray-900
- `wfPulse` CSS keyframes (artık gerek yok)
- `PieChart`, `Pie`, `Cell` recharts import'ları (kullanılmıyor)
- `Flame`, `Wrench`, `CheckCircle`, `XCircle`, `ArrowRight` icon import'ları (kullanılmıyor)

### Yeni component'ler (dosya içinde)

- `Kpi` — tone: neutral/alert/warn, icon + label + value + sub
- `Panel` — başlık + sağda count + body wrapper
- `FlowStep` — workflow adımı (warn badge)
- `AlertItem` — border-left renkli, aksiyon butonlu
- `ListRow` — küçük liste satırı
- `SectionTitle` — mavi dikey çubuk + uppercase etiket

---

## 2. Test Sonuçları

- `npx tsc --noEmit` → ✅ 0 hata
- `npm run audit:columns` → ✅ TEMİZ (Dashboard içindeki tek `.insert` — `uys_tedarikler` tedarik önerisi — geçerli)
- `npm run lint` — pre-existing dosya genelinde hatalar aynı (benim eklediğim yeni lint hatası yok)

---

## 3. Navigation Bağlantıları (Test için)

Tüm eski navigasyon korundu:

| Element | Navigate to |
|---|---|
| Header termin badge | `/orders` |
| Header mesaj badge | `/messages` |
| KPI Aktif Sipariş | `/orders` |
| KPI Açık İş Emri | `/work-orders` |
| KPI Aktif Çalışma | `/production` |
| KPI Bugün Fire | `/reports` |
| KPI Min Stok Altı | `/warehouse` |
| KPI Bu Hafta Sevk | `/shipment` |
| Workflow adımları | ilgili modül |
| Alert item'ları | ilgili modül |
| Sevk liste satırı | `/shipment` |
| Aktif çalışma kartı | `/operator?oprId=...` |
| Personel panelleri | `/operators`, `/stations` |
| Quick Access | rol bazlı modül |

---

## 4. Bilgi Bankası Güncelleme Noktaları

### §6 Son Sürüm Geçmişi — yeni satır:

```
| v15.30 | F (Dashboard redesign — IFS tarzı light tema) |
```

### §14 Öncelik 3 ÜYSREV1 — F maddesi kapansın:

```
⚠ Öncelik 3 — Hızlı düzeltmeler (22 Nis akşam ÜYSREV1)
- ✓ A. Checklist sayfası sil (v15.27)
- ✓ B. Ürün ağacı 'Reçete Güncelle' → modal aç (v15.27)
- ✓ C. Aktif olmayan operatörler → InactiveOperatorsCard (v15.27)
- ⏭ D. Depolar CSS — dosya yok, atlandı
- ✓ E. Reçeteler CSS iyileştirme (v15.27)
- ✓ F. Dashboard redesign — IFS tarzı light tema (v15.30)
```

**ÜYSREV1 A/B/C/E/F tümü tamamlandı. Sadece D atlandı (dosya yoktu).**

### §2 "Bir sonraki oturum notları" — güncelleme:

Orta Öncelik listesinden F satırı çıkartılsın. Kalan:

| # | İş | Süre |
|---|---|---|
| G | Supabase RLS + Auth (güvenlik) | 1-2 gün |
| Parça 3 | Manuel İE Seçim UI — Buket'in asıl isteği | 2-3 saat (SPEC NETLEŞTİRİLMELİ) |
| Parça 2B | Kalem bazlı termin FIFO rafine | 2 saat |

> **Parça 3 notu:** v15.30 oturumunda Buket "Parça 3'ten kastın ne?" dedi. KB'de tam spec yok. Rafa kaldırıldı — netleştirilince açılır.

---

## 5. Git Commit Mesajı Önerisi

```
v15.30 — F: Dashboard redesign (IFS-style light theme)

- Dashboard.tsx tamamen yeniden yazıldı (979 → 756 satır)
- Light "ada" yaklaşımı: dashboard kendi bg-gray-50 konteyneri
  içinde light, app shell dark kalır
- 6 KPI tile + 7 adım compact workflow + konsolide uyarılar paneli
- Recharts light tema (beyaz tooltip, gri axis)
- Aktif çalışma kartları state'e göre renkli (uzun/durgun/normal)
- Tüm data hesaplamaları aynı; sadece görsel+layout yenilendi
- Tüm navigation path'leri korundu
- ÜYSREV1 F maddesi kapandı (§14 Öncelik 3'te A/B/C/E/F tümü ✓)
```

---

## 6. Bilinen Sınırlamalar

- Tailwind v4'ün custom `bg-bg-*` tokenları HÂLÂ dark-only. Dashboard onları kullanmıyor (standart Tailwind renklerine geçti). **App geneli dark tema etkilenmedi.**
- IE11 gibi çok eski tarayıcılar için hiçbir ek polyfill eklenmedi (zaten proje React 19 kullanıyor, modern tarayıcı gerektiriyor).
- Dashboard mobile'da (≤768px) grid columns küçülüyor — ama KPI'lar 2x3'e sığıyor, workflow 7 adım dar da olsa scroll'suz görünebiliyor. Eğer mobile'de sorun çıkarsa `overflow-x-auto` eklenebilir.

---

## 7. Push Sırası

```
1. Dashboard.tsx → src/pages/Dashboard.tsx (mevcut dosyayı overwrite)
2. git add src/pages/Dashboard.tsx
3. git commit (§5'teki mesajla)
4. git push
5. GitHub Actions: audit + build + deploy bekle
6. Canlıda Dashboard'u aç, her section'ı tıkla, navigasyon doğrula
7. Sağlık Raporu çalıştır → JSON paylaş
```

*— Son —*
