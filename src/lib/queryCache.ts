// src/lib/queryCache.ts
// Basit TTL tabanlı freshness gate.
//
// Tasarım: cache veri saklamaz, sadece "key en son ne zaman taze sayıldı"
// bilgisini tutar. Çağıran isFresh(key) ile network'e gitmeden çıkıp çıkmamaya
// karar verir; markFresh(key) ile başarılı yüklemeden sonra TTL'i sıfırlar.
//
// Zustand store state'i ile veri-cache senkronu derdi olmadığı için bu pattern
// daha sade ve realtime path'leriyle çakışmaz: store state'i tek doğrudur,
// cache yalnızca "tekrar fetch'e gerek var mı?" sorusunu cevaplar.

const DEFAULT_TTL_MS = 30_000

const _expiry = new Map<string, number>()

/** Verilen key için kayıt taze mi (TTL içinde mi)? */
export function isFresh(key: string): boolean {
  const exp = _expiry.get(key)
  if (exp === undefined) return false
  if (Date.now() >= exp) {
    _expiry.delete(key)
    return false
  }
  return true
}

/** key için freshness penceresini şimdiden +ttlMs olarak işaretle. */
export function markFresh(key: string, ttlMs: number = DEFAULT_TTL_MS): void {
  _expiry.set(key, Date.now() + ttlMs)
}

