import type { Recipe, StokHareket, Tedarik, WorkOrder, Material, MrpRezerve } from '@/types'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'

// ═══ DEBUG ═══
// Normal kullanımda false — sorun varsa true yapıp canlı konsoldan izle
const DEBUG_MRP = false
const dbg = (...args: any[]) => { if (DEBUG_MRP) console.log(...args) }

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
      dbg(`[MRP DEBUG] Sipariş ${o.id} kalem ${u.mamulKod} x${netAdet} → BOM sonuç:`, Object.keys(p).length, 'malzeme:', Object.keys(p))
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
  // KAPSAM FİLTRESİ: sipariş seçildiyse sadece o siparişlerle bağlantılı İE'ler (orderId eşleşmeli)
  const ymIEs = workOrders.filter(w => {
    if (!w.bagimsiz && !w.siparisDisi) return false
    if (w.durum === 'iptal') return false
    if (secilenYMIds && !secilenYMIds.has(w.id)) return false
    // Sipariş seçildiyse: orderId eşleşmeli (yoksa atla)
    if (ordIdSet) {
      if (!w.orderId || !ordIdSet.has(w.orderId)) return false
    }
    return true
  })
  dbg('[MRP DEBUG] Bağımsız/SiparisDisi YM İE sayısı:', ymIEs.length, '| IDs:', ymIEs.map(w => w.id))
  for (const w of ymIEs) {
    // v15.35.3: Kalan hesabı = hedef - üretilen (daha doğru)
    const uretilen = stokHareketler.filter(h => (h as any).woId === w.id || h.woId === w.id).length > 0
      ? 0 : 0  // (log bazlı hesaplama bu dosyada yok — şimdilik hedef kullanılır)
    const kalan = w.hedef - uretilen
    if (!kalan || !w.malkod) continue
    const wTermin = (w as any).termin || ''
    const p = bomPatlaNet(w.malkod, kalan, 0, {}, recipes, stokHareketler, materials)
    dbg('[MRP DEBUG] İE', w.id, w.ieNo, w.malkod, 'x', kalan, 'bagimsiz:', w.bagimsiz, 'siparisDisi:', w.siparisDisi, '→ BOM:', Object.keys(p).length, 'malzeme:', Object.keys(p))
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

  // 3. Brüt ihtiyaçları yuvarla
  Object.keys(brutIhtiyac).forEach(k => { brutIhtiyac[k].brut = Math.ceil(brutIhtiyac[k].brut) })

  // 4. KESİM PLANI OVERRIDE — v2 kritik özellik (şema: p.satirlar[].kesimler[].woId)
  // Kesim planı varsa HM ihtiyacını BOM yerine gerçek bar sayısından al.
  // KAPSAM FİLTRESİ: ordIds verilmişse, sadece o siparişlere ait kesimlerin
  // hamAdet payını topla (satır paylaşımlı ise kesim adet oranıyla böl).
  const secilenWoIds = ordIdSet
    ? new Set(workOrders.filter(w => ordIdSet.has(w.orderId)).map(w => w.id))
    : null
  dbg('[MRP DEBUG] Kapsam filtre:', { ordIds, toplamCuttingPlan: cuttingPlans.length, secilenWoIds: secilenWoIds ? [...secilenWoIds] : null })
  cuttingPlans.filter(p => p.durum !== 'tamamlandi').forEach(p => {
    const hmk = p.hamMalkod; if (!hmk) return
    const hmM = materials.find(m => m.kod === hmk)
    // YarıMamul ise atla — tedarik edilmez
    if (hmM?.tip === 'YarıMamul') return

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

    // BOM'dan bu malkoda eklenen tüm termin gruplarını temizle
    Object.keys(brutIhtiyac).forEach(bk => {
      if (bk.startsWith(malkodLower + '__')) delete brutIhtiyac[bk]
    })

    // Plan termini ile tek satır olarak ekle
    const grupKey = malkodLower + '__' + planTermin
    brutIhtiyac[grupKey] = { malkod: hmk, malad: hmM?.ad || p.hamMalad || hmk, tip: hmM?.tip || 'Hammadde', birim: hmM?.birim || 'Adet', brut: planAdet, termin: planTermin }
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

    const kLower = (bi.malkod || '').trim().toLowerCase()
    const stokDus = Math.min(stokPool[kLower] || 0, bi.brut)
    stokPool[kLower] = (stokPool[kLower] || 0) - stokDus
    const kalan = Math.max(0, bi.brut - stokDus)
    const acikDus = Math.min(acikTedPool[kLower] || 0, kalan)
    acikTedPool[kLower] = (acikTedPool[kLower] || 0) - acikDus
    const net = Math.max(0, Math.ceil(bi.brut - stokDus - acikDus))
    const durum: MRPRow['durum'] = (stokDus + acikDus) >= bi.brut ? 'yeterli' : net > 0 ? 'eksik' : 'yeterli'

    sonuc.push({
      malkod: bi.malkod, malad: bi.malad, tip: bi.tip, birim: bi.birim,
      brut: bi.brut, stok: stokDus, acikTedarik: acikDus, net, durum,
      termin: bi.termin || '',
    })
  }

  dbg('[MRP DEBUG] FINAL brütIhtiyac keys:', Object.keys(brutIhtiyac).length, '| sonuç satır:', sonuc.length, '| mallar:', Object.values(brutIhtiyac).map(b => b.malkod))

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
  let mevcutMap: Record<string, number> = {}
  if (orderId) {
    const { data: mevcutTedarikler, error: tErr } = await supabase
      .from('uys_tedarikler')
      .select('malkod, miktar, teslim_tarihi')
      .eq('order_id', orderId)
      .eq('geldi', false)
    if (tErr) {
      // Sorgu fail olursa eski davranışa düş — bug duruma sebep olur ama akış bozulmaz.
      console.warn('[v15.56 mrpTedarikOlustur] Mevcut tedarik kontrolü fail, eski davranışa düşüyor:', tErr.message)
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
  _orderId: string,
  _mrpRows: MRPRow[]
): Promise<number> {
  // v15.70: no-op (rezerve sistemi kapatıldı)
  return 0
}

// Bir siparişe ait tüm rezerveleri siler — v15.70: no-op
export async function rezerveSil(_orderId: string): Promise<void> {
  // v15.70: no-op (rezerve sistemi kapatıldı)
  return
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
  _orders: any[],
  _workOrders: WorkOrder[],
  _recipes: Recipe[],
  _stokHareketler: StokHareket[],
  _tedarikler: Tedarik[],
  _cuttingPlans: { hamMalkod: string; hamMalad: string; durum: string; gerekliAdet: number; satirlar: any[] }[],
  _materials: Material[],
): Promise<{ siparisSayisi: number; rezerveSayisi: number }> {
  // v15.70: no-op (rezerve sistemi kapatıldı). Caller imzaları korundu.
  return { siparisSayisi: 0, rezerveSayisi: 0 }
}

// ═══ v15.74 — SİPARİŞ DELTA HESABI (İş Emri #13 madde 11) ═══
// Sipariş edit edildiğinde "ne değişti" tespit eder. 8 senaryo:
//   1 ARTIS    — kalem adet ↑     → WO hedefleri × mpm ile artar (yeni İE açılmaz)
//   2 AZALIS   — kalem adet ↓     → WO hedefleri azalır (üretildi > yeniAdet ise BLOCK)
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
        // AZALIS — üretildi > yeniAdet ise hata
        if (uretildi > yeniK.adet) {
          result.hatalar.push(
            `Reçete ${rcId} için ${uretildi} adet üretildi, yeni adet ${yeniK.adet} olamaz (azaltma kabul edilmez)`
          )
        }
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
        const c = await buildWorkOrders(
          delta.orderId, newOrder.siparisNo, kd.rcId, kd.yeniAdet,
          recipes, yeniKalem.termin, baslangicSira
        )
        ozetler.push(`Yeni kalem → ${c} İE oluşturuldu`)
      }
    }

    // 'recete' senaryosu kalem_sil + kalem_ekle olarak gelir (rcId değiştiği için
    // siparisDelta yukarıda zaten ikisini tespit eder). Bu yüzden ayrı handler yok.
  }

  return { ozetler }
}
