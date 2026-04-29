# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 29 Nisan 2026 akşam (oturum kapanışı, ~17:00)
**Son canlı sürüm:** v15.99
**Bugün push edilen:** **18 sürüm** (v15.82 → v15.99) — Madde 15 tam tur + bulk import çoklu kalem + reçete iç tutarlılığı sentinel

---

## YENİ OTURUM AÇILIŞINDA İLK ADIM

```
UYS v3 devamı. Bilgi Bankası açılış kuralı (§0):
docs/UYS_v3_Bilgi_Bankasi.md (özellikle §0, §18 ailesi, §19, §20, §21 MRP Formülü,
  §22 (27 Nis), §23 (28 Nis sabah), §24 (28 Nis öğlen), §25 (28 Nis öğleden sonra),
  §26 (29 Nis tam gün) ⭐ YENİ) +
docs/saha_model_28nis2026.md (13 senaryo) +
docs/DEVAM_NOTU.md +
docs/is_emri/00_BACKLOG_Master.md +
docs/is_emri/13_AnaAkisRefactor.md
oku.

Önceki chat silindi/silinecek — tüm bilgi docs/'ta.
```

---

## 29 NİSAN ÖZETİ (15 SÜRÜM)

| # | Sürüm | Konu |
|---|---|---|
| 1 | v15.82 | Saha model uyum: AZALIS BLOCK kaldırıldı + manuel İE termin zorunlu |
| 2 | v15.83 | Senaryo 1 modal Faz 1 MVP — kesim planı sonrası onay (autoZincir + onKesimFark callback) |
| 3 | v15.84 | Senaryo 13 otomatik test — v15.83 modal'ının testRunner ispatı |
| 4 | v15.85 | Test cleanup bug fix (3 katmanlı: dinamik sub-run + mrp_calculations + autoChain etiketleme) |
| 5 | v15.86 | "IE--01" boş prefix bug fix — Tekil İE'de etkinSiparisNo kullanımı |
| 6 | v15.87 | buildWorkOrders idempotency — DB MAX(sira) ile duplicate sira imkansız |
| 7 | v15.88 | MRP "0 aktif sipariş" UX bug — bekliyor durumu listede gözükür |
| 8 | v15.89 | Sağlık raporu 3 yeni kontrol (#12 plansız İE, #13 sira unique, #14 ie_no unique) |
| 9 | v15.90 | **Madde 15 P1**: Veri modeli (rezerv_order_id + uys_bildirimler + uys_manuel_mudahale_log + RBAC) |
| 10 | v15.91 | Sipariş no UNIQUE constraint + UI duplicate koruması |
| 11 | v15.92 | **Madde 15 P2**: Mamul rezerv/serbest UI + 2-aşama çıkış modalı |
| 12 | v15.93 | Audit schema dosyaları sql/ klasörüne |
| 13 | v15.94 | Audit senkronizasyonu (bildirimler store'a, mudahale log whitelist'e) |
| 14 | v15.95 | **Madde 15 P3**: Hammadde FIFO termin tahsisi + MRP rozetleri |
| 15 | v15.96 | **Madde 15 P4**: Bildirim merkezi (Topbar Bell + dropdown + MRP eksik üreticisi) |
| 16 | v15.97 | Doc kalıcı kayıt (DEVAM_NOTU + Bilgi Bankası §26 + Backlog Madde 15 ✅) |
| 17 | v15.98 | Bulk import çoklu kalem desteği (siparis_no'ya göre grupla) |
| 18 | v15.99 | Sağlık raporu Kontrol #15 — Reçete iç tutarlılığı sentinel (29 Nis IE-04 saha vakası) |

---

## ANA ÇIKTILAR

### Madde 15 Onay Sistemi — Tam Tur ✅

| Faz | Sürüm | Ne |
|---|---|---|
| P1 | v15.90 | Veri modeli + RBAC altyapısı |
| P2 | v15.92 | Mamul stok rezerv/serbest ayrımı + 2-aşama çıkış modalı (sebep+açıklama zorunlu) |
| P3 | v15.95 | Hammadde FIFO termin tahsisi (MRP sayfasında 🟢🟡🔴 rozetler) |
| P4 | v15.96 | Bildirim merkezi (Topbar Bell + 2 otomatik bildirim üreticisi) |

**Yeni tablolar:**
- `uys_bildirimler` — bildirim merkezi (sarı/kırmızı, kategori, ref_id, okundu)
- `uys_manuel_mudahale_log` — audit trail (sebep+açıklama zorunlu)

**Yeni kolon:**
- `uys_stok_hareketler.rezerv_order_id` — mamul rezerv/serbest ayrımı (giriş kayıtlarında dolu = rezerv, NULL = serbest)

**Yeni RBAC:**
- `bildirim_view`, `bildirim_okundu_isaretle` (planlama+uretim_sor+depocu)
- `manuel_mudahale_yap` (planlama+depocu — rezerv'e dokunma yetkisi)
- `manuel_mudahale_log_view` (sadece admin)

### Sağlık Raporu — 14/14 PASS

Yeni 3 kontrol eklendi (v15.89):
- #12 Plansız Kesim İE
- #13 Sipariş içi sıra numarası unique
- #14 ie_no benzersizliği ve format

Saha durum: 12 PASS · 2 WARN · 0 FAIL. WARN'lar saha aksiyon (kod sorunu değil).

### Saha Bug Temizliği

- 6 boş prefix İE düzeltildi (manuel SQL UPDATE)
- 1 sipariş duplicate (S26A_03151) birleştirildi (DO bloğu, FIFO sıra ile devam)
- DB UNIQUE constraint `uys_orders.siparis_no` eklendi (artık DB seviyesinde de korunuyor)

---

## YARIN İÇİN ÖNCELİKLER

### ⚠️ KRİTİK — Yarın ilk iş
**42 reçetede yuvarlama hatası kaldı** (gizli mayın). Belirti: hedef adedi yuvarlama hatasıyla eşleştiğinde "stok yetersiz" hatası → üretim engelleniyor. Saha vakası: IE-S26A_02808-01 (PROFIL 40x40x2.5 790mm, 700 hedef) bu yüzden başlamadı.

Reçete listesi (29 Nis akşamı):
- 1/6  (~0.1667 yuvarlanmış) — 13 reçete
- 1/7  (~0.1429) — 7 reçete
- 1/9  (~0.1111) — 6 reçete
- 1/11 (~0.0909) — 4 reçete
- 1/12 (~0.0833) — 11 reçete (`000zcxdee609`'da 2 satır)
- 1/13 (~0.0769) — 3 reçete

**Düzeltilen:** `mojob65vtlv7ib` (yarın yeniden kontrol etmeye gerek yok)

**Yarın çözüm yolu:** Supabase Studio multi-statement çalıştırmadı (bilinen sorun, 5 farklı SQL strateji denendi başarısız). Yapılacak:
- Node script (`scripts/fix-rounding.cjs`) — Supabase JS client ile her UPDATE ayrı request
- veya `psql` CLI üzerinden direkt migration

**Sentinel:** Yarın v15.99 Kontrol #15'e benzer bir kontrol eklenecek (ya `cuttingPlan.ts`'de tolerans ya da `canProduceWO` toleransı). Kullanılan SQL pattern (1/N tarama):
```sql
SELECT r.id, r.mamul_kod, s.value->>'miktar'
FROM uys_recipes r, jsonb_array_elements(r.satirlar) s
WHERE s.value->>'tip' = 'Hammadde'
  AND ABS((s.value->>'miktar')::numeric - 1.0/N) < 0.001
  AND (s.value->>'miktar')::numeric <> 1.0/N;
```

### Hemen
- **Sahada Madde 15 testi:** Mamul üret, depodan çıkış yap, manuel müdahale yap, bildirim gör
- **MRP rozetleri kontrolü:** 🟢🟡🔴 sayaçlar gerçek siparişlerle doğru görünüyor mu

### Kısa vadede (Backlog'dan)
- **#5 Sevkiyat Oluşturma Formu** — Production-blocker (UYS v3'te liste var, oluşturma yok)
- **#7 Toplu Sipariş Excel İmport** — Pratik gereklilik
- **#9 Stok Onarım** — Audit kritik

### Madde 15'in açık ucu (Faz 2 — backlog)
- Senaryo 1 modal "Düzenle" modu (kullanıcı manuel hedef girsin) — şimdilik atlandı, saha kullanımı sonrası ihtiyaç doğarsa
- Hammadde manuel müdahale — P3'te tahsis görünür ama "rezerv kırma" UI'sı henüz yok (mamul tarafında var, hammaddeye taşınabilir)

### Bilinen WARN'lar
- BORU Ø48,3x3 5500mm — net 154 adet, termin 5 Mayıs (gerçek tedarik ihtiyacı)
- S26A_02808 — mrp_durum bayat (MRP "Hesapla" çalıştırılırsa düzelir)

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

İyi akşamlar Buket. 🌙 — **18 sürüm tek günde rekor.** Madde 15 sahada + bulk import düzeldi + reçete sentinel eklendi.

---

## SON SAATTE EK ÇIKTILAR (29 Nis 17:00 ~)

**v15.97 — Doc kalıcı kayıt:** Bu DEVAM_NOTU + §26 Bilgi Bankası + Backlog güncel.

**v15.98 — Bulk import bugfix:** S26A_03146 14 kalemli sipariş Excel ile yüklendi. Eski kod "tekrar eden siparis_no" hata veriyordu, şimdi `siparis_no`'ya göre gruplanıyor. Önizlemede "📦 N sipariş (M kalem)" rozet eklendi.

**v15.99 — Reçete iç tutarlılığı:** Saha vakası — IE-S26A_03146-04 plansız kaldı çünkü reçetenin `mamul_kod`'u "1450 MM" (boşluklu), iç YarıMamul satırının `malkod`'u "1450MM" (boşluksuz). Tek seferlik el kayması. Manuel SQL ile düzeltildi. Sağlık raporu **Kontrol #15** eklendi → gelecekte aynı el kayması 5 dakikada yakalanır.

**Saha gerçek WARN'lar (kod değil):**
- BORU Ø48,3x3 5500mm — net 154 adet, termin 5 Mayıs (tedarik açılmalı)
- S26A_02808 + S26A_03146 mrp_durum bayat (Hesapla çalıştırılırsa düzelir, 30 sn iş)
