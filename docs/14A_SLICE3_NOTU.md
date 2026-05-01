# İş Emri #14 — Faz A — Slice 3 Patch Notu (v16.32)

**Tarih:** 1 Mayıs 2026
**Statü:** 🟢 **Sandbox build PASS, sahaya iniş hazır**

---

## Slice 3 ne yapar

7 caller noktasında `hesaplaMRP` çağrısı `hesaplaMRPCached` wrapper'ı üzerinden yapılıyor. Cache HIT/MISS otomatik. **İlk kez gerçek değer üreten katman** — Slice 1+2 altyapı kurmuştu, üretim hareketleri cache'i tüketmeye başlıyor.

---

## Build doğrulaması

```
npm run build                    ✓ Exit 0 (2.17s)
  ├─ audit-schema.cjs            ✓
  ├─ audit-columns.cjs           ✓
  ├─ tsc --noEmit                ✓
  └─ vite build                  ✓
```

Pre-existing 2 warning (Slice 3 değil, mevcut): autoChain dynamic import çatışması, chunk size > 1MB.

---

## Değişen dosyalar (4 dosya)

| Dosya | Cache wrap | Scope |
|---|---|---|
| `src/features/production/autoChain.ts` | 252. satır | `{orderId}` |
| `src/pages/Orders.tsx` | 248 (döngü), 857 (detail) | `{orderId}` |
| `src/pages/DataManagement.tsx` | 217 (sağlık #5), 268 (sağlık #7 döngü) | `'global'`, `{orderId}` |
| `src/pages/MRP.tsx` | 260 (hesapla döngü), 300 (bildirim döngü) | `{orderId}` |

---

## Cache'lenmeyen yerler ve gerekçeleri

### Bilerek atlandı (Slice 3 kapsamı dışı)

| Konum | Sebep |
|---|---|
| `MRP.tsx:58` (useMemo) | Sync hook, async wrapper kullanılamaz. **Slice 4'te** `useMrpCachedMemo` custom hook ile çözülecek (loading state + useEffect). |
| `MRP.tsx:136` (useMemo) | Aynı sebep + `ymSet` özel parametre. |
| `MRP.tsx:254` | `ymSet` parametresi cache key'in parçası değil — wrap edilse bile yanlış cache'e yazar. Atlandı. |
| `Orders.tsx:243` (topluMRP) | `ordIds` array (çoklu sipariş). Tek-tek döngü zaten 248'de cache'leniyor; toplu sonuç farklı senaryo. |
| `testRunner.ts` (8 nokta) | Test mode'da `getActiveTestRunId()` dolu → mrpCache zaten by-pass yapıyor. Dokunmaya gerek yok. |
| `hammaddeTahsis.ts:80` | "Brüt ihtiyaç" özel modu (yorum: "MRP imzası bunu desteklemiyor"). Cache farklı bir hesabı kirletir. |

---

## Backward compatibility

- Eski `hesaplaMRP` API'si değişmedi (Slice 1+2'deki gibi). Cache'lenmeyen 6+ caller olduğu gibi çalışıyor.
- Wrapper saf bir caller — async/await dışında davranış değişikliği yok.
- Test mode (`uys_active_test_run_id`): tüm cache by-pass.

---

## Saha doğrulama (deploy sonrası)

1. **Cache HIT görünür mü?** Bir sipariş için MRP çalıştır (Orders detail panel veya MRP sayfası), sonra hemen başka bir kullanıcıda aynı siparişi aç. İkinci hesap **DB'den hesap yapmadan** cache'ten döner.

2. **Trigger invalidation çalışıyor mu?** Bir order'a yeni İE ekle → `uys_mrp_state_order` ilgili `invalidated=true` olmalı. Sonra MRP yeniden hesaplandığında `invalidated=false`.

3. **Sağlık raporu hızı:** DataManagement → Sağlık raporu çalıştır. Önceden her sipariş için ham hesap yapılıyordu; şimdi cache HIT'lerle hızlanmalı (özellikle 2. ve sonraki çalıştırmalarda).

---

## Slice 4 ön hazırlığı

Hedef: useMemo içindeki 2 noktayı (MRP.tsx:58 + 136) cache-aware yap. İki seçenek:

**(a) Custom hook `useMrpCachedMemo`:**
- `useEffect` içinde async hesap
- `useState` ile sonuç tutulur
- İlk render boş, sonra dolar
- Loading state UI gösterilir mi sorusu var (saha 89 operatörlü, ilk frame'de "..." görünmesi normal mi?)

**(b) Eski sync davranışı koru, cache'i kaldırma:**
- useMemo'lar olduğu gibi kalır, MRP.tsx 254 da öyle
- Slice 3 kazançları (autoChain + DataManagement sağlık + tek-order detail panelleri) yeterli sayılır
- Slice 4 başka konuya geçer (örn. Faz B state machine)

Karar Slice 4 öncesi.

---

## Production deploy

### Adım 1 — Patch zip teslim
ZIP içeriği: 4 caller dosyası + bu not.

### Adım 2 — Deploy
```powershell
cd C:\Users\iskender.uzun\Documents\GitHub\ozler-uys-v3
git pull
Expand-Archive "$env:USERPROFILE\Downloads\uys_v16_32_slice3.zip" -DestinationPath . -Force
git add -A
git status
git commit -m "v16.32 - IE #14 Faz A Slice 3: 7 caller cache wrap (autoChain, Orders, DataManagement, MRP)"
git tag v16.32
git push --follow-tags
```

DB tarafında değişiklik yok (Slice 1 trigger'ları zaten canlıda).

---

*Slice 3 build PASS. Production deploy onayı bekliyor.*
