# src/services — Servis katmanı kılavuzu

Bu klasör, Supabase'a giden CRUD ve sorgu çağrılarını **tablo başına** bir servis dosyasında toplar. Amaç: sayfa/komponent kodunu `supabase.from(...)` zincirlerinden temizlemek, normalizasyonu ve hata sözleşmesini tek yerde tutmak.

> **Faz 1 (mevcut):** Scaffold. `_base/` yardımcıları + referans şablon (`hmTipleriService.ts`).
> **Faz 2:** Düşük riskli tablolar için servisler tek tek eklenecek (onay ile).

## Kurallar

1. **Tek tablo = tek servis dosyası.** Dosya adı `<tabloAdi>Service.ts` (camelCase). Örnek: `tedarikciService.ts` → `uys_tedarikciler`.
2. **Tablo adı dosya başında `const TABLO = '...'` ile tutulur.** Hardcoded string serpiştirme yok.
3. **Supabase proxy'sinden geçilir.** Daima `import { supabase } from '@/lib/supabase'`. Ham `createClient` kullanılmaz — guest-mode ve `test_run_id` auto-attach davranışları proxy'de.
4. **Mutasyonlarda audit alanları.** `created_by` ve `updated_by` `auditAlanlari(kullaniciAd, mode)` ile basılır; servis imzasının son parametresi `kullaniciAd?: string | null`.
5. **Normalizasyon servis içinde.** UI sadece form datası gönderir; `kod` (upper+trim), `ad` (trim), opsiyonel stringler null'a indirgenir. `_base/query.ts → norm`.
6. **Hata sözleşmesi: throw.** Supabase error'u `wrap(error, { table, op })` ile `ServiceError`'a çevrilip throw edilir. Çağıran `try/catch` ile yakalar.
   - Sessiz `false` döndürme yok (eski `lib/supabase.ts` `dbInsert` kalıbından kaçınılır).
   - `isGuestBlocked / isUniqueViolation / isForeignKeyViolation` helper'ları UI'da kullanıcıya özelleştirilmiş mesaj göstermek için kullanılabilir.
7. **Dönüş tipleri DB satırının TS karşılığı.** Şimdilik camelCase mapper kullanmıyoruz — `src/store/index.ts`'deki `M` ile çakışmaması için. Tip dosyası: `src/types/<entity>.ts` altında `<Entity>`, `<Entity>Insert`, `<Entity>Update`.
8. **Realtime servisin işi değil.** Realtime subscription'lar `src/hooks/useRealtime.ts` veya feature-spesifik subscribe fonksiyonlarında kalır.
9. **Global cache'e giren tablolar (`TABLE_MAP`) için servis YAZMA.** Bu tablolar `loadAll` ile zaten store'da; bir servis paralel okuma yaparsa kafa karışıklığı olur. Servisler **store dışı**, **whitelist** tabloları içindir (bkz. `scripts/audit-schema.cjs` `STORE_WHITELIST`).

## Şablon

```ts
// src/services/<tablo>Service.ts
import { supabase } from '@/lib/supabase'
import {
  applyIlikeArama,
  applyAktifFiltre,
  auditAlanlari,
  norm,
} from '@/services/_base/query'
import { wrap } from '@/services/_base/errors'
import type { Entity, EntityInsert, EntityUpdate } from '@/types/entity'

const TABLO = 'uys_entity'
const OP = 'select' as const

export interface ListeOpts {
  sadeceAktif?: boolean
  arama?: string
}

export async function listEntity(opts: ListeOpts = {}): Promise<Entity[]> {
  let q = supabase.from(TABLO).select('*').order('sira').order('ad')
  q = applyAktifFiltre(q, opts.sadeceAktif)
  q = applyIlikeArama(q, opts.arama, ['kod', 'ad'])
  const { data, error } = await q
  wrap(error, { table: TABLO, op: 'select' })
  return (data ?? []) as Entity[]
}

export async function createEntity(
  payload: EntityInsert,
  kullaniciAd?: string | null,
): Promise<Entity> {
  const insertData: EntityInsert = {
    ...payload,
    kod: norm.kod(payload.kod),
    ad: norm.ad(payload.ad),
    ...auditAlanlari(kullaniciAd, 'create'),
  }
  const { data, error } = await supabase
    .from(TABLO)
    .insert(insertData)
    .select()
    .single()
  wrap(error, { table: TABLO, op: 'insert' })
  return data as Entity
}
```

## Faz 2'de servise alınacaklar (planlanan)

Sadece `STORE_WHITELIST`'te olan, store'a girmeyen tablolar:
- `notesService.ts` → `uys_notes`
- `tedarikciService.ts` → `uys_tedarikciler`
- `acikBarlarService.ts` → `uys_acik_barlar`
- `bildirimlerService.ts` → `uys_bildirimler`
- `izinlerService.ts` → `uys_izinler`

Her biri ayrı commit, kullanıcı onayı ile.

## Faz 2 dışı (bilinçli)

- `src/store/index.ts` — global cache + realtime; dokunulmaz.
- `src/features/chat/chatService.ts` — zaten servis konumunda; farklı stil ama çalışıyor.
- `src/features/production/*` (`mrp`, `mrpCache`, `autoChain`, `stokTuketim`, `barModel`...) — multi-tablo, sıralı yan-etkili domain akışları; "use-case service" konumundalar.
- Sayfa içi inline query'ler — yeni kodda servis-first, eski kod organik göç eder.
