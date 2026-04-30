# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 30 Nisan 2026 sabah
**Son canlı sürüm:** v16.02
**Bugün push edilen:** **v16.00 / v16.01 / v16.02** — sağlık raporu hotfix + MRP filtre band-aid + cutting override LEVHA kök fix

---

## YENİ OTURUM AÇILIŞINDA İLK ADIM

```
UYS v3 devamı. Bilgi Bankası açılış kuralı (§0):
docs/UYS_v3_Bilgi_Bankasi.md (özellikle §0, §18 ailesi, §19, §20, §21 MRP Formülü,
  §22 (27 Nis), §23 (28 Nis sabah), §24 (28 Nis öğlen), §25 (28 Nis öğleden sonra),
  §26 (29 Nis tam gün), §27 (30 Nis sabah) ⭐ YENİ) +
docs/DEVAM_NOTU.md +
docs/is_emri/00_BACKLOG_Master.md
oku.
```

---

## 30 NİSAN ÖZETİ

| # | Sürüm | Konu |
|---|---|---|
| 1 | v16.00 | `DataManagement.tsx` #15 sentinel typo fix: `recipes` → `recs` |
| 2 | v16.01 | `MRP.tsx` filtreye `dbEksik` eklendi (mrp_durum='eksik' DB görünürlüğü band-aid) |
| 3 | v16.02 | `mrp.ts` LEVHA cutting override skip root fix |
| 4 | — | Saha: S26A_03150 plywood 131 levha eksik görünür oldu, tedarik edildi |

---

## ANA ÇIKTILAR

- `v16.00`: Sağlık raporu #15 sentinel içinde `ReferenceError` engellendi; rapor tekrar üretildi.
- `v16.01`: `dbEksik` filtre band-aid ile `mrp_durum='eksik'` DB görünür hâle getirildi; kök çözüm değil.
- `v16.02`: `mrp.ts` LEVHA override skip kök fix ile plywood yüzey kesim yanlışlığı kapatıldı.
- Saha vakası S26A_03150 (MV GRUP, 5 Mayıs termin): plywood 131 levha eksik sistemde görünür oldu, kullanıcı tedarik etti, plywood stok 214/214 ve BORU 5500 stok 154/154 ile sipariş kaynak yeterli.
- Yeni backlog: #20 Sipariş-bütünü PlanBekliyor, #21 2D bin-packing, #22 Sağlık #16 sentinel, #23 Hesapla butonu `mrp_durum` DB UPDATE bug'ı.

---

## YARIN İÇİN ÖNCELİKLER

1. **#23** — `Hesapla` butonu MRP `mrp_durum` DB UPDATE'ini yazmıyor; bunun tam persistasyonu ve testini ilk iş yap.
2. **#20** — `statusUtils.ts` İE-bazlı mantığı sipariş-bağlamlı `sipariş-toplam HM` kontrolü ile tamamlasın.
3. **#21** — `cutting.ts` için 2D bin-packing gereksinimini netleştir, `boykesimOptimum` 1D varsayımı yüzey kesimlerde doğru değil.
4. **#22** — Sağlık #16 sentinel: aktif sipariş için toplam hammadde ihtiyacını stok + açık_tedarik ile karşıla.
5. `v16.02` sonrası sahayı takip et: benzer plywood/LEVHA siparişlerde eksik görünürlüğü ve tedarik sonrası stok durumunu doğrula.

---

## BİLİNEN WARN'LAR

- `v16.01` sadece görünürlük band-aid; gerçek düzeltme `mrp_durum` yazma + `Hesapla` persist kontrolü.
- `v16.02` kök fix yaptı ama 2D plywood bin-packing hâlâ backlog'lu.
- Saha S26A_03150 düzeldi; benzer plywood siparişlerde `214/214` ve `154/154` stok kontrolü yap.
- `statusUtils` hâlihazırda İE-bazlı; #20 ile sipariş düzeyine çekilmeli.
- Bu oturumda yeni `#23` eklendi; `docs/is_emri/00_BACKLOG_Master.md` mutlaka güncellendi.

---

## MULTI-MACHINE NOTU

Bugün ev makinesi (`iskender.uzun` profile) ana kullanım. NB081'de Node yok, GitHub Actions build'e güveniliyor. v15.94 audit kuralı sayesinde build artık DB şema uyumsuzluğunu yakalıyor — `sql/*.sql` dosyaları + kod tarafı senkron olmalı.

Çoklu admin oturum sorunu (28 Nis tespit) hala backlog'da.

---

## ÖNEMLİ KURALLAR (DEĞİŞMEDİ)

- §18 (Downloads hijyen)
- §18.2 (yeni tablo: DataManagement.tables + store TABLE_MAP + audit-schema.cjs whitelist eşzamanlı eklenmeli)
- §18.3 (durum string normalize)
- §18.4 (artık yönetimi havuz tek standart)
- §18.5 (SQL `public.` prefix)
- §20 (Tehdit modeli — RLS allow_all hala iç ağda kabul, yarın için değil)
- §21 (MRP formülü: Net = İhtiyaç − Stok − Yolda)

---

## SİL UYARISI

⚠️ **Bu chat 29 Nis 2026 akşamı silinecek.** Bilgilerin tamamı:
- `docs/UYS_v3_Bilgi_Bankasi.md` §22 + §23 + §24 + §25 + **§26 (29 Nis tam gün) ⭐**
- `docs/saha_model_28nis2026.md`
- `docs/DEVAM_NOTU.md` (bu dosya — yenilendi)
- `docs/is_emri/00_BACKLOG_Master.md` (Madde 15 ✅ işaretlendi)

Yarın yeni Claude oturumunda chat aramaya **gerek yok**.

İyi sabahlar Buket. 🌅 — **v16.00-v16.02 hotfix serisi** saha görünürlüğünü iyileştirdi.

---

## SON SAATTE EK ÇIKTILAR (29 Nis 17:00 ~)

**v15.97 — Doc kalıcı kayıt:** Bu DEVAM_NOTU + §26 Bilgi Bankası + Backlog güncel.

**v15.98 — Bulk import bugfix:** S26A_03146 14 kalemli sipariş Excel ile yüklendi. Eski kod "tekrar eden siparis_no" hata veriyordu, şimdi `siparis_no`'ya göre gruplanıyor. Önizlemede "📦 N sipariş (M kalem)" rozet eklendi.

**v15.99 — Reçete iç tutarlılığı:** Saha vakası — IE-S26A_03146-04 plansız kaldı çünkü reçetenin `mamul_kod`'u "1450 MM" (boşluklu), iç YarıMamul satırının `malkod`'u "1450MM" (boşluksuz). Tek seferlik el kayması. Manuel SQL ile düzeltildi. Sağlık raporu **Kontrol #15** eklendi → gelecekte aynı el kayması 5 dakikada yakalanır.

**Saha gerçek WARN'lar (kod değil):**
- BORU Ø48,3x3 5500mm — net 154 adet, termin 5 Mayıs (tedarik açılmalı)
- S26A_02808 + S26A_03146 mrp_durum bayat (Hesapla çalıştırılırsa düzelir, 30 sn iş)
