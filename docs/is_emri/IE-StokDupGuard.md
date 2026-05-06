# IE-StokDupGuard — Stok Hareketleri Çift-Tıklama Duplicate Önleme (TAMAMLANDI v16.47)

**Tip:** Bug fix — DB trigger + geriye dönük temizlik (data integrity)
**Sürüm:** v16.47
**Migration:** TUR1-3F (TEST + PROD uygulandı 5 May 2026)
**Frontend kod:** Submit guard ayrı sprint (DB tarafı yeterli)

## Açık sorular — kararlar

| # | Soru | Karar |
|---|---|---|
| AS1 | Pencere | **5 sn** (gözlemlenen tüm vakalar < 1 sn) |
| AS2 | Toplu Giriş | aciklama farklılaştırma (frontend, sonra) |
| AS3 | Sistem-otomatik | **Muaf**: `wo_id IS NULL AND log_id IS NULL` koşulu |
| AS4 | Geriye dönük kapsam | **(a) sn_fark<5** = 28 kayıt, 2778 birim |
| AS5 | Sıra | (a) Önce trigger, sonra temizlik |

## PROD veri analizi (5 May 2026)

| Metrik | Değer |
|---|---|
| Çift-tıklama vakası (<5 sn) | **11 grup** |
| Fazla kayıt | **28 satır** |
| Fazla stok birimi | **2778 birim** |
| Manuel akış (etkilenen) | 11/11 |
| Sistem-otomatik akış | 0 (temiz) |

En büyük vakalar:
- H0101C030028544: 296 birim × 6 → **1480 fazla**
- H0202A030043485: 200 birim × 5 → **800 fazla**
- H0102C030086133: 67 birim × 4 → **201 fazla**

## Trigger Mantığı

```sql
TRIGGER trg_stok_hareket_dup_guard
BEFORE INSERT ON uys_stok_hareketler
FOR EACH ROW EXECUTE FUNCTION fn_stok_hareket_dup_guard();
```

Function adımları:
1. `wo_id NOT NULL OR log_id NOT NULL` → muaf, RETURN NEW (sistem-otomatik)
2. 5 sn pencerede aynı `(malkod, miktar, tip, aciklama)` + manuel → RETURN NULL (sessiz skip)
3. Aksi halde RETURN NEW

## TEST + PROD Davranış Testi (4/4 PASS)

| # | Senaryo | Beklenen | Sonuç |
|---|---|---|---|
| 1 | 5× duplicate manuel | 1 kayıt | ✅ |
| 2 | Farklı aciklama | 2 kayıt | ✅ |
| 3 | wo_id NOT NULL × 3 | 3 kayıt (muaf) | ✅ |
| 4 | Farklı malkod × 2 | 2 kayıt | ✅ |

## Geriye Dönük Temizlik

Yedek tablo: `uys_stok_hareketler_dup_temizlik_yedek` (28 satır, rollback için)

```sql
WITH gruplar AS (
  SELECT array_agg(id ORDER BY updated_at) AS ids,
         EXTRACT(EPOCH FROM (MAX(updated_at) - MIN(updated_at))) AS sn_fark
  FROM uys_stok_hareketler
  WHERE wo_id IS NULL AND log_id IS NULL
  GROUP BY malkod, miktar, tip, COALESCE(aciklama,''), tarih
  HAVING COUNT(*) > 1
)
DELETE FROM uys_stok_hareketler
WHERE id IN (SELECT unnest(ids[2:]) FROM gruplar WHERE sn_fark < 5);
```

Sonuç: **0 dup kaldı PROD'da**.

## Rollback

```sql
DROP TRIGGER IF EXISTS trg_stok_hareket_dup_guard ON uys_stok_hareketler;
DROP FUNCTION IF EXISTS fn_stok_hareket_dup_guard();
DROP INDEX IF EXISTS uys_sh_dup_guard_idx;
-- Silinen kayıtları geri yükle:
INSERT INTO uys_stok_hareketler SELECT * FROM uys_stok_hareketler_dup_temizlik_yedek;
```

## Sonraki adım (ayrı sprint)

- Frontend submit guard (Warehouse.tsx Manuel Giriş/Çıkış modal): `submitting` state + disabled buton + "Kaydediliyor..." metni. UX iyileştirme. DB zaten güvenli.

## Saha Etkisi

- **Anında:** Yeni manuel duplicate'ler engelleniyor
- **Veri:** 2778 fazla birim stok düzeldi → MRP/planlama artık doğru stok üzerinden çalışır
- **Sistem-otomatik akış:** Üretim/fire/rezerv etkilenmedi