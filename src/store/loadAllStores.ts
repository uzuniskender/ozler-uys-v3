import { useOrderStore } from './useOrderStore'
import { useProductionStore } from './useProductionStore'
import { useWarehouseStore } from './useWarehouseStore'
import { useAuthStore } from './useAuthStore'

export async function loadAllStores(): Promise<void> {
  await Promise.all([
    useOrderStore.getState().loadOwn(),
    useProductionStore.getState().loadOwn(),
    useWarehouseStore.getState().loadOwn(),
    useAuthStore.getState().loadOwn(),
  ])
  const o = useOrderStore.getState()
  const p = useProductionStore.getState()
  const w = useWarehouseStore.getState()
  const a = useAuthStore.getState()
  const synced = o.synced && p.synced && w.synced && a.synced
  console.log(`✅ Tüm store'lar yüklendi · synced=${synced}`)
}
