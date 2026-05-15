import { useOrderStore } from './useOrderStore'
import { useProductionStore } from './useProductionStore'
import { useWarehouseStore } from './useWarehouseStore'
import { useAuthStore } from './useAuthStore'

// In-flight dedup: aynı anda 2+ çağrı geldiğinde tek bir Promise paylaşılır
// (strict-mode çift mount + paralel useEffect tetiklemeleri için).
let _inflight: Promise<void> | null = null

export async function loadAllStores(): Promise<void> {
  if (_inflight) return _inflight
  _inflight = (async () => {
    await Promise.all([
      useOrderStore.getState().loadOwn(),
      useProductionStore.getState().loadOwn(),
      useWarehouseStore.getState().loadOwn(),
      useAuthStore.getState().loadOwn(),
    ])
  })()
  try {
    await _inflight
  } finally {
    _inflight = null
  }
}
