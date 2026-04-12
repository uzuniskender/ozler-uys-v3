import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import type { Recipe, RecipeRow } from '@/types'

/**
 * autoZincir: Sipariş → Reçeteden İş Emirleri oluştur
 * v2'deki _buildWOs mantığının port'u
 */
export async function buildWorkOrders(
  orderId: string,
  siparisNo: string,
  recipeId: string,
  adet: number,
  recipes: Recipe[]
): Promise<number> {
  const rc = recipes.find(r => r.id === recipeId)
  if (!rc || !rc.satirlar?.length) return 0

  const satirlar = rc.satirlar
  // Operasyonu olan satırları bul (İE oluşturulacaklar)
  const opRows = satirlar.filter(s => s.opId).sort((a, b) => {
    // Derin kırılımlar önce (bottom-up)
    const dA = (a.kirno || '').split('.').length
    const dB = (b.kirno || '').split('.').length
    return dB - dA || (a.kirno || '').localeCompare(b.kirno || '')
  })

  // Mamul satırı (kirno = '1') opId'siz ise pseudo İE ekle
  const mamulSatir = satirlar.find(s => !s.kirno?.includes('.'))
  if (mamulSatir && !mamulSatir.opId) {
    opRows.push({
      ...mamulSatir,
      opId: '', // mamul tamamlama
      tip: 'Mamul',
    } as RecipeRow)
  }

  const workOrders: Record<string, unknown>[] = []
  let woIdx = 0

  // Kırılım → miktar map (zincir çarpan hesabı)
  const kirnoMap: Record<string, RecipeRow> = {}
  satirlar.forEach(s => { kirnoMap[s.kirno || ''] = s })

  for (const s of opRows) {
    // Zincir çarpan: üst kırılımların miktar çarpımı
    const parcalar = (s.kirno || '1').split('.')
    let zincirCarpan = 1
    for (let i = 1; i < parcalar.length - 1; i++) {
      const ebKirno = parcalar.slice(0, i + 1).join('.')
      const eb = kirnoMap[ebKirno]
      if (eb) zincirCarpan *= (eb.miktar || 1)
    }

    const hedef = Math.max(1, Math.ceil(adet * zincirCarpan * (s.miktar || 1)))

    // Hammadde bileşenleri (bir alt seviye)
    const depth = (s.kirno || '').split('.').length
    const hm = satirlar
      .filter(r => r.tip === 'Hammadde' && r.kirno?.startsWith(s.kirno + '.') && r.kirno.split('.').length === depth + 1)
      .map(h => ({ malkod: h.malkod, malad: h.malad, miktarTotal: Math.round(adet * (h.miktar || 1)) }))

    woIdx++
    const isMamulAuto = !s.opId && s.tip === 'Mamul'

    workOrders.push({
      id: uid(),
      order_id: orderId,
      rc_id: recipeId,
      mamul_kod: rc.mamulKod,
      mamul_ad: rc.mamulAd,
      sira: woIdx,
      kirno: s.kirno || '1',
      op_id: s.opId || null,
      op_kod: isMamulAuto ? 'MAMUL' : '',
      op_ad: isMamulAuto ? 'MAMUL TAMAMLAMA' : '',
      ist_id: s.istId || null,
      malkod: s.malkod || '',
      malad: s.malad || '',
      hedef,
      mpm: s.miktar || 1,
      hm,
      ie_no: `IE-${siparisNo}-${String(woIdx).padStart(2, '0')}`,
      wh_alloc: 0,
      hazirlik_sure: s.hazirlikSure || 0,
      islem_sure: s.islemSure || 0,
      durum: 'bekliyor',
      bagimsiz: false,
      siparis_disi: false,
      mamul_auto: isMamulAuto,
      operator_id: null,
      olusturma: today(),
    })
  }

  // Batch insert
  if (workOrders.length) {
    for (let i = 0; i < workOrders.length; i += 50) {
      const batch = workOrders.slice(i, i + 50)
      const { error } = await supabase.from('uys_work_orders').upsert(batch, { onConflict: 'id' })
      if (error) console.error('WO insert error:', error.message)
    }
  }

  // Operasyon adlarını doldur (opId → operations tablosundan)
  if (workOrders.length) {
    const opIds = [...new Set(workOrders.map(w => w.op_id as string).filter(Boolean))]
    if (opIds.length) {
      const { data: ops } = await supabase.from('uys_operations').select('id, kod, ad').in('id', opIds)
      if (ops) {
        for (const wo of workOrders) {
          if (wo.op_id && !wo.op_ad) {
            const op = ops.find(o => o.id === wo.op_id)
            if (op) {
              await supabase.from('uys_work_orders').update({ op_kod: op.kod, op_ad: op.ad }).eq('id', wo.id as string)
            }
          }
        }
      }
    }
  }

  return workOrders.length
}
