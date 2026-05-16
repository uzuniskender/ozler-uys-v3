// v15.95 — Madde 15 P3: Hammadde Tahsis FIFO Hesabi
// Saha modeli §25:
//   - Birden fazla siparis ayni hammaddeye ihtiyac duyabilir
//   - Stok + yolda tedarik FIFO termin sirasiyla siparişlere PAYLASTIRILIR
//   - Tahsis = sanal (DB'de degil), runtime hesap
//
// Kural:
//   1. Siparisleri termin yakindan uzaga sirala (yakin once alir)
//   2. Her siparisin ihtiyacini sirayla karsila:
//      - once mevcut stoktan dus
//      - sonra yolda tedarikten dus
//      - kalanlar EKSIK = tedarik aciilmali
//   3. Sonuc: her siparis icin tahsisStok + tahsisYolda + eksik
//
// Bu hesap MRP'nin uzantisi. hesaplaMRP tek siparis icin (veya ordIds set'i icin)
// brüt-net hesaplar; hammaddeTahsis ise TUM aktif siparişler arasinda paylastirir.

import { hesaplaMRP, type MRPRow } from '@/services/mrpService'
import type { Order, WorkOrder, Recipe, Material, StokHareket, Tedarik, MrpRezerve } from '@/types'

export interface SiparisTahsis {
  orderId: string
  siparisNo: string
  musteri: string
  termin: string
  ihtiyac: number       // bu siparisin bu malzemeden ihtiyaci (kg/adet)
  tahsisStok: number    // mevcut stoktan ayrilan
  tahsisYolda: number   // yolda tedarikten ayrilan
  eksik: number         // hala kalan (tedarik gerek)
}

export interface HammaddeTahsis {
  malkod: string
  malad: string
  birim: string
  toplamStok: number
  toplamYolda: number   // bekleyen tedarik
  toplamIhtiyac: number
  tahsisler: SiparisTahsis[]
  durum: 'yeterli' | 'tedarikYeterli' | 'eksik'
  // 'yeterli' -> ihtiyac <= stok (hepsi mevcuttan karsilanir)
  // 'tedarikYeterli' -> ihtiyac > stok, ama stok+yolda yetiyor
  // 'eksik' -> stok+yolda yetmiyor, yeni tedarik aciilmali
}

/**
 * Tum aktif siparişler icin hammadde bazinda FIFO termin tahsis hesabi.
 *
 * Bu fonksiyon hesaplaMRP'yi her siparis icin ayri cagirir, sonra
 * malzeme bazinda gruplayip FIFO ile paylastirir.
 *
 * Donus: malkod -> HammaddeTahsis map.
 */
export function hesaplaHammaddeTahsisi(
  orders: Order[],
  workOrders: WorkOrder[],
  recipes: Recipe[],
  stokHareketler: StokHareket[],
  tedarikler: Tedarik[],
  cuttingPlans: { hamMalkod: string; hamMalad: string; durum: string; gerekliAdet: number; satirlar: any[] }[],
  materials: Material[],
  logs: { woId: string; qty: number }[],
): Record<string, HammaddeTahsis> {
  // Aktif siparişleri filtrele -- iptal/tamamlandi olmayanlar
  // Termin sirasina gore SIRALA (FIFO yakin once)
  const aktifSip = orders
    .filter(o => o.durum !== 'iptal')
    .sort((a, b) => (a.termin || '9999-12-31').localeCompare(b.termin || '9999-12-31'))

  // Step 1: Her siparis icin BRUT ihtiyaclari hesapla (stok ve tedariği DUSME)
  // hesaplaMRP'yi cagiriken bu fonksiyon stok dusumu yapar -- biz burada brut'a ihtiyacimiz var.
  // Yaklasim: her siparis icin ayri hesapla, brut degerini al (stok=0, tedarik=[] gibi davran).
  // AMA hesaplaMRP imzasi bunu desteklemiyor. Pratik cözum: her siparis icin tek-tek cagir,
  // sonuc.brut + sonuc.stok + sonuc.acikTedarik = orijinal brut.
  const siparisIhtiyaclari: Record<string, Record<string, number>> = {} // orderId -> malkod -> brut
  const malzemeMeta: Record<string, { malad: string; birim: string }> = {}

  for (const o of aktifSip) {
    try {
      const rows = hesaplaMRP(
        [o.id], orders as any, workOrders, recipes, stokHareketler, tedarikler, cuttingPlans,
        materials, null, undefined, undefined, logs,
      )
      siparisIhtiyaclari[o.id] = {}
      for (const r of rows) {
        // Brüt = sonuctaki brut field (siparise dusen ihtiyac)
        // Eger artik (havuzdan) ise atla
        if (r.artik) continue
        siparisIhtiyaclari[o.id][r.malkod] = (r.brut || 0)
        if (!malzemeMeta[r.malkod]) {
          malzemeMeta[r.malkod] = { malad: r.malad, birim: r.birim || 'Adet' }
        }
      }
    } catch (e) {
      // Sessiz fail -- bu siparis icin tahsis hesaplanamadi
      siparisIhtiyaclari[o.id] = {}
    }
  }

  // Step 2: Her malzeme icin toplam stok + yolda hesapla
  const malStok: Record<string, number> = {}
  for (const h of stokHareketler) {
    if (!h.malkod) continue
    const k = h.malkod
    const m = Number(h.miktar) || 0
    if (!(k in malStok)) malStok[k] = 0
    malStok[k] += (h.tip === 'giris' ? m : -m)
  }

  const malYolda: Record<string, number> = {}
  for (const t of tedarikler) {
    if (t.geldi || !t.malkod) continue
    if (t.durum === 'iptal') continue
    malYolda[t.malkod] = (malYolda[t.malkod] || 0) + (Number(t.miktar) || 0)
  }

  // Step 3: Malzeme bazinda FIFO tahsis
  const result: Record<string, HammaddeTahsis> = {}
  // Tum malzemeleri topla (siparişlerde gecen)
  const tumMalkods = new Set<string>()
  for (const oid in siparisIhtiyaclari) {
    for (const mk in siparisIhtiyaclari[oid]) tumMalkods.add(mk)
  }

  for (const malkod of tumMalkods) {
    const meta = malzemeMeta[malkod] || { malad: malkod, birim: 'Adet' }
    let kalanStok = Math.max(0, malStok[malkod] || 0)
    let kalanYolda = malYolda[malkod] || 0
    const tahsisler: SiparisTahsis[] = []
    let toplamIhtiyac = 0

    // Termin sirasinda siparişleri dolas
    for (const o of aktifSip) {
      const ihtiyac = Math.max(0, siparisIhtiyaclari[o.id]?.[malkod] || 0)
      if (ihtiyac <= 0) continue
      toplamIhtiyac += ihtiyac

      // Once stoktan dus
      const tahsisStok = Math.min(kalanStok, ihtiyac)
      kalanStok -= tahsisStok
      let kalan = ihtiyac - tahsisStok

      // Sonra yoldan dus
      const tahsisYolda = Math.min(kalanYolda, kalan)
      kalanYolda -= tahsisYolda
      kalan -= tahsisYolda

      tahsisler.push({
        orderId: o.id,
        siparisNo: o.siparisNo,
        musteri: o.musteri,
        termin: o.termin || '',
        ihtiyac,
        tahsisStok,
        tahsisYolda,
        eksik: kalan,
      })
    }

    if (tahsisler.length === 0) continue

    // Durum
    const toplamEksik = tahsisler.reduce((a, t) => a + t.eksik, 0)
    const toplamStok = malStok[malkod] || 0
    const toplamYolda = malYolda[malkod] || 0
    let durum: HammaddeTahsis['durum']
    if (toplamEksik > 0) durum = 'eksik'
    else if (toplamStok < toplamIhtiyac) durum = 'tedarikYeterli'
    else durum = 'yeterli'

    result[malkod] = {
      malkod,
      malad: meta.malad,
      birim: meta.birim,
      toplamStok,
      toplamYolda,
      toplamIhtiyac,
      tahsisler,
      durum,
    }
  }

  return result
}

/**
 * Bir siparis icin tahsis ozeti -- UI'da rozette gostermek icin.
 * Sonuc: 'yesil' (hepsi karsilandi), 'sari' (eksik var ama tedarik geliyor), 'kirmizi' (hala eksik)
 */
export function siparisTahsisOzeti(
  orderId: string,
  tahsis: Record<string, HammaddeTahsis>
): { durum: 'yesil' | 'sari' | 'kirmizi' | 'yok'; eksikSayi: number; toplamMalzeme: number } {
  let eksikSayi = 0
  let sariSayi = 0
  let toplamMalzeme = 0

  for (const malkod in tahsis) {
    const t = tahsis[malkod]
    const benim = t.tahsisler.find(x => x.orderId === orderId)
    if (!benim || benim.ihtiyac <= 0) continue
    toplamMalzeme++
    if (benim.eksik > 0) eksikSayi++
    else if (benim.tahsisYolda > 0) sariSayi++
    // tahsisStok > 0 ise yesil (zaten eksik/sari degil)
  }

  if (toplamMalzeme === 0) return { durum: 'yok', eksikSayi: 0, toplamMalzeme: 0 }
  if (eksikSayi > 0) return { durum: 'kirmizi', eksikSayi, toplamMalzeme }
  if (sariSayi > 0) return { durum: 'sari', eksikSayi: 0, toplamMalzeme }
  return { durum: 'yesil', eksikSayi: 0, toplamMalzeme }
}
