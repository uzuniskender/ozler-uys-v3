import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Order, Customer, Sevk, MrpRezerve } from '@/types'
import { entriesFor } from './tables'
import { isFresh, markFresh } from '@/lib/queryCache'

export interface OrderStore {
  orders: Order[]
  customers: Customer[]
  sevkler: Sevk[]
  mrpRezerve: MrpRezerve[]
  loading: boolean
  synced: boolean
  setOrders: (orders: Order[]) => void
  loadOwn: (opts?: { force?: boolean }) => Promise<void>
  reloadOwn: (tables: string[]) => Promise<void>
}

const OWN = entriesFor('order')
const CACHE_KEY = 'store:order:loadOwn'

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  customers: [],
  sevkler: [],
  mrpRezerve: [],
  loading: true,
  synced: false,

  setOrders: (orders) => set({ orders }),

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
      console.error('useOrderStore.loadOwn:', e)
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
    set(updates as Partial<OrderStore>)
  },
}))
