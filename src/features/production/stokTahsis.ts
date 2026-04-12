import { supabase } from '@/lib/supabase'
import type { WorkOrder, StokHareket } from '@/types'

/**
 * #7: Stok Tahsis — İE'ye stok tahsis et (wh_alloc alanını güncelle)
 * Mevcut stoktan İE'nin HM ihtiyaçlarını karşıla
 */
export function stokTahsisDurumu(
  wo: WorkOrder,
  stokHareketler: StokHareket[]
): { malkod: string; malad: string; ihtiyac: number; stok: number; tahsis: number; eksik: number }[] {
  if (!wo.hm?.length || !wo.hedef) return []

  const stokMap: Record<string, number> = {}
  stokHareketler.forEach(h => {
    stokMap[h.malkod] = (stokMap[h.malkod] || 0) + (h.tip === 'giris' ? h.miktar : -h.miktar)
  })

  return wo.hm.map(h => {
    const stok = Math.max(0, stokMap[h.malkod] || 0)
    const ihtiyac = h.miktarTotal
    const tahsis = Math.min(stok, ihtiyac)
    return { malkod: h.malkod, malad: h.malad, ihtiyac, stok, tahsis, eksik: Math.max(0, ihtiyac - stok) }
  })
}

export async function stokTahsisEt(woId: string, tahsisEdilen: number): Promise<void> {
  await supabase.from('uys_work_orders').update({ wh_alloc: tahsisEdilen }).eq('id', woId)
}
