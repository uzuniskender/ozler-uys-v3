import { uid, today } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Material } from '@/types'

interface KesimIhtiyac {
  malkod: string; malad: string; boy: number; adet: number
  woId?: string; ieNo?: string
}

interface KesimSonuc {
  hamMalkod: string; hamMalad: string; hamBoy: number
  kesimTip: string; gerekliAdet: number
  satirlar: { malkod: string; malad: string; boy: number; adet: number }[]
  fire: number; fireOran: number
}

/**
 * Kesim Planı Optimizasyonu - Decreasing First Fit
 * Ham malzeme boylarından parça kesilecek optimum planı hesaplar
 */
export function optimizeKesim(
  ihtiyaclar: KesimIhtiyac[],
  hamMalzemeler: Material[]
): KesimSonuc[] {
  if (!ihtiyaclar.length) return []

  // Malzeme koduna göre grupla
  const groups: Record<string, KesimIhtiyac[]> = {}
  ihtiyaclar.forEach(k => {
    const key = k.malkod.replace(/\d+$/, '') // Prefix bazlı gruplama
    if (!groups[key]) groups[key] = []
    groups[key].push(k)
  })

  const sonuclar: KesimSonuc[] = []

  for (const [, parcalar] of Object.entries(groups)) {
    // En uygun ham malzemeyi bul
    const uygunHM = hamMalzemeler.filter(m =>
      m.tip === 'Hammadde' && m.boy > 0 &&
      parcalar.some(p => p.boy > 0 && p.boy <= m.boy)
    )

    if (!uygunHM.length) continue

    // Her ham malzeme için hesapla, en az fire olanı seç
    let bestPlan: KesimSonuc | null = null

    for (const hm of uygunHM) {
      const plan = decreasingFirstFit(parcalar, hm.boy)
      if (!bestPlan || plan.fireOran < bestPlan.fireOran) {
        bestPlan = {
          hamMalkod: hm.kod, hamMalad: hm.ad, hamBoy: hm.boy,
          kesimTip: 'boy', gerekliAdet: plan.barCount,
          satirlar: parcalar.map(p => ({ malkod: p.malkod, malad: p.malad, boy: p.boy, adet: p.adet })),
          fire: plan.totalFire, fireOran: plan.fireOran,
        }
      }
    }

    if (bestPlan) sonuclar.push(bestPlan)
  }

  return sonuclar
}

/**
 * Decreasing First Fit algoritması
 */
function decreasingFirstFit(parcalar: KesimIhtiyac[], hamBoy: number) {
  // Parçaları büyükten küçüğe sırala, tekrar et
  const items: number[] = []
  parcalar.forEach(p => {
    for (let i = 0; i < p.adet; i++) items.push(p.boy)
  })
  items.sort((a, b) => b - a)

  // Çubuklar
  const bars: number[] = [] // kalan boyluk

  for (const item of items) {
    if (item <= 0 || item > hamBoy) continue
    // İlk sığan çubuğu bul
    let placed = false
    for (let i = 0; i < bars.length; i++) {
      if (bars[i] >= item) {
        bars[i] -= item
        placed = true
        break
      }
    }
    if (!placed) {
      bars.push(hamBoy - item)
    }
  }

  const totalFire = bars.reduce((a, b) => a + b, 0)
  const totalUsed = bars.length * hamBoy
  const fireOran = totalUsed > 0 ? Math.round(totalFire / totalUsed * 100) : 0

  return { barCount: bars.length, totalFire, fireOran }
}

/**
 * Kesim planını Supabase'e kaydet
 */
export async function kesimPlaniKaydet(sonuclar: KesimSonuc[]): Promise<number> {
  if (!sonuclar.length) return 0

  const rows = sonuclar.map(s => ({
    id: uid(),
    ham_malkod: s.hamMalkod, ham_malad: s.hamMalad, ham_boy: s.hamBoy,
    kesim_tip: s.kesimTip, durum: 'bekliyor',
    satirlar: s.satirlar, gerekli_adet: s.gerekliAdet,
    fire: s.fire, fire_oran: s.fireOran,
    tarih: today(),
  }))

  for (let i = 0; i < rows.length; i += 50) {
    await supabase.from('uys_kesim_planlari').upsert(rows.slice(i, i + 50), { onConflict: 'id' })
  }

  return rows.length
}
