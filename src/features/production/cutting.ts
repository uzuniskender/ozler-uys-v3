import { uid, today } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { WorkOrder, Material, Recipe } from '@/types'

interface KesimKesim {
  woId: string; ieNo: string
  malkod: string; malad: string
  parcaBoy: number; parcaEn?: number
  adet: number; tamamlandi: number
}

interface KesimSatir {
  id: string; hamAdet: number; fireMm: number
  kesimler: KesimKesim[]; durum: string
}

interface KesimPlanSonuc {
  id: string; hamMalkod: string; hamMalad: string; hamBoy: number; hamEn: number
  kesimTip: string; durum: string; tarih: string
  satirlar: KesimSatir[]; gerekliAdet: number
}

// Parça boyunu malzeme bilgisinden veya adından al
function getParcaBoy(malkod: string, materials: Material[]): number {
  const m = materials.find(x => x.kod === malkod)
  if (m && m.boy && m.en) return Math.min(m.boy, m.en)
  if (m && m.boy) return m.boy
  return 0
}

function getParcaEn(malkod: string, materials: Material[]): number {
  const m = materials.find(x => x.kod === malkod)
  if (m && m.boy && m.en) return Math.max(m.boy, m.en)
  return 0
}

// ═══ KESİM PLANI OLUŞTUR — v2 _kesimPlanOlusturCore port'u ═══
export function kesimPlanOlustur(
  workOrders: WorkOrder[],
  operations: { id: string; ad: string; kod: string }[],
  recipes: Recipe[],
  materials: Material[],
  logs: { woId: string; qty: number }[],
  mevcutPlanlar: KesimPlanSonuc[]
): KesimPlanSonuc[] {
  function wProd(woId: string): number { return logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0) }
  function wPct(w: WorkOrder): number { return w.hedef > 0 ? Math.min(100, Math.round(wProd(w.id) / w.hedef * 100)) : 0 }

  const kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH']

  // HM bazlı gruplama: hamMalkod → ihtiyaçlar
  const gruplar: Record<string, {
    hamMalkod: string; hamMalad: string; hamBoy: number; hamEn: number
    kesimTip: string; ihtiyaclar: { woId: string; ieNo: string; malkod: string; malad: string; parcaBoy: number; parcaEn: number; adet: number }[]
  }> = {}

  for (const w of workOrders) {
    if (wPct(w) >= 100 || w.durum === 'iptal') continue
    const kalan = Math.max(0, w.hedef - wProd(w.id))
    if (!kalan) continue

    // Sadece kesim operasyonlu İE'ler
    const wOp = operations.find(o => o.id === w.opId)
    const wOpAd = (wOp?.ad || w.opAd || '').toUpperCase()
    if (!kesimOps.some(k => wOpAd.includes(k))) continue

    // HM bileşenlerini bul
    const hmSatirlar: { malkod: string; malad: string }[] = []
    if (w.hm?.length) {
      w.hm.forEach(h => hmSatirlar.push({ malkod: h.malkod, malad: h.malad }))
    } else {
      // BOM'dan bir seviye aşağı
      const rc = recipes.find(r => r.id === w.rcId) || recipes.find(r => r.mamulKod === w.malkod)
      if (rc?.satirlar) {
        const woKirno = w.kirno || '1'
        const depth = woKirno.split('.').length
        rc.satirlar.filter(s =>
          (s.tip === 'Hammadde' || s.tip === 'Sarf') &&
          (s.kirno || '').startsWith(woKirno + '.') &&
          (s.kirno || '').split('.').length === depth + 1
        ).forEach(s => hmSatirlar.push({ malkod: s.malkod || '', malad: s.malad || '' }))
      }
    }

    for (const hm of hmSatirlar) {
      const hmalkod = hm.malkod; if (!hmalkod) continue
      const hmM = materials.find(m => m.kod === hmalkod)
      const hamBoy = hmM?.boy || 0
      const hamEn = hmM?.en || 0
      if (!hamBoy) continue // Boy bilgisi yoksa kesim yapılamaz

      const parcaBoy = getParcaBoy(w.malkod, materials)
      const parcaEn = getParcaEn(w.malkod, materials)
      const kesimTip = parcaEn > 0 ? 'yuzey' : 'boy'

      if (!gruplar[hmalkod]) {
        gruplar[hmalkod] = {
          hamMalkod: hmalkod, hamMalad: hm.malad || hmM?.ad || hmalkod,
          hamBoy, hamEn, kesimTip, ihtiyaclar: []
        }
      }

      // Aynı WO zaten varsa topla
      const mevcut = gruplar[hmalkod].ihtiyaclar.find(x => x.woId === w.id && x.malkod === w.malkod)
      if (mevcut) { mevcut.adet += kalan }
      else {
        gruplar[hmalkod].ihtiyaclar.push({
          woId: w.id, ieNo: w.ieNo || w.id,
          malkod: w.malkod, malad: w.malad || w.malkod,
          parcaBoy: parcaBoy || 0, parcaEn: parcaEn || 0,
          adet: kalan
        })
      }
    }
  }

  if (!Object.keys(gruplar).length) return []

  // Her grup için optimum kesim planı oluştur
  const sonuclar: KesimPlanSonuc[] = []
  const mevcutKopyasi = [...mevcutPlanlar]

  for (const g of Object.values(gruplar)) {
    // Mevcut bekleyen plan var mı?
    const mevcutPlan = mevcutKopyasi.find(p => p.hamMalkod === g.hamMalkod && p.durum !== 'tamamlandi')

    if (mevcutPlan) {
      // Mevcut plan var — sadece henüz planlanmamış WO'ları ekle
      const planlananWoIds = new Set<string>()
      mevcutPlan.satirlar.forEach(s => s.kesimler.forEach(k => planlananWoIds.add(k.woId)))
      const yeniIhtiyaclar = g.ihtiyaclar.filter(iht => !planlananWoIds.has(iht.woId))
      if (yeniIhtiyaclar.length > 0) {
        const ekGrup = { ...g, ihtiyaclar: yeniIhtiyaclar }
        const ekSatirlar = boykesimOptimum(ekGrup, workOrders, materials, logs)
        mevcutPlan.satirlar = mevcutPlan.satirlar.concat(ekSatirlar)
        mevcutPlan.gerekliAdet = mevcutPlan.satirlar.reduce((a, s) => a + s.hamAdet, 0)
      }
      sonuclar.push(mevcutPlan)
    } else {
      // Yeni plan oluştur
      const satirlar = boykesimOptimum(g, workOrders, materials, logs)
      const plan: KesimPlanSonuc = {
        id: uid(), hamMalkod: g.hamMalkod, hamMalad: g.hamMalad,
        hamBoy: g.hamBoy, hamEn: g.hamEn, kesimTip: g.kesimTip,
        durum: 'bekliyor', tarih: today(),
        satirlar, gerekliAdet: satirlar.reduce((a, s) => a + s.hamAdet, 0),
      }
      sonuclar.push(plan)
    }
  }

  return sonuclar
}

// Boy kesim optimizasyonu — Decreasing First Fit + Fire Doldurma
function boykesimOptimum(
  g: { hamMalkod: string; hamBoy: number; ihtiyaclar: { woId: string; ieNo: string; malkod: string; malad: string; parcaBoy: number; parcaEn: number; adet: number }[] },
  allWOs: WorkOrder[],
  materials: Material[],
  logs: { woId: string; qty: number }[]
): KesimSatir[] {
  const hamBoy = g.hamBoy || 6000
  const ihtiyaclar = g.ihtiyaclar.slice().sort((a, b) => (b.parcaBoy || 0) - (a.parcaBoy || 0))

  // Bar listesi
  const barlar: { kalan: number; kesimler: KesimKesim[] }[] = []

  for (const iht of ihtiyaclar) {
    const parcaBoy = iht.parcaBoy; if (!parcaBoy) continue
    let kalanAdet = iht.adet

    while (kalanAdet > 0) {
      // Best-fit: en az boşluk bırakan bar'ı seç
      let enIyiBi = -1; let enIyiKalan = Infinity
      for (let bi = 0; bi < barlar.length; bi++) {
        const adedPerBor = Math.floor(barlar[bi].kalan / parcaBoy)
        if (adedPerBor > 0) {
          const konulacak = Math.min(adedPerBor, kalanAdet)
          const kalanSonra = barlar[bi].kalan - konulacak * parcaBoy
          if (kalanSonra < enIyiKalan) { enIyiKalan = kalanSonra; enIyiBi = bi }
        }
      }
      if (enIyiBi >= 0) {
        const bar = barlar[enIyiBi]
        const adedPerBor = Math.floor(bar.kalan / parcaBoy)
        const konulan = Math.min(adedPerBor, kalanAdet)
        const mev = bar.kesimler.find(k => k.woId === iht.woId && k.malkod === iht.malkod)
        if (mev) mev.adet += konulan
        else bar.kesimler.push({ woId: iht.woId, ieNo: iht.ieNo, malkod: iht.malkod, malad: iht.malad, parcaBoy, adet: konulan, tamamlandi: 0 })
        bar.kalan -= konulan * parcaBoy
        kalanAdet -= konulan
      } else {
        // Yeni bar aç
        const adedPerYeni = Math.floor(hamBoy / parcaBoy)
        const konulan = Math.min(adedPerYeni, kalanAdet)
        barlar.push({
          kalan: hamBoy - konulan * parcaBoy,
          kesimler: [{ woId: iht.woId, ieNo: iht.ieNo, malkod: iht.malkod, malad: iht.malad, parcaBoy, adet: konulan, tamamlandi: 0 }]
        })
        kalanAdet -= konulan
      }
    }
  }

  // Fire doldurma — kalan boşluklara mevcut WO'lardan ekle
  for (const bar of barlar) {
    if (bar.kalan < 10) continue
    const ilgiliWOs = allWOs.filter(w => {
      if (w.durum === 'iptal') return false
      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
      if (prod >= w.hedef) return false
      return (w.hm || []).some(h => h.malkod === g.hamMalkod)
    })
    for (const w of ilgiliWOs) {
      const pb = getParcaBoy(w.malkod, materials); if (!pb || pb > bar.kalan) continue
      const zatenPlan = barlar.reduce((a, b) => { const k = b.kesimler.find(k => k.woId === w.id); return a + (k ? k.adet : 0) }, 0)
      const kalan = Math.max(0, (w.hedef || 0) - zatenPlan)
      if (!kalan) continue
      const sigacak = Math.min(Math.floor(bar.kalan / pb), kalan)
      if (!sigacak) continue
      const mev = bar.kesimler.find(k => k.woId === w.id)
      if (mev) mev.adet += sigacak
      else bar.kesimler.push({ woId: w.id, ieNo: w.ieNo || w.id, malkod: w.malkod, malad: w.malad, parcaBoy: pb, adet: sigacak, tamamlandi: 0 })
      bar.kalan -= sigacak * pb
    }
  }

  // Aynı kesim düzenindeki barları grupla
  const gruplu: KesimSatir[] = []
  for (const bar of barlar) {
    const anahtar = bar.kesimler.map(k => k.woId + ':' + k.parcaBoy + ':' + k.adet).sort().join('|')
    const mev = gruplu.find(g => {
      const gAnahtar = g.kesimler.map(k => k.woId + ':' + k.parcaBoy + ':' + k.adet).sort().join('|')
      return gAnahtar === anahtar
    })
    if (mev) mev.hamAdet++
    else gruplu.push({ id: uid(), hamAdet: 1, fireMm: bar.kalan, kesimler: JSON.parse(JSON.stringify(bar.kesimler)), durum: 'bekliyor' })
  }

  return gruplu
}

// Kesim planlarını Supabase'e kaydet
export async function kesimPlanlariKaydet(planlar: KesimPlanSonuc[]): Promise<number> {
  if (!planlar.length) return 0
  for (const plan of planlar) {
    await supabase.from('uys_kesim_planlari').upsert({
      id: plan.id,
      ham_malkod: plan.hamMalkod, ham_malad: plan.hamMalad,
      ham_boy: plan.hamBoy, ham_en: plan.hamEn,
      kesim_tip: plan.kesimTip, durum: plan.durum,
      satirlar: plan.satirlar, gerekli_adet: plan.gerekliAdet,
      tarih: plan.tarih,
    }, { onConflict: 'id' })
  }
  return planlar.length
}

// ═══ BACKWARD COMPAT ═══
export { kesimPlanlariKaydet as kesimPlaniKaydet }

interface KesimIhtiyacCompat { malkod: string; malad: string; boy: number; adet: number; woId?: string; ieNo?: string }
interface KesimSonucCompat { hamMalkod: string; hamMalad: string; hamBoy: number; kesimTip: string; gerekliAdet: number; satirlar: { malkod: string; malad: string; boy: number; adet: number }[]; fire: number; fireOran: number }

export function optimizeKesim(ihtiyaclar: KesimIhtiyacCompat[], hamMalzemeler: Material[]): KesimSonucCompat[] {
  if (!ihtiyaclar.length) return []
  const groups: Record<string, KesimIhtiyacCompat[]> = {}
  ihtiyaclar.forEach(k => { const key = k.malkod.replace(/\d+$/, ''); if (!groups[key]) groups[key] = []; groups[key].push(k) })
  const sonuclar: KesimSonucCompat[] = []
  for (const [, parcalar] of Object.entries(groups)) {
    const uygunHM = hamMalzemeler.filter(m => m.tip === 'Hammadde' && m.boy > 0 && parcalar.some(p => p.boy > 0 && p.boy <= m.boy))
    if (!uygunHM.length) continue
    let best: KesimSonucCompat | null = null
    for (const hm of uygunHM) {
      const items: number[] = []; parcalar.forEach(p => { for (let i = 0; i < p.adet; i++) items.push(p.boy) }); items.sort((a, b) => b - a)
      const bars: number[] = []
      for (const item of items) { if (item <= 0 || item > hm.boy) continue; let placed = false; for (let i = 0; i < bars.length; i++) { if (bars[i] >= item) { bars[i] -= item; placed = true; break } }; if (!placed) bars.push(hm.boy - item) }
      const totalFire = bars.reduce((a, b) => a + b, 0); const totalUsed = bars.length * hm.boy; const fireOran = totalUsed > 0 ? Math.round(totalFire / totalUsed * 100) : 0
      const plan: KesimSonucCompat = { hamMalkod: hm.kod, hamMalad: hm.ad, hamBoy: hm.boy, kesimTip: 'boy', gerekliAdet: bars.length, satirlar: parcalar.map(p => ({ malkod: p.malkod, malad: p.malad, boy: p.boy, adet: p.adet })), fire: totalFire, fireOran }
      if (!best || plan.fireOran < best.fireOran) best = plan
    }
    if (best) sonuclar.push(best)
  }
  return sonuclar
}
