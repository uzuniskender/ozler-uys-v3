import type { Recipe, StokHareket, Tedarik, WorkOrder, Material, MrpRezerve } from '@/types'
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
    // DEBUG: Derinlik 0'da bu kola girmemeli eğer reçete varsa
    if (derinlik === 0) console.log(`[MRP DEBUG] ${mamulKod} için RECETE BULUNAMADI, üst reçetelerden HM toplanıyor! rc=`, rc)
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
  secilenYMIds?: Set<string> | null,
  mrpRezerve?: MrpRezerve[],
  currentOrderId?: string
): MRPRow[] {
  // brutIhtiyac ANAHTARLARI case-insensitive (.trim().toLowerCase())
  // ama her kaydın .malkod field'ı orijinal case'de saklanır (final çıktıda kullanmak için)
  const brutIhtiyac: Record<string, { malkod: string; malad: string; tip: string; birim: string; brut: number; termin: string }> = {}

  // Kapsam için ordIdSet — hem sipariş filtresi hem bağımsız YM filtresi hem cutting plan kapsamı kullanır
  const ordIdSet = ordIds ? new Set(ordIds) : null

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
      // DEBUG — bomPatlaNet ne çıkarmış?
      console.log(`[MRP DEBUG] Sipariş ${o.id} kalem ${u.mamulKod} x${netAdet} → BOM sonuç:`, Object.keys(p).length, 'malzeme:', Object.keys(p))
      Object.keys(p).forEach(k => {
        const v = p[k]
        const key = (k || '').trim().toLowerCase()
        if (!brutIhtiyac[key]) brutIhtiyac[key] = { malkod: k, malad: v.malad, tip: v.tip, birim: v.birim, brut: 0, termin: urunTermin }
        else if (urunTermin && (!brutIhtiyac[key].termin || urunTermin < brutIhtiyac[key].termin)) brutIhtiyac[key].termin = urunTermin
        brutIhtiyac[key].brut += v.miktar
      })
    }
  }

  // 2. Bağımsız YM İş Emirleri — KAPSAM FİLTRESİ: sipariş seçildiyse sadece o siparişlerin bağımsız YM'leri
  const ymIEs = workOrders.filter(w => {
    if (!w.bagimsiz || w.durum === 'iptal') return false
    if (secilenYMIds && !secilenYMIds.has(w.id)) return false
    // Sipariş seçildiyse: sadece o siparişlerle bağlantılı bağımsız YM'ler (orderId eşleşmeli)
    if (ordIdSet) {
      if (!w.orderId || !ordIdSet.has(w.orderId)) return false
    }
    return true
  })
  console.log('[MRP DEBUG] Bağımsız YM İE sayısı:', ymIEs.length, '| IDs:', ymIEs.map(w => w.id))
  for (const w of ymIEs) {
    const kalan = w.hedef // simplified — ideally use logs to get actual remaining
    if (!kalan || !w.malkod) continue
    const wTermin = (w as any).termin || ''
    const p = bomPatlaNet(w.malkod, kalan, 0, {}, recipes, stokHareketler, materials)
    console.log('[MRP DEBUG] Bağımsız YM İE', w.id, w.malkod, 'x', kalan, '→ BOM:', Object.keys(p).length, 'malzeme:', Object.keys(p))
    Object.keys(p).forEach(k => {
      if (k === w.malkod) return
      const v = p[k]
      const key = (k || '').trim().toLowerCase()
      if (!brutIhtiyac[key]) brutIhtiyac[key] = { malkod: k, malad: v.malad, tip: v.tip, birim: v.birim, brut: 0, termin: wTermin }
      else if (wTermin && (!brutIhtiyac[key].termin || wTermin < brutIhtiyac[key].termin)) brutIhtiyac[key].termin = wTermin
      brutIhtiyac[key].brut += v.miktar
    })
  }

  // 3. Brüt ihtiyaçları yuvarla
  Object.keys(brutIhtiyac).forEach(k => { brutIhtiyac[k].brut = Math.ceil(brutIhtiyac[k].brut) })

  // 4. KESİM PLANI OVERRIDE — v2 kritik özellik (şema: p.satirlar[].kesimler[].woId)
  // Kesim planı varsa HM ihtiyacını BOM yerine gerçek bar sayısından al.
  // KAPSAM FİLTRESİ: ordIds verilmişse, sadece o siparişlere ait kesimlerin
  // hamAdet payını topla (satır paylaşımlı ise kesim adet oranıyla böl).
  const secilenWoIds = ordIdSet
    ? new Set(workOrders.filter(w => ordIdSet.has(w.orderId)).map(w => w.id))
    : null
  console.log('[MRP DEBUG] Kapsam filtre:', { ordIds, toplamCuttingPlan: cuttingPlans.length, secilenWoIds: secilenWoIds ? [...secilenWoIds] : null })
  cuttingPlans.filter(p => p.durum !== 'tamamlandi').forEach(p => {
    const hmk = p.hamMalkod; if (!hmk) return
    const hmM = materials.find(m => m.kod === hmk)
    // YarıMamul ise atla — tedarik edilmez
    if (hmM?.tip === 'YarıMamul') return

    let planAdet: number

    if (secilenWoIds) {
      // Seçili siparişlerin kesimlerine düşen hamAdet payını topla
      let toplamPay = 0
      for (const s of (p.satirlar || [])) {
        const kesimler: any[] = (s as any).kesimler || []
        const toplamKesimAdet = kesimler.reduce((a, k) => a + (k.adet || 0), 0)
        if (toplamKesimAdet === 0) continue
        const kapsamKesimAdet = kesimler
          .filter(k => k.woId && secilenWoIds.has(k.woId))
          .reduce((a, k) => a + (k.adet || 0), 0)
        if (kapsamKesimAdet === 0) continue
        toplamPay += ((s as any).hamAdet || 0) * (kapsamKesimAdet / toplamKesimAdet)
      }
      planAdet = Math.ceil(toplamPay)
      console.log('[MRP DEBUG] Plan:', hmk, '| kapsam pay:', toplamPay.toFixed(3), '→ planAdet:', planAdet)
      if (planAdet <= 0) return // Bu plan seçili siparişlerle ilgisiz
    } else {
      // Genel hesap (ordIds=null): planın tamamı
      planAdet = p.gerekliAdet || (p.satirlar || []).reduce((a: number, s: any) => a + (s.hamAdet || 0), 0)
      if (!planAdet) return
      console.log('[MRP DEBUG] Plan:', hmk, '| genel → planAdet:', planAdet)
    }

    console.log('[MRP DEBUG] Cutting override EKLENDİ:', hmk, 'brut:', planAdet)
    const key = (hmk || '').trim().toLowerCase()
    if (!brutIhtiyac[key]) brutIhtiyac[key] = { malkod: hmk, malad: hmM?.ad || p.hamMalad || hmk, tip: hmM?.tip || 'Hammadde', birim: hmM?.birim || 'Adet', brut: 0, termin: '' }
    // Kesim planı gerçek bar sayısını gösterir — BOM'u override et
    brutIhtiyac[key].brut = planAdet
  })

  // 5. Stok ve açık tedarik hesabı
  const sonuc: MRPRow[] = []
  Object.keys(brutIhtiyac).forEach(k => {
    const bi = brutIhtiyac[k]
    // Stok sorguları orijinal malkod ile (stok hareketleri kart kodunu birebir tutar)
    const fizikselStok = getStok(bi.malkod, stokHareketler)
    // Başka siparişlerin rezervesini düş (kendi siparişin hariç) — case-insensitive malkod eşleşmesi
    const kLower = (bi.malkod || '').trim().toLowerCase()
    const baskaRezerve = (mrpRezerve || [])
      .filter(r => (r.malkod || '').trim().toLowerCase() === kLower && r.orderId !== currentOrderId)
      .reduce((a, r) => a + r.miktar, 0)
    const stok = Math.max(0, fizikselStok - baskaRezerve)
    // TÜM açık tedarikler (v2 mantığı — sadece aynı sipariş değil) — case-insensitive
    const acikTedarik = tedarikler
      .filter(t => (t.malkod || '').trim().toLowerCase() === kLower && !t.geldi)
      .reduce((a, t) => a + t.miktar, 0)
    const net = Math.max(0, Math.ceil(bi.brut - stok - acikTedarik))
    const durum: MRPRow['durum'] = (stok + acikTedarik) >= bi.brut ? 'yeterli' : net > 0 ? 'eksik' : 'yeterli'

    // YarıMamul filtreleme — üretilir, tedarik edilmez
    if (bi.tip === 'YarıMamul') return

    sonuc.push({ malkod: bi.malkod, malad: bi.malad, tip: bi.tip, birim: bi.birim, brut: bi.brut, stok: Math.max(0, stok), acikTedarik, net, durum, termin: bi.termin || '' })
  })

  console.log('[MRP DEBUG] FINAL brütIhtiyac keys:', Object.keys(brutIhtiyac).length, '| sonuç satır:', sonuc.length, '| mallar:', Object.values(brutIhtiyac).map(b => b.malkod))

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

// ═══ MRP REZERVE YAZMA — Faz B Parça 2C ═══
// MRP hesabından sonra ilgili siparişe ait rezervasyon kayıtları oluşturur.
// Önce o siparişin eski rezervasyonlarını siler, sonra yeni kayıtları yazar.
// Rezerve sadece MRP hesabında 'kullanılabilir stok' düşümü için kullanılır;
// fiziksel stok kullanımında (üretim/çıkış) dikkate alınmaz.
export async function rezerveYaz(
  orderId: string,
  mrpRows: MRPRow[]
): Promise<number> {
  if (!orderId) return 0
  // Eski rezervasyonları sil (sipariş revize olabilir, yeni hesap yapıldı)
  await supabase.from('uys_mrp_rezerve').delete().eq('order_id', orderId)
  // Brüt > 0 ve stok var (net eksik olsa bile, stok kadar rezerve edilmeli)
  // Rezerve miktarı = min(brüt, fiziksel stok) — gerçekten ayrılabilecek miktar
  // Case-insensitive gruplama: aynı malzeme farklı yazılmışsa tek kayıtta topla
  const grupMap: Record<string, { malkod: string; malad: string; miktar: number; birim: string }> = {}
  mrpRows
    .filter(r => r.brut > 0 && r.stok > 0)
    .forEach(r => {
      const key = (r.malkod || '').trim().toLowerCase()
      if (!grupMap[key]) {
        grupMap[key] = { malkod: r.malkod, malad: r.malad, miktar: 0, birim: r.birim }
      }
      grupMap[key].miktar += Math.min(r.brut, r.stok)
    })
  const rezerveler = Object.values(grupMap).map(g => ({
    id: uid(),
    order_id: orderId,
    malkod: g.malkod,
    malad: g.malad,
    miktar: g.miktar,
    birim: g.birim,
    tarih: today(),
  }))
  if (!rezerveler.length) return 0
  await supabase.from('uys_mrp_rezerve').insert(rezerveler)
  return rezerveler.length
}

// Bir siparişe ait tüm rezerveleri siler
// (sipariş iptal/revize/üretim tamamlandığında çağrılır)
export async function rezerveSil(orderId: string): Promise<void> {
  if (!orderId) return
  await supabase.from('uys_mrp_rezerve').delete().eq('order_id', orderId)
}

// ═══ TÜM AKTİF SİPARİŞLER İÇİN REZERVE SENKRONİZASYONU — Faz B Parça 2B+2C ═══
// TERMİN-FIFO ALOKASYON:
// 1. Aktif siparişleri termine göre sıralar (erken termin önce)
// 2. Her siparişin MRP'sini sırayla hesaplar — önceki siparişlerin rezervesi kullanılabilir stoktan düşülmüş olarak
// 3. Her siparişin rezervesini min(brut, kullanılabilir_stok) olarak yazar
// 4. Kalan stok sonraki siparişlere bırakılır
//
// Bu fonksiyon şu durumlarda çağrılmalı (UI tetikleyicilerinden):
//   - Sipariş oluşturma/revize/silme/kapatma
//   - Tedarik geldi=true işaretlenmesi
//   - Stok hareketi (manuel giriş/çıkış)
export async function rezerveleriSenkronla(
  orders: any[],
  workOrders: WorkOrder[],
  recipes: Recipe[],
  stokHareketler: StokHareket[],
  tedarikler: Tedarik[],
  cuttingPlans: { hamMalkod: string; hamMalad: string; durum: string; gerekliAdet: number; satirlar: any[] }[],
  materials: Material[],
): Promise<{ siparisSayisi: number; rezerveSayisi: number }> {
  // 1. Aktif siparişler — iptal/tamamlandı hariç
  const aktif = orders
    .filter((o: any) => o.durum !== 'İptal' && o.durum !== 'Tamamlandı')
    .slice()
    .sort((a: any, b: any) => {
      // Termine göre FIFO — erken termin önce
      const at = a.termin || '9999-99-99'
      const bt = b.termin || '9999-99-99'
      if (at !== bt) return at.localeCompare(bt)
      // Aynı termin: önce oluşturulan önce (ikincil FIFO)
      return (a.olusturma || '').localeCompare(b.olusturma || '')
    })

  console.log('[REZERVE SYNC] Aktif sipariş sayısı:', aktif.length, '| Sıra:', aktif.map((o: any) => ({ id: o.id, siparisNo: o.siparisNo, termin: o.termin })))

  // 2. Sıralı işleme — önceki siparişlerin yeni rezervesi sonrakinin hesabına girer
  const guncelRezerveler: MrpRezerve[] = []
  let toplamRezerve = 0

  for (const o of aktif) {
    // Bu sipariş için MRP — önceki rezerveler dahil, kendisi hariç
    const satirlar = hesaplaMRP(
      [o.id],
      aktif,
      workOrders,
      recipes,
      stokHareketler,
      tedarikler,
      cuttingPlans,
      materials,
      null,
      guncelRezerveler,
      o.id,
    )

    // Eski rezerveyi sil + yeni yaz
    const sayi = await rezerveYaz(o.id, satirlar)
    toplamRezerve += sayi

    // Bu siparişin yeni rezervelerini guncelRezerveler'e ekle (sonraki siparişler için)
    satirlar
      .filter(r => r.brut > 0 && r.stok > 0)
      .forEach(r => {
        guncelRezerveler.push({
          id: '',
          orderId: o.id,
          malkod: r.malkod,
          malad: r.malad,
          miktar: Math.min(r.brut, r.stok),
          birim: r.birim,
          mrpRunId: '',
          tarih: today(),
        } as MrpRezerve)
      })
  }

  console.log('[REZERVE SYNC] ✓ Tamamlandı. Sipariş:', aktif.length, '| Toplam rezerve kaydı:', toplamRezerve)
  return { siparisSayisi: aktif.length, rezerveSayisi: toplamRezerve }
}
