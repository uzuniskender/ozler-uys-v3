# İş Emri #14 — Faz A — Slice 1+2 Patch Notu (v16.31)

**Tarih:** 1 Mayıs 2026
**Statü:** 🟢 **Sandbox build PASS, sahaya iniş hazır**

---

## Build doğrulaması

Sandbox'ta tam repo + Slice 2 patch'leri ile çalıştırıldı:

```
npm ci                            ✓ 389 packages, 17s
npm run build                      ✓ Exit 0
  ├─ audit-schema.cjs              ✓ Tüm listeler şemayla uyumlu
  ├─ audit-columns.cjs             ✓ 254 insert/update/upsert taranıp DB ile uyuşuyor
  ├─ tsc --noEmit                  ✓ Type check temiz
  └─ vite build                    ✓ 3.30s, dist/ üretildi
```

İki bilinen warning (pre-existing, Slice 2 değil):
- `INEFFECTIVE_DYNAMIC_IMPORT`: autoChain dynamic+static import çatışması (mrp.ts ↔ testRunner/Orders)
- Chunk size > 1MB (index-CdQFc4Wd.js, mevcut bundle splitting önerisi)

---

## Patch içeriği

| Dosya | Tip | İçerik |
|---|---|---|
| `src/lib/supabase.ts` | patch | `getActiveTestRunId` artık `export function` |
| `src/features/production/mrpCache.ts` | **yeni** | 5 fonksiyon: getMrpCacheGlobal/Order, setMrpCacheGlobal/Order, clearMrpCacheAll. Test mode bypass + 5dk TTL. |
| `src/features/production/mrp.ts` | patch | `hesaplaMRPCached(scope, computeFn, opts)` cache-aware wrapper |
| `scripts/audit-schema.cjs` | patch | STORE_WHITELIST + DATA_MGMT_WHITELIST'e cache tabloları eklendi |
| `sql/20260501_v16_31_mrp_state_tables.sql` | **yeni** | İki cache tablosu + RLS Aşama 4 v2 OP3 |
| `sql/20260501_v16_31_mrp_state_triggers.sql` | **yeni** | 2 invalidation fonksiyonu + 7 trigger |

---

## Mimari kararlar

### 1. Şema: B (iki tablo)
- `uys_mrp_state_global` (singleton id=1)
- `uys_mrp_state_order` (PK = order_id, FK CASCADE)

### 2. Trigger karması (7 trigger)
- **Row-level (hedefli + global):** uys_orders, uys_work_orders
- **Statement-level (sadece global):** uys_kesim_planlari, uys_stok_hareketler, uys_tedarikler, uys_recipes, uys_bom_trees

`uys_kesim_planlari`'da order_id yok → statement-level.
`uys_recipes` ve `uys_bom_trees` global invalidate (BOM recursive traversal MRP'ye girer).

### 3. Hata yumuşaklığı
İki invalidation fonksiyonu da `EXCEPTION WHEN OTHERS THEN RAISE WARNING` ile sarılı. Cache invalidation hata verirse asıl INSERT/UPDATE/DELETE etkilenmez.

### 4. Test modu by-pass
`localStorage.uys_active_test_run_id` doluysa cache TAM kapalı. Test koşusu üretim cache'ini kirletmesin.

### 5. 5dk TTL koruyucu
`invalidated=false AND hesaplandi > now-5dk` → cache HIT. Trigger fail durumunda emniyet.

### 6. Backward compatibility
Eski `hesaplaMRP` API'si değişmedi. 6 mevcut caller etkilenmez. UI'da görünür değişiklik yok.

### 7. RLS
İki yeni tablo Aşama 4 v2 OP3 standardı: `allow_all` policy `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. Anon erişimi yok.

**RLS son durum:** 43/43 → **45/45** tablo güvenli.

---

## Production deploy adımları

### Adım 1 — DB migration (Supabase MCP, claude.ai sandbox'tan)

Slice 1 sandbox'ta (`cowgxwmhlogmswatbltz`) test edildi (6/6 PASS, 1 SKIP). Production'a (`lmhcobrgrnvtprvmcito`) apply için Buket onayı bekleniyor. **Bu adım Buket'in PowerShell'inde değil, claude.ai'de Supabase MCP ile yapılacak.**

### Adım 2 — Kod deploy (Buket'in PowerShell'i)

```powershell
cd C:\Users\iskender.uzun\Documents\GitHub\ozler-uys-v3
git pull
Expand-Archive "$env:USERPROFILE\Downloads\uys_v16_31_final.zip" -DestinationPath . -Force
git add -A
git status
git commit -m "v16.31 - IE #14 Faz A: mrp_state cache altyapisi (Slice 1+2)"
git tag v16.31
git push --follow-tags
```

GitHub Actions deploy otomatik tetiklenir.

### Adım 3 — Saha doğrulama

- Bir sipariş aç/kapat → `uys_mrp_state_global.invalidated=true` mi?
- Bir order için MRP hesapla → `uys_mrp_state_order` ilgili order satırı oluştu mu?
- Yeni stok hareketi → global invalidated=true mi?

(Slice 3 öncesi, caller'lar henüz cache yazmıyor — sadece trigger'lar aktif. Cache yazımı Slice 3'te başlar.)

---

## Slice 3 ön hazırlığı

Slice 3'te 6 caller'ı `hesaplaMRPCached`'e geçirmek (1-2 gün):
- MRP.tsx (3 nokta)
- Orders.tsx (3 nokta)
- DataManagement.tsx (2 nokta)
- testRunner.ts (cache by-pass kalır, scope=null)

---

*Slice 1+2 build PASS. Production deploy Buket onayı bekleniyor.*
