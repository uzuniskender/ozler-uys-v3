import type {
  Order, WorkOrder, ProductionLog, Material, Operation,
  Station, Operator, Recipe, BomTree, StokHareket,
  CuttingPlan, Tedarik, Tedarikci, DurusKodu, Customer, MrpRezerve,
  Sevk, OperatorNote, ActiveWork, FireLog, ChecklistItem,
  HmTip, TestRun, Problem, Kullanici, AcikBar, Izin, Bildirim, PendingFlow
} from '@/types'
import { useOrderStore } from './useOrderStore'
import { useProductionStore } from './useProductionStore'
import { useWarehouseStore } from './useWarehouseStore'
import { useAuthStore } from './useAuthStore'
import { TABLE_MAP, type StoreName } from './tables'

// Slice store'lar + registry — yeni kod doğrudan bunları kullanmalı.
export { useOrderStore } from './useOrderStore'
export { useProductionStore } from './useProductionStore'
export { useWarehouseStore } from './useWarehouseStore'
export { useAuthStore } from './useAuthStore'
export { TABLE_MAP } from './tables'
export type { StoreName, TableEntry } from './tables'
export { M } from './mappers'

// ═══ ORCHESTRATOR ═══
// 4 slice'ı paralel yükler. App.tsx ve useRealtime.ts bunu çağırır.
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

// Realtime dispatcher — tabloları sahibi olan store'a yönlendirir.
export async function reloadTablesDispatched(tables: string[]): Promise<void> {
  const byStore: Record<StoreName, string[]> = { order: [], production: [], warehouse: [], auth: [] }
  for (const t of tables) {
    const e = TABLE_MAP.find(x => x.table === t)
    if (e) byStore[e.store].push(t)
  }
  const tasks: Promise<void>[] = []
  if (byStore.order.length) tasks.push(useOrderStore.getState().reloadOwn(byStore.order))
  if (byStore.production.length) tasks.push(useProductionStore.getState().reloadOwn(byStore.production))
  if (byStore.warehouse.length) tasks.push(useWarehouseStore.getState().reloadOwn(byStore.warehouse))
  if (byStore.auth.length) tasks.push(useAuthStore.getState().reloadOwn(byStore.auth))
  await Promise.all(tasks)
}

// ═══ ESKİ API: COMPOSITE SHIM ═══
// 38 consumer dosyayı kırmamak için useStore eski API'yi taklit eder.
// Geçiş aşamalı — consumer'lar zamanla doğrudan slice hook'larına geçecek.
export interface UYSStore {
  orders: Order[]; workOrders: WorkOrder[]; logs: ProductionLog[]
  materials: Material[]; operations: Operation[]; stations: Station[]
  operators: Operator[]; recipes: Recipe[]; bomTrees: BomTree[]
  stokHareketler: StokHareket[]; cuttingPlans: CuttingPlan[]
  tedarikler: Tedarik[]; tedarikciler: Tedarikci[]; durusKodlari: DurusKodu[]; mrpRezerve: MrpRezerve[]
  customers: Customer[]; sevkler: Sevk[]; operatorNotes: OperatorNote[]
  activeWork: ActiveWork[]; fireLogs: FireLog[]; checklist: ChecklistItem[]
  acikBarlar: AcikBar[]
  izinler: Izin[]; bildirimler: Bildirim[]; pendingFlows: PendingFlow[]
  hmTipler: HmTip[]; testRuns: TestRun[]; problemler: Problem[]; kullanicilar: Kullanici[]
  yetkiMap: Record<string, string[]>
  loading: boolean; synced: boolean
  loadAll: () => Promise<void>
  setOrders: (orders: Order[]) => void
  setWorkOrders: (wos: WorkOrder[]) => void
  reloadTables: (tables: string[]) => Promise<void>
}

function mergedState(
  o: ReturnType<typeof useOrderStore.getState>,
  p: ReturnType<typeof useProductionStore.getState>,
  w: ReturnType<typeof useWarehouseStore.getState>,
  a: ReturnType<typeof useAuthStore.getState>
): UYSStore {
  return {
    orders: o.orders, customers: o.customers, sevkler: o.sevkler, mrpRezerve: o.mrpRezerve,
    workOrders: p.workOrders, logs: p.logs, recipes: p.recipes, bomTrees: p.bomTrees,
    operations: p.operations, stations: p.stations, cuttingPlans: p.cuttingPlans,
    fireLogs: p.fireLogs, acikBarlar: p.acikBarlar, activeWork: p.activeWork,
    durusKodlari: p.durusKodlari, pendingFlows: p.pendingFlows, operatorNotes: p.operatorNotes,
    materials: w.materials, stokHareketler: w.stokHareketler, tedarikler: w.tedarikler,
    tedarikciler: w.tedarikciler, hmTipler: w.hmTipler,
    operators: a.operators, kullanicilar: a.kullanicilar, izinler: a.izinler,
    bildirimler: a.bildirimler, checklist: a.checklist, testRuns: a.testRuns,
    problemler: a.problemler, yetkiMap: a.yetkiMap,
    loading: o.loading || p.loading || w.loading || a.loading,
    synced: o.synced && p.synced && w.synced && a.synced,
    loadAll: loadAllStores,
    setOrders: o.setOrders,
    setWorkOrders: p.setWorkOrders,
    reloadTables: reloadTablesDispatched,
  }
}

function useStoreImpl<T>(selector?: (s: UYSStore) => T): T | UYSStore {
  const o = useOrderStore()
  const p = useProductionStore()
  const w = useWarehouseStore()
  const a = useAuthStore()
  const merged = mergedState(o, p, w, a)
  return selector ? selector(merged) : merged
}

;(useStoreImpl as unknown as { getState: () => UYSStore }).getState = () =>
  mergedState(
    useOrderStore.getState(),
    useProductionStore.getState(),
    useWarehouseStore.getState(),
    useAuthStore.getState()
  )

export const useStore = useStoreImpl as {
  (): UYSStore
  <T>(selector: (s: UYSStore) => T): T
  getState: () => UYSStore
}
