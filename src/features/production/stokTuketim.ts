import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import type { WorkOrder, Recipe } from '@/types'

/**
 * #8: Stok Tüketim — Üretim yapıldığında HM bileşenlerini stoktan düş
 * wo.hm varsa oradan, yoksa reçeteden (recipes) alır
 */
export async function stokTuketimIsle(
  woId: string,
  qty: number,
  logId: string,
  workOrders: WorkOrder[],
  recipes?: Recipe[]
): Promise<number> {
  const wo = workOrders.find(w => w.id === woId)
  if (!wo || qty <= 0) return 0

  const rows: Record<string, unknown>[] = []

  if (wo.hm?.length && wo.hedef) {
    // wo.hm'den hesapla
    for (const h of wo.hm) {
      const perUnit = h.miktarTotal / wo.hedef
      const consume = Math.round(qty * perUnit * 100) / 100
      if (consume <= 0) continue
      rows.push({
        id: uid(), tarih: today(),
        malkod: h.malkod, malad: h.malad,
        miktar: consume, tip: 'cikis',
        log_id: logId, wo_id: woId,
        aciklama: 'HM tüketim — üretim',
      })
    }
  } else if (recipes?.length && wo.rcId) {
    // Reçeteden fallback
    const rc = recipes.find(r => r.id === wo.rcId)
    if (rc?.satirlar?.length) {
      const hmRows = rc.satirlar.filter(s => s.tip === 'Hammadde' || s.tip === 'hammadde' || s.tip === 'YarıMamul')
      for (const s of hmRows) {
        const consume = Math.round((s.miktar || 0) * (wo.mpm || 1) * qty * 100) / 100
        if (consume <= 0) continue
        rows.push({
          id: uid(), tarih: today(),
          malkod: s.malkod, malad: s.malad,
          miktar: consume, tip: 'cikis',
          log_id: logId, wo_id: woId,
          aciklama: 'HM tüketim — reçeteden',
        })
      }
    }
  }

  if (rows.length) {
    await supabase.from('uys_stok_hareketler').insert(rows)
  }
  return rows.length
}

/**
 * #6: Fire → Sipariş Dışı İE oluşturma
 */
export async function fireIEOlustur(
  woId: string,
  fireQty: number,
  workOrders: WorkOrder[]
): Promise<string | null> {
  const wo = workOrders.find(w => w.id === woId)
  if (!wo || fireQty <= 0) return null

  const ieNo = `FIRE-${wo.ieNo}-${Date.now().toString(36).slice(-4).toUpperCase()}`
  const newWO = {
    id: uid(),
    order_id: wo.orderId || null,
    rc_id: wo.rcId || null,
    sira: 999,
    kirno: wo.kirno,
    op_id: wo.opId, op_kod: wo.opKod, op_ad: wo.opAd,
    ist_id: wo.istId, ist_kod: wo.istKod, ist_ad: wo.istAd,
    malkod: wo.malkod, malad: wo.malad,
    hedef: fireQty, mpm: wo.mpm,
    hm: wo.hm,
    ie_no: ieNo,
    hazirlik_sure: wo.hazirlikSure,
    islem_sure: wo.islemSure,
    durum: 'bekliyor',
    bagimsiz: true,
    siparis_disi: true,
    mamul_kod: wo.mamulKod, mamul_ad: wo.mamulAd,
    not_: `Fire telafi — kaynak: ${wo.ieNo}`,
    olusturma: today(),
  }

  const { error } = await supabase.from('uys_work_orders').insert(newWO)
  if (error) return null
  return ieNo
}
