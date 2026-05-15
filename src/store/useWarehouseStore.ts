import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Material, StokHareket, Tedarik, Tedarikci, HmTip } from '@/types'
import { M } from './mappers'
import { entriesFor } from './tables'

export interface WarehouseStore {
  materials: Material[]
  stokHareketler: StokHareket[]
  tedarikler: Tedarik[]
  tedarikciler: Tedarikci[]
  hmTipler: HmTip[]
  loading: boolean
  synced: boolean
  loadOwn: () => Promise<void>
  reloadOwn: (tables: string[]) => Promise<void>
}

const OWN = entriesFor('warehouse')
const STOK_TABLE = 'uys_stok_hareketler'

// stokHareketler: Supabase default limit (1000) aşılabilir — sayfalama (v16.53)
async function fetchStokHareketler(): Promise<StokHareket[]> {
  const PAGE = 1000
  let sayfa = 0
  let tum: StokHareket[] = []
  while (true) {
    const { data, error } = await supabase
      .from(STOK_TABLE)
      .select('*')
      .range(sayfa * PAGE, (sayfa + 1) * PAGE - 1)
    if (error || !data || data.length === 0) break
    tum = [...tum, ...data.map(r => M.stokHareket(r as Record<string, unknown>))]
    if (data.length < PAGE) break
    sayfa++
  }
  return tum
}

export const useWarehouseStore = create<WarehouseStore>((set) => ({
  materials: [],
  stokHareketler: [],
  tedarikler: [],
  tedarikciler: [],
  hmTipler: [],
  loading: true,
  synced: false,

  loadOwn: async () => {
    set({ loading: true })
    try {
      const digerler = OWN.filter(t => t.table !== STOK_TABLE)
      const results = await Promise.all(digerler.map(t => supabase.from(t.table).select('*')))
      const updates: Record<string, unknown> = {}
      let ok = 0
      results.forEach((res, i) => {
        const t = digerler[i]
        if (!res.error && res.data) {
          updates[t.key] = res.data.map(r => t.mapper(r as Record<string, unknown>))
          ok++
        }
      })
      const tumSH = await fetchStokHareketler()
      if (tumSH.length > 0) {
        updates.stokHareketler = tumSH
        ok++
      }
      set({ ...updates, loading: false, synced: ok > 0 })
    } catch (e) {
      console.error('useWarehouseStore.loadOwn:', e)
      set({ loading: false, synced: false })
    }
  },

  reloadOwn: async (tables: string[]) => {
    const hedefler = OWN.filter(t => tables.includes(t.table))
    if (hedefler.length === 0) return
    const updates: Record<string, unknown> = {}
    // stokHareketler için sayfalama; diğerleri tek select
    const digerler = hedefler.filter(t => t.table !== STOK_TABLE)
    const results = await Promise.all(digerler.map(t => supabase.from(t.table).select('*')))
    results.forEach((res, i) => {
      const t = digerler[i]
      if (!res.error && res.data) {
        updates[t.key] = res.data.map(r => t.mapper(r as Record<string, unknown>))
      }
    })
    if (hedefler.some(t => t.table === STOK_TABLE)) {
      const tumSH = await fetchStokHareketler()
      updates.stokHareketler = tumSH
    }
    set(updates as Partial<WarehouseStore>)
  },
}))
