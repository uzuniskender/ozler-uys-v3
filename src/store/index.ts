import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { setYetkiOverrides } from '@/lib/permissions'
import type {
  Order, WorkOrder, ProductionLog, Material, Operation,
  Station, Operator, Recipe, BomTree, StokHareket,
  CuttingPlan, Tedarik, Tedarikci, DurusKodu, Customer,
  Sevk, OperatorNote, ActiveWork, FireLog, ChecklistItem, Izin, Kullanici, HmTip
} from '@/types'

// ═══ DB → JS MAPPERS ═══
const M = {
  order: (r: Record<string, unknown>): Order => ({
    id: r.id as string, siparisNo: (r.siparis_no || '') as string, musteri: (r.musteri || '') as string,
    tarih: (r.tarih || '') as string, termin: (r.termin || '') as string, not: (r.not_ || '') as string,
    urunler: (r.urunler || []) as Order['urunler'], mamulKod: (r.mamul_kod || '') as string,
    mamulAd: (r.mamul_ad || '') as string, adet: (r.adet as number) || 1,
    receteId: (r.recete_id || '') as string, mrpDurum: (r.mrp_durum || 'bekliyor') as string,
    durum: (r.durum || '') as string, oncelik: (r.oncelik as number) || 0, olusturma: (r.olusturma || '') as string,
  }),
  wo: (r: Record<string, unknown>): WorkOrder => {
    const malkod = (r.malkod || '') as string
    const rawHm = (r.hm || []) as WorkOrder['hm']
    const hm = malkod ? rawHm.filter(h => h.malkod !== malkod) : rawHm
    return {
      id: r.id as string, orderId: (r.order_id || '') as string, rcId: (r.rc_id || '') as string,
      sira: (r.sira as number) || 0, kirno: (r.kirno || '') as string,
      opId: (r.op_id || '') as string, opKod: (r.op_kod || '') as string, opAd: (r.op_ad || '') as string,
      istId: (r.ist_id || '') as string, istKod: (r.ist_kod || '') as string, istAd: (r.ist_ad || '') as string,
      malkod, malad: (r.malad || '') as string,
      hedef: (r.hedef as number) || 0, mpm: (r.mpm as number) || 1,
      hm, ieNo: (r.ie_no || '') as string,
      whAlloc: (r.wh_alloc as number) || 0, hazirlikSure: (r.hazirlik_sure as number) || 0,
      islemSure: (r.islem_sure as number) || 0, durum: (r.durum || '') as string,
      bagimsiz: !!r.bagimsiz, siparisDisi: !!r.siparis_disi,
      mamulKod: (r.mamul_kod || '') as string, mamulAd: (r.mamul_ad || '') as string,
      mamulAuto: !!r.mamul_auto, operatorId: (r.operator_id || null) as string | null,
      not: (r.not_ || '') as string, olusturma: (r.olusturma || '') as string,
    }
  },
  log: (r: Record<string, unknown>): ProductionLog => ({
    id: r.id as string, woId: (r.wo_id || '') as string, tarih: (r.tarih || '') as string,
    qty: (r.qty as number) || 0, fire: (r.fire as number) || 0,
    operatorlar: (r.operatorlar || []) as ProductionLog['operatorlar'],
    duruslar: (r.duruslar || []) as ProductionLog['duruslar'],
    not: (r.not_ || '') as string, malkod: (r.malkod || '') as string,
    ieNo: (r.ie_no || '') as string, operatorId: (r.operator_id || null) as string | null,
    vardiya: (r.vardiya || '') as string,
  }),
  material: (r: Record<string, unknown>): Material => ({
    id: r.id as string, kod: (r.kod || '') as string, ad: (r.ad || '') as string,
    tip: (r.tip || '') as string, hammaddeTipi: (r.hammadde_tipi || '') as string, birim: (r.birim || 'Adet') as string,
    boy: (r.boy as number) || 0, en: (r.en as number) || 0, kalinlik: (r.kalinlik as number) || 0,
    uzunluk: (r.uzunluk as number) || 0,
    cap: (r.cap as number) || 0, icCap: (r.ic_cap as number) || 0, minStok: (r.min_stok as number) || 0,
    opId: (r.op_id || '') as string, opKod: (r.op_kod || '') as string,
  }),
  operation: (r: Record<string, unknown>): Operation => ({
    id: r.id as string, kod: (r.kod || '') as string, ad: (r.ad || '') as string,
    bolum: (r.bolum || '') as string,
  }),
  station: (r: Record<string, unknown>): Station => ({
    id: r.id as string, kod: (r.kod || '') as string, ad: (r.ad || '') as string,
    opIds: (r.op_ids || []) as string[],
  }),
  operator: (r: Record<string, unknown>): Operator => ({
    id: r.id as string, kod: (r.kod || '') as string, ad: (r.ad || '') as string,
    bolum: (r.bolum || '') as string, aktif: r.aktif !== false, sifre: (r.sifre || '') as string,
  }),
  recipe: (r: Record<string, unknown>): Recipe => ({
    id: r.id as string, rcKod: (r.rc_kod || '') as string, ad: (r.ad || '') as string,
    bomId: (r.bom_id || '') as string, mamulKod: (r.mamul_kod || '') as string,
    mamulAd: (r.mamul_ad || '') as string, satirlar: (r.satirlar || []) as Recipe['satirlar'],
  }),
  bomTree: (r: Record<string, unknown>): BomTree => ({
    id: r.id as string, mamulKod: (r.mamul_kod || '') as string,
    mamulAd: (r.mamul_ad || '') as string, ad: (r.ad || '') as string,
    rows: (r.rows || []) as BomTree['rows'],
  }),
  stokHareket: (r: Record<string, unknown>): StokHareket => ({
    id: r.id as string, tarih: (r.tarih || '') as string, malkod: (r.malkod || '') as string,
    malad: (r.malad || '') as string, miktar: (r.miktar as number) || 0,
    tip: (r.tip || 'giris') as 'giris' | 'cikis',
    logId: (r.log_id || '') as string, woId: (r.wo_id || '') as string,
    aciklama: (r.aciklama || '') as string,
  }),
  cuttingPlan: (r: Record<string, unknown>): CuttingPlan => ({
    id: r.id as string, hamMalkod: (r.ham_malkod || '') as string, hamMalad: (r.ham_malad || '') as string,
    hamBoy: (r.ham_boy as number) || 0, hamEn: (r.ham_en as number) || 0,
    kesimTip: (r.kesim_tip || '') as string, durum: (r.durum || 'bekliyor') as string,
    satirlar: (r.satirlar || []) as CuttingPlan['satirlar'], tarih: (r.tarih || '') as string,
    gerekliAdet: (r.gerekli_adet as number) || 0,
  }),
  tedarik: (r: Record<string, unknown>): Tedarik => ({
    id: r.id as string, malkod: (r.malkod || '') as string, malad: (r.malad || '') as string,
    miktar: (r.miktar as number) || 0, birim: (r.birim || 'Adet') as string,
    orderId: (r.order_id || '') as string, siparisNo: (r.siparis_no || '') as string,
    durum: (r.durum || '') as string, geldi: !!r.geldi,
    teslimTarihi: (r.teslim_tarihi || '') as string, tedarikcId: (r.tedarikci_id || '') as string,
    tedarikcAd: (r.tedarikci_ad || '') as string, not: (r.not_ || '') as string,
    tarih: (r.tarih || '') as string,
  }),
  tedarikci: (r: Record<string, unknown>): Tedarikci => ({
    id: r.id as string, kod: (r.kod || '') as string, ad: (r.ad || '') as string,
    adres: (r.adres || '') as string, tel: (r.tel || '') as string,
    email: (r.email || '') as string, not: (r.not_ || '') as string,
  }),
  durusKodu: (r: Record<string, unknown>): DurusKodu => ({
    id: r.id as string, kod: (r.kod || '') as string, ad: (r.ad || '') as string,
    kategori: (r.kategori || '') as string,
  }),
  customer: (r: Record<string, unknown>): Customer => ({
    id: r.id as string, ad: (r.ad || '') as string, kod: (r.kod || '') as string,
  }),
  sevk: (r: Record<string, unknown>): Sevk => ({
    id: r.id as string, orderId: (r.order_id || '') as string, siparisNo: (r.siparis_no || '') as string,
    musteri: (r.musteri || '') as string, tarih: (r.tarih || '') as string,
    kalemler: (r.kalemler || []) as Sevk['kalemler'], not: (r.not_ || '') as string,
  }),
  operatorNote: (r: Record<string, unknown>): OperatorNote => ({
    id: r.id as string, opId: (r.op_id || '') as string, opAd: (r.op_ad || '') as string,
    tarih: (r.tarih || '') as string, saat: (r.saat || '') as string,
    mesaj: (r.mesaj || '') as string, okundu: !!r.okundu,
    cevap: (r.cevap || '') as string, cevaplayan: (r.cevaplayan || '') as string,
    cevapTarih: (r.cevap_tarih || '') as string,
  }),
  activeWork: (r: Record<string, unknown>): ActiveWork => ({
    id: r.id as string, opId: (r.op_id || '') as string, opAd: (r.op_ad || '') as string,
    woId: (r.wo_id || '') as string, woAd: (r.wo_ad || '') as string,
    baslangic: (r.baslangic || '') as string, tarih: (r.tarih || '') as string,
  }),
  fireLog: (r: Record<string, unknown>): FireLog => ({
    id: r.id as string, logId: (r.log_id || '') as string, woId: (r.wo_id || '') as string,
    tarih: (r.tarih || '') as string, malkod: (r.malkod || '') as string, malad: (r.malad || '') as string,
    qty: (r.qty as number) || 0, ieNo: (r.ie_no || '') as string, opAd: (r.op_ad || '') as string,
    operatorlar: (r.operatorlar || []) as FireLog['operatorlar'], not: (r.not_ || '') as string,
  }),
  checklist: (r: Record<string, unknown>): ChecklistItem => ({
    id: r.id as string, tip: (r.tip || 'gorev') as ChecklistItem['tip'],
    baslik: (r.baslik || '') as string, aciklama: (r.aciklama || '') as string,
    atanan: (r.atanan || '') as string, oncelik: (r.oncelik || 'normal') as ChecklistItem['oncelik'],
    durum: (r.durum || 'bekliyor') as ChecklistItem['durum'], tarih: (r.tarih || '') as string,
    termin: (r.termin || '') as string, kategori: (r.kategori || '') as string,
    resimler: (r.resimler || []) as ChecklistItem['resimler'],
    tamamlanma: (r.tamamlanma || '') as string, olusturan: (r.olusturan || '') as string,
    notlar: (r.notlar || '') as string,
  }),
  izin: (r: Record<string, unknown>): Izin => ({
    id: r.id as string, opId: (r.op_id || '') as string, opAd: (r.op_ad || '') as string,
    baslangic: (r.baslangic || '') as string, bitis: (r.bitis || '') as string,
    tip: (r.tip || 'yıllık') as string, durum: (r.durum || 'bekliyor') as string,
    saatBaslangic: (r.saat_baslangic || '') as string, saatBitis: (r.saat_bitis || '') as string,
    onaylayan: (r.onaylayan || '') as string, onayTarihi: (r.onay_tarihi || '') as string,
    not: (r.not_ || '') as string, olusturan: (r.olusturan || 'admin') as string,
  }),
  hmTip: (r: Record<string, unknown>): HmTip => ({
    id: r.id as string, kod: (r.kod || '') as string, ad: (r.ad || '') as string,
    aciklama: (r.aciklama || '') as string, sira: (r.sira as number) || 0,
    olusturma: (r.olusturma || '') as string,
  }),
  kullanici: (r: Record<string, unknown>): Kullanici => ({
    id: r.id as string, ad: (r.ad || '') as string,
    kullaniciAd: (r.kullanici_ad || '') as string, sifre: (r.sifre || '') as string,
    rol: (r.rol || 'planlama') as Kullanici['rol'], aktif: r.aktif !== false,
  }),
}

interface UYSStore {
  orders: Order[]; workOrders: WorkOrder[]; logs: ProductionLog[]
  materials: Material[]; operations: Operation[]; stations: Station[]
  operators: Operator[]; recipes: Recipe[]; bomTrees: BomTree[]
  stokHareketler: StokHareket[]; cuttingPlans: CuttingPlan[]
  tedarikler: Tedarik[]; tedarikciler: Tedarikci[]; durusKodlari: DurusKodu[]
  customers: Customer[]; sevkler: Sevk[]; operatorNotes: OperatorNote[]
  activeWork: ActiveWork[]; fireLogs: FireLog[]; checklist: ChecklistItem[]
  izinler: Izin[]; kullanicilar: Kullanici[]; hmTipler: HmTip[]
  loading: boolean; synced: boolean
  yetkiMap: Record<string, string[]> | null
  loadAll: () => Promise<void>
  setOrders: (orders: Order[]) => void
  setWorkOrders: (wos: WorkOrder[]) => void
}

const TABLE_MAP: Array<{ key: keyof UYSStore; table: string; mapper: (r: Record<string, unknown>) => unknown }> = [
  { key: 'orders', table: 'uys_orders', mapper: M.order },
  { key: 'workOrders', table: 'uys_work_orders', mapper: M.wo },
  { key: 'logs', table: 'uys_logs', mapper: M.log },
  { key: 'materials', table: 'uys_malzemeler', mapper: M.material },
  { key: 'operations', table: 'uys_operations', mapper: M.operation },
  { key: 'stations', table: 'uys_stations', mapper: M.station },
  { key: 'operators', table: 'uys_operators', mapper: M.operator },
  { key: 'recipes', table: 'uys_recipes', mapper: M.recipe },
  { key: 'bomTrees', table: 'uys_bom_trees', mapper: M.bomTree },
  { key: 'stokHareketler', table: 'uys_stok_hareketler', mapper: M.stokHareket },
  { key: 'cuttingPlans', table: 'uys_kesim_planlari', mapper: M.cuttingPlan },
  { key: 'tedarikler', table: 'uys_tedarikler', mapper: M.tedarik },
  { key: 'tedarikciler', table: 'uys_tedarikciler', mapper: M.tedarikci },
  { key: 'durusKodlari', table: 'uys_durus_kodlari', mapper: M.durusKodu },
  { key: 'customers', table: 'uys_customers', mapper: M.customer },
  { key: 'sevkler', table: 'uys_sevkler', mapper: M.sevk },
  { key: 'operatorNotes', table: 'uys_operator_notes', mapper: M.operatorNote },
  { key: 'activeWork', table: 'uys_active_work', mapper: M.activeWork },
  { key: 'fireLogs', table: 'uys_fire_logs', mapper: M.fireLog },
  { key: 'checklist', table: 'uys_checklist', mapper: M.checklist },
  { key: 'izinler', table: 'uys_izinler', mapper: M.izin },
  { key: 'kullanicilar', table: 'uys_kullanicilar', mapper: M.kullanici },
  { key: 'hmTipler', table: 'uys_hm_tipleri', mapper: M.hmTip },
]

export const useStore = create<UYSStore>((set) => ({
  orders: [], workOrders: [], logs: [], materials: [], operations: [],
  stations: [], operators: [], recipes: [], bomTrees: [], stokHareketler: [],
  cuttingPlans: [], tedarikler: [], tedarikciler: [], durusKodlari: [],
  customers: [], sevkler: [], operatorNotes: [], activeWork: [], fireLogs: [], checklist: [], izinler: [], kullanicilar: [], hmTipler: [],
  loading: true, synced: false, yetkiMap: null,

  loadAll: async () => {
    set({ loading: true })
    try {
      const results = await Promise.all(TABLE_MAP.map(t => supabase.from(t.table).select('*')))
      const updates: Partial<UYSStore> = {}
      let ok = 0
      results.forEach((res, i) => {
        const t = TABLE_MAP[i]
        if (!res.error && res.data) {
          (updates as Record<string, unknown>)[t.key] = res.data.map(r => t.mapper(r as Record<string, unknown>))
          ok++
        }
      })
      if (ok >= 5) {
        // Yetki haritasını yükle
        try {
          const { data: yaData } = await supabase.from('uys_yetki_ayarlari').select('*').eq('id', 'rbac').limit(1)
          if (yaData?.[0]?.data) {
            updates.yetkiMap = yaData[0].data
            setYetkiOverrides(yaData[0].data)
          }
        } catch { /* tablo yoksa varsayılan kullanılır */ }
        set({ ...updates, loading: false, synced: true } as Partial<UYSStore>)
        console.log(`✅ ${ok}/${TABLE_MAP.length} tablo yüklendi`)
      } else {
        set({ loading: false, synced: false })
      }
    } catch (e) {
      console.error('loadAll:', e)
      set({ loading: false, synced: false })
    }
  },
  setOrders: (orders) => set({ orders }),
  setWorkOrders: (workOrders) => set({ workOrders }),
}))
