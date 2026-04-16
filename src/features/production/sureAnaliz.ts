import type { Recipe, WorkOrder, ProductionLog } from '@/types'

export interface SureAnaliz {
  ortDkPerAdet: number    // Ortalama adam-dakika / adet
  toplamDk: number         // Toplam adam-dakikası
  toplamAdet: number       // Toplam üretilen adet
  woSayisi: number         // Katkıda bulunan İE sayısı
  logSayisi: number        // Katkıda bulunan log sayısı
}

// İki HH:mm arasındaki farkı dakika olarak döndür (taşma yoksa pozitif)
function dakikaFark(bas: string, bit: string): number {
  if (!bas || !bit) return 0
  const [bH, bM] = bas.split(':').map(Number)
  const [eH, eM] = bit.split(':').map(Number)
  if (isNaN(bH) || isNaN(bM) || isNaN(eH) || isNaN(eM)) return 0
  let diff = (eH * 60 + eM) - (bH * 60 + bM)
  // Gece yarısından geçen vardiya için 24 saat ekle
  if (diff < -60) diff += 24 * 60
  return diff > 0 ? diff : 0
}

// Belirli bir reçete + kirno için gerçek operatör süre analizi
export function analizSureForKirno(
  recipeId: string,
  kirno: string,
  workOrders: WorkOrder[],
  logs: ProductionLog[],
): SureAnaliz {
  const woList = workOrders.filter(w => w.rcId === recipeId && (w.kirno || '') === kirno)
  if (woList.length === 0) return { ortDkPerAdet: 0, toplamDk: 0, toplamAdet: 0, woSayisi: 0, logSayisi: 0 }

  let toplamDk = 0
  let toplamAdet = 0
  let logSayisi = 0

  for (const wo of woList) {
    const woLogs = logs.filter(l => l.woId === wo.id)
    for (const log of woLogs) {
      if (!log.qty || log.qty <= 0) continue
      const oprs = (log.operatorlar || []) as { bas?: string; bit?: string }[]
      let logDk = 0
      for (const op of oprs) {
        logDk += dakikaFark(op.bas || '', op.bit || '')
      }
      if (logDk > 0) {
        toplamDk += logDk
        toplamAdet += log.qty
        logSayisi++
      }
    }
  }

  return {
    ortDkPerAdet: toplamAdet > 0 ? toplamDk / toplamAdet : 0,
    toplamDk, toplamAdet,
    woSayisi: woList.length,
    logSayisi,
  }
}

// Bir reçetenin tüm satırları için toplu analiz yap
// Dönen map: kirno → analiz
export function analizReceteTumSatirlar(
  recipe: Recipe,
  workOrders: WorkOrder[],
  logs: ProductionLog[],
): Record<string, SureAnaliz> {
  const out: Record<string, SureAnaliz> = {}
  for (const row of recipe.satirlar || []) {
    if (row.tip !== 'Mamul' && row.tip !== 'YarıMamul') continue
    if (!row.kirno) continue
    const r = analizSureForKirno(recipe.id, row.kirno, workOrders, logs)
    if (r.logSayisi > 0) out[row.kirno] = r
  }
  return out
}

// Dakika ölçümünü, satırın sureBirim'ine göre çevir
export function donusturBirim(dakika: number, hedefBirim: string | undefined): number {
  if (hedefBirim === 'sn') return dakika * 60
  return dakika // 'dk' veya tanımsız
}
