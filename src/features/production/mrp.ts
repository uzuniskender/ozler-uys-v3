import type { Recipe, StokHareket, Tedarik, WorkOrder, Material } from '@/types'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'

export interface MRPRow {
  malkod: string; malad: string; tip: string; birim: string
  brut: number; stok: number; acikTedarik: number; net: number
  durum: 'yeterli' | 'eksik' | 'yok'
  termin: string
  artik?: boolean
}

// ═══ STOK HESAPLA ═══
function getStok(malkod: string, stokHareketler: StokHareket[]): number {
  return Math.floor(stokHareketler
    .filter(h => h.malkod === malkod)
    .reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0))
}

// ═══ BOM PATLAT NET — v2 bomPatlaNet port'u ═══
// Recursive BOM explosion with YM stock netting
function bomPatlaNet(
  mamulKod: string,
  adet: number,
  derinlik: number,
  ziyaret: Record<string, boolean>,
  recipes: Recipe[],
  stokHareketler: StokHareket[],
  materials: Material[]
): Record<string, { malkod: string; malad: string; tip: string; birim: string; miktar: number }> {
  if (derinlik > 10) return {}

  // YM stoku düş
  const ymStok = Math.floor(getStok(mamulKod, stokHareketler))
  const netAdet = Math.max(0, adet - (derinlik > 0 ? ymStok : 0)) // Kök seviyede stok düşme
  if (netAdet <= 0 && derinlik > 0) return {}

  const sonuc: Record<string, { malkod: string; malad: string; tip: string; birim: string; miktar: number }> = {}

  // Bu mamul kodunun reçetesini bul
  const rc = recipes.find(r => r.mamulKod === mamulKod)
  if (!rc?.satirlar?.length) {
    // Kendi reçetesi yok — üst reçetelerden alt kirno'ları bul
    for (const r of recipes) {
      const satirlar = r.satirlar || []
      const ymSatir = satirlar.find(s => s.malkod === mamulKod)
      if (!ymSatir) continue
      const ymKirno = ymSatir.kirno || ''
      if (!ymKirno) continue
      const ymDepth = ymKirno.split('.').length
      const altlar = satirlar.filter(s => (s.kirno || '').startsWith(ymKirno + '.'))
      if (!altlar.length) break

      const kirnoMap: Record<string, typeof satirlar[0]> = {}
      altlar.forEach(s => { kirnoMap[s.kirno || ''] = s })

      // Hammadde/Sarf satırları
      altlar.filter(s => s.tip === 'Hammadde' || s.tip === 'Sarf').forEach(s => {
        const sk = s.kirno || ''
        const hmalkod = s.malkod || ''; if (!hmalkod) return
        const parcalar = sk.split('.')
        let ebCarpan = 1
        for (let i = ymDepth; i < parcalar.length - 1; i++) {
          const ebk = parcalar.slice(0, i + 1).join('.')
          const eb = kirnoMap[ebk]
          if (eb?.tip === 'YarıMamul') ebCarpan *= (eb.miktar || 1)
        }
        const tm = (s.miktar || 1) * ebCarpan * netAdet
        if (!sonuc[hmalkod]) sonuc[hmalkod] = { malkod: hmalkod, malad: s.malad || '', tip: s.tip || 'Hammadde', birim: s.birim || 'Adet', miktar: 0 }
        sonuc[hmalkod].miktar += tm
      })

      // Alt YarıMamul'lar için recursive
      altlar.filter(s => s.tip === 'YarıMamul' && !ziyaret[s.malkod || '']).forEach(s => {
        const ymalkod = s.malkod || ''; if (!ymalkod) return
        const sk = s.kirno || ''
        const parcalar = sk.split('.')
        let ebCarpan = 1
        for (let i = ymDepth; i < parcalar.length - 1; i++) {
          const ebk = parcalar.slice(0, i + 1).join('.')
          const eb = kirnoMap[ebk]
          if (eb?.tip === 'YarıMamul') ebCarpan *= (eb.miktar || 1)
        }
        const ymIht = (s.miktar || 1) * ebCarpan * netAdet
        const ymSt = Math.floor(getStok(ymalkod, stokHareketler))
        const ymIhtNet = Math.max(0, ymIht - ymSt)
        if (ymIhtNet > 0) {
          const z2 = { ...ziyaret, [ymalkod]: true }
          const alt2 = bomPatlaNet(ymalkod, ymIhtNet, derinlik + 1, z2, recipes, stokHareketler, materials)
          Object.keys(alt2).forEach(k => {
            if (!sonuc[k]) sonuc[k] = { ...alt2[k], miktar: 0 }
            sonuc[k].miktar += alt2[k].miktar
          })
        }
      })
      break
    }
    return sonuc
  }

  // Reçete var — kirno bazlı mı düz mü?
  const satirlar = rc.satirlar
  const isFlat = !satirlar.find(s => s.kirno)

  if (isFlat) {
    satirlar.forEach(s => {
      const malkod = s.malkod || ''; if (!malkod) return
      const tip = s.tip || 'Hammadde'
      const miktar = (s.miktar || 1) * netAdet
      if (tip === 'YarıMamul' && !ziyaret[malkod]) {
        const z2 = { ...ziyaret, [malkod]: true }
        const alt = bomPatlaNet(malkod, miktar, derinlik + 1, z2, recipes, stokHareketler, materials)
        Object.keys(alt).forEach(k => {
          if (k === malkod) return
          if (!sonuc[k]) sonuc[k] = { ...alt[k], miktar: 0 }
          sonuc[k].miktar += alt[k].miktar
        })
      } else {
        if (!sonuc[malkod]) sonuc[malkod] = { malkod, malad: s.malad || '', tip, birim: s.birim || 'Adet', miktar: 0 }
        sonuc[malkod].miktar += miktar
      }
    })
  } else {
    // Kirno bazlı — kaskad net ihtiyaç hesabı
    const kirnoMap: Record<string, typeof satirlar[0]> = {}
    satirlar.forEach(s => { kirnoMap[s.kirno || ''] = s })
    let minDepth = Infinity
    satirlar.forEach(s => { const d = (s.kirno || '1').split('.').length; if (d < minDepth) minDepth = d })

    satirlar.filter(s => s.tip === 'Hammadde' || s.tip === 'Sarf').forEach(s => {
      const sk = s.kirno || ''
      const malkod = s.malkod || ''; if (!malkod) return
      const parcalar = sk.split('.')

      // Kaskad net ihtiyaç hesabı — her YM seviyesinde stok düş
      const netIhtiyac: Record<string, number> = {}
      const kokKirno = parcalar.slice(0, minDepth).join('.')
      netIhtiyac[kokKirno] = netAdet

      for (let pi = minDepth; pi < parcalar.length; pi++) {
        const ustKirno = parcalar.slice(0, pi).join('.')
        const altKirno = parcalar.slice(0, pi + 1).join('.')
        const altSatir = kirnoMap[altKirno]
        if (!altSatir) continue
        const ustNet = netIhtiyac[ustKirno] !== undefined ? netIhtiyac[ustKirno] : netAdet
        const brutIht = ustNet * (altSatir.miktar || 1)
        if (altSatir.tip === 'YarıMamul') {
          const ymSt = Math.floor(getStok(altSatir.malkod || '', stokHareketler))
          netIhtiyac[altKirno] = Math.max(0, brutIht - ymSt)
        } else {
          netIhtiyac[altKirno] = brutIht
        }
      }

      const hmNet = netIhtiyac[sk] !== undefined ? netIhtiyac[sk] : (s.miktar || 1) * netAdet
      if (hmNet <= 0) return
      if (!sonuc[malkod]) sonuc[malkod] = { malkod, malad: s.malad || '', tip: s.tip || 'Hammadde', birim: s.birim || 'Adet', miktar: 0 }
      sonuc[malkod].miktar += hmNet
    })
  }

  return sonuc
}

// ═══ ANA MRP HESAPLAMA — v2 hesaplaMRP port'u ═══
export function hesaplaMRP(
  ordIds: string[] | null,
  orders: { id: string; adet: number; mamulKod: string; receteId: string; durum: string; termin?: string; urunler?: { mamulKod: string; adet: number; termin?: string }[] }[],
  workOrders: WorkOrder[],
  recipes: Recipe[],
  stokHareketler: StokHareket[],
  tedarikler: Tedarik[],
  cuttingPlans: { hamMalkod: string; hamMalad: string; durum: string; gerekliAdet: number; satirlar: any[] }[],
  materials: Material[],
  secilenYMIds?: Set<string> | null
): MRPRow[] {
  const brutIhtiyac: Record<string, { malkod: string; malad: string; tip: string; birim: string; brut: number; termin: string }> = {}

  // 1. Siparişlerin BOM patlatması
  const siparisler = ordIds === null
    ? orders.filter(o => o.durum !== 'Tamamlandı' && o.durum !== 'İptal')
    : orders.filter(o => ordIds.includes(o.id))

  for (const o of siparisler) {
    const urunler = o.urunler?.length ? o.urunler : [{ mamulKod: o.mamulKod, adet: o.adet }]
    for (const u of urunler) {
      if (!u.mamulKod || !u.adet) continue
      // Net adet: toplam sipariş - zaten üretilmiş
      const urunWOs = workOrders.filter(w =>
        w.orderId === o.id && (w.mamulKod === u.mamulKod || w.malkod === u.mamulKod) && !w.kirno?.includes('.')
      )
      const uretilen = urunWOs.reduce((a, w) => {
        const prod = stokHareketler.filter(h => h.woId === w.id).length > 0 ? 0 : 0 // simplify
        return a
      }, 0)
      // For now just use full adet (v2 uses wProd which needs logs)
      const netAdet = u.adet

      const urunTermin = (u as any).termin || o.termin || ''
      const p = bomPatlaNet(u.mamulKod, netAdet, 0, {}, recipes, stokHareketler, materials)
      Object.keys(p).forEach(k => {
        const v = p[k]
        if (!brutIhtiyac[k]) brutIhtiyac[k] = { malkod: k, malad: v.malad, tip: v.tip, birim: v.birim, brut: 0, termin: urunTermin }
        else if (urunTermin && (!brutIhtiyac[k].termin || urunTermin < brutIhtiyac[k].termin)) brutIhtiyac[k].termin = urunTermin
        brutIhtiyac[k].brut += v.miktar
      })
    }
  }

  // 2. Bağımsız YM İş Emirleri
  const ymIEs = workOrders.filter(w => {
    if (!w.bagimsiz || w.durum === 'iptal') return false
    if (secilenYMIds && !secilenYMIds.has(w.id)) return false
    return true
  })
  for (const w of ymIEs) {
    const kalan = w.hedef // simplified — ideally use logs to get actual remaining
    if (!kalan || !w.malkod) continue
    const wTermin = (w as any).termin || ''
    const p = bomPatlaNet(w.malkod, kalan, 0, {}, recipes, stokHareketler, materials)
    Object.keys(p).forEach(k => {
      if (k === w.malkod) return
      const v = p[k]
      if (!brutIhtiyac[k]) brutIhtiyac[k] = { malkod: k, malad: v.malad, tip: v.tip, birim: v.birim, brut: 0, termin: wTermin }
      else if (wTermin && (!brutIhtiyac[k].termin || wTermin < brutIhtiyac[k].termin)) brutIhtiyac[k].termin = wTermin
      brutIhtiyac[k].brut += v.miktar
    })
  }

  // 3. Brüt ihtiyaçları yuvarla
  Object.keys(brutIhtiyac).forEach(k => { brutIhtiyac[k].brut = Math.ceil(brutIhtiyac[k].brut) })

  // 4. KESİM PLANI OVERRIDE — v2 kritik özellik
  // Kesim planı varsa HM ihtiyacını BOM yerine gerçek bar sayısından al
  cuttingPlans.filter(p => p.durum !== 'tamamlandi').forEach(p => {
    const hmk = p.hamMalkod; if (!hmk) return
    const hmM = materials.find(m => m.kod === hmk)
    // YarıMamul ise atla — tedarik edilmez
    if (hmM?.tip === 'YarıMamul') return
    const planAdet = p.gerekliAdet || (p.satirlar || []).reduce((a: number, s: any) => a + (s.hamAdet || 0), 0)
    if (!planAdet) return
    if (!brutIhtiyac[hmk]) brutIhtiyac[hmk] = { malkod: hmk, malad: hmM?.ad || p.hamMalad || hmk, tip: hmM?.tip || 'Hammadde', birim: hmM?.birim || 'Adet', brut: 0, termin: '' }
    // Kesim planı gerçek bar sayısını gösterir — BOM'u override et
    brutIhtiyac[hmk].brut = planAdet
  })

  // 5. Stok ve açık tedarik hesabı
  const sonuc: MRPRow[] = []
  Object.keys(brutIhtiyac).forEach(k => {
    const bi = brutIhtiyac[k]
    const stok = getStok(k, stokHareketler)
    // TÜM açık tedarikler (v2 mantığı — sadece aynı sipariş değil)
    const acikTedarik = tedarikler
      .filter(t => t.malkod === k && !t.geldi)
      .reduce((a, t) => a + t.miktar, 0)
    const net = Math.max(0, Math.ceil(bi.brut - stok - acikTedarik))
    const durum: MRPRow['durum'] = (stok + acikTedarik) >= bi.brut ? 'yeterli' : net > 0 ? 'eksik' : 'yeterli'

    // YarıMamul filtreleme — üretilir, tedarik edilmez
    if (bi.tip === 'YarıMamul') return

    sonuc.push({ malkod: k, malad: bi.malad, tip: bi.tip, birim: bi.birim, brut: bi.brut, stok: Math.max(0, stok), acikTedarik, net, durum, termin: bi.termin || '' })
  })

  return sonuc.sort((a, b) => {
    const s: Record<string, number> = { yok: 0, eksik: 1, yeterli: 2 }
    const at = a.termin || '9999-99-99'; const bt = b.termin || '9999-99-99'
    if (at !== bt) return at.localeCompare(bt)
    return (s[a.durum] || 0) - (s[b.durum] || 0) || (a.malad || '').localeCompare(b.malad || '', 'tr')
  })
}

// ═══ BACKWARD COMPAT ═══
export async function mrpTedarikOlustur(
  orderId: string, siparisNo: string, mrpRows: MRPRow[]
): Promise<number> {
  const ihtiyaclar = mrpRows.filter(r => r.net > 0)
  if (!ihtiyaclar.length) return 0
  for (const r of ihtiyaclar) {
    await supabase.from('uys_tedarikler').insert({
      id: uid(), malkod: r.malkod, malad: r.malad, miktar: r.net, birim: r.birim,
      order_id: orderId, siparis_no: siparisNo,
      durum: 'bekliyor', geldi: false, tarih: today(), teslim_tarihi: r.termin || null, not_: 'MRP otomatik',
    })
  }
  // Siparisin mrp_durum'u 'tamam' olsun (MRP akisi kapandi)
  if (orderId) await supabase.from('uys_orders').update({ mrp_durum: 'tamam' }).eq('id', orderId)
  return ihtiyaclar.length
}
