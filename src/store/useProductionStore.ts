import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type {
  WorkOrder, ProductionLog, Recipe, BomTree, Operation, Station,
  CuttingPlan, FireLog, AcikBar, ActiveWork, DurusKodu, PendingFlow, OperatorNote
} from '@/types'
import { entriesFor } from './tables'
import { isFresh, markFresh } from '@/lib/queryCache'

export interface ProductionStore {
  workOrders: WorkOrder[]
  logs: ProductionLog[]
  recipes: Recipe[]
  bomTrees: BomTree[]
  operations: Operation[]
  stations: Station[]
  cuttingPlans: CuttingPlan[]
  fireLogs: FireLog[]
  acikBarlar: AcikBar[]
  activeWork: ActiveWork[]
  durusKodlari: DurusKodu[]
  pendingFlows: PendingFlow[]
  operatorNotes: OperatorNote[]
  loading: boolean
  synced: boolean
  setWorkOrders: (wos: WorkOrder[]) => void
  loadOwn: (opts?: { force?: boolean }) => Promise<void>
  reloadOwn: (tables: string[]) => Promise<void>
}

const OWN = entriesFor('production')
const CACHE_KEY = 'store:production:loadOwn'

export const useProductionStore = create<ProductionStore>((set, get) => ({
  workOrders: [],
  logs: [],
  recipes: [],
  bomTrees: [],
  operations: [],
  stations: [],
  cuttingPlans: [],
  fireLogs: [],
  acikBarlar: [],
  activeWork: [],
  durusKodlari: [],
  pendingFlows: [],
  operatorNotes: [],
  loading: true,
  synced: false,

  setWorkOrders: (workOrders) => set({ workOrders }),

  loadOwn: async (opts) => {
    if (!opts?.force && isFresh(CACHE_KEY) && get().synced) return
    set({ loading: true })
    try {
      const results = await Promise.all(OWN.map(t => supabase.from(t.table).select('*')))
      const updates: Record<string, unknown> = {}
      let ok = 0
      results.forEach((res, i) => {
        const t = OWN[i]
        if (!res.error && res.data) {
          updates[t.key] = res.data.map(r => t.mapper(r as Record<string, unknown>))
          ok++
        }
      })
      if (ok > 0) markFresh(CACHE_KEY)
      set({ ...updates, loading: false, synced: ok > 0 })
    } catch (e) {
      console.error('useProductionStore.loadOwn:', e)
      set({ loading: false, synced: false })
    }
  },

  reloadOwn: async (tables: string[]) => {
    const hedefler = OWN.filter(t => tables.includes(t.table))
    if (hedefler.length === 0) return
    const results = await Promise.all(hedefler.map(t => supabase.from(t.table).select('*')))
    const updates: Record<string, unknown> = {}
    results.forEach((res, i) => {
      const t = hedefler[i]
      if (!res.error && res.data) {
        updates[t.key] = res.data.map(r => t.mapper(r as Record<string, unknown>))
      }
    })
    set(updates as Partial<ProductionStore>)
  },
}))
