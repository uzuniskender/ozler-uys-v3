import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import type { Recipe, RecipeRow, WorkOrder, Material, StokHareket, Tedarik } from '@/types'
import { kesimPlanOlustur, kesimPlanlariKaydet } from './cutting'
import { hesaplaMRP } from './mrp'

// ═══ İE OLUŞTUR — reçeteden iş emirleri ═══
export async function buildWorkOrders(
  orderId: string, siparisNo: string, recipeId: string, adet: number, recipes: Recipe[], termin?: string
): Promise<number> {
  const rc = recipes.find(r => r.id === recipeId)
  if (!rc || !rc.satirlar?.length) return 0

  const satirlar = rc.satirlar
  const opRows = satirlar.filter(s => s.opId).sort((a, b) => {
    const dA = (a.kirno || '').split('.').length
    const dB = (b.kirno || '').split('.').length
    return dB - dA || (a.kirno || '').localeCompare(b.kirno || '')
  })

  const mamulSatir = satirlar.find(s => !s.kirno?.includes('.'))
  if (mamulSatir && !mamulSatir.opId) {
    opRows.push({ ...mamulSatir, opId: '', tip: 'Mamul' } as RecipeRow)
  }

  const kirnoMap: Record<string, RecipeRow> = {}
  satirlar.forEach(s => { kirnoMap[s.kirno || ''] = s })

  const workOrders: Record<string, unknown>[] = []
  let woIdx = 0

  for (const s of opRows) {
    const parcalar = (s.kirno || '1').split('.')
    let zincirCarpan = 1
    for (let i = 1; i < parcalar.length - 1; i++) {
      const ebKirno = parcalar.slice(0, i + 1).join('.')
      const eb = kirnoMap[ebKirno]
      if (eb) zincirCarpan *= (eb.miktar || 1)
    }
    const hedef = Math.max(1, Math.ceil(adet * zincirCarpan * (s.miktar || 1)))
    const depth = (s.kirno || '').split('.').length
    const hm = satirlar
      .filter(r => r.tip === 'Hammadde' && r.kirno?.startsWith(s.kirno + '.') && r.kirno.split('.').length === depth + 1)
      .map(h => ({ malkod: h.malkod, malad: h.malad, miktarTotal: Math.round(adet * (h.miktar || 1)) }))

    woIdx++
    const isMamulAuto = !s.opId && s.tip === 'Mamul'
    workOrders.push({
      id: uid(), order_id: orderId, rc_id: recipeId,
      mamul_kod: rc.mamulKod, mamul_ad: rc.mamulAd,
      sira: woIdx, kirno: s.kirno || '1',
      op_id: s.opId || null, op_kod: isMamulAuto ? 'MAMUL' : '', op_ad: isMamulAuto ? 'MAMUL TAMAMLAMA' : '',
      ist_id: s.istId || null, malkod: s.malkod || '', malad: s.malad || '',
      hedef, mpm: s.miktar || 1, hm,
      ie_no: `IE-${siparisNo}-${String(woIdx).padStart(2, '0')}`,
      wh_alloc: 0, hazirlik_sure: s.hazirlikSure || 0, islem_sure: s.islemSure || 0,
      durum: 'bekliyor', bagimsiz: false, siparis_disi: false, termin: termin || null,
      mamul_auto: isMamulAuto, operator_id: null, olusturma: today(),
    })
  }

  if (workOrders.length) {
    for (let i = 0; i < workOrders.length; i += 50) {
      await supabase.from('uys_work_orders').upsert(workOrders.slice(i, i + 50), { onConflict: 'id' })
    }
    // Op adlarını doldur
    const opIds = [...new Set(workOrders.map(w => w.op_id as string).filter(Boolean))]
    if (opIds.length) {
      const { data: ops } = await supabase.from('uys_operations').select('id, kod, ad').in('id', opIds)
      if (ops) {
        for (const wo of workOrders) {
          if (wo.op_id && !wo.op_ad) {
            const op = ops.find(o => o.id === wo.op_id)
            if (op) await supabase.from('uys_work_orders').update({ op_kod: op.kod, op_ad: op.ad }).eq('id', wo.id as string)
          }
        }
      }
    }
  }
  return workOrders.length
}

// ═══ TAM ZİNCİR: İE → Kesim → MRP → Tedarik ═══
export interface ZincirSonuc {
  woCount: number; kesimCount: number; mrpCount: number; tedCount: number
  eksikler: { malkod: string; malad: string; brut: number; stok: number; net: number }[]
  adimlar: string[]
}

export async function autoZincir(
  orderId: string,
  woCount: number,
  orders: any[], workOrders: WorkOrder[], recipes: Recipe[],
  operations: { id: string; ad: string; kod: string }[],
  materials: Material[], stokHareketler: StokHareket[], tedarikler: Tedarik[],
  logs: { woId: string; qty: number }[],
  cuttingPlans: any[],
  onProgress?: (adimlar: string[]) => void
): Promise<ZincirSonuc> {
  const adimlar: string[] = []
  adimlar.push(`✅ ${woCount} iş emri oluşturuldu`)
  onProgress?.(adimlar)

  // Re-fetch work orders (just created)
  const { data: freshWOs } = await supabase.from('uys_work_orders').select('*')
  const allWOs: WorkOrder[] = freshWOs?.map((r: any) => ({
    id: r.id, orderId: r.order_id, rcId: r.rc_id, sira: r.sira || 0, kirno: r.kirno,
    opId: r.op_id, opKod: r.op_kod, opAd: r.op_ad, istId: r.ist_id, istKod: r.ist_kod, istAd: r.ist_ad,
    malkod: r.malkod, malad: r.malad, hedef: r.hedef || 0, mpm: r.mpm || 1, hm: r.hm || [],
    ieNo: r.ie_no, whAlloc: r.wh_alloc || 0, hazirlikSure: r.hazirlik_sure || 0, islemSure: r.islem_sure || 0,
    durum: r.durum, bagimsiz: !!r.bagimsiz, siparisDisi: !!r.siparis_disi,
    mamulKod: r.mamul_kod, mamulAd: r.mamul_ad, mamulAuto: !!r.mamul_auto,
    operatorId: r.operator_id, not: r.not_, olusturma: r.olusturma, termin: r.termin || '',
  })) || workOrders

  // ADIM 2: Kesim Planı
  let kesimCount = 0
  try {
    const yeniPlanlar = kesimPlanOlustur(allWOs, operations, recipes, materials, logs, cuttingPlans)
    if (yeniPlanlar.length) {
      kesimCount = await kesimPlanlariKaydet(yeniPlanlar)
      adimlar.push(`✅ ${kesimCount} kesim planı oluşturuldu`)
    } else {
      adimlar.push('ℹ️ Kesim operasyonlu İE bulunamadı')
    }
  } catch (e: any) {
    adimlar.push('⚠️ Kesim planı hatası: ' + e.message)
  }
  onProgress?.(adimlar)

  // Re-fetch cutting plans
  const { data: freshCP } = await supabase.from('uys_kesim_planlari').select('*')
  const allCP = freshCP?.map((r: any) => ({
    hamMalkod: r.ham_malkod, hamMalad: r.ham_malad, durum: r.durum,
    gerekliAdet: r.gerekli_adet, satirlar: r.satirlar || [],
  })) || cuttingPlans

  // ADIM 3: MRP
  let mrpSonuc: any[] = []
  try {
    mrpSonuc = hesaplaMRP([orderId], orders, allWOs, recipes, stokHareketler, tedarikler, allCP, materials)
    const eksikSay = mrpSonuc.filter(x => x.durum === 'eksik').length
    adimlar.push(`✅ MRP: ${mrpSonuc.length} kalem${eksikSay ? ' · ' + eksikSay + ' eksik' : ''}`)
  } catch (e: any) {
    adimlar.push('⚠️ MRP hatası: ' + e.message)
  }
  onProgress?.(adimlar)

  // ADIM 4: Tedarik Otomatik Oluştur
  let tedCount = 0
  try {
    const ord = orders.find((o: any) => o.id === orderId)
    const eksikler = mrpSonuc.filter(x => x.durum === 'eksik' && x.net > 0)
    for (const x of eksikler) {
      // Bu malkod+sipariş için zaten açık tedarik var mı?
      const mevcutTed = tedarikler.find(t => t.malkod === x.malkod && t.orderId === orderId && !t.geldi)
      if (mevcutTed) continue
      await supabase.from('uys_tedarikler').insert({
        id: uid(), malkod: x.malkod, malad: x.malad, miktar: x.net,
        birim: x.birim || 'Adet', tarih: today(),
        order_id: orderId, siparis_no: ord?.siparisNo || '',
        durum: 'bekliyor', geldi: false, not_: 'Otomatik (Sipariş Zinciri)',
      })
      tedCount++
    }
    adimlar.push(tedCount > 0 ? `✅ ${tedCount} tedarik oluşturuldu` : '✅ Tüm malzemeler yeterli')
  } catch (e: any) {
    adimlar.push('⚠️ Tedarik hatası: ' + e.message)
  }
  onProgress?.(adimlar)

  const eksikler = mrpSonuc.filter(x => x.durum === 'eksik').map(x => ({
    malkod: x.malkod, malad: x.malad, brut: x.brut, stok: x.stok, net: x.net,
  }))

  return { woCount, kesimCount, mrpCount: mrpSonuc.length, tedCount, eksikler, adimlar }
}
