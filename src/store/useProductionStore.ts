import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type {
  WorkOrder, ProductionLog, Recipe, BomTree, Operation, Station,
  CuttingPlan, FireLog, AcikBar, ActiveWork, DurusKodu, PendingFlow, OperatorNote
} from '@/types'
import { entriesFor } from './tables'

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
  loadOwn: () => Promise<void>
  reloadOwn: (tables: string[]) => Promise<void>
}

const OWN = entriesFor('production')

export const useProductionStore = create<ProductionStore>((set) => ({
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

  loadOwn: async () => {
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
