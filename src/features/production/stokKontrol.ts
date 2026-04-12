import type { WorkOrder, StokHareket, Tedarik } from '@/types'

export interface StokKontrolSatir {
  malkod: string
  malad: string
  gerekli: number
  mevcut: number
  acikTed: number
  durum: 'YETERLI' | 'KISMI' | 'YOK' | 'BEKLIYOR'
}

export interface StokKontrolSonuc {
  durum: 'OK' | 'KISMI' | 'YOK'
  satirlar: StokKontrolSatir[]
  maxYapilabilir: number
}

/**
 * v2 stokKontrolWO — İE'nin HM stok durumunu kontrol et
 * - Her HM için YETERLI/KISMI/YOK
 * - Açık tedarik hesaba katılır
 * - Max yapılabilir adet hesaplanır
 */
export function stokKontrolWO(
  wo: WorkOrder,
  kalan: number,
  stokHareketler: StokHareket[],
  tedarikler: Tedarik[]
): StokKontrolSonuc {
  if (kalan <= 0) return { durum: 'OK', satirlar: [], maxYapilabilir: 0 }

  // Mamul stokta varsa HM kontrolüne gerek yok
  const mamulStok = stokHareketler
    .filter(h => h.malkod === wo.malkod)
    .reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
  if (Math.floor(mamulStok) >= kalan) return { durum: 'OK', satirlar: [], maxYapilabilir: kalan }

  // HM kontrolü
  if (!wo.hm?.length) return { durum: 'OK', satirlar: [], maxYapilabilir: kalan }

  const satirlar: StokKontrolSatir[] = []
  let minYapilabilir = kalan

  for (const hm of wo.hm) {
    const stok = Math.floor(stokHareketler
      .filter(h => h.malkod === hm.malkod)
      .reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0))

    const acikTed = tedarikler
      .filter(t => t.malkod === hm.malkod && !t.geldi)
      .reduce((a, t) => a + t.miktar, 0)

    const birimIhtiyac = hm.miktarTotal / (wo.hedef || 1) // Birim başına HM ihtiyacı

    let durum: StokKontrolSatir['durum'] = 'YETERLI'
    if (stok <= 0 && acikTed <= 0) durum = 'YOK'
    else if (stok < birimIhtiyac * kalan) {
      durum = acikTed > 0 ? 'BEKLIYOR' : 'KISMI'
    }

    if (durum !== 'YETERLI') {
      satirlar.push({
        malkod: hm.malkod, malad: hm.malad,
        gerekli: Math.ceil(birimIhtiyac * kalan),
        mevcut: Math.max(0, stok), acikTed, durum,
      })
    }

    // Max yapılabilir hesabı
    if (birimIhtiyac > 0) {
      const maxBuHM = Math.floor(stok / birimIhtiyac)
      if (maxBuHM < minYapilabilir) minYapilabilir = maxBuHM
    }
  }

  if (!satirlar.length) return { durum: 'OK', satirlar: [], maxYapilabilir: kalan }

  const enKotu = satirlar.some(s => s.durum === 'YOK')
  return {
    durum: enKotu ? 'YOK' : 'KISMI',
    satirlar,
    maxYapilabilir: Math.max(0, minYapilabilir),
  }
}
