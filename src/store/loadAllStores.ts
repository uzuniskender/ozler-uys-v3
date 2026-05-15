import { useOrderStore } from './useOrderStore'
import { useProductionStore } from './useProductionStore'
import { useWarehouseStore } from './useWarehouseStore'
import { useAuthStore } from './useAuthStore'

// In-flight dedup: aynı anda 2+ çağrı geldiğinde tek bir Promise paylaşılır
// (strict-mode çift mount + paralel useEffect tetiklemeleri için).
// `force` cache'i bypass eder; in-flight dedup yine çalışır.
let _inflight: Promise<void> | null = null

export async function loadAllStores(opts?: { force?: boolean }): Promise<void> {
  if (_inflight) return _inflight
  _inflight = (async () => {
    await Promise.all([
      useOrderStore.getState().loadOwn(opts),
      useProductionStore.getState().loadOwn(opts),
      useWarehouseStore.getState().loadOwn(opts),
      useAuthStore.getState().loadOwn(opts),
    ])
  })()
  try {
    await _inflight
  } finally {
    _inflight = null
  }
}
