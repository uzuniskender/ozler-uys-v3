import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type {
  Operator, Kullanici, Izin, Bildirim, ChecklistItem, TestRun, Problem
} from '@/types'
import { entriesFor } from './tables'

export interface AuthStore {
  operators: Operator[]
  kullanicilar: Kullanici[]
  izinler: Izin[]
  bildirimler: Bildirim[]
  checklist: ChecklistItem[]
  testRuns: TestRun[]
  problemler: Problem[]
  yetkiMap: Record<string, string[]>
  loading: boolean
  synced: boolean
  loadOwn: () => Promise<void>
  reloadOwn: (tables: string[]) => Promise<void>
  reloadYetki: () => Promise<void>
}

const OWN = entriesFor('auth')

async function fetchYetkiMap(): Promise<Record<string, string[]>> {
  const { data } = await supabase.from('uys_yetki_ayarlari').select('*')
  const map: Record<string, string[]> = {}
  if (data) {
    data.forEach((r: Record<string, unknown>) => {
      if (r.aksiyon) map[r.aksiyon as string] = (r.roller || []) as string[]
    })
  }
  return map
}

export const useAuthStore = create<AuthStore>((set) => ({
  operators: [],
  kullanicilar: [],
  izinler: [],
  bildirimler: [],
  checklist: [],
  testRuns: [],
  problemler: [],
  yetkiMap: {},
  loading: true,
  synced: false,

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
      updates.yetkiMap = await fetchYetkiMap()
      set({ ...updates, loading: false, synced: ok > 0 })
    } catch (e) {
      console.error('useAuthStore.loadOwn:', e)
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
    set(updates as Partial<AuthStore>)
  },

  reloadYetki: async () => {
    const map = await fetchYetkiMap()
    set({ yetkiMap: map })
  },
}))
