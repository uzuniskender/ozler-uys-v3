# İE — Reçete → Açık İE Operasyon/İstasyon/Süre Senkronizasyonu (TAMAMLANDI v16.45)

**Tip:** Bug fix — DB trigger
**Sürüm:** v16.45
**Migration:** TUR1-3F (TEST + PROD uygulandı)
**Frontend kod:** YOK
**Şema değişikliği:** YOK (yalnızca yeni trigger + perf index)

## Açık sorular — kararlar

| # | Soru | Karar |
|---|---|---|
| 1 | kirno → sira dönüşümü | **kirno bazlı eşleme** (sira hesabı gereksiz; uys_work_orders.kirno kolonu zaten reçete kirno'su tutuyor — autoChain.ts:80) |
| 2 | mpm senkron | **(a) Etme** — kaynak yok (reçete satırı/operasyon/istasyon hiçbirinde mpm yok), planlamacı değeri korunur |
| 3 | istId boş | **Dokunma** — sadece dolu istId için ist_kod/ist_ad senkron, autoChain default-resolve ezme yok |

## Trigger Mantığı

```sql
TRIGGER trg_recipe_op_sync
AFTER UPDATE OF satirlar ON uys_recipes
FOR EACH ROW
EXECUTE FUNCTION fn_recipe_op_sync();
```

Function:
1. `OLD.satirlar IS NOT DISTINCT FROM NEW.satirlar` → erken çık (idempotent guard)
2. Her satır için:
   - `opId` veya `kirno` boşsa atla (İE açılmamış)
   - `uys_operations` master'dan op_kod/op_ad çek
   - `istId` doluysa `uys_stations`'tan ist_kod/ist_ad çek
   - `UPDATE uys_work_orders SET ... WHERE rc_id = NEW.id AND kirno = satir->>'kirno' AND durum NOT IN ('tamamlandi','iptal')`
3. `mpm` UPDATE listesinde YOK
4. istId boşsa `ist_*` alanlarına dokunulmaz (`COALESCE(NULLIF(v_istid, ''), ist_id)`)

## TEST + PROD Davranış Testi (5 senaryo PASS)

| # | Senaryo | Sonuç |
|---|---|---|
| 1 | Açık WO (bekliyor) — opId/istId/sure değişti | ✅ Senkron |
| 2 | Multi-WO (kirno '1' + '1.1') | ✅ İkisi de senkron |
| 3 | Tamamlanmış WO (durum='tamamlandi') | ✅ KORUNDU (geçmiş kayıt iz) |
| 4 | istId boş — dokunma | ✅ ist_* korundu, sadece islem/hazirlik güncel |
| 5 | İdempotent (aynı satirlar UPDATE) | ✅ Erken çıkış, no-op |

## Saha Doğrulama (PROD)

YMH100346 reçete (id=moa5tffreqr5bx, kirno='1', opId=mmu5ykmy0ijl/027) → IE-S26A_03150-15 (eski op=023 KESME LAZER):

**ÖNCE:** op_kod=023 KESME LAZER, updated_at=2026-04-30 04:35
**SONRA (sahte mutation ile trigger tetiklendi):** op_kod=**027 KESME TESTERE**, updated_at=2026-05-05 16:45 ✓

Toplu stale tarama: 0 stale WO PROD'da. Saha vakası tek izoleydi, trigger ile düzeldi.

## Migration

TEST: `test_2026_05_05_recipe_op_sync_trigger_TUR1_3F` (apply_migration ile)
PROD: `prod_2026_05_05_recipe_op_sync_trigger_TUR1_3F` (apply_migration ile)

İçerik: 1 function (fn_recipe_op_sync) + 1 trigger (trg_recipe_op_sync) + 1 index (uys_wo_rc_id_kirno_durum_idx)

## Yeni Playwright Spec

`tests/e2e/specs/06-recipe-op-sync.spec.ts` — 3 senaryo (DB-only, frontend kod yok):

- `trg-recipe-sync-1` — açık WO senkron
- `trg-recipe-sync-2` — tamamlanmış WO korunur
- `trg-recipe-sync-3` — multi-WO (kirno '1' + '1.1')

Mevcut 18 yeşil + 3 yeni = **21 yeşil hedef**.

## Rollback

```sql
DROP TRIGGER IF EXISTS trg_recipe_op_sync ON uys_recipes;
DROP FUNCTION IF EXISTS fn_recipe_op_sync();
DROP INDEX IF EXISTS uys_wo_rc_id_kirno_durum_idx;
```

Trigger çalıştığı süredeki update'ler kalır (data kaybı yok); davranış değişikliği geri alınır.
