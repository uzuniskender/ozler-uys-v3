import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type {
  Order, WorkOrder, ProductionLog, Material, Operation,
  Station, Operator, Recipe, BomTree, StokHareket,
  CuttingPlan, Tedarik, Tedarikci, DurusKodu, Customer,
  Sevk, OperatorNote, ActiveWork, FireLog
} from '@/types'

// DB row → JS object mappers
const mappers = {
  orders: (r: Record<string, unknown>): Order => ({
    id: r.id as string, siparisNo: r.siparis_no as string, musteri: r.musteri as string,
    tarih: r.tarih as string, termin: r.termin as string, not: r.not_ as string || '',
    urunler: (r.urunler || []) as Order['urunler'], mamulKod: r.mamul_kod as string || '',
    mamulAd: r.mamul_ad as string || '', adet: (r.adet as number) || 1,
    receteId: r.recete_id as string || '', mrpDurum: r.mrp_durum as string || 'bekliyor',
    durum: r.durum as string || '', oncelik: (r.oncelik as number) || 0,
    olusturma: r.olusturma as string || '',
  }),
  workOrders: (r: Record<string, unknown>): WorkOrder => ({
    id: r.id as string, orderId: r.order_id as string || '', rcId: r.rc_id as string || '',
    sira: (r.sira as number) || 0, kirno: r.kirno as string || '',
    opId: r.op_id as string || '', opKod: r.op_kod as string || '', opAd: r.op_ad as string || '',
    istId: r.ist_id as string || '', istKod: r.ist_kod as string || '', istAd: r.ist_ad as string || '',
    malkod: r.malkod as string || '', malad: r.malad as string || '',
    hedef: (r.hedef as number) || 0, mpm: (r.mpm as number) || 1,
    hm: (r.hm || []) as WorkOrder['hm'], ieNo: r.ie_no as string || '',
    whAlloc: (r.wh_alloc as number) || 0, hazirlikSure: (r.hazirlik_sure as number) || 0,
    islemSure: (r.islem_sure as number) || 0, durum: r.durum as string || '',
    bagimsiz: !!r.bagimsiz, siparisDisi: !!r.siparis_disi,
    mamulKod: r.mamul_kod as string || '', mamulAd: r.mamul_ad as string || '',
    mamulAuto: !!r.mamul_auto, operatorId: r.operator_id as string | null,
    not: r.not_ as string || '', olusturma: r.olusturma as string || '',
  }),
  logs: (r: Record<string, unknown>): ProductionLog => ({
    id: r.id as string, woId: r.wo_id as string, tarih: r.tarih as string,
    qty: (r.qty as number) || 0, fire: (r.fire as number) || 0,
    operatorlar: (r.operatorlar || []) as ProductionLog['operatorlar'],
    duruslar: (r.duruslar || []) as ProductionLog['duruslar'],
    not: r.not_ as string || '', malkod: r.malkod as string || '',
    ieNo: r.ie_no as string || '', operatorId: r.operator_id as string | null,
    vardiya: r.vardiya as string || '',
  }),
  operators: (r: Record<string, unknown>): Operator => ({
    id: r.id as string, kod: r.kod as string || '', ad: r.ad as string || '',
    bolum: r.bolum as string || '', aktif: r.aktif !== false, sifre: r.sifre as string || '',
  }),
  operatorNotes: (r: Record<string, unknown>): OperatorNote => ({
    id: r.id as string, opId: r.op_id as string || '', opAd: r.op_ad as string || '',
    tarih: r.tarih as string || '', saat: r.saat as string || '',
    mesaj: r.mesaj as string || '', okundu: !!r.okundu,
  }),
  activeWork: (r: Record<string, unknown>): ActiveWork => ({
    id: r.id as string, opId: r.op_id as string || '', opAd: r.op_ad as string || '',
    woId: r.wo_id as string || '', woAd: r.wo_ad as string || '',
    baslangic: r.baslangic as string || '', tarih: r.tarih as string || '',
  }),
}

interface UYSStore {
  // Data
  orders: Order[]
  workOrders: WorkOrder[]
  logs: ProductionLog[]
  materials: Material[]
  operations: Operation[]
  stations: Station[]
  operators: Operator[]
  recipes: Recipe[]
  bomTrees: BomTree[]
  stokHareketler: StokHareket[]
  cuttingPlans: CuttingPlan[]
  tedarikler: Tedarik[]
  tedarikciler: Tedarikci[]
  durusKodlari: DurusKodu[]
  customers: Customer[]
  sevkler: Sevk[]
  operatorNotes: OperatorNote[]
  activeWork: ActiveWork[]
  fireLogs: FireLog[]

  // UI state
  loading: boolean
  synced: boolean

  // Actions
  loadAll: () => Promise<void>
  setOrders: (orders: Order[]) => void
  setWorkOrders: (wos: WorkOrder[]) => void
}

const TABLE_MAP: Array<{ key: keyof UYSStore; table: string; mapper?: (r: Record<string, unknown>) => unknown }> = [
  { key: 'orders', table: 'uys_orders', mapper: mappers.orders },
  { key: 'workOrders', table: 'uys_work_orders', mapper: mappers.workOrders },
  { key: 'logs', table: 'uys_logs', mapper: mappers.logs },
  { key: 'materials', table: 'uys_malzemeler' },
  { key: 'operations', table: 'uys_operations' },
  { key: 'stations', table: 'uys_stations' },
  { key: 'operators', table: 'uys_operators', mapper: mappers.operators },
  { key: 'recipes', table: 'uys_recipes' },
  { key: 'bomTrees', table: 'uys_bom_trees' },
  { key: 'stokHareketler', table: 'uys_stok_hareketler' },
  { key: 'cuttingPlans', table: 'uys_kesim_planlari' },
  { key: 'tedarikler', table: 'uys_tedarikler' },
  { key: 'tedarikciler', table: 'uys_tedarikciler' },
  { key: 'durusKodlari', table: 'uys_durus_kodlari' },
  { key: 'customers', table: 'uys_customers' },
  { key: 'sevkler', table: 'uys_sevkler' },
  { key: 'operatorNotes', table: 'uys_operator_notes', mapper: mappers.operatorNotes },
  { key: 'activeWork', table: 'uys_active_work', mapper: mappers.activeWork },
  { key: 'fireLogs', table: 'uys_fire_logs' },
]

export const useStore = create<UYSStore>((set) => ({
  orders: [], workOrders: [], logs: [], materials: [], operations: [],
  stations: [], operators: [], recipes: [], bomTrees: [], stokHareketler: [],
  cuttingPlans: [], tedarikler: [], tedarikciler: [], durusKodlari: [],
  customers: [], sevkler: [], operatorNotes: [], activeWork: [], fireLogs: [],
  loading: true, synced: false,

  loadAll: async () => {
    set({ loading: true })
    try {
      const results = await Promise.all(
        TABLE_MAP.map(t => supabase.from(t.table).select('*'))
      )
      const updates: Partial<UYSStore> = {}
      let ok = 0
      results.forEach((res, i) => {
        const t = TABLE_MAP[i]
        if (!res.error && res.data) {
          const mapped = t.mapper
            ? res.data.map(r => t.mapper!(r as Record<string, unknown>))
            : res.data
          ;(updates as Record<string, unknown>)[t.key] = mapped
          ok++
        }
      })
      if (ok >= 5) {
        set({ ...updates, loading: false, synced: true } as Partial<UYSStore>)
        console.log(`✅ ${ok}/${TABLE_MAP.length} tablo yüklendi`)
      } else {
        set({ loading: false, synced: false })
        console.warn('⚠ Yeterli tablo yüklenemedi')
      }
    } catch (e) {
      console.error('loadAll hata:', e)
      set({ loading: false, synced: false })
    }
  },

  setOrders: (orders) => set({ orders }),
  setWorkOrders: (workOrders) => set({ workOrders }),
}))
