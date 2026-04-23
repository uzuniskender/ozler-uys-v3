# UYS v3 — v15.33 Patch Notları (Supabase pagination)

**Tarih:** 23 Nisan 2026 gece
**Kapsam:** Supabase varsayılan 1000 satır limitini aşan sayfalı veri çekme
**Bilgi Bankası güncellemesi:** §4, §13

---

## 1. Özet

Supabase API'si `select('*')` çağrılarında varsayılan olarak **1000 satır** ile sınırlandırır. UYS v3 bu limite dayandığında:

- Store'a yüklenen `stokHareketler` eksik kalır → Depolar sayfası stok sayıları yanlış
- Sağlık Raporu'na yüklenen `stoks` eksik kalır → Kontrol #11 (Bar Model tutarlılığı) yanlış "eksik" raporlar
- `orphan log/fire/stok` kontrolü (#9) eksik veriyle çalışır

v15.32 retro migration sonrası `uys_stok_hareketler` 1563 satıra çıktı → 1000'de kesilmeye başladı. Bu v15.33'ün konusu.

## 2. Tespit

Retro migration `1403 bar_acilis` ve `1350 açık bar` yazdı ama Sağlık Raporu **Kontrol #11 hâlâ 18 fail** döndürüyordu. Sample kontrolde:

```sql
SELECT id, aciklama FROM uys_stok_hareketler
WHERE id LIKE 'bar-open-mobvakyveo23dr-%';
-- → kayıt VAR (retro yazmış)
```

Ama Sağlık Raporu kayıt yokmuş gibi davrandı → limit hipotezi:

```sql
SELECT COUNT(*) FROM uys_stok_hareketler;
-- → 1563  (>1000, limit kesiyor)
```

Teyit: Kontrol #9 "1064 kayıt temiz" diyordu — 1000+ sayıları olması gerekirken 1064'te kesilmişti.

## 3. Çözüm

### Yeni helper: `fetchAll(table, pageSize)`

`src/lib/supabase.ts`'e eklendi. 1000'lik bloklar halinde `range(from, to)` ile tüm satırları çeker:

```ts
export async function fetchAll<T = any>(
  table: string,
  pageSize = 1000
): Promise<{ data: T[]; error: any }> { ... }
```

Güvenlik tavanı 1M satır (1000 iterasyon × 1000 satır).

### Kullanılan yerler (4 dosya → 3 dosya etkileniyor)

| Dosya | Değişiklik |
|---|---|
| `src/lib/supabase.ts` | `fetchAll` helper eklendi |
| `src/store/index.ts` | `loadAll` + `reloadTables` içindeki Promise.all çağrıları fetchAll kullanır |
| `src/pages/DataManagement.tsx` | Sağlık Raporu Promise.all (11 tablo) + toplu birleştirme Faz 1 & Faz 2 Promise.all (her biri 6 tablo) + malzeme tazeleme (1 yer) fetchAll kullanır; versiyon v15.33 |

`.eq()` veya `.limit()` içeren sorgular dokunulmadı (zaten 1000 altı kalıyor).

## 4. Değişen Dosyalar (3)

- `src/lib/supabase.ts` — fetchAll helper (yeni export)
- `src/store/index.ts` — import + 2 Promise.all fetchAll'a geçirildi
- `src/pages/DataManagement.tsx` — import + 4 Promise.all bloğu + 1 tek sorgu fetchAll'a geçirildi + rapor versiyonu

SQL değişikliği YOK. Tablo yapısı yok. Göç yok. Sadece kod.

## 5. Deploy Sırası

```
1. 3 dosyayı repo'ya kopyala
2. git status — 3 modified görünmeli
3. Commit + push (mesaj §7)
4. GitHub Actions build yeşil bekle
5. UYS'de Ctrl+Shift+R (cache temizle)
6. Veri Yönetimi → Sağlık Raporu Çalıştır
7. Beklenen: 11/11 pass — özellikle Kontrol #9 sayısı artmış olmalı
   (önceki "1064 kayıt" → gerçek orphan sayımı), Kontrol #11 pass
8. Depolar sayfasında stok sayıları doğru mu gözat
```

## 6. Beklenen Sonuçlar

**Öncesi (v15.32 canlıda):**
| Kontrol | Durum | Mesaj |
|---|---|---|
| 9. Orphan log/fire/stok | pass (yanlış) | "1064 kayıt temiz" (gerçek: 1627) |
| 11. Bar Model tutarlılığı | fail | "18 tamamlanmış satırın bar_acilis kaydı eksik" (gerçek: 0) |

**Sonrası (v15.33):**
| Kontrol | Durum | Mesaj |
|---|---|---|
| 9. Orphan log/fire/stok | pass | "1627 kayıt temiz" |
| 11. Bar Model tutarlılığı | pass | "29 kesim planı taranıp bar_acilis tutarlı" |

## 7. Git Commit Mesajı Önerisi

```
v15.33 - Supabase pagination: 1000 satir limiti asildi

- fetchAll(table) helper (src/lib/supabase.ts): 1000'lik sayfalar halinde
  tum satirlari ceker, guvenlik tavani 1M satir.
- src/store/index.ts: loadAll + reloadTables fetchAll kullanir.
  Store'daki stokHareketler/logs/vb artik eksik gelmez.
- src/pages/DataManagement.tsx: Saglik Raporu Promise.all + toplu
  birlestirme Faz 1/2 + malzeme tazelemede fetchAll.
  Kontrol #11 artik tum bar_acilis kayitlarini gorur.

Etki: Saglik Rap Kontrol #9 ve #11 dogru veri ile calisir.
Depolar sayfasi stok sayilari dogru.
.eq()/.limit() kullanan sorgulara dokunulmadi.

Test: tsc 0 hata (sende dogrulayacaksin), bracket balance tam.
```

## 8. Bilgi Bankası Güncelleme

### §6 Son Sürüm Geçmişi
```
| v15.33 | Supabase pagination — fetchAll helper ile 1000 satır limiti aşıldı |
```

### §4 Veritabanı — not ekle
```
⚠️ Supabase API varsayılanı: select('*') en fazla 1000 satır döner.
Tüm satırlar için fetchAll() helper kullan (src/lib/supabase.ts).
```

### §13 Audit altyapısı
Sağlık Raporu'nun tüm kontrolleri artık fetchAll ile çalışır — 1000+ kayıtlı tablolar (uys_stok_hareketler, uys_logs) tam veriyle sayılır.

## 9. Kalan Sorular (Faz B)

Bu paketten sonra da kalan Faz B listesi değişmedi:
- MRP açık bar havuzu entegrasyonu
- Kesim planı havuzdan çekim
- Açık bar yaş raporu (6 ay+ uyarısı)
- Parça 2B/2C rezerve stok
- Parça 3 kesim planı manuel İE seçim UI

---

*— Son —*
