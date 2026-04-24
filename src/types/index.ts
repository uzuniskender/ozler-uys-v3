// ═══ CORE TYPES ═══

export interface Order {
  id: string
  siparisNo: string
  musteri: string
  tarih: string
  termin: string
  not: string
  urunler: OrderItem[]
  mamulKod: string
  mamulAd: string
  adet: number
  receteId: string
  mrpDurum: string
  durum: string
  sevkDurum: string
  oncelik: number
  olusturma: string
}

export interface OrderItem {
  rcId: string
  mamulKod: string
  mamulAd: string
  adet: number
  termin: string
  not?: string
}

export interface WorkOrder {
  id: string
  orderId: string
  rcId: string
  sira: number
  kirno: string
  opId: string
  opKod: string
  opAd: string
  istId: string
  istKod: string
  istAd: string
  malkod: string
  malad: string
  hedef: number
  mpm: number
  hm: HammaddeItem[]
  ieNo: string
  whAlloc: number
  hazirlikSure: number
  islemSure: number
  durum: string
  bagimsiz: boolean
  siparisDisi: boolean
  termin: string
  mamulKod: string
  mamulAd: string
  mamulAuto: boolean
  operatorId: string | null
  not: string
  olusturma: string
}

export interface HammaddeItem {
  malkod: string
  malad: string
  miktarTotal: number
}

export interface ProductionLog {
  id: string
  woId: string
  tarih: string
  saat: string
  qty: number
  fire: number
  operatorlar: LogOperator[]
  duruslar: LogDurus[]
  not: string
  malkod: string
  ieNo: string
  operatorId: string | null
  vardiya: string
}

export interface LogOperator {
  id: string
  ad: string
  bas: string
  bit: string
}

export interface LogDurus {
  sebep: string
  bas: string
  bit: string
  not: string
}

export interface Material {
  id: string
  kod: string
  ad: string
  tip: string
  hammaddeTipi: string
  birim: string
  boy: number
  en: number
  kalinlik: number
  uzunluk: number
  cap: number
  icCap: number
  minStok: number
  opId: string
  opKod: string
  revizyon: number
  revizyonTarihi: string
  oncekiId: string
  aktif: boolean
}

export interface HmTip {
  id: string
  kod: string
  ad: string
  aciklama: string
  sira: number
  olusturma: string
}

export interface Operation {
  id: string
  kod: string
  ad: string
  bolum?: string
}

export interface Station {
  id: string
  kod: string
  ad: string
  opIds: string[]
  durum: string
  arizaNot: string
}

export interface Operator {
  id: string
  kod: string
  ad: string
  bolum: string
  aktif: boolean
  sifre: string
  durum: string
}

export interface Recipe {
  id: string
  rcKod: string
  ad: string
  bomId: string
  mamulKod: string
  mamulAd: string
  satirlar: RecipeRow[]
}

export interface RecipeRow {
  id: string
  kirno: string
  malkod: string
  malad: string
  tip: string
  miktar: number
  birim: string
  opId: string
  istId: string
  hazirlikSure: number
  islemSure: number
  sureBirim?: string // 'dk' | 'sn'
}

export interface BomTree {
  id: string
  mamulKod: string
  mamulAd: string
  ad: string
  rows: BomRow[]
}

export interface BomRow {
  id: string
  kirno: string
  malkod: string
  malad: string
  tip: string
  miktar: number
  birim: string
}

export interface StokHareket {
  id: string
  tarih: string
  malkod: string
  malad: string
  miktar: number
  tip: 'giris' | 'cikis'
  logId: string
  woId: string
  aciklama: string
}

export interface CuttingPlan {
  id: string
  hamMalkod: string
  hamMalad: string
  hamBoy: number
  hamEn: number
  kesimTip: string
  durum: string
  satirlar: CuttingRow[]
  tarih: string
  gerekliAdet: number
}

export interface CuttingRow {
  id: string
  hamAdet: number
  fireMm: number
  kesimler: CuttingItem[]
  durum: string
}

export interface CuttingItem {
  woId: string
  ieNo: string
  malkod: string
  malad: string
  parcaBoy: number
  parcaEn: number
  adet: number
  tamamlandi: number
}

export interface Tedarik {
  id: string
  malkod: string
  malad: string
  miktar: number
  birim: string
  orderId: string
  siparisNo: string
  durum: string
  geldi: boolean
  teslimTarihi: string
  tedarikcId: string
  tedarikcAd: string
  not: string
  tarih: string
}

export interface MrpRezerve {
  id: string
  orderId: string
  malkod: string
  malad: string
  miktar: number
  birim: string
  mrpRunId: string
  tarih: string
}
export interface Tedarikci {
  id: string
  kod: string
  ad: string
  adres: string
  tel: string
  email: string
  not: string
}

export interface DurusKodu {
  id: string
  kod: string
  ad: string
  kategori: string
}

export interface Customer {
  id: string
  ad: string
  kod: string
}

export interface Sevk {
  id: string
  orderId: string
  siparisNo: string
  musteri: string
  tarih: string
  kalemler: SevkKalem[]
  not: string
}

export interface SevkKalem {
  malkod: string
  malad: string
  miktar: number
}

export interface OperatorNote {
  id: string
  opId: string
  opAd: string
  tarih: string
  saat: string
  mesaj: string
  okundu: boolean
  cevap?: string
  cevaplayan?: string
  cevapTarih?: string
  kategori?: OperatorNoteKategori
  oncelik?: OperatorNoteOncelik
}

export type OperatorNoteKategori = 'Stok' | 'Arıza' | 'Malzeme' | 'Talep' | 'Diğer'
export type OperatorNoteOncelik = 'Normal' | 'Acil'

export const OPERATOR_NOTE_KATEGORILER: OperatorNoteKategori[] = ['Stok', 'Arıza', 'Malzeme', 'Talep', 'Diğer']

export interface ActiveWork {
  id: string
  opId: string
  opAd: string
  woId: string
  woAd: string
  baslangic: string
  tarih: string
}

export interface FireLog {
  id: string
  logId: string
  woId: string
  tarih: string
  malkod: string
  malad: string
  qty: number
  ieNo: string
  opAd: string
  operatorlar: LogOperator[]
  not: string
  telafiWoId?: string
}

export interface ChecklistItem {
  id: string
  tip: 'gorev' | 'istek'
  baslik: string
  aciklama: string
  atanan: string
  oncelik: 'dusuk' | 'normal' | 'yuksek' | 'acil'
  durum: 'bekliyor' | 'devam' | 'tamamlandi' | 'iptal'
  tarih: string
  termin: string
  kategori: string
  resimler: { url: string; ad: string; tarih: string }[]
  tamamlanma: string
  olusturan: string
  notlar: string
}

export interface Izin {
  id: string
  opId: string
  opAd: string
  baslangic: string
  bitis: string
  tip: string
  durum: string
  saatBaslangic: string
  saatBitis: string
  onaylayan: string
  onayTarihi: string
  not: string
  olusturan: string
}

export interface Kullanici {
  id: string
  ad: string
  kullaniciAd: string
  sifre: string
  rol: 'admin' | 'uretim_sor' | 'planlama' | 'depocu'
  aktif: boolean
}

// v15.31 — Bar Model: açık bar havuzu
// v15.34 — hurda alanları
export interface AcikBar {
  id: string
  hamMalkod: string          // kaynak ham malzeme (BORU 6000 MM vs.)
  hamMalad: string
  uzunlukMm: number          // kalan uzunluk
  kaynakPlanId: string       // uys_kesim_planlari.id
  kaynakSatirId: string      // plan satir.id
  barIndex: number           // satırdaki bar sırası (hamAdet>1 için)
  olusmaTarihi: string
  durum: 'acik' | 'tuketildi' | 'hurda'
  tuketimLogId: string       // tüketildiyse hangi log
  tuketimTarihi: string
  not: string
  // v15.34 — Hurda işareti
  hurdaTarihi?: string
  hurdaSebep?: string
  hurdaKullaniciId?: string
  hurdaKullaniciAd?: string
}

export interface Problem {
  id: string
  problem: string          // Problem tanımı (zorunlu)
  termin: string           // ISO date 'YYYY-MM-DD' (opsiyonel)
  sorumlu: string          // Ad Soyad (metin)
  durum: string            // 'Açık' | 'Devam' | 'Kapandı'
  yapilanlar: string       // Aksiyon tarihçesi (stamp'lı append)
  notlar: string           // Ek notlar (opsiyonel)
  olusturan: string
  olusturma: string        // ISO datetime
  sonDegistiren: string
  sonDegistirme: string    // ISO datetime
  kapatmaTarihi: string    // ISO date
}
