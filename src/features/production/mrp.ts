import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import type { Recipe, StokHareket, Tedarik, WorkOrder } from '@/types'

interface MRPRow {
  malkod: string; malad: string; tip: string; birim: string
  brut: number; stok: number; acikTedarik: number; net: number
  boy?: number; en?: number
}

/**
 * MRP Hesaplama: Siparişteki reçeteden BOM patlatma → brüt ihtiyaç → stok düş → net ihtiyaç
 */
export function hesaplaMRP(
  orderId: string,
  adet: number,
  recipe: Recipe,
  stokHareketler: StokHareket[],
  tedarikler: Tedarik[],
  _workOrders?: WorkOrder[]
): MRPRow[] {
  if (!recipe?.satirlar?.length) return []

  // Stok hesapla
  const stokMap: Record<string, number> = {}
  stokHareketler.forEach(h => {
    stokMap[h.malkod] = (stokMap[h.malkod] || 0) + (h.tip === 'giris' ? h.miktar : -h.miktar)
  })

  // Açık tedarik
  const acikTedarikMap: Record<string, number> = {}
  tedarikler.filter(t => !t.geldi && t.orderId === orderId).forEach(t => {
    acikTedarikMap[t.malkod] = (acikTedarikMap[t.malkod] || 0) + t.miktar
  })

  // BOM patlatma - hammadde ihtiyaçları
  const ihtiyacMap: Record<string, MRPRow> = {}
  const satirlar = recipe.satirlar

  // Kırılım → miktar map
  const kirnoMap: Record<string, typeof satirlar[0]> = {}
  satirlar.forEach(s => { kirnoMap[s.kirno || ''] = s })

  satirlar.forEach(s => {
    if (s.tip !== 'Hammadde') return

    // Zincir çarpan hesabı
    const parcalar = (s.kirno || '1').split('.')
    let zincirCarpan = 1
    for (let i = 1; i < parcalar.length - 1; i++) {
      const ebKirno = parcalar.slice(0, i + 1).join('.')
      const eb = kirnoMap[ebKirno]
      if (eb) zincirCarpan *= (eb.miktar || 1)
    }

    const brut = Math.ceil(adet * zincirCarpan * (s.miktar || 1))
    const malkod = s.malkod || ''

    if (!ihtiyacMap[malkod]) {
      ihtiyacMap[malkod] = {
        malkod, malad: s.malad || '', tip: s.tip, birim: s.birim || 'Adet',
        brut: 0, stok: Math.max(0, stokMap[malkod] || 0),
        acikTedarik: acikTedarikMap[malkod] || 0, net: 0,
      }
    }
    ihtiyacMap[malkod].brut += brut
  })

  // Net ihtiyaç = brüt - stok - açık tedarik
  Object.values(ihtiyacMap).forEach(r => {
    r.net = Math.max(0, r.brut - r.stok - r.acikTedarik)
  })

  return Object.values(ihtiyacMap).sort((a, b) => b.net - a.net)
}

/**
 * MRP sonuçlarından tedarik kayıtları oluştur
 */
export async function mrpTedarikOlustur(
  orderId: string,
  siparisNo: string,
  mrpRows: MRPRow[]
): Promise<number> {
  const ihtiyaclar = mrpRows.filter(r => r.net > 0)
  if (!ihtiyaclar.length) return 0

  const rows = ihtiyaclar.map(r => ({
    id: uid(),
    malkod: r.malkod, malad: r.malad, miktar: r.net, birim: r.birim,
    order_id: orderId, siparis_no: siparisNo,
    durum: 'bekliyor', geldi: false,
    tarih: today(), not_: 'MRP otomatik',
  }))

  for (let i = 0; i < rows.length; i += 50) {
    await supabase.from('uys_tedarikler').upsert(rows.slice(i, i + 50), { onConflict: 'id' })
  }

  return rows.length
}
