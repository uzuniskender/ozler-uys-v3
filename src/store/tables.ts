import { M } from './mappers'

// Hangi store hangi tabloya sahip — slice'lar bu registry'yi filtreleyip kendi tablolarını bulur.
// audit-schema.cjs bu dosyayı parse ediyor (`table: '...'` literal'lerini regex ile yakalar).
export type StoreName = 'order' | 'production' | 'warehouse' | 'auth'

export interface TableEntry {
  store: StoreName
  key: string
  table: string
  mapper: (r: Record<string, unknown>) => unknown
}

export const TABLE_MAP: TableEntry[] = [
  { store: 'order',      key: 'orders',         table: 'uys_orders',          mapper: M.order },
  { store: 'order',      key: 'customers',      table: 'uys_customers',       mapper: M.customer },
  { store: 'order',      key: 'sevkler',        table: 'uys_sevkler',         mapper: M.sevk },
  { store: 'order',      key: 'mrpRezerve',     table: 'uys_mrp_rezerve',     mapper: M.mrpRezerve },

  { store: 'production', key: 'workOrders',     table: 'uys_work_orders',     mapper: M.wo },
  { store: 'production', key: 'logs',           table: 'uys_logs',            mapper: M.log },
  { store: 'production', key: 'recipes',        table: 'uys_recipes',         mapper: M.recipe },
  { store: 'production', key: 'bomTrees',       table: 'uys_bom_trees',       mapper: M.bomTree },
  { store: 'production', key: 'operations',     table: 'uys_operations',      mapper: M.operation },
  { store: 'production', key: 'stations',       table: 'uys_stations',        mapper: M.station },
  { store: 'production', key: 'cuttingPlans',   table: 'uys_kesim_planlari',  mapper: M.cuttingPlan },
  { store: 'production', key: 'fireLogs',       table: 'uys_fire_logs',       mapper: M.fireLog },
  { store: 'production', key: 'acikBarlar',     table: 'uys_acik_barlar',     mapper: M.acikBar },
  { store: 'production', key: 'activeWork',     table: 'uys_active_work',     mapper: M.activeWork },
  { store: 'production', key: 'durusKodlari',   table: 'uys_durus_kodlari',   mapper: M.durusKodu },
  { store: 'production', key: 'pendingFlows',   table: 'uys_pending_flows',   mapper: M.pendingFlow },
  { store: 'production', key: 'operatorNotes',  table: 'uys_operator_notes',  mapper: M.operatorNote },

  { store: 'warehouse',  key: 'materials',      table: 'uys_malzemeler',      mapper: M.material },
  { store: 'warehouse',  key: 'stokHareketler', table: 'uys_stok_hareketler', mapper: M.stokHareket },
  { store: 'warehouse',  key: 'tedarikler',     table: 'uys_tedarikler',      mapper: M.tedarik },
  { store: 'warehouse',  key: 'tedarikciler',   table: 'uys_tedarikciler',    mapper: M.tedarikci },
  { store: 'warehouse',  key: 'hmTipler',       table: 'uys_hm_tipleri',      mapper: M.hmTip },

  { store: 'auth',       key: 'operators',      table: 'uys_operators',       mapper: M.operator },
  { store: 'auth',       key: 'kullanicilar',   table: 'uys_kullanicilar',    mapper: M.kullanici },
  { store: 'auth',       key: 'izinler',        table: 'uys_izinler',         mapper: M.izin },
  { store: 'auth',       key: 'bildirimler',    table: 'uys_bildirimler',     mapper: M.bildirim },
  { store: 'auth',       key: 'checklist',      table: 'uys_checklist',       mapper: M.checklist },
  { store: 'auth',       key: 'testRuns',       table: 'uys_test_runs',       mapper: M.testRun },
  { store: 'auth',       key: 'problemler',     table: 'pt_problemler',       mapper: M.problem },
]

export function entriesFor(store: StoreName): TableEntry[] {
  return TABLE_MAP.filter(t => t.store === store)
}
