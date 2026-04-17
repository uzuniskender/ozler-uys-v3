import type { WorkOrder, StokHareket, Tedarik, Material, Recipe } from '@/types'

export interface StokKontrolSatir {
  malkod: string
  malad: string
  tip: string
  gerekli: number
  mevcut: number
  acikTed: number
  durum: 'YETERLI' | 'KISMI' | 'YOK' | 'BEKLIYOR'
}

export interface StokKontrolSonuc {
  durum: 'OK' | 'KISMI' | 'YOK'
  satirlar: StokKontrolSatir[]
  maxYapilabilir: number
  mesaj?: string
}

function netStok(malkod: string, stokHareketler: StokHareket[]): number {
  return stokHareketler
    .filter(h => h.malkod === malkod)
    .reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
}

function netAcikTed(malkod: string, tedarikler: Tedarik[]): number {
  return tedarikler
    .filter(t => t.malkod === malkod && !t.geldi)
    .reduce((a, t) => a + t.miktar, 0)
}

/**
 * Bir malzemeyi üretmek için GEREKLİ olan doğrudan alt bileşenleri bul.
 * Öncelik: 1) Kendi reçetesi (mamulKod === malkod), 2) wo.hm (kök İE için)
 */
function dogrudanAltBilesenler(
  malkod: string,
  recipes: Recipe[],
  wo?: WorkOrder
): { malkod: string; malad: string; tip: string; birimIhtiyac: number }[] {
  const rc = recipes.find(r => r.mamulKod === malkod)
  if (rc && rc.satirlar?.length) {
    const topLevel = rc.satirlar.filter(s => s.kirno && !s.kirno.includes('.'))
    return topLevel
      .filter(s => s.malkod && s.malkod !== malkod)
      .map(s => ({
        malkod: s.malkod,
        malad: s.malad || s.malkod,
        tip: s.tip || 'Hammadde',
        birimIhtiyac: s.miktar || 0,
      }))
  }
  if (wo && wo.malkod === malkod && wo.hm?.length) {
    return wo.hm
      .filter(hm => hm.malkod !== malkod && hm.malkod !== wo.mamulKod)
      .map(hm => ({
        malkod: hm.malkod,
        malad: hm.malad || hm.malkod,
        tip: 'Hammadde',
        birimIhtiyac: (hm.miktarTotal || 0) / (wo.hedef || 1),
      }))
  }
  return []
}

/**
 * Recursive malzeme kontrol.
 * Bu seviyede stok yeterli DEĞİLSE alt kademeye iner.
 * Alt kademede her şey yeterliyse [] döner (bu üretilebilir demek).
 * Alt kademede bir şey eksikse o eksikleri satır olarak döner.
 */
function malzemeKontrol(
  malkod: string,
  malad: string,
  tip: string,
  gerekli: number,
  stokHareketler: StokHareket[],
  tedarikler: Tedarik[],
  recipes: Recipe[],
  materials: Material[] | undefined,
  ziyaret: Set<string>,
  derinlik: number,
  wo?: WorkOrder
): StokKontrolSatir[] {
  if (derinlik > 10 || ziyaret.has(malkod)) return []
  ziyaret.add(malkod)

  const kendiStok = Math.max(0, Math.floor(netStok(malkod, stokHareketler)))
  if (kendiStok >= gerekli) return []

  const acikTed = netAcikTed(malkod, tedarikler)

  // Alt bileşenlere bak
  const altlar = dogrudanAltBilesenler(malkod, recipes, wo)
  if (altlar.length > 0) {
    // Alt kademelerde her şey yeterli mi? AND mantığı
    const altSatirlar: StokKontrolSatir[] = []
    let hepsiYeterli = true
    for (const alt of altlar) {
      const altGerekli = alt.birimIhtiyac * (gerekli - kendiStok)
      if (altGerekli <= 0) continue
      const altSonuc = malzemeKontrol(
        alt.malkod, alt.malad, alt.tip,
        altGerekli,
        stokHareketler, tedarikler, recipes, materials,
        new Set(ziyaret),
        derinlik + 1,
        wo
      )
      if (altSonuc.length > 0) {
        hepsiYeterli = false
        altSatirlar.push(...altSonuc)
      }
    }
    if (hepsiYeterli) return []
    // Alt kademede eksikler var — onları raporla
    return altSatirlar
  }

  // Yaprak — ne reçetesi var ne alt. Genelde HM/Sarf.
  const mat = materials?.find(m => m.kod === malkod)
  const effTip = mat?.tip || tip
  const netEksik = Math.max(0, gerekli - kendiStok)
  if (netEksik <= 0) return []

  let durum: StokKontrolSatir['durum']
  if (kendiStok + acikTed >= gerekli) durum = acikTed > 0 && kendiStok < gerekli ? 'BEKLIYOR' : 'YETERLI'
  else if (kendiStok + acikTed <= 0) durum = 'YOK'
  else durum = 'KISMI'

  if (durum === 'YETERLI') return []

  return [{
    malkod, malad, tip: effTip,
    gerekli: Math.ceil(gerekli),
    mevcut: kendiStok,
    acikTed,
    durum,
  }]
}

/**
 * İE için stok kontrol.
 * Kural: "Alt kırılımın herhangi bir seviyesinde yeterli stok varsa üretilebilir.
 *         Hiçbir kademede yeterli yoksa STOK YOK uyarısı."
 */
export function stokKontrolWO(
  wo: WorkOrder,
  kalan: number,
  stokHareketler: StokHareket[],
  tedarikler: Tedarik[],
  materials?: Material[],
  recipes?: Recipe[]
): StokKontrolSonuc {
  if (kalan <= 0) return { durum: 'OK', satirlar: [], maxYapilabilir: 0 }

  // Mamul stokta varsa üretmeye gerek yok
  const mamulStok = Math.floor(netStok(wo.malkod, stokHareketler))
  if (mamulStok >= kalan) return { durum: 'OK', satirlar: [], maxYapilabilir: kalan }

  const altlar = dogrudanAltBilesenler(wo.malkod, recipes || [], wo)
  if (altlar.length === 0) {
    return { durum: 'OK', satirlar: [], maxYapilabilir: kalan }
  }

  const tumSatirlar: StokKontrolSatir[] = []
  let enKotu: 'OK' | 'KISMI' | 'YOK' = 'OK'

  for (const alt of altlar) {
    const altGerekli = alt.birimIhtiyac * kalan
    if (altGerekli <= 0) continue
    const sonuclar = malzemeKontrol(
      alt.malkod, alt.malad, alt.tip,
      altGerekli,
      stokHareketler, tedarikler, recipes || [], materials,
      new Set([wo.malkod]),
      1,
      wo
    )
    if (sonuclar.length > 0) {
      tumSatirlar.push(...sonuclar)
      if (sonuclar.some(s => s.durum === 'YOK')) enKotu = 'YOK'
      else if (enKotu !== 'YOK') enKotu = 'KISMI'
    }
  }

  if (tumSatirlar.length === 0) {
    return { durum: 'OK', satirlar: [], maxYapilabilir: kalan }
  }

  // maxYapilabilir — en kısıtlı yaprak bileşene göre
  let minMax = 0
  if (tumSatirlar.length > 0) {
    const oranlar = tumSatirlar
      .filter(s => s.gerekli > 0 && kalan > 0)
      .map(s => {
        const birimIhtiyac = s.gerekli / kalan
        if (birimIhtiyac <= 0) return kalan
        const mevcutToplam = s.mevcut + s.acikTed
        return Math.floor(mevcutToplam / birimIhtiyac)
      })
    minMax = oranlar.length ? Math.max(0, Math.min(...oranlar)) : 0
  }

  return {
    durum: enKotu,
    satirlar: tumSatirlar,
    maxYapilabilir: minMax,
  }
}
