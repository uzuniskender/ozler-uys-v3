/**
 * mrpEngine.ts — Saf Fonksiyon MRP Motoru (v17.01)
 *
 * PDF spec'e göre 5 ayrık katman:
 *   1. explodeBOM   → sadece yapısal hesap, stok dokunmaz
 *   2. aggregateBOM → miktar birleştirme
 *   3. netting      → stok + tedarik düşme
 *   4. reservation  → stok tahsis (rezerveYaz ile entegre)
 *   5. buildResult  → MRPRow[] üretimi
 *
 * MEVCUT hesaplaMRP ile BACKWARD COMPATIBLE:
 *   - Bu dosya mevcut mrp.ts'i DEĞİŞTİRMEZ
 *   - İleride hesaplaMRP bu engine'e delege edecek
 *   - Test edilebilir: aynı input → her zaman aynı output
 *
 * Temel fark:
 *   - Eski: bomPatlaNet() hem BOM'u patlattı hem YM stoğunu düştü
 *   - Yeni: explodeBOM() sadece yapısal; netYM() ayrı adım
 */

import type { Recipe, StokHareket, Tedarik, Material } from '@/types'
import { getStok } from '@/lib/hammaddeHesap'

// ─── Tip tanımları ────────────────────────────────────────────────────────────

export interface BOMLine {
  malkod: string
  malad: string
  tip: 'Hammadde' | 'Sarf' | 'YarıMamul'
  birim: string
  miktar: number       // bu sipariş için brüt miktar (YM stoku düşülmemiş)
  termin?: string
}

export interface AggregatedBOM {
  /** grupKey = `${malkod.toLowerCase()}__${termin}` */
  [grupKey: string]: BOMLine & { brut: number }
}

export interface NettingInput {
  malkod: string
  malad: string
  tip: string
  birim: string
  brut: number
  termin: string
}

export interface NettingResult {
  malkod: string
  malad: string
  tip: string
  birim: string
  brut: number
  stok: number        // stoktan karşılanan miktar
  acikTedarik: number // açık tedarikten karşılanan
  net: number         // kalan ihtiyaç
  termin: string
  durum: 'yeterli' | 'eksik'
}

// ─── KATMAN 1: explodeBOM ─────────────────────────────────────────────────────
/**
 * Mamulü BOM ağacında patlatır. SAFI YAPISAL hesap:
 * - YarıMamul stoku düşmez (sadece ağacı iter)
 * - Rekürsif: YM'lerin kendi reçetelerini açar
 * - derinlik > 10 → güvenlik durağı
 *
 * @returns Yaprak seviyesi malzeme listesi (YM'ler dahil — netting ayrı adımda)
 */
export function explodeBOM(
  mamulKod: string,
  adet: number,
  recipes: Recipe[],
  materials: Material[],
  derinlik = 0,
  ziyaret: Set<string> = new Set(),
): BOMLine[] {
  if (derinlik > 10 || adet <= 0) return []
  if (ziyaret.has(mamulKod)) return []  // döngü koruması

  const rc = recipes.find(r =>
    (r.mamulKod || '').toLowerCase().trim() === mamulKod.toLowerCase().trim()
  )
  if (!rc?.satirlar?.length) return []

  const satirlar = rc.satirlar
  const isFlat = !satirlar.find(s => s.kirno)
  const result: BOMLine[] = []

  if (isFlat) {
    for (const s of satirlar) {
      const malkod = s.malkod || ''
      if (!malkod) continue
      const tip = (s.tip || 'Hammadde') as BOMLine['tip']
      const satMiktar = (s.miktar ?? 1) * adet

      if (tip === 'YarıMamul') {
        // Rekürsif — YM kendi reçetesini açar
        const z2 = new Set(ziyaret)
        z2.add(mamulKod)
        const altlar = explodeBOM(malkod, satMiktar, recipes, materials, derinlik + 1, z2)
        result.push(...altlar)
        // YM kendisi de listeye gir (netting için lazım)
        result.push({ malkod, malad: s.malad || '', tip, birim: s.birim || 'Adet', miktar: satMiktar })
      } else {
        result.push({ malkod, malad: s.malad || '', tip, birim: s.birim || 'Adet', miktar: satMiktar })
      }
    }
  } else {
    // Kirno bazlı — mevcut bomPatlaNet mantığıyla uyumlu
    const kirnoMap: Record<string, typeof satirlar[0]> = {}
    satirlar.forEach(s => { kirnoMap[s.kirno || ''] = s })
    let minDepth = Infinity
    satirlar.forEach(s => {
      const d = (s.kirno || '1').split('.').length
      if (d < minDepth) minDepth = d
    })

    for (const s of satirlar) {
      const malkod = s.malkod || ''
      if (!malkod) continue
      const tip = (s.tip || 'Hammadde') as BOMLine['tip']
      if (tip !== 'Hammadde' && tip !== 'Sarf') continue

      // Kirno kaskad net ihtiyaç — YAPAY netting değil, sadece ağaç çarpanları
      const sk = s.kirno || ''
      const parcalar = sk.split('.')
      let carpan = adet
      for (let pi = minDepth; pi < parcalar.length; pi++) {
        const ustKirno = parcalar.slice(0, pi).join('.')
        const altKirno = parcalar.slice(0, pi + 1).join('.')
        const altSatir = kirnoMap[altKirno]
        if (!altSatir) continue
        carpan *= (altSatir.miktar ?? 1)
      }

      result.push({
        malkod,
        malad: s.malad || '',
        tip,
        birim: s.birim || 'Adet',
        miktar: (s.miktar ?? 1) * adet,  // orijinal satır miktarı × sipariş adeti
      })
    }
  }

  return result
}

// ─── KATMAN 2: aggregateBOM ───────────────────────────────────────────────────
/**
 * Birden fazla sipariş / BOM sonucunu termin gruplayarak birleştirir.
 * YarıMamul satırlarını HariçTutar (netting sonrası gereksiz).
 */
export function aggregateBOM(
  lines: (BOMLine & { termin?: string })[],
  excludeYM = true,
): AggregatedBOM {
  const result: AggregatedBOM = {}

  for (const line of lines) {
    if (excludeYM && line.tip === 'YarıMamul') continue
    const termin = line.termin || ''
    const grupKey = `${line.malkod.toLowerCase().trim()}__${termin}`

    if (!result[grupKey]) {
      result[grupKey] = { ...line, brut: 0 }
    }
    result[grupKey].brut += line.miktar
  }

  // Brütleri yuvarla
  for (const v of Object.values(result)) {
    v.brut = Math.ceil(v.brut)
  }

  return result
}

// ─── KATMAN 2b: netYM ────────────────────────────────────────────────────────
/**
 * YarıMamul stokunu düşer — explodeBOM'dan dönen YM satırları için.
 * Bu adım bomPatlaNet'in derinlik>0'daki stok düşmesini karşılar.
 *
 * Sonuç: kalan YM ihtiyacı. Eğer stok karşılıyorsa o kol atlanır.
 */
export function netYM(
  lines: BOMLine[],
  stokHareketler: StokHareket[],
): BOMLine[] {
  // YM'leri bul, stoktan düş
  const ymNetMap: Record<string, number> = {}

  for (const line of lines) {
    if (line.tip !== 'YarıMamul') continue
    const stok = Math.floor(getStok(line.malkod, stokHareketler))
    const mevcut = ymNetMap[line.malkod] ?? stok
    const net = Math.max(0, line.miktar - mevcut)
    ymNetMap[line.malkod] = Math.max(0, mevcut - line.miktar)
    // net=0 ise bu kolun HM ihtiyacı yok — kaldır
    if (net <= 0) {
      // Bu YM'nin kendi alt satırlarını da kaldır
      // (aggregateBOM zaten YM'yi hariç tutar; bu bilgi caller'a geçirilir)
    }
  }

  // YM stoku yeterliyse o YM'nin altındaki HM satırları kaldırılır.
  // NOT: Bu implementasyon şimdilik basit — explodeBOM ile tam entegrasyon
  // ileride yapılacak (Faz 2). Şu an placeholder.
  return lines
}

// ─── KATMAN 3: netting ───────────────────────────────────────────────────────
/**
 * Brüt ihtiyaçtan stok + açık tedarik düşer.
 * FIFO termin sırası: erken termin önce stoktan alır.
 * SAFI FONKSİYON: dış state değiştirmez, sadece hesaplar.
 *
 * @param brutMap  aggregateBOM çıktısı
 * @param stokHareketler  mevcut stok hareketi listesi
 * @param tedarikler  açık tedarikler (geldi=false)
 * @returns NettingResult[]  her satır için net ihtiyaç
 */
export function netting(
  brutMap: AggregatedBOM,
  stokHareketler: StokHareket[],
  tedarikler: Tedarik[],
): NettingResult[] {
  // Başlangıç stok + açık tedarik havuzu (malkod bazlı)
  const stokPool: Record<string, number> = {}
  const acikTedPool: Record<string, number> = {}

  for (const bi of Object.values(brutMap)) {
    const k = bi.malkod.toLowerCase().trim()
    if (stokPool[k] === undefined) {
      stokPool[k] = getStok(bi.malkod, stokHareketler)
      acikTedPool[k] = tedarikler
        .filter(t => (t.malkod || '').toLowerCase().trim() === k && !t.geldi)
        .reduce((a, t) => a + t.miktar, 0)
    }
  }

  // FIFO: erken termin önce
  const sirali = Object.values(brutMap).sort((a, b) => {
    const at = a.termin || '9999-99-99'
    const bt = b.termin || '9999-99-99'
    return at.localeCompare(bt)
  })

  const result: NettingResult[] = []

  for (const bi of sirali) {
    if (bi.tip === 'YarıMamul') continue  // YM'ler netting dışı

    const k = bi.malkod.toLowerCase().trim()
    const stokDus = Math.min(stokPool[k] ?? 0, bi.brut)
    stokPool[k] = (stokPool[k] ?? 0) - stokDus
    const kalan = Math.max(0, bi.brut - stokDus)
    const acikDus = Math.min(acikTedPool[k] ?? 0, kalan)
    acikTedPool[k] = (acikTedPool[k] ?? 0) - acikDus
    const net = Math.max(0, Math.ceil(bi.brut - stokDus - acikDus))

    result.push({
      malkod: bi.malkod,
      malad: bi.malad,
      tip: bi.tip,
      birim: bi.birim,
      brut: bi.brut,
      stok: stokDus,
      acikTedarik: acikDus,
      net,
      termin: bi.termin || '',
      durum: net > 0 ? 'eksik' : 'yeterli',
    })
  }

  return result.sort((a, b) => {
    const at = a.termin || '9999-99-99'
    const bt = b.termin || '9999-99-99'
    if (at !== bt) return at.localeCompare(bt)
    return (a.durum === 'eksik' ? 0 : 1) - (b.durum === 'eksik' ? 0 : 1)
  })
}

// ─── KATMAN 4: buildResult ────────────────────────────────────────────────────
/**
 * NettingResult[] → MRPRow[] (mevcut tip ile uyumlu çıktı)
 * hesaplaMRP() ile tamamen aynı format — drop-in replacement.
 */
export function buildResult(nettingRows: NettingResult[]): import('./mrp').MRPRow[] {
  return nettingRows.map(r => ({
    malkod: r.malkod,
    malad: r.malad,
    tip: r.tip,
    birim: r.birim,
    brut: r.brut,
    stok: r.stok,
    rezerve: 0,          // rezerve ayrı hesaplanır
    acikTedarik: r.acikTedarik,
    net: r.net,
    durum: r.net > 0 ? 'eksik' : 'yeterli',
    termin: r.termin,
  }))
}

// ─── ORKESTRATÖR: hesaplaMRPEngine ───────────────────────────────────────────
/**
 * Tek sipariş için engine pipeline'ı çalıştırır.
 * Şimdilik basit senaryo: tek mamul, flat BOM, stok netting.
 * Çok seviyeli + cutting plan override → Faz 2'de eklenir.
 *
 * @param mamulKod  üretilecek ürün
 * @param adet      sipariş miktarı
 * @param termin    sipariş termin tarihi
 */
export function hesaplaMRPEngine(params: {
  mamulKod: string
  adet: number
  termin?: string
  recipes: Recipe[]
  materials: Material[]
  stokHareketler: StokHareket[]
  tedarikler: Tedarik[]
}): NettingResult[] {
  const { mamulKod, adet, termin, recipes, materials, stokHareketler, tedarikler } = params

  // 1. BOM patlat
  const bomLines = explodeBOM(mamulKod, adet, recipes, materials)

  // 2. Termin ekle + aggregate
  const linesWithTermin = bomLines.map(l => ({ ...l, termin: termin || '' }))
  const brutMap = aggregateBOM(linesWithTermin)

  // 3. Netting
  const nettingRows = netting(brutMap, stokHareketler, tedarikler)

  return nettingRows
}
