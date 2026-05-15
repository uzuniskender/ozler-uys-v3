import { isWorkOrderOpen } from '@/lib/statusUtils'
import type { Recipe, StokHareket, Tedarik, WorkOrder, Material, MrpRezerve } from '@/types'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
// v16.31 (IE #14 Faz A Slice 2) — cache-aware wrapper bagimliliklari
import {
  getMrpCacheGlobal,
  setMrpCacheGlobal,
  getMrpCacheOrder,
  setMrpCacheOrder,
} from './mrpCache'

// ═══ DEBUG ═══
// localStorage.setItem('UYS_DEBUG_MRP', 'true') ile canlı aç, ?debug=mrp URL param'ı ile de aç
// Normal kullanımda false — sorun varsa localStorage flag aç, consolda izle
const DEBUG_MRP = typeof window !== 'undefined' && (
  (typeof localStorage !== 'undefined' && localStorage.getItem('UYS_DEBUG_MRP') === 'true') ||
  (typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'mrp')
)
const dbg = (...args: any[]) => { if (DEBUG_MRP) console.log(...args) }

export interface MRPRow {
  malkod: string; malad: string; tip: string; birim: string
  brut: number; stok: number; rezerve: number; acikTedarik: number; net: number
  durum: 'yeterli' | 'eksik' | 'yok'
  termin: string
  artik?: boolean
}

// ═══ STOK HESAPLA ═══
// Serbest stok = giris - cikis - rezerv
// 'bar_acilis' → çıkış gibi sayılır (hammadde kullanıma açıldı)
// 'rezerv' → serbest stoktan düşülür ama fiziksel çıkış değil
// getStok → merkezi kaynak: hammaddeHesap.ts
export { getStok, getYolda } from '@/lib/hammaddeHesap'

// Rezerve toplam (hangi siparişe ne kadar rezerve edilmiş)
export function getRezervDetay(malkod: string, stokHareketler: StokHareket[]): { orderId: string; miktar: number }[] {
  const map = new Map<string, number>()
  stokHareketler
    .filter(h => h.malkod === malkod && h.tip === 'rezerv' && h.rezervOrderId)
    .forEach(h => {
      const key = h.rezervOrderId!
      map.set(key, (map.get(key) || 0) + h.miktar)
    })
  return Array.from(map.entries()).map(([orderId, miktar]) => ({ orderId, miktar }))
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
  const rc = recipes.find(r => r.mamulKod?.toLowerCase().trim() === mamulKod?.toLowerCase().trim())
  if (!rc?.satirlar?.length) {
    // DEBUG: Derinlik 0'da bu kola girmemeli eğer reçete varsa
    if (derinlik === 0) dbg(`[MRP DEBUG] ${mamulKod} için RECETE BULUNAMADI, üst reçetelerden HM toplanıyor! rc=`, rc)
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
          if (eb?.tip === 'YarıMamul') ebCarpan *= (eb.miktar ?? 1)
        }
        const tm = (s.miktar ?? 1) * ebCarpan * netAdet
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
          if (eb?.tip === 'YarıMamul') ebCarpan *= (eb.miktar ?? 1)
        }
        const ymIht = (s.miktar ?? 1) * ebCarpan * netAdet
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
      const miktar = (s.miktar ?? 1) * netAdet
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
        const brutIht = ustNet * (altSatir.miktar ?? 1)
        if (altSatir.tip === 'YarıMamul') {
          const ymSt = Math.floor(getStok(altSatir.malkod || '', stokHareketler))
          netIhtiyac[altKirno] = Math.max(0, brutIht - ymSt)
        } else {
          netIhtiyac[altKirno] = brutIht
        }
      }

      const hmNet = netIhtiyac[sk] !== undefined ? netIhtiyac[sk] : (s.miktar ?? 1) * netAdet
      if (hmNet <= 0) return
      if (!sonuc[malkod]) sonuc[malkod] = { malkod, malad: s.malad || '', tip: s.tip || 'Hammadde', birim: s.birim || 'Adet', miktar: 0 }
      sonuc[malkod].miktar += hmNet
    })
  }

  return sonuc
}

// ═══ ANA MRP HESAPLAMA — v2 hesaplaMRP port'u ═══
// v15.81 — logs parametresi eklendi (saha bug fix).
// Önceden 'uretilen=0' hardcode'du → tamamlanmış WO'lar bile hammadde "ihtiyacı" üretiyordu.
// (Bilgi Bankası §25). Yeni: kalan = max(0, hedef - log toplam). logs verilmezse eski davranış.

// ─── hesaplaMRP Parametre Interface ──────────────────────────────────────────
export interface HesaplaMRPParams {
  ordIds: string[] | null
  orders: { id: string; adet: number; mamulKod: string; receteId: string; durum: string; termin?: string; urunler?: { mamulKod: string; adet: number; termin?: string }[] }[]
  workOrders: WorkOrder[]
  recipes: Recipe[]
  stokHareketler: StokHareket[]
  tedarikler: Tedarik[]
  cuttingPlans: { hamMalkod: string; hamMalad: string; durum: string; gerekliAdet: number; satirlar: any[] }[]
  materials: Material[]
  secilenYMIds?: Set<string> | null
  mrpRezerve?: MrpRezerve[]
  currentOrderId?: string
  logs?: { woId: string; qty: number }[]
  retrospektif?: boolean
}

export function hesaplaMRP(
  ordIds: string[] | null,
  orders: HesaplaMRPParams['orders'],
  workOrders: WorkOrder[],
  recipes: Recipe[],
  stokHareketler: StokHareket[],
  tedarikler: Tedarik[],
  cuttingPlans: HesaplaMRPParams['cuttingPlans'],
  materials: Material[],
  secilenYMIds?: Set<string> | null,
  mrpRezerve?: MrpRezerve[],
  currentOrderId?: string,
  logs?: { woId: string; qty: number }[],
  retrospektif?: boolean
): MRPRow[] {
  // brutIhtiyac ANAHTARLARI case-insensitive (.trim().toLowerCase())
  // ama her kaydın .malkod field'ı orijinal case'de saklanır (final çıktıda kullanmak için)
  const brutIhtiyac: Record<string, { malkod: string; malad: string; tip: string; birim: string; brut: number; termin: string }> = {}

  // Kapsam için ordIdSet — hem sipariş filtresi hem bağımsız YM filtresi hem cutting plan kapsamı kullanır
  // v15.35.3: Boş array (ordIds=[]) kapsam filtresi olmadığı anlamına gelir — yalnızca YM seçilip sipariş seçilmediği durum için
  const ordIdSet = (ordIds && ordIds.length > 0) ? new Set(ordIds) : null

  // 1. Siparişlerin BOM patlatması
  // ordIds=null → tüm aktif (genel mod, rezerveleriSenkronla)
  // ordIds=[] → hiç sipariş (kullanıcı sadece YM seçti)
  // ordIds=[a,b] → seçili siparişler
  const siparisler = ordIds === null
    ? orders.filter(o => o.durum !== 'Tamamlandı' && o.durum !== 'İptal')
    : orders.filter(o => ordIds.includes(o.id))

  for (const o of siparisler) {
    const urunler = o.urunler?.length ? o.urunler : [{ mamulKod: o.mamulKod, adet: o.adet }]
    for (const u of urunler) {
      if (!u.mamulKod || !u.adet) continue

      // v15.81 — Bu kalemin üretilen miktarını hesapla.
      // Eski kod: prod=0 hardcode (yorum: "v2 uses wProd which needs logs").
      // Yeni: WO'nun mamul kodu ile eşleşen logların qty toplamı.
      const urunWOs = workOrders.filter(w =>
        w.orderId === o.id && (w.mamulKod === u.mamulKod || w.malkod === u.mamulKod) && !w.kirno?.includes('.')
      )
      const uretilen = logs
        ? urunWOs.reduce((a, w) => a + logs.filter(l => l.woId === w.id).reduce((b, l) => b + (l.qty || 0), 0), 0)
        : 0  // logs verilmezse eski davranış (geriye uyum)

      // Net adet: toplam sipariş - üretilmiş (mpm yok burada — siparis düzeyinde hedef)
      // Not: WO hedef = adet × mpm; üretilen de mpm cinsinden. Karşılaştırma için
      // adet düzeyine indirgemek lazım. Basit yaklaşım: ürünün toplam WO hedefini
      // referans al, oran hesapla.
      let netAdet = u.adet
      if (logs && uretilen > 0) {
        const toplamHedef = urunWOs.reduce((a, w) => a + (w.hedef || 0), 0)
        if (toplamHedef > 0) {
          // İlerleme oranı: uretilen / toplamHedef
          const oran = Math.min(1, uretilen / toplamHedef)
          netAdet = Math.max(0, Math.ceil(u.adet * (1 - oran)))
        }
      }
      if (netAdet === 0 && !retrospektif) continue  // Bu ürün tamamen üretilmiş, BOM patlatmaya gerek yok
      if (netAdet === 0 && retrospektif) netAdet = u.adet  // Retrospektif: toplam ihtiyacı göster

      const urunTermin = (u as any).termin || o.termin || ''
      const p = bomPatlaNet(u.mamulKod, netAdet, 0, {}, recipes, stokHareketler, materials)
      // DEBUG — bomPatlaNet ne çıkarmış?
      dbg(`[MRP DEBUG] Sipariş ${o.id} kalem ${u.mamulKod} x${netAdet} (asıl ${u.adet}, üretildi ${uretilen}) → BOM:`, Object.keys(p).length)
      Object.keys(p).forEach(k => {
        const v = p[k]
        const key = (k || '').trim().toLowerCase()
        // v15.50a — Faz B P2: termin gruplama. Aynı malkod farklı terminler ayrı satır.
        const grupKey = key + '__' + (urunTermin || '')
        if (!brutIhtiyac[grupKey]) brutIhtiyac[grupKey] = { malkod: k, malad: v.malad, tip: v.tip, birim: v.birim, brut: 0, termin: urunTermin }
        brutIhtiyac[grupKey].brut += v.miktar
      })
    }
  }

  // 2. Bağımsız YM + Sipariş Dışı İş Emirleri
  // v15.35.3: siparisDisi bayrağı da kapsama dahil (manuel kesim İE'leri hammadde ihtiyacı çıkarsın)
  // v15.78: secilenYMIds explicit seçim → ordIdSet'i bypass eder.
  // v15.81: Tamamlanmış WO'lar atlanır (saha bug fix — saha 7 IE-MANUAL tamamlandı durumda
  //         hammadde ihtiyacı üretiyordu çünkü 'uretilen=0' hardcode'du, iptal/tamamlandi filtresi yoktu).
  const ymIEs = workOrders.filter(w => {
    if (!w.bagimsiz && !w.siparisDisi) return false
    if (!isWorkOrderOpen(w)) return false  // v15.81 — tamamlandi eklendi
    // Explicit YM seçimi varsa override: sadece set içindekiler dahil, ordIdSet bypass.
    if (secilenYMIds) return secilenYMIds.has(w.id)
    // Explicit seçim yok → sipariş kapsamına bak
    if (ordIdSet) {
      if (!w.orderId || !ordIdSet.has(w.orderId)) return false
    }
    return true
  })
  dbg('[MRP DEBUG] Bağımsız/SiparisDisi YM İE sayısı:', ymIEs.length, '| IDs:', ymIEs.map(w => w.id))
  for (const w of ymIEs) {
    // v15.81 — Log bazlı kalan hesabı (eski kod: 'uretilen=0' hardcode'du).
    const uretilen = logs
      ? logs.filter(l => l.woId === w.id).reduce((a, l) => a + (l.qty || 0), 0)
      : 0
    const kalan = retrospektif ? w.hedef : Math.max(0, w.hedef - uretilen)
    if ((!kalan && !retrospektif) || !w.malkod) continue
    const wTermin = (w as any).termin || ''
    const p = bomPatlaNet(w.malkod, kalan, 0, {}, recipes, stokHareketler, materials)
    dbg('[MRP DEBUG] İE', w.id, w.ieNo, w.malkod, 'kalan:', kalan, '(hedef', w.hedef, '- üretildi', uretilen, ')', '→ BOM:', Object.keys(p).length)
    Object.keys(p).forEach(k => {
      if (k === w.malkod) return
      const v = p[k]
      const key = (k || '').trim().toLowerCase()
      // v15.50a — Faz B P2: termin gruplama (bağımsız/sipariş dışı İE)
      const grupKey = key + '__' + (wTermin || '')
      if (!brutIhtiyac[grupKey]) brutIhtiyac[grupKey] = { malkod: k, malad: v.malad, tip: v.tip, birim: v.birim, brut: 0, termin: wTermin }
      brutIhtiyac[grupKey].brut += v.miktar
    })
  }

  // 2b. Siparişe bağlı WO'ların w.hm alanından ek hammadde ihtiyacı
  // Bazı WO'lar (örn. plywood kesim) siparişe bağlı ama mamulün kök reçetesinde yok.
  // Bu WO'ların `hm` alanında gerçek hammadde listesi var — bunu da hesaba kat.
  const secilenOrdIds = ordIdSet
  // Sadece mamul kodu BOM'da (reçetede) OLMAYAN WO'lar — PLY gibi reçete yolu dışındakiler
  // BOM'dan zaten hesaplananları tekrar ekleme (çift sayım önleme)
  const bomHesaplananMalkodlar = new Set(siparisler.map(o => {
    const urunler = o.urunler?.length ? o.urunler : [{ mamulKod: o.mamulKod }]
    return urunler.map(u => u.mamulKod)
  }).flat())
  
  const hmWOs = workOrders.filter(w => {
    if (!w.orderId) return false
    if (secilenOrdIds && !secilenOrdIds.has(w.orderId)) return false
    if (!secilenOrdIds && ordIds !== null) return false  // genel mod değil
    if (!isWorkOrderOpen(w) || w.durum === 'kismi_tamam') return false
    if (!w.hm || !(w.hm as any[]).length) return false
    const rc = recipes.find(r => r.mamulKod === w.malkod)
    if (!rc) return true  // Reçetesi yok → hm'den hesapla (PLY gibi)
    // v16.71 — Kesim WO + kesim planına dahil değilse → hm'den hesapla.
    // BOM YM stokunu görüp netAdet=0 yapabilir; kesim planı olmayan WO
    // gerçekte hammadde keseceği için hm'den hesaplanmalı.
    const KESIM_KW = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH', 'ROUTER']
    const isKesim = KESIM_KW.some(k => (w.opAd || '').toUpperCase().includes(k))
    if (isKesim) {
      const planliIds = new Set(
        cuttingPlans
          .filter(p => (p.durum || '').toLowerCase() !== 'iptal')
          .flatMap(p => (p.satirlar || []).flatMap((s: any) =>
            (s.kesimler || []).map((k: any) => k.woId)
          ))
          .filter(Boolean)
      )
      if (!planliIds.has(w.id)) return true  // Kesim planı yok → hm kullan
    }
    // Reçetesi var + kesim planı var → BOM zaten hesapladı, atla
    return false
  })
  for (const w of hmWOs) {
    const uretilen = logs ? logs.filter(l => l.woId === w.id).reduce((a, l) => a + (l.qty || 0), 0) : 0
    const kalan = Math.max(0, (w.hedef || 0) - uretilen)
    if (!kalan) continue
    const wTermin = (w as any).termin || ''
    for (const hm of (w.hm as any[])) {
      const hmkod: string = hm.malkod || ''; if (!hmkod) continue
      const hmMiktar: number = hm.miktarTotal || hm.miktar || 0; if (!hmMiktar) continue
      const hmM = materials.find(m => m.kod === hmkod)
      if (!hmM || hmM.tip === 'YarıMamul') continue  // YM değil, hammadde/sarf olmalı
      // BOM patlamasından bu hammadde zaten geldiyse ekleme
      const key = hmkod.trim().toLowerCase() + '__' + wTermin
      const ihtiyac = hmMiktar * (kalan / (w.hedef || 1))  // miktarTotal zaten hedef için toplam
      if (!brutIhtiyac[key]) {
        brutIhtiyac[key] = { malkod: hmkod, malad: hmM.ad || hm.malad || hmkod, tip: hmM.tip || 'Hammadde', birim: hmM.birim || 'Adet', brut: 0, termin: wTermin }
      }
      brutIhtiyac[key].brut += ihtiyac
      dbg('[MRP DEBUG] WO hm ek ihtiyaç:', w.ieNo, hmkod, '+', ihtiyac)
    }
  }

  // 3. Brüt ihtiyaçları yuvarla
  Object.keys(brutIhtiyac).forEach(k => { brutIhtiyac[k].brut = Math.ceil(brutIhtiyac[k].brut) })

  // 4. KESİM PLANI OVERRIDE — v2 kritik özellik (şema: p.satirlar[].kesimler[].woId)
  // Kesim planı varsa HM ihtiyacını BOM yerine gerçek bar sayısından al.
  // KAPSAM FİLTRESİ: ordIds verilmişse, sadece o siparişlere ait kesimlerin
  // hamAdet payını topla (satır paylaşımlı ise kesim adet oranıyla böl).
  // FIX v16.46: ordIds=[] + secilenYMIds varsa (YM-only mod) cutting plan kapsamını
  // secilenYMIds'deki WO'larla sınırlandır. Eski: null → "genel mod" → alakasız tüm
  // kesim planları brutIhtiyac'a ekleniyordu.
  const secilenWoIds = ordIdSet
    ? new Set(workOrders.filter(w => ordIdSet.has(w.orderId)).map(w => w.id))
    : secilenYMIds ?? null
  dbg('[MRP DEBUG] Kapsam filtre:', { ordIds, toplamCuttingPlan: cuttingPlans.length, secilenWoIds: secilenWoIds ? [...secilenWoIds] : null })
  cuttingPlans.filter(p => p.durum !== 'tamamlandi').forEach(p => {
    const hmk = p.hamMalkod; if (!hmk) return
    const hmM = materials.find(m => m.kod === hmk)
    // YarıMamul ise atla — tedarik edilmez
    if (hmM?.tip === 'YarıMamul') return
    // v16.02 — LEVHA (yüzey kesim) için override yapma. boykesimOptimum 1D bin-packing
    // yapıyor (sadece parcaBoy), levha gibi 2D malzemelerde plan adedi gerçek ihtiyacın
    // çok altında çıkıyor (örn: 877×2677 plywood için 100 lazımken plan ~34 yazıyor →
    // BOM'un 100'ü silinip 34 yazılıyor → MRP "yeterli" diyor → tedarik açılmıyor).
    // Çözüm: levha tipi için BOM ihtiyacını koru, plan adedi güvenilmez. Profil/boru
    // (1D) için override aktif kalır. Backlog #21'de gerçek 2D bin-packing yazılınca
    // bu kontrol kaldırılabilir. Saha vakası: 30 Nis 2026 S26A_03150 plywood 131 eksik
    // sistem tarafından "yok" sayılıyordu (Bilgi Bankası §27).
    if ((hmM as any)?.hammaddeTipi === 'LEVHA') {
      dbg('[MRP DEBUG] Cutting override skip (LEVHA - yüzey kesim, 1D plan güvenilmez):', hmk)
      return
    }

    let planAdet: number

    if (secilenWoIds) {
      // Seçili siparişlerin kesimlerine düşen hamAdet payını topla
      // v15.35: havuz barlarından (havuzBarId taşıyan satırlar) yeni sipariş gerekmez → dahil etme
      let toplamPay = 0
      for (const s of (p.satirlar || [])) {
        if ((s as any).havuzBarId) continue
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
      dbg('[MRP DEBUG] Plan:', hmk, '| kapsam pay:', toplamPay.toFixed(3), '→ planAdet:', planAdet)
      if (planAdet <= 0) return // Bu plan seçili siparişlerle ilgisiz
    } else {
      // Genel hesap (ordIds=null): planın tamamı — havuz satırları hariç
      // v15.35: gerekliAdet'e güvenmek yerine satırlardan hesapla, havuz satırlarını filtrele
      planAdet = (p.satirlar || [])
        .filter((s: any) => !s.havuzBarId)
        .reduce((a: number, s: any) => a + (s.hamAdet || 0), 0)
      if (!planAdet) return
      dbg('[MRP DEBUG] Plan:', hmk, '| genel → planAdet:', planAdet, '(havuz satırları hariç)')
    }

    dbg('[MRP DEBUG] Cutting override EKLENDİ:', hmk, 'brut:', planAdet)
    const malkodLower = (hmk || '').trim().toLowerCase()

    // v15.50a — Faz B P2: cutting plan override termin gruplama uyumlu.
    // Plan'a düşen kesimlerin İE'lerinin EN ERKEN termini plan termini sayılır (FIFO).
    // BOM'dan bu malkoda eklenen TÜM termin gruplarını sil — plan tek satırda override eder.
    const planWoIds = new Set<string>()
    for (const s of (p.satirlar || [])) {
      for (const k of ((s as any).kesimler || [])) {
        if (k.woId) planWoIds.add(k.woId)
      }
    }
    const planTermin = workOrders
      .filter(w => planWoIds.has(w.id) && (w as any).termin)
      .map(w => (w as any).termin as string)
      .sort()[0] || ''

    // v16.07 — KÖK ÇÖZÜM: BOM toplamı kazanmalıdır eğer plan stoğa kalibre
    // ise (saha vakası: 30 Nis 4 ihlal, sentinel #16). Eski mantık plan'ı
    // override ediyordu → BOM eksiği yutuyordu. Yeni: max(BOM, plan).
    // Plan > BOM ise plan kazanır (havuz/artık optimize eden vakalar).
    let bomToplam = 0
    Object.keys(brutIhtiyac).forEach(bk => {
      if (bk.startsWith(malkodLower + '__')) {
        bomToplam += brutIhtiyac[bk].brut
        delete brutIhtiyac[bk]
      }
    })
    const finalBrut = Math.max(planAdet, bomToplam)
    dbg('[MRP DEBUG] v16.07 max(BOM,plan):', hmk, 'BOM:', bomToplam, 'plan:', planAdet, '=>', finalBrut)
    dbg('[MRP v16.11] Cutting override karari:', { malkod: hmk, planAdet, bomToplam, finalBrut, stok: getStok(hmk, stokHareketler) })

    // Plan termini ile tek satır olarak ekle
    const grupKey = malkodLower + '__' + planTermin
    brutIhtiyac[grupKey] = { malkod: hmk, malad: hmM?.ad || p.hamMalad || hmk, tip: hmM?.tip || 'Hammadde', birim: hmM?.birim || 'Adet', brut: finalBrut, termin: planTermin }
  })

  // 5. Stok ve açık tedarik hesabı — v15.63: Buket'in net formülü
  //    NET İHTİYAÇ = BRÜT − STOK − YOLDA GELEN
  // Rezerve mantığı KALDIRILDI: stokPool artık fiziksel stok'tan rezerve düşmüyor.
  // (mrpRezerve parametresi geriye uyumluluk için kalır ama kullanılmaz; rezerveYaz
  // çağrıları çalışmaya devam eder — ölü kayıt, ileride temizlenir.)
  //
  // Sebep: Önceki implementasyon "diğer siparişlerin rezervesini" stoktan düşüyordu.
  // Bu kullanıcının net formülünden sapma — örnek: 208 stok + 207 ihtiyaç durumunda
  // diğer siparişler 174+34=208 rezerve yapmış olunca yeni siparişe stok 0 görünüp
  // 207 eksik gibi gözüküyordu. Doğrusu: sadece fiziksel stok değerlendirilir.
  const stokPool: Record<string, number> = {}
  const acikTedPool: Record<string, number> = {}
  Object.values(brutIhtiyac).forEach(bi => {
    const kLower = (bi.malkod || '').trim().toLowerCase()
    if (stokPool[kLower] !== undefined) return
    stokPool[kLower] = getStok(bi.malkod, stokHareketler)
    acikTedPool[kLower] = tedarikler
      .filter(t => (t.malkod || '').trim().toLowerCase() === kLower && !t.geldi)
      .reduce((a, t) => a + t.miktar, 0)
  })

  // Termin sırasına göre işle (FIFO) — en erken termin pool'dan önce alır
  const sirali = Object.values(brutIhtiyac).sort((a, b) => {
    const at = a.termin || '9999-99-99'
    const bt = b.termin || '9999-99-99'
    return at.localeCompare(bt)
  })

  const sonuc: MRPRow[] = []
  for (const bi of sirali) {
    // YarıMamul filtreleme — üretilir, tedarik edilmez
    if (bi.tip === 'YarıMamul') continue
    const _kLowerDbg = (bi.malkod || '').trim().toLowerCase()
    dbg('[MRP v16.11] Step 5 satir:', {
      malkod: bi.malkod,
      brut: bi.brut,
      stok_havuzu: stokPool[_kLowerDbg] || 0,
      acik_tedarik: acikTedPool[_kLowerDbg] || 0,
      termin: bi.termin
    })

    const kLower = (bi.malkod || '').trim().toLowerCase()
    const stokDus = Math.min(stokPool[kLower] || 0, bi.brut)
    stokPool[kLower] = (stokPool[kLower] || 0) - stokDus
    const kalan = Math.max(0, bi.brut - stokDus)
    const acikDus = Math.min(acikTedPool[kLower] || 0, kalan)
    acikTedPool[kLower] = (acikTedPool[kLower] || 0) - acikDus
    const net = Math.max(0, Math.ceil(bi.brut - stokDus - acikDus))
    const durum: MRPRow['durum'] = (stokDus + acikDus) >= bi.brut ? 'yeterli' : net > 0 ? 'eksik' : 'yeterli'

    // Rezerve bilgisi — bilgisel, hesabı etkilemez
    const rezerve = stokHareketler
      .filter(h => (h.malkod || '').trim().toLowerCase() === kLower && h.tip === 'rezerv')
      .reduce((a, h) => a + h.miktar, 0)

    sonuc.push({
      malkod: bi.malkod, malad: bi.malad, tip: bi.tip, birim: bi.birim,
      brut: bi.brut, stok: stokDus, rezerve, acikTedarik: acikDus, net, durum,
      termin: bi.termin || '',
    })
  }

  dbg('[MRP DEBUG] FINAL brütIhtiyac keys:', Object.keys(brutIhtiyac).length, '| sonuç satır:', sonuc.length, '| mallar:', Object.values(brutIhtiyac).map(b => b.malkod))
  dbg('[MRP v16.11] EKSIKLER (net>0):', sonuc.filter(r => r.net > 0).map(r => ({ malkod: r.malkod, brut: r.brut, stok: r.stok, acikTedarik: r.acikTedarik, net: r.net })))

  return sonuc.sort((a, b) => {
    const s: Record<string, number> = { yok: 0, eksik: 1, yeterli: 2 }
    const at = a.termin || '9999-99-99'; const bt = b.termin || '9999-99-99'
    if (at !== bt) return at.localeCompare(bt)
    return (s[a.durum] || 0) - (s[b.durum] || 0) || (a.malad || '').localeCompare(b.malad || '', 'tr')
  })
}

// ═══ BACKWARD COMPAT ═══
// v15.50b — opts parametresi eklendi:
//   - mrpCalculationId: uys_mrp_calculations snapshot id (varsa tedarikler.mrp_calculation_id'ye yazılır)
//   - auto: tedarik kaydının auto_olusturuldu bayrağı (default true — toplu/otomatik akış)
// Geri uyumluluk: opts yoksa eski davranış (auto=true, calc_id=null).
//
// v15.56 (F-21) — İDEMPOTENT KONTROL:
//   Aynı orderId + malkod + termin için zaten BEKLEYEN tedarik varsa, miktar farkı (delta) kadar açar.
//   - Mevcut miktar >= ihtiyaç → HİÇ AÇMA (atla)
//   - Mevcut miktar < ihtiyaç → SADECE FARKI AÇ
//   - Mevcut tedarik yok → ihtiyaç kadar aç (eski davranış)
//
//   Bug kanıtı: 27 Nis 2026'da S26A_02981_2 siparişi için aynı malkod (H0102C030093044) için
//   35 saniye arayla 2 ayrı tedarik kaydı açıldı (114 + 207 = 321 birim, oysa gerçek ihtiyaç 207).
//   Bu fonksiyonun açık tedarik kontrolü yapmamasından kaynaklandı.
//
//   Dönüş: KAYITLI (insert edilen) tedarik sayısı. Hepsi atlandıysa 0 döner — çağıran taraf
//   "Tüm ihtiyaçlar karşılanmış" mesajını gösterir.
export async function mrpTedarikOlustur(
  orderId: string, siparisNo: string, mrpRows: MRPRow[],
  opts?: { mrpCalculationId?: string; auto?: boolean }
): Promise<number> {
  const ihtiyaclar = mrpRows.filter(r => r.net > 0)
  if (!ihtiyaclar.length) return 0
  const auto = opts?.auto ?? true
  const calcId = opts?.mrpCalculationId || null

  // v15.56 F-21 — Mevcut bekleyen tedarikleri tek seferde çek (performans için)
  // Lookup: malkod + termin → toplam mevcut bekleyen miktar
  //
  // v16.41 fix — Saha vakası S26A_03078 (5 May 2026 05:41–05:43):
  // Tedarik açıldı (geldi=false), 1–2 dk içinde geldi=true yapıldı (depo girişi),
  // 2. autoChain hesabı .eq('geldi', false) filtresiyle "açık tedarik 0" buldu →
  // aynı malkod için 2. kez tedarik açtı (84+158 birim, oysa ihtiyaç 42+79).
  //
  // Çözüm: geldi filtresi kaldırıldı, yerine BUGÜN açılmış (tarih=today) tüm tedarikler sayılır.
  // - Bugün açılmış geldi=false → mevcutMap'e dahil ✓ (eski davranış)
  // - Bugün açılmış geldi=true (1 dk içinde depo girişi) → mevcutMap'e dahil ✓ (yeni)
  // - Eski tarihli geldi=true → dahil DEĞİL (zaten stoğa geçmiş, hesaplaMRP brut-stok hesabında düşmüş)
  // - Eski tarihli geldi=false → dahil DEĞİL (1 günden eski açık tedarik = duplicate riski yok)
  let mevcutMap: Record<string, number> = {}
  if (orderId) {
    const { data: mevcutTedarikler, error: tErr } = await supabase
      .from('uys_tedarikler')
      .select('malkod, miktar, teslim_tarihi, geldi, tarih')
      .eq('order_id', orderId)
      .gte('tarih', today())
    if (tErr) {
      // Sorgu fail olursa eski davranışa düş — bug duruma sebep olur ama akış bozulmaz.
      console.warn('[v16.41 mrpTedarikOlustur] Mevcut tedarik kontrolü fail, eski davranışa düşüyor:', tErr.message)
      mevcutMap = {}
    } else {
      for (const t of (mevcutTedarikler || [])) {
        const key = `${(t.malkod || '').trim().toLowerCase()}__${t.teslim_tarihi || ''}`
        mevcutMap[key] = (mevcutMap[key] || 0) + (t.miktar || 0)
      }
    }
  }

  let kayitliSay = 0
  const atlananLog: string[] = []
  const kismiLog: string[] = []

  for (const r of ihtiyaclar) {
    const termin = r.termin || ''
    const key = `${(r.malkod || '').trim().toLowerCase()}__${termin}`
    const mevcut = mevcutMap[key] || 0
    const fark = r.net - mevcut

    if (fark <= 0) {
      // Mevcut bekleyen tedarik yeterli — yeni kayıt açma
      atlananLog.push(`${r.malkod}@${termin || '-'}: ihtiyaç ${r.net}, mevcut ${mevcut}`)
      continue
    }

    if (mevcut > 0) {
      kismiLog.push(`${r.malkod}@${termin || '-'}: ihtiyaç ${r.net}, mevcut ${mevcut}, fark ${fark}`)
    }

    await supabase.from('uys_tedarikler').insert({
      id: uid(), malkod: r.malkod, malad: r.malad, miktar: fark, birim: r.birim,
      order_id: orderId, siparis_no: siparisNo,
      durum: 'bekliyor', geldi: false, tarih: today(), teslim_tarihi: termin || null,
      not_: auto ? 'MRP otomatik' : 'MRP',
      auto_olusturuldu: auto,
      mrp_calculation_id: calcId,
    })
    kayitliSay++

    // Lookup'ı güncelle — aynı malkod + termin tekrar gelirse çift sayım olmasın
    mevcutMap[key] = mevcut + fark
  }

  if (atlananLog.length > 0) {
    console.log('[v15.56 mrpTedarikOlustur] Atlandı (mevcut yeterli):', atlananLog.join(' | '))
  }
  if (kismiLog.length > 0) {
    console.log('[v15.56 mrpTedarikOlustur] Kısmi (delta):', kismiLog.join(' | '))
  }

  // Siparisin mrp_durum'u 'tamam' olsun (MRP akisi kapandi)
  if (orderId) await supabase.from('uys_orders').update({ mrp_durum: 'tamam' }).eq('id', orderId)
  return kayitliSay
}

// ═══ v15.67 — TEDARİK DÜZELTME (İş Emri #13 madde 10 iskelet) ═══
// Sipariş silindiğinde/eksildiğinde fazla bekleyen tedarikleri otomatik düşür/iptal eder.
//
// Spec madde 10: "Sipariş silinirse/eksilirse... MRP fazla olmuş olacak. Tedarik sayfasında
// sipariş gelmediyse miktar düzeltilir, geldiyse malzeme stoğa girer."
//
// Mantık:
//   - Yeni MRP sonucunda bir malzemenin net'i 0 ise ve o sipariş için bekleyen tedarik varsa
//     → tedarik tamamen iptal edilir (DELETE)
//   - Bekleyen tedarik miktarı yeni ihtiyaçtan fazla ise → miktar yeni ihtiyaca düşürülür
//   - GELDİ=true tedarikler dokunulmaz (zaten stoğa girmiş, spec'e uygun)
//
// Çağrılma yeri: runMRP (Orders.tsx) sonunda, mrpTedarikOlustur'dan SONRA çalıştırılır
// (idempotent: yeni eklenen tedarikler düzeltilmez, sadece ESKİ fazlalar).
//
// İskelet: Bu adım tek başına eksik. İleride (madde 11 ile) miktar artışı durumu eklenecek.
export async function mrpTedarikDuzelt(
  orderId: string,
  yeniMrpRows: MRPRow[]
): Promise<{ azaltilan: number; iptalEdilen: number }> {
  let azaltilan = 0
  let iptalEdilen = 0
  if (!orderId) return { azaltilan, iptalEdilen }

  // Mevcut bekleyen tedarikleri çek (sadece bu siparişe ait + gelmemiş)
  const { data: mevcut, error: tErr } = await supabase
    .from('uys_tedarikler')
    .select('id, malkod, miktar, teslim_tarihi')
    .eq('order_id', orderId)
    .eq('geldi', false)

  if (tErr) {
    console.warn('[v15.67 mrpTedarikDuzelt] Bekleyen tedarik fetch fail:', tErr.message)
    return { azaltilan, iptalEdilen }
  }

  // Yeni MRP'de her malkod için toplam ihtiyaç (termin gruplama dahil)
  const yeniIhtiyacMap: Record<string, number> = {}
  for (const r of yeniMrpRows) {
    const k = (r.malkod || '').trim().toLowerCase()
    yeniIhtiyacMap[k] = (yeniIhtiyacMap[k] || 0) + Math.max(0, r.net)
  }

  for (const t of (mevcut || [])) {
    const k = (t.malkod || '').trim().toLowerCase()
    const yeniIhtiyac = yeniIhtiyacMap[k] || 0
    const mevcutMiktar = t.miktar || 0

    if (yeniIhtiyac <= 0) {
      // Bu malzemeye yeni MRP'de hiç ihtiyaç yok → tedariği tamamen iptal et
      await supabase.from('uys_tedarikler').delete().eq('id', t.id)
      // Bağlı stok hareketi (ted-{id} formatında) varsa o da silinir — ileride geldi=true olursa
      // duplicate önleme. Şu an geldi=false olduğu için stok hareketi henüz yok ama emniyet için.
      await supabase.from('uys_stok_hareketler').delete().eq('id', `ted-${t.id}`)
      iptalEdilen++
    } else if (mevcutMiktar > yeniIhtiyac) {
      // Bekleyen tedarik fazla → miktar yeni ihtiyaca düşürülür
      await supabase.from('uys_tedarikler').update({ miktar: yeniIhtiyac }).eq('id', t.id)
      // İhtiyaç haritasını güncelle — aynı malkod için başka tedarik varsa yeniden saymasın
      yeniIhtiyacMap[k] = 0
      azaltilan++
    } else {
      // mevcutMiktar <= yeniIhtiyac → dokunma, yeniIhtiyac'tan ne kadar düşülecek hesapla
      yeniIhtiyacMap[k] = yeniIhtiyac - mevcutMiktar
    }
  }

  if (iptalEdilen + azaltilan > 0) {
    console.log(`[v15.67 mrpTedarikDuzelt] orderId=${orderId} iptal=${iptalEdilen} azaltilan=${azaltilan}`)
  }
  return { azaltilan, iptalEdilen }
}

// ═══ MRP REZERVE — v15.70: SİSTEM KALDIRILDI ═══
// v15.63'te stokPool rezerve düşürmesi kaldırıldı (Buket'in formülü: BRÜT-STOK-YOLDA).
// Rezerve kayıtları MRP hesabını etkilemiyordu, sadece DB'ye yazılıyordu (ölü kayıt).
// v15.70'te tüm rezerve fonksiyonları no-op yapıldı:
//   - DB'ye yeni rezerve YAZILMAZ (uys_mrp_rezerve insertion durdu)
//   - Mevcut DB kayıtları dokunulmaz (1-2 hafta sonra DROP TABLE migration)
//   - Caller imzaları korundu (Orders.tsx, MRP.tsx, Procurement, vb. değişmeden çalışır)
//
// 2-aşamalı plan:
//   Aşama 1 (v15.70): Fonksiyonlar no-op (BU PATCH)
//   Aşama 2 (1-2 hafta sonra, sahada sorun yoksa): Fonksiyon tanımları + tablo + tip + store kaldırılır
export async function rezerveYaz(
  orderId: string,
  mrpRows: MRPRow[]
): Promise<number> {
  // v16.71 — Gerçek implementasyon (v15.70 no-op kaldırıldı)
  if (!orderId || !mrpRows.length) return 0

  // Bu siparişin eski rezervlerini temizle
  await supabase.from('uys_stok_hareketler')
    .delete()
    .eq('rezerv_order_id', orderId)
    .eq('tip', 'rezerv')

  // Stoktan karşılanabilen malzemeler için rezerv yaz
  const rows = mrpRows.filter(r => r.brut > 0 && r.stok > 0)
  if (!rows.length) return 0

  const ts = Date.now()
  const insertRows = rows.map((r, i) => ({
    id: `rezerv-${orderId}-${r.malkod.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 18)}-${ts}-${i}`,
    malkod: r.malkod, malad: r.malad,
    miktar: Math.min(Math.ceil(r.brut), Math.floor(r.stok)),
    tip: 'rezerv', tarih: today(),
    rezerv_order_id: orderId,
    aciklama: 'MRP otomatik rezerve',
  }))

  const { error } = await supabase.from('uys_stok_hareketler').insert(insertRows)
  if (error) { console.error('[rezerveYaz]', error); return 0 }
  return insertRows.length
}

// Bir siparişe ait tüm rezerveleri siler
export async function rezerveSil(orderId: string): Promise<void> {
  // v16.71 — Gerçek implementasyon (v15.70 no-op kaldırıldı)
  if (!orderId) return
  await supabase.from('uys_stok_hareketler')
    .delete()
    .eq('rezerv_order_id', orderId)
    .eq('tip', 'rezerv')
}

// ═══ KESİM PLANI TEMİZLEME HELPER — woId bazlı ═══
// Verilen woId'lere ait kesimleri tüm planlardan çıkarır.
// Bir satır tüm kesimlerini kaybederse satır silinir.
// Bir plan tüm satırlarını kaybederse plan silinir.
// Sipariş silme + sipariş revize akışlarında kullanılır.
export async function cuttingPlanTemizle(
  woIds: string[],
  cuttingPlans: { id: string; satirlar: any[] }[]
): Promise<{ guncellenenPlan: number; silinenPlan: number; temizlenenKesim: number }> {
  if (!woIds.length) return { guncellenenPlan: 0, silinenPlan: 0, temizlenenKesim: 0 }
  const woIdSet = new Set(woIds)
  let guncellenen = 0, silinen = 0, temizlenen = 0

  for (const plan of cuttingPlans) {
    const origSatirlar = plan.satirlar || []
    if (!origSatirlar.length) continue

    const yeniSatirlar: any[] = []
    let planDegisti = false
    for (const satir of origSatirlar) {
      const origKesimler = satir.kesimler || []
      const yeniKesimler = origKesimler.filter((k: any) => !woIdSet.has(k.woId))
      if (yeniKesimler.length !== origKesimler.length) {
        planDegisti = true
        temizlenen += origKesimler.length - yeniKesimler.length
      }
      if (yeniKesimler.length > 0) {
        yeniSatirlar.push({ ...satir, kesimler: yeniKesimler })
      }
    }

    if (yeniSatirlar.length === 0) {
      // Plan tamamen boşaldı — sil
      await supabase.from('uys_kesim_planlari').delete().eq('id', plan.id)
      silinen++
    } else if (planDegisti) {
      // Plan güncellendi (hamAdet'e dokunulmuyor — manuel yeniden optimizasyon gerekebilir)
      await supabase.from('uys_kesim_planlari').update({ satirlar: yeniSatirlar }).eq('id', plan.id)
      guncellenen++
    }
  }
  return { guncellenenPlan: guncellenen, silinenPlan: silinen, temizlenenKesim: temizlenen }
}

// ═══ SİPARİŞ SİLME ORCHESTRATOR — Faz B Parça 2C+ ═══
// Tek fonksiyonda tüm zinciri orkestre eder:
//  1. Üretim kontrolü — İE'lerde log varsa force=true gerekir (kullanıcı onayı)
//  2. İş emirlerini sil
//  3. Kesim planlarından bu siparişin kesimlerini çıkar (boşalan plan silinir)
//  4. Açık tedarikleri (geldi=false) sil — gereksiz kaldılar
//  5. Gelmiş tedariklerin (geldi=true) order_id bağını kopar — malzeme stokta serbest kalır
//  6. Rezerveleri sil
//  7. Siparişi sil
// NOT: Stok hareketleri ve üretim logları DOKUNULMAZ. Üretilmiş miktar stokta kalır.
// NOT: Çağırdıktan sonra mutlaka loadAll + rezerveleriSenkronla tetiklenmeli.
export async function siparisSilKapsamli(
  orderId: string,
  state: {
    workOrders: WorkOrder[]
    logs: { woId: string; qty: number }[]
    cuttingPlans: { id: string; satirlar: any[] }[]
  },
  options?: { force?: boolean }
): Promise<{
  ok: boolean
  hata?: string
  detay?: { kayitSayisi: number; toplamMiktar: number }
  ozet?: { silinenIE: number; guncellenenPlan: number; silinenPlan: number; silinenAcikTedarik: number; kopanGelmisTedarik: number }
}> {
  if (!orderId) return { ok: false, hata: 'Sipariş ID boş' }

  // 1. Üretim kontrolü
  const woIds = state.workOrders.filter(w => w.orderId === orderId).map(w => w.id)
  const uretilmis = state.logs.filter(l => woIds.includes(l.woId))
  if (uretilmis.length > 0 && !options?.force) {
    const toplamMiktar = uretilmis.reduce((a, l) => a + (l.qty || 0), 0)
    return {
      ok: false,
      hata: 'Siparişte üretim başlamış',
      detay: { kayitSayisi: uretilmis.length, toplamMiktar }
    }
  }

  // 2. İş emirlerini sil
  await supabase.from('uys_work_orders').delete().eq('order_id', orderId)

  // 3. Kesim planlarını güncelle
  const cpResult = await cuttingPlanTemizle(woIds, state.cuttingPlans)

  // 4. Açık tedarikleri sil
  const { count: acikCount } = await supabase.from('uys_tedarikler').delete({ count: 'exact' }).eq('order_id', orderId).eq('geldi', false)

  // 5. Gelmiş tedariklerin sipariş bağını kopar
  const { count: gelmisCount } = await supabase.from('uys_tedarikler').update({ order_id: null, siparis_no: null }, { count: 'exact' }).eq('order_id', orderId).eq('geldi', true)

  // 6. Rezerveleri sil
  await supabase.from('uys_mrp_rezerve').delete().eq('order_id', orderId)

  // 7. Siparişi sil
  await supabase.from('uys_orders').delete().eq('id', orderId)

  return {
    ok: true,
    ozet: {
      silinenIE: woIds.length,
      guncellenenPlan: cpResult.guncellenenPlan,
      silinenPlan: cpResult.silinenPlan,
      silinenAcikTedarik: acikCount || 0,
      kopanGelmisTedarik: gelmisCount || 0,
    }
  }
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
): Promise<{ siparisSayisi: number; rezerveSayisi: number; yazılanRezerv: any[] }> {
  // v16.71 — Gerçek termin-FIFO implementasyonu (v15.70 no-op kaldırıldı)
  //
  // MANTIK:
  // 1. Tüm mevcut otomatik rezervleri sil
  // 2. Aktif siparişleri termine göre sırala (erken termin önce)
  // 3. Her sipariş için MRP hesapla — önceki siparişlerin rezervleri
  //    in-memory birikimi ile stoktan düşülmüş olarak gelir
  // 4. Rezerv yaz: min(brüt ihtiyaç, kalan serbest stok)
  // 5. Toplu insert

  // 1. Mevcut otomatik rezervleri temizle (manuel "Rezerve Et" kayıtları korunur)
  await supabase.from('uys_stok_hareketler')
    .delete()
    .eq('tip', 'rezerv')
    .eq('aciklama', 'MRP otomatik rezerve')

  // 2. Aktif siparişler — termin sıralı
  const aktif = orders
    .filter(o => o.state !== 'tamamlandi' && o.state !== 'kapali' && o.state !== 'iptal')
    .sort((a, b) => (a.termin || '9999-99-99').localeCompare(b.termin || '9999-99-99'))

  if (!aktif.length) return { siparisSayisi: 0, rezerveSayisi: 0, yazılanRezerv: [] }

  // v16.71 fix — closure stokHareketler önceki hesaptan otomatik rezervleri içerebilir.
  // DELETE DB'den siliyor ama closure güncellemiyor → çifte rezerv → stok sıfır.
  const stokHareketlerTemiz = stokHareketler.filter((h: any) =>
    !(h.tip === 'rezerv' && h.aciklama === 'MRP otomatik rezerve')
  )

  // 3-4. Her sipariş için hesap + in-memory birikim
  // extraRezerv: malkod → bu oturumda yazılmış toplam rezerv miktarı
  const extraRezerv: Record<string, number> = {}
  const allInserts: any[] = []
  const ts = Date.now()

  for (const order of aktif) {
    // Gerçek stok hareketlerine in-memory rezervleri ekle
    const fakeEktra = Object.entries(extraRezerv)
      .filter(([, m]) => m > 0)
      .map(([malkod, miktar]) => ({
        malkod, miktar, tip: 'rezerv' as const,
        rezervOrderId: '__senkron__', tarih: today(),
        id: '', malad: '', birim: '', aciklama: '',
      }))

    const birlesikStok = [...stokHareketlerTemiz, ...fakeEktra] as StokHareket[]

    const rows = hesaplaMRP(
      [order.id], orders, workOrders, recipes,
      birlesikStok, tedarikler, cuttingPlans, materials,
      null, [], order.id
    )

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (r.brut <= 0 || r.stok <= 0) continue
      const rezervMiktar = Math.min(Math.ceil(r.brut), Math.floor(r.stok))
      if (rezervMiktar <= 0) continue

      allInserts.push({
        id: `rezerv-${order.id}-${r.malkod.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 18)}-${ts}-${allInserts.length}`,
        malkod: r.malkod, malad: r.malad,
        miktar: rezervMiktar, tip: 'rezerv', tarih: today(),
        rezerv_order_id: order.id,
        aciklama: 'MRP otomatik rezerve',
      })

      extraRezerv[r.malkod] = (extraRezerv[r.malkod] || 0) + rezervMiktar
    }
  }

  // 5. Toplu insert (100'erli batch)
  for (let i = 0; i < allInserts.length; i += 100) {
    const { error } = await supabase.from('uys_stok_hareketler').insert(allInserts.slice(i, i + 100))
    if (error) console.error('[rezerveleriSenkronla] insert error:', error)
  }

  return { siparisSayisi: aktif.length, rezerveSayisi: allInserts.length, yazılanRezerv: allInserts as any[] }
}

// ═══ v15.74 — SİPARİŞ DELTA HESABI (İş Emri #13 madde 11) ═══
// Sipariş edit edildiğinde "ne değişti" tespit eder. 8 senaryo:
//   1 ARTIS    — kalem adet ↑     → WO hedefleri × mpm ile artar (yeni İE açılmaz)
//   2 AZALIS   — kalem adet ↓     → WO hedefleri azalır.
//                                    v15.82'den önce: üretildi > yeniAdet → BLOCK
//                                    v15.82 sonrası: izin verilir, hedef = max(üretildi, yeniHedef)
//                                    Fazla üretim serbest stoğa (saha kuralı, Senaryo 5)
//   3 IPTAL    — sipariş iptal    → tüm açık WO durum='iptal', tedarik düzelt
//   4 RECETE   — kalem rcId değişti → eski WO'lar 'iptal', yeni WO'lar açılır (loglar korunur)
//   5 TERMIN   — kalem termin değişti → WO termin update
//   6 KALEM_EKLE — yeni kalem    → buildWorkOrders ile yeni WO'lar
//   7 KALEM_SIL  — kalem silindi → o kalemin WO'ları 'iptal' (silme yok)
//   8 METADATA   — müşteri/no/not değişti → sadece orders update
//
// Kombine: birden fazla senaryo aynı anda olabilir (örn. kalem 1 artış + kalem 2 silindi).
// Bu yüzden delta KALEM BAZLI hesaplanır.
//
// TEMEL KURAL: Değişiklik anına kadar olan log/üretim DOKUNULMAZ.
// WO durum='iptal' olur ama silinmez (log'larla bağ korunur).

import type { OrderItem } from '@/types'

export type DeltaTip = 'artis' | 'azalis' | 'iptal' | 'recete' | 'termin' | 'kalem_ekle' | 'kalem_sil' | 'metadata' | 'noop'

export interface KalemDelta {
  rcId: string
  tip: DeltaTip
  eskiAdet: number
  yeniAdet: number
  fark: number
  uretildiAdet: number  // bu kaleme bağlı tüm logların toplamı (kontrol için)
  eskiTermin?: string
  yeniTermin?: string
  etkilenenWoIds: string[]
}

export interface SiparisDelta {
  orderId: string
  iptalEdildi: boolean         // sipariş bütün durum 'iptal' yapıldıysa true
  metadataDegisti: boolean
  kalemDeltalari: KalemDelta[]
  hatalar: string[]            // örn. "Reçete X için 50 üretildi, yeni adet 40 olamaz"
  toplamSenaryoSayisi: number  // metadata + kalem değişimi
}

/**
 * v15.74 — Sipariş edit'inde "ne değişti" tespit eder.
 * Yan etki yok, sadece okur. Caller siparisRevizeUygula ile asıl işi yapar.
 */
export function siparisDelta(
  oldOrder: { id: string; siparisNo: string; musteri: string; not: string; durum: string; urunler: OrderItem[] },
  newOrder: { siparisNo: string; musteri: string; not: string; durum: string; urunler: OrderItem[] },
  workOrders: WorkOrder[],
  logs: { woId: string; qty: number }[],
): SiparisDelta {
  const result: SiparisDelta = {
    orderId: oldOrder.id,
    iptalEdildi: false,
    metadataDegisti: false,
    kalemDeltalari: [],
    hatalar: [],
    toplamSenaryoSayisi: 0,
  }

  // İptal kontrolü (en üst öncelikli)
  if (newOrder.durum === 'iptal' || newOrder.durum === 'kapalı') {
    if (oldOrder.durum !== newOrder.durum) {
      result.iptalEdildi = true
      result.toplamSenaryoSayisi++
      return result  // iptal varsa diğer farkları umursama (zaten hepsi etkilenecek)
    }
  }

  // Metadata değişimi
  if (
    oldOrder.siparisNo !== newOrder.siparisNo ||
    oldOrder.musteri !== newOrder.musteri ||
    oldOrder.not !== newOrder.not
  ) {
    result.metadataDegisti = true
    result.toplamSenaryoSayisi++
  }

  // Kalem bazlı diff — eski ve yeni urunler[] karşılaştır
  const oldByRc: Record<string, OrderItem> = {}
  for (const k of (oldOrder.urunler || [])) oldByRc[k.rcId] = k

  const yeniByRc: Record<string, OrderItem> = {}
  for (const k of (newOrder.urunler || [])) yeniByRc[k.rcId] = k

  // Bu kaleme bağlı WO'ları + üretildiği toplam adeti getirir
  function woUretildi(rcId: string): { woIds: string[]; uretildi: number } {
    const woIds = workOrders
      .filter(w => w.orderId === oldOrder.id && w.rcId === rcId && w.durum !== 'iptal')
      .map(w => w.id)
    let uretildi = 0
    for (const woId of woIds) {
      uretildi += logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0)
    }
    return { woIds, uretildi }
  }

  // Eski kalemler — yeni listede var mı bak
  for (const rcId of Object.keys(oldByRc)) {
    const oldK = oldByRc[rcId]
    const yeniK = yeniByRc[rcId]
    const { woIds, uretildi } = woUretildi(rcId)

    if (!yeniK) {
      // KALEM SİLİNDİ
      result.kalemDeltalari.push({
        rcId, tip: 'kalem_sil',
        eskiAdet: oldK.adet, yeniAdet: 0, fark: -oldK.adet,
        uretildiAdet: uretildi,
        eskiTermin: oldK.termin, yeniTermin: undefined,
        etkilenenWoIds: woIds,
      })
      result.toplamSenaryoSayisi++
      continue
    }

    // Adet, termin, rcId aynı mı? (rcId map'in anahtarı zaten aynı, reçete değişimi farklı şekilde tespit edilmeli)
    const adetDegisti = oldK.adet !== yeniK.adet
    const terminDegisti = oldK.termin !== yeniK.termin

    if (adetDegisti) {
      const fark = yeniK.adet - oldK.adet
      if (fark > 0) {
        result.kalemDeltalari.push({
          rcId, tip: 'artis',
          eskiAdet: oldK.adet, yeniAdet: yeniK.adet, fark,
          uretildiAdet: uretildi,
          eskiTermin: oldK.termin, yeniTermin: yeniK.termin,
          etkilenenWoIds: woIds,
        })
        result.toplamSenaryoSayisi++
      } else {
        // v15.82 — AZALIS: üretildi > yeniAdet artık BLOCK DEĞİL.
        // Saha modeli (28 Nis 2026, saha_model_28nis2026.md Senaryo 5):
        //   "Üretildi 35, sipariş 30'a düştü → IE.hedef=35'te dondurulur,
        //    sipariş kalemi=30 (müşteriye 30), fazla 5 → SERBEST stoğa."
        // siparisRevizeUygula zaten Math.max(uretildiAdet, ...) ile hedefi
        // koruyor. Burada hata atmak gereksizdi — kullanıcı engelleniyordu.
        // Eski kuralı kaldırdık (Senaryo 7 Adım 4 testi de güncellendi).
        result.kalemDeltalari.push({
          rcId, tip: 'azalis',
          eskiAdet: oldK.adet, yeniAdet: yeniK.adet, fark,
          uretildiAdet: uretildi,
          eskiTermin: oldK.termin, yeniTermin: yeniK.termin,
          etkilenenWoIds: woIds,
        })
        result.toplamSenaryoSayisi++
      }
    } else if (terminDegisti) {
      result.kalemDeltalari.push({
        rcId, tip: 'termin',
        eskiAdet: oldK.adet, yeniAdet: yeniK.adet, fark: 0,
        uretildiAdet: uretildi,
        eskiTermin: oldK.termin, yeniTermin: yeniK.termin,
        etkilenenWoIds: woIds,
      })
      result.toplamSenaryoSayisi++
    }
  }

  // Yeni kalemler — eski listede yok ise KALEM_EKLE
  for (const rcId of Object.keys(yeniByRc)) {
    if (oldByRc[rcId]) continue  // zaten yukarıda işlendi
    const yeniK = yeniByRc[rcId]
    result.kalemDeltalari.push({
      rcId, tip: 'kalem_ekle',
      eskiAdet: 0, yeniAdet: yeniK.adet, fark: yeniK.adet,
      uretildiAdet: 0,
      eskiTermin: undefined, yeniTermin: yeniK.termin,
      etkilenenWoIds: [],
    })
    result.toplamSenaryoSayisi++
  }

  return result
}

/**
 * v15.74 — siparisDelta sonucuna göre asıl uygulamayı yapar.
 * Caller tarafında çağrılma sırası:
 *   1. siparisDelta() → ne değişti tespit
 *   2. delta.hatalar.length > 0 ise → kullanıcıya göster, abort
 *   3. siparisRevizeUygula() → DB değişiklikleri uygula
 *   4. mrpTedarikDuzelt() → fazla bekleyen tedarikleri otomatik düşür (madde 10)
 *   5. runMRP / autoMRP → eksikleri açar (F-19/20)
 *
 * @returns özet string'leri (toast göstermek için)
 */
export async function siparisRevizeUygula(
  delta: SiparisDelta,
  newOrder: { id: string; siparisNo: string; musteri: string; not: string; termin: string; durum: string; urunler: OrderItem[]; mamulKod: string; mamulAd: string; receteId: string; adet: number },
  recipes: Recipe[],
  cuttingPlans: { id: string; satirlar: any[] }[],
): Promise<{ ozetler: string[] }> {
  const ozetler: string[] = []

  // 1) Sipariş kaydının kendisini güncelle (her zaman — adet/termin değişebilir, urunler yeniden serileştirilir)
  const orderRow: Record<string, unknown> = {
    siparis_no: newOrder.siparisNo,
    musteri: newOrder.musteri,
    not_: newOrder.not,
    termin: newOrder.termin,
    mamul_kod: newOrder.mamulKod,
    mamul_ad: newOrder.mamulAd,
    recete_id: newOrder.receteId,
    adet: newOrder.adet,
    urunler: newOrder.urunler,
  }
  // İptal durumu varsa onu da güncelle
  if (delta.iptalEdildi) orderRow['durum'] = newOrder.durum

  // mrp_durum revizyonun anlamlı olduğu durumlarda 'bekliyor' olur
  // (sadece adet/termin/reçete/kalem ekleme/silme. Metadata için dokunma)
  const akisDegisti = delta.kalemDeltalari.some(k => k.tip !== 'termin')
  if (akisDegisti && !delta.iptalEdildi) orderRow['mrp_durum'] = 'bekliyor'

  await supabase.from('uys_orders').update(orderRow).eq('id', delta.orderId)

  // 2) İptal senaryosu — tüm açık WO'ları iptal et (silme yok, log korunur)
  if (delta.iptalEdildi) {
    const { count: iptalSayisi } = await supabase
      .from('uys_work_orders')
      .update({ durum: 'iptal' })
      .eq('order_id', delta.orderId)
      .neq('durum', 'iptal')
      .select('*', { count: 'exact', head: true })
    ozetler.push(`Sipariş iptal edildi · ${iptalSayisi || 0} İE iptal işaretlendi (loglar korundu)`)
    return { ozetler }
  }

  // 3) Kalem bazlı senaryolar
  for (const kd of delta.kalemDeltalari) {
    if (kd.tip === 'metadata' || kd.tip === 'noop') continue

    if (kd.tip === 'artis') {
      // WO hedefleri × mpm ile artar. MEvcut kayıt için: yeni hedef = (yeni adet) × mpm
      // Çünkü buildWorkOrders'ta hedef = ceil(adet × zincirCarpan × mpm) → bunu bizim "adet"'e oranlamak için
      // formül olmadan basit yaklaşım: WO'nun mevcut hedef'i / eski adet × yeni adet (oranlı yaz)
      for (const woId of kd.etkilenenWoIds) {
        // Mevcut WO oku, hedefini orantılı artır
        const { data: wo } = await supabase
          .from('uys_work_orders')
          .select('id, hedef')
          .eq('id', woId)
          .single()
        if (!wo) continue
        const yeniHedef = Math.ceil((wo.hedef as number) * (kd.yeniAdet / kd.eskiAdet))
        await supabase.from('uys_work_orders').update({ hedef: yeniHedef }).eq('id', woId)
      }
      ozetler.push(`+${kd.fark} adet → ${kd.etkilenenWoIds.length} İE hedefi artırıldı`)
    }

    if (kd.tip === 'azalis') {
      // Aynı orantı, hedef azaltılır. (Hata kontrolü siparisDelta'da yapıldı)
      for (const woId of kd.etkilenenWoIds) {
        const { data: wo } = await supabase
          .from('uys_work_orders')
          .select('id, hedef')
          .eq('id', woId)
          .single()
        if (!wo) continue
        const yeniHedef = Math.max(kd.uretildiAdet, Math.ceil((wo.hedef as number) * (kd.yeniAdet / kd.eskiAdet)))
        await supabase.from('uys_work_orders').update({ hedef: yeniHedef }).eq('id', woId)
      }
      ozetler.push(`${kd.fark} adet → ${kd.etkilenenWoIds.length} İE hedefi azaltıldı (üretildi=${kd.uretildiAdet} korundu)`)
    }

    if (kd.tip === 'termin') {
      // Sadece termin update, akış değişmez
      for (const woId of kd.etkilenenWoIds) {
        await supabase.from('uys_work_orders').update({ termin: kd.yeniTermin || null }).eq('id', woId)
      }
      ozetler.push(`Termin değişti → ${kd.etkilenenWoIds.length} İE güncellendi`)
    }

    if (kd.tip === 'kalem_sil') {
      // O kalemin tüm açık WO'ları iptal (silme yok)
      await supabase
        .from('uys_work_orders')
        .update({ durum: 'iptal' })
        .in('id', kd.etkilenenWoIds)
      ozetler.push(`Kalem silindi → ${kd.etkilenenWoIds.length} İE iptal (loglar korundu)`)
    }

    if (kd.tip === 'kalem_ekle') {
      // Yeni kalem için WO'lar oluştur — buildWorkOrders dynamic import
      // (Circular dep önlemek için)
      const { buildWorkOrders } = await import('./autoChain')
      // Kalem ekle: woTotal başlangıç max sira + 1
      const { data: maxSira } = await supabase
        .from('uys_work_orders')
        .select('sira')
        .eq('order_id', delta.orderId)
        .order('sira', { ascending: false })
        .limit(1)
      const baslangicSira = (maxSira && maxSira[0]?.sira) ? Number(maxSira[0].sira) : 0
      // newOrder.urunler içinden bu rcId'li kalemi bul (yeni eklenmiş olmalı)
      const yeniKalem = newOrder.urunler.find(k => k.rcId === kd.rcId)
      if (yeniKalem) {
        // stoktan:true → WO açma, YM stoktan çıkış yaz
        if ((yeniKalem as any).stoktan) {
          const { addStokHareketi } = await import('@/lib/stokHelper')
          await addStokHareketi({
            malkod: yeniKalem.mamulKod,
            malad: yeniKalem.mamulAd || yeniKalem.mamulKod,
            miktar: kd.yeniAdet,
            tip: 'cikis',
            aciklama: `Stoktan karşılandı — ${newOrder.siparisNo}`,
          })
          ozetler.push(`Stoktan karşılandı → ${kd.yeniAdet} adet ${yeniKalem.mamulKod}`)
        } else {
          const c = await buildWorkOrders(
            delta.orderId, newOrder.siparisNo, kd.rcId, kd.yeniAdet,
            recipes, yeniKalem.termin, baslangicSira
          )
          ozetler.push(`Yeni kalem → ${c} İE oluşturuldu`)
        }
      }
    }

    // 'recete' senaryosu kalem_sil + kalem_ekle olarak gelir (rcId değiştiği için
    // siparisDelta yukarıda zaten ikisini tespit eder). Bu yüzden ayrı handler yok.
  }

  return { ozetler }
}

// ═══════════════════════════════════════════════════════════════════════════
// IE #14 Faz A Slice 2 (v16.31) — CACHE-AWARE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════
//
// Amaç: Aynı parametre seti (global veya order-tek) için tekrar tekrar
// hesaplaMRP çağrısı yapmadan DB-cache'ten oku, fresh ise dön.
//
// API:
//   await hesaplaMRPCached(scope, computeFn, opts?)
//
//   scope:
//     'global'              -> uys_mrp_state_global cache
//     { orderId: '...' }    -> uys_mrp_state_order cache (tek sipariş)
//     null                  -> cache by-pass (custom kullanım, çoklu sipariş, secilenYMIds vs.)
//
//   computeFn: () => MRPRow[]   — cache miss veya forced refresh anında çağrılır
//
//   opts.forceRefresh: true    — cache'i atla, mutlaka recompute + cache yaz
//
// Test modu:
//   localStorage.uys_active_test_run_id varsa cache TAM by-pass — test koşusu
//   üretim cache'ini kirletmesin.
//
// Trigger'lar (Slice 1 migration):
//   uys_orders, uys_work_orders, uys_kesim_planlari, uys_stok_hareketler,
//   uys_tedarikler, uys_recipes, uys_bom_trees -> invalidate.
//
// Caller pattern (Slice 3'te aşamalı geçiş):
//   const rows = await hesaplaMRPCached(
//     ordIds === null ? 'global'
//       : (ordIds && ordIds.length === 1) ? { orderId: ordIds[0] } : null,
//     () => hesaplaMRP(ordIds, orders, workOrders, recipes, ...)
//   )
//
// ESKİ hesaplaMRP API'si DEĞİŞMEDİ — backward compatible. Mevcut çağrılar etkilenmez.
// ═══════════════════════════════════════════════════════════════════════════

export type MrpCacheScope = 'global' | { orderId: string } | null

export interface HesaplaMRPCachedOpts {
  forceRefresh?: boolean
}

/**
 * Cache-aware MRP hesabı.
 *
 * 1) scope === null  -> cache yok, computeFn() doğrudan döndürülür
 * 2) Test modu       -> cache yok, computeFn() doğrudan döndürülür
 * 3) forceRefresh    -> compute + cache yaz, dön
 * 4) Cache HIT       -> cache.rows döndürülür
 * 5) Cache MISS/STALE -> compute + cache yaz, dön
 *
 * computeFn senkron — eski hesaplaMRP'yi closure ile sarın.
 */
export async function hesaplaMRPCached(
  scope: MrpCacheScope,
  computeFn: () => MRPRow[],
  opts?: HesaplaMRPCachedOpts
): Promise<MRPRow[]> {
  // (1) Cache by-pass: custom kullanım
  if (scope === null) return computeFn()

  // (2) Force refresh: hesapla + cache yaz, dön
  if (opts?.forceRefresh) {
    const rows = computeFn()
    if (scope === 'global') {
      await setMrpCacheGlobal(rows)
    } else {
      await setMrpCacheOrder(scope.orderId, rows)
    }
    return rows
  }

  // (3) Cache okuma denemesi
  const cached = scope === 'global'
    ? await getMrpCacheGlobal()
    : await getMrpCacheOrder(scope.orderId)

  if (cached) {
    // HIT — invalidated=false ve TTL içinde
    return cached.rows
  }

  // (4) MISS/STALE — compute + cache yaz
  const rows = computeFn()

  // Cache yazımı await edilir ama hata atlatılır (mrpCache içinde catch'li).
  if (scope === 'global') {
    await setMrpCacheGlobal(rows)
  } else {
    await setMrpCacheOrder(scope.orderId, rows)
  }

  return rows
}
