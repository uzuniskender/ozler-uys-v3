# UYS v3 — v15.32 Patch Notları (Bar Model Kapsama + Kontrol #11)

**Tarih:** 23 Nisan 2026 akşam
**Kapsam:** v15.31'de kaçan üretim giriş yolları + Sağlık Raporu Kontrol #11
**Bilgi Bankası güncellemesi:** §2, §6, §13, §14

---

## 1. Özet

v15.31 Bar Model Faz A sadece `ProductionEntry.tsx`'i güncelledi; canlıda üretim girişlerinin **büyük çoğunluğunun `OperatorPanel.tsx`** üzerinden yapıldığı atlandı. Sonuçta deploy sonrası da küsüratlı `cikis` kayıtları yazılmaya devam etti (ör. `IE-MANUAL-MOBVXM63` → `0.1429` tüketim).

v15.32 bu boşluğu kapatır, Sağlık Raporu'na **Kontrol #11 (Bar Model tutarlılığı)** ekler ki bundan sonra aynı sorun manuel SQL ile avlanmak zorunda kalınmadan raporda görünür.

## 2. Neyin yanlıştı? (özet tespit)

v15.31 deploy sonrası canlı üretim testi:

| WO | hedef | üretim | Beklenen davranış | Gerçekleşen |
|---|---|---|---|---|
| `IE-MANUAL-MOBVXM63` | 1 | 1 | bar_acilis × 1, açık bar (fireMm>0 ise) | `cikis: 0.1429` (eski orantılı düşüm) |

Sebep: OperatorPanel'in `savePanel` fonksiyonu (hem edit hem yeni kayıt modu) bar-model skip'i yapmıyor, `barModelSync` çağrısı yok.

Ayrıca:
- `WorkOrders.tsx` (log qty düzenleme) da delta HM'de aynı hatayı yapıyordu.
- `CuttingPlans.tsx`'teki eski `artikStokaGir` / modal `stokaGir` aktif kalıyor → çift izleme riski (hem manuel `-ARTIK` stok, hem `uys_acik_barlar` havuz).

## 3. Değişen Dosyalar (4 + 1 SQL)

### Değişen (4)
- `src/pages/OperatorPanel.tsx`
  - `barModelSync, isBarMaterialByKod` import
  - `useStore` destructure'a `materials` eklendi
  - Edit mode HM döngüsü → bar-model skip
  - Yeni kayıt mode HM döngüsü → bar-model skip
  - `reloadTables`'a `uys_acik_barlar` eklendi
  - Kaydetme sonunda `barModelSync` çağrısı (idempotent upsert)
- `src/pages/WorkOrders.tsx`
  - `isBarMaterialByKod` import
  - Log qty düzenleme delta HM döngüsünde bar-model skip
- `src/pages/CuttingPlans.tsx`
  - `artikStokaGir` fonksiyonu disable (toast bilgilendirme)
  - Modal içi `stokaGir` disable (toast bilgilendirme)
  - `showPrompt` import'u kaldırıldı (artık kullanılmıyor)
- `src/pages/DataManagement.tsx`
  - Sağlık Raporu **Kontrol #11 — Bar Model tutarlılığı**
  - Rapor versiyon etiketi `v15.25 → v15.32`

### Yeni (1)
- `sql/sql_v15_32_cleanup.sql` — v15.31 sonrası yazılmış kalıntı küsüratlı çıkışları audit'e alıp siler. Idempotent; tekrar çalıştırılsa no-op olur.

## 4. Kontrol #11 — Bar Model tutarlılığı

**Mantık:** Her kesim planı satırı için —
1. Ham malkod bar-model malzeme mi? (`tip='Hammadde' && uzunluk>0`) — değilse atla.
2. Satır %100 tamamlandı mı? (tüm WO'larda `prod >= hedef`, iptal'ler skip) — değilse atla.
3. Deterministik id'leri beklenen: `bar-open-{planId}-{satirId}-{i}` (i=0..hamAdet-1). Eksik olanları topla.

**Durum:**
- `pass` — tüm tamamlanan satırlar için bar_acilis kayıtları tam
- `fail` — en az 1 satırda bar_acilis eksik (detayda ilk 20'si listelenir)

**Aksiyon:** Eksik varsa: ilgili WO'lardan birine tekrar üretim girişi yap (idempotent tetiklenir, eksik kayıtları yazar). Çalışmazsa canlı kod sürümünü doğrula.

## 5. Deploy Sırası

**ÖNEMLİ:** Kod + SQL **aynı deploy'da** gitmeli.

```
1. 5 dosyayı repo'ya kopyala:
   - src/pages/OperatorPanel.tsx       (overwrite)
   - src/pages/WorkOrders.tsx          (overwrite)
   - src/pages/CuttingPlans.tsx        (overwrite)
   - src/pages/DataManagement.tsx      (overwrite)
   - sql/sql_v15_32_cleanup.sql        (yeni)

2. Lokal audit + test:
   npm run audit:columns
   npm run audit:schema
   npx tsc --noEmit

3. Commit + push (mesaj örneği §7'de)
4. GitHub Actions build yeşil bekle
5. Supabase SQL Editor → sql_v15_32_cleanup.sql çalıştır
6. Notice'ı oku: kaç kalıntı silindi, kalan_kusurat 0 mu
7. UYS'de Ctrl+Shift+R (cache temizle)
8. Veri Yönetimi → Sağlık Raporu Çalıştır → Kontrol #11 pass mi
9. Test: OperatorPanel'den yeni bir üretim girişi yap;
   konsolda "[barModel] N bar açıldı, M açık bar havuza girdi" logu çıkmalı
10. Depolar → Açık Bar Havuzu sekmesinde yeni kayıt görünmeli
```

## 6. Geri Alma

v15.32 kod değişiklikleri aksama yaratırsa:
- Kodu önceki commit'e geri at
- v15.32 SQL'i tamamen idempotent olduğu için silinen kayıtlar audit tablosunda durur; gerekirse `v15.31 §7 geri alma` bloğu hâlâ geçerli

## 7. Git Commit Mesajı Önerisi

```
v15.32 — Bar Model kapsama: OperatorPanel + WorkOrders + CuttingPlans + Sağlık Rap #11

- v15.31 ProductionEntry dışı üretim giriş yollarını atlamıştı.
- OperatorPanel.tsx: edit + yeni kayıt HM döngüsünde bar-model skip +
  barModelSync çağrısı (idempotent). reloadTables'a uys_acik_barlar eklendi.
- WorkOrders.tsx: log qty düzenleme delta HM'sinde bar-model skip.
- CuttingPlans.tsx: eski artikStokaGir/modal stokaGir disable — artıklar
  Açık Bar Havuzu'nda otomatik izleniyor, çift kayıt tehlikesi yok.
- DataManagement.tsx Sağlık Raporu Kontrol #11 — tamamlanan satır için
  bar_acilis eksikse fail, deterministik id kontrolü (bar-open-...).
- sql_v15_32_cleanup.sql: v15.31 sonrası yazılan kalıntı küsüratlı çıkışları
  audit'e alıp siler. Idempotent.

Test: tsc 0 hata, audit-columns temiz, audit-schema temiz.
```

## 8. Bilgi Bankası Güncelleme Noktaları

### §6 Son Sürüm Geçmişi — yeni satır
```
| v15.32 | Bar Model kapsama — OperatorPanel + WorkOrders + CuttingPlans + Sağlık Rap Kontrol #11 |
```

### §2 KRİTİK/NOTLAR — v15.31 kapsam notu
v15.31 notunun altına ek:
```
⚠️ Ders: v15.31 sadece ProductionEntry kapsadı, OperatorPanel atlandı. v15.32
hepsini kapsadı + Kontrol #11 ile benzer tasarım kaçaklarını Sağlık Raporu'nda
otomatik yakalayacak.
```

### §13 Sağlık Raporu kontrolleri — #11 ekle
```
Kontrol 11 — Bar Model tutarlılığı: tamamlanan kesim planı satırları için
deterministik bar-open-* id'leri yazılmış mı. Eksikse fail.
```

### §14 Öncelik 0 — güncelleme
```
## 🔴 Öncelik 0 — Mimari
- ✅ TAMAM (v15.31 + v15.32) — Stok hareketi mantığı yeniden tasarımı (§2 KRİTİK)
  ve tüm üretim giriş yollarında kapsama
- Supabase RLS + Auth (hâlâ açık)
```

## 9. Kalan İşler (Faz B — ileride)

Kontrol #11 artık canlıda. Faz B'ye kalan:
- **MRP açık bar havuzu entegrasyonu** — "bu kadar bar zaten havuzda var" mantığı
- **Kesim planı havuzdan çekim** — yeni plan oluşturulurken uygun açık bar varsa önce havuzdan seç (`cutting.ts`)
- **Açık bar yaş raporu** — Warehouse'a "6 aydır havuzda duran" uyarısı

---

*— Son —*
