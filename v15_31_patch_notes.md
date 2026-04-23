# UYS v3 — v15.31 Patch Notları (Bar Model)

**Tarih:** 23 Nisan 2026 sabah
**Kapsam:** 🔴 KRİTİK §2 — Stok Hareketi Mantığı Yeniden Tasarımı (Faz A)
**Bilgi Bankası güncellemesi:** §2, §4, §6, §13, §14 Öncelik 0

---

## 1. Özet

Ham profil/boru için kesir stok düşümü (−0,333 boru) kaldırıldı. Yeni mantık: kesim planı satırı tamamlanınca ham maldan **tam sayı** bar çıkışı yazılır ve artık (fireMm) yeni "Açık Bar Havuzu" tablosuna girer.

## 2. Buket'in 22 Nisan kararları (§2)

| Soru | Cevap | Uygulandı |
|---|---|---|
| 1. Depocu "bar aç" yapıyor mu? | DIA'da var, UYS'de yok | UYS içinde otomasyon kuruldu |
| 2. Kesim planı → otomatik bar aç? | Evet, + üretim girişi ile ortak | Kesim planı satırı %100 üretildiğinde tetiklenir |
| 3. Artık (750 mm) ne olacak? | Ayrı stok kalemi, açık bar havuzu | `uys_acik_barlar` tablosu |
| 4. Mevcut küsüratlı kayıtlar? | Sil, sıfırdan | Göç SQL'i hazır — audit'li delete |
| Alt-A. Hangi malzemeler? | Tüm ham malzemeler (tip filtresi) | `tip='Hammadde' && uzunluk>0` |
| Alt-B. Tetikleme ne zaman? | 1 ve 2 ortak | Kesim planı oluşur → rezerve (mevcut MRP); üretim girişi → fiili yazım |
| Alt-C. Artık altı fire? | Sonra karar | Şimdilik hepsi havuza, eşik yok |

## 3. Değişen Dosyalar (9)

### Yeni dosyalar (2)
- `sql/sql_v15_31_bar_model.sql` — yeni tablo + küsüratlı kayıt göçü
- `src/features/production/barModel.ts` — çekirdek modül

### Değişen dosyalar (7)
- `master_schema.sql` — `uys_acik_barlar` eklendi (temiz kurulum için)
- `src/types/index.ts` — `AcikBar` interface
- `src/store/index.ts` — mapper + TABLE_MAP + state
- `src/pages/DataManagement.tsx` — `tables[]`'e Açık Bar Havuzu eklendi
- `src/pages/ProductionEntry.tsx` — inline + toplu HM düşümünde bar-model atla, `barModelSync` tetikleyici, reloadTables genişletildi
- `src/features/production/stokTuketim.ts` — bar-model HM atlama (materials parametresi eklendi)
- `src/pages/Warehouse.tsx` — 4. tab "Açık Bar Havuzu" (ham bazında gruplu)
- `scripts/audit-schema.cjs` — DATA_MGMT_WHITELIST + STORE_WHITELIST güncellendi

## 4. Mimarî Özet

### Yeni tablo: `uys_acik_barlar`

```
id, ham_malkod, ham_malad, uzunluk_mm,
kaynak_plan_id, kaynak_satir_id, bar_index,
olusma_tarihi, durum ('acik'|'tuketildi'),
tuketim_log_id, tuketim_tarihi, not_
```

### Yeni stok hareket tipi

- `bar_acilis` — ham bardan −1. `uys_stok_hareketler.tip`. Mevcut stok hesapları (`tip==='giris' ? +:-`) bu satırları otomatik çıkış sayar; kod genelinde düzeltme gerekmedi.

### Açık bar havuzu semantiği

- `uys_acik_barlar` **ayrı tabloda** izlenir, `uys_stok_hareketler`'e yazılmaz.
- Raw malkod bakiyesini **etkilemez**.
- `durum='acik'` → havuzda, `durum='tuketildi'` → kullanıldı.

### Deterministik ID'ler (idempotency)

- Bar açılışı stok ID: `bar-open-{planId}-{satirId}-{index}`
- Açık bar kaydı ID: `ab-{planId}-{satirId}-{index}`
- 2 kez tetiklense duplicate yazmaz (tedarik `ted-*` paternine paralel).

### `isBarMaterial(m)` — hangi malzeme bar modelinde?

```ts
m.tip === 'Hammadde' && m.uzunluk > 0
```

Sarf, kimyasal, ayar mili vb. diğer HM'ler eski orantılı yolda kalır.

## 5. Akış

### 5.1 Üretim girişi senaryosu

1. Depocu ProductionEntry'de İE'ye 50 adet üretim girer
2. `uys_logs` satırı yazılır (mevcut)
3. Mamul stoğa +50 `uys_stok_hareketler.giris` (mevcut)
4. **v15.31:** HM düşümü döngüsünde bar-model malzemeler ATLANIR
5. **v15.31:** `barModelSync(woId, ...)` çağrılır
6. Bu İE'yi içeren kesim planı satırlarını bulur
7. Satırın tüm WO'ları %100 üretim mi kontrol eder
8. Tamamlandıysa:
   - `hamAdet` kadar `bar_acilis` kaydı (idempotent upsert)
   - `fireMm > 0` ise `uys_acik_barlar` kaydı (idempotent upsert)

### 5.2 İdempotency örneği

- Aynı İE'ye 2 kere üretim girişi yapılsa (2x30 = 60 adet, hedef 60), ikinci girişte kesim planı satırı yine %100 tamamlanmış sayılır. Ama bar_acilis ve açık_bar kayıtları zaten deterministik ID ile upsert edildiği için **duplicate yazılmaz**. Güvenli.

## 6. Göç Stratejisi (v15.31 SQL)

`sql/sql_v15_31_bar_model.sql` 4 bölümden oluşur:

1. `uys_acik_barlar` tablosu + indexler + realtime publication
2. Audit tablosu `uys_v15_31_silinen_hareketler` oluştur
3. Küsüratlı çıkış hareketlerini bar-model malzemeler için audit'e kopyala + ana tablodan sil
4. Doğrulama (kalan küsürat 0 mu kontrolü) + geri alma talimatı (yorum blok)

### Silme kriteri

```sql
malkod IN (tip='Hammadde' AND uzunluk>0 malzemeler)
AND MOD(miktar, 1) <> 0
AND tip = 'cikis'
AND id NOT LIKE 'ted-%'   -- tedarik kaynaklı korunur
```

Bu **tek seferlik** bir göçtür. Script idempotent — tekrar çalıştırılsa no-op.

## 7. Deploy Sırası (Buket için)

**ÖNEMLİ:** Kod ve SQL aynı deploy'da gitmeli. Ayrı deploy risk yaratır.

```
1. Kodu push et (9 dosya)
2. GitHub Actions → audit + build + deploy bekle
3. Canlıda build hatasız mı doğrula
4. Supabase Dashboard → SQL Editor
5. sql_v15_31_bar_model.sql'i çalıştır
6. Çıktıda "v15.31 Göç — N adet küsüratlı çıkış kaydı..." mesajını gör
7. Kalan küsürat 0 mu doğrula (2. Notice satırı)
8. UYS'de sayfa yenile — Depolar → Açık Bar Havuzu tabı var mı?
9. 1 test kesim planı oluştur + üretim girişi yap → açık bar kaydı düşüyor mu?
```

### Geri alma

Eğer sorun çıkarsa:

```sql
INSERT INTO public.uys_stok_hareketler
SELECT * FROM public.uys_v15_31_silinen_hareketler
ON CONFLICT (id) DO NOTHING;
```

Ve kodu önceki commit'e geri at. Audit tablosu korunur (silinmez).

## 8. Test Sonuçları

- `npx tsc --noEmit` → ✅ 0 hata
- `npm run audit:columns` → ✅ 215 çağrı, 0 sorun (3 legit untraced warning — v15.29'dan beri aynı)
- `npm run audit:schema` → ✅ DataManagement + Store uyumlu (35 tablo, 34 DM, 26 store + 9 whitelist)

## 9. Kalan İşler (Faz B — ileride)

Bu sürüm **Faz A**. Faz B için (sonraki oturumlar, gerek duyulursa):

- **MRP açık bar havuzu entegrasyonu:** MRP stok hesabında `uys_acik_barlar` bilgisini kullanarak "bu kadar bar zaten havuzda var, yeni tam bar gerekmez" mantığı. Şu anki MRP cutting-override zaten doğru çalışır ama havuzu tanımaz.
- **Kesim planı havuzdan çekim:** Yeni plan oluştururken uygun boy açık bar varsa önce havuzdan seç, sonra tam bar aç. (cutting.ts'de boykesimOptimum'a havuz seed parametresi.)
- **Sağlık Raporu Kontrol #11:** "Tamamlanan kesim planı satırlarının bar_acilis kayıtları yazılmış mı" kontrolü.
- **Açık bar yaş raporu:** Warehouse'da "6 aydır havuzda duran açık barlar" uyarısı (değerini tutmasın).

## 10. Bilgi Bankası Güncelleme Noktaları

### §6 Son Sürüm Geçmişi — yeni satır

```
| v15.31 | 🔴 Bar Model Faz A — §2 KRİTİK stok mantığı çözüldü (kesir → tam sayı + açık bar havuzu) |
```

### §2 BİR SONRAKİ OTURUMA NOTLAR — büyük güncelleme

🔴 KRİTİK bölümü kaldırılmalı (çözüldü). Yerine küçük bir "Faz B" notu:

```
🟡 Orta Öncelik — Bar Model Faz B (v15.31'den türeyen)
- MRP'de açık bar havuzu stoğu olarak sayılsın
- Kesim planı oluşturulurken önce havuzdan çek
- Sağlık Raporu Kontrol #11 — bar_acilis tutarlılığı
```

Mevcut 🟡 Orta listesi (G, Parça 3, Parça 2B) aynen kalır.

### §4 Veritabanı — yeni tablo notu

Tablo sayısı 33 → **35** (`uys_acik_barlar` + göç audit `uys_v15_31_silinen_hareketler`).

### §14 — Öncelik 0 kapansın

```
## 🔴 Öncelik 0 — Mimari
- ✅ TAMAM (v15.31) — Stok hareketi mantığı yeniden tasarımı (§2 KRİTİK)
- Supabase RLS + Auth (hâlâ açık)
```

### §13 Audit altyapısı

`STORE_WHITELIST` 8 → 9 tablo (`uys_v15_31_silinen_hareketler` eklendi).
`DATA_MGMT_WHITELIST` yeni — 1 tablo (aynı).

## 11. Git Commit Mesajı Önerisi

```
v15.31 — Bar Model Faz A: stok hareketi yeniden tasarımı (§2 KRİTİK)

- Ham profil/boru için kesir stok düşümü kaldırıldı.
- Kesim planı satırı %100 üretilince: bar_acilis × hamAdet (ham −N)
  + fireMm varsa uys_acik_barlar kaydı — idempotent upsert.
- Açık bar havuzu ayrı tabloda; raw malkod bakiyesini etkilemez.
- isBarMaterial(m): m.tip='Hammadde' && m.uzunluk>0.
- ProductionEntry inline + toplu girişte bar-model HM atlanır.
- Warehouse'a "Açık Bar Havuzu" tabı (ham bazında gruplu).
- Göç SQL: küsüratlı çıkışlar audit tablosuna alınıp silinir.

§14 Öncelik 0 (stok mantığı mimarisi) kapandı.
Test: tsc 0 hata, audit-columns 216 temiz, audit-schema 35/34/26 temiz.
```

---

*— Son —*
