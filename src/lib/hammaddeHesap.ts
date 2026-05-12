/**
 * hammaddeHesap.ts — Tek kaynak hammadde hesaplama modülü
 *
 * KURAL: Stok, ihtiyaç, net durum hesabı yalnızca buradan yapılır.
 * Başka dosyada bu hesap tekrarlanmaz.
 *
 * Fonksiyonlar:
 *   getStok(malkod, stokHareketler)        → fiziksel stok
 *   buildIhtiyacMap(allWos, cuttingPlans)  → ihtiyaç haritası
 *   getNetDurum(malkod, ...)               → {stok, ihtiyac, yolda, net}
 *   computeOrderEksik(orders, ...)         → sipariş bazında eksik malzeme seti
 */

import type { WorkOrder, CuttingPlan, StokHareket } from '@/types'

// ─── 1. FİZİKSEL STOK ────────────────────────────────────────────────────────
// giris - cikis - bar_acilis - rezerv
export function getStok(malkod: string, stokHareketler: StokHareket[]): number {
  return Math.floor(
    stokHareketler
      .filter(h => h.malkod === malkod)
      .reduce((a, h) => {
        if (h.tip === 'giris') return a + h.miktar
        if (h.tip === 'cikis' || h.tip === 'bar_acilis' || (h.tip as string) === 'rezerv') return a - h.miktar
        return a
      }, 0)
  )
}

// ─── 2. İHTİYAÇ HARİTASI ─────────────────────────────────────────────────────
// Kesim planı olan malzeme → plan bar adedi
// Kesim planı olmayan      → WO hm.miktarTotal
export function buildIhtiyacMap(
  allWos: WorkOrder[],
  cuttingPlans: CuttingPlan[],
  materials?: { kod: string; tip: string }[]
): Record<string, { malkod: string; malad: string; ihtiyac: number }> {
  const map: Record<string, { malkod: string; malad: string; ihtiyac: number }> = {}
  const planliMalkodlar = new Set<string>()

  // 1. Aktif kesim planlarından malkod → toplam bar
  for (const p of cuttingPlans) {
    if (p.durum === 'tamamlandi' || p.durum === 'iptal') continue
    const toplamBar = (p.satirlar || []).reduce((a, s) => a + ((s as any).hamAdet || 0), 0)
    if (toplamBar <= 0) continue
    const mk = p.hamMalkod
    if (!map[mk]) map[mk] = { malkod: mk, malad: p.hamMalad || '', ihtiyac: 0 }
    map[mk].ihtiyac += toplamBar
    planliMalkodlar.add(mk)
  }

  // 2. Aktif WO'ların hm — kesim planında olmayan malzemeler
  for (const w of allWos) {
    if (w.durum === 'iptal' || w.durum === 'tamamlandi' || w.durum === 'kismi_tamam') continue
    for (const h of ((w.hm || []) as any[])) {
      const mk = (h.malkod || '').trim()
      if (!mk || planliMalkodlar.has(mk)) continue
      if (materials) {
        const mat = materials.find(m => m.kod === mk)
        if (mat?.tip === 'YarıMamul') continue
      }
      if (!map[mk]) map[mk] = { malkod: mk, malad: h.malad || '', ihtiyac: 0 }
      map[mk].ihtiyac += Number(h.miktarTotal || 0)
    }
  }

  return map
}

// ─── 3. TEK MALKOD NET DURUM ──────────────────────────────────────────────────
export function getNetDurum(
  malkod: string,
  stokHareketler: StokHareket[],
  allWos: WorkOrder[],
  cuttingPlans: CuttingPlan[],
  tedarikler: { malkod: string; miktar: number; geldi: boolean }[],
  materials?: { kod: string; tip: string }[]
): { stok: number; ihtiyac: number; yolda: number; net: number } {
  const stok = getStok(malkod, stokHareketler)
  const ihtiyacMap = buildIhtiyacMap(allWos, cuttingPlans, materials)
  const ihtiyac = Math.ceil(ihtiyacMap[malkod]?.ihtiyac || 0)
  const yolda = tedarikler
    .filter(t => t.malkod === malkod && !t.geldi)
    .reduce((a, t) => a + t.miktar, 0)
  return { stok, ihtiyac, yolda, net: Math.max(0, ihtiyac - stok - yolda) }
}

// ─── 4. SİPARİŞ BAZINDA EKSİK ────────────────────────────────────────────────
// WorkOrders.tsx ve statusUtils.ts'te kullanılır
export function computeOrderEksik(
  orders: any[],
  allWos: WorkOrder[],
  stokHareketler: StokHareket[],
  tedarikler: { malkod: string; miktar: number; geldi: boolean }[],
  cuttingPlans: CuttingPlan[],
  materials?: { kod: string; tip: string }[]
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()

  // Tüm aktif planların malkod → bar haritası (sipariş bağımsız, global)
  const planBarMap: Record<string, number> = {}
  const planliMalkodlar = new Set<string>()
  for (const p of cuttingPlans) {
    if (p.durum === 'tamamlandi' || p.durum === 'iptal') continue
    const toplam = (p.satirlar || []).reduce((a, s) => a + ((s as any).hamAdet || 0), 0)
    if (toplam > 0) {
      planBarMap[p.hamMalkod] = (planBarMap[p.hamMalkod] || 0) + toplam
      planliMalkodlar.add(p.hamMalkod)
    }
  }

  for (const o of orders) {
    const oWos = allWos.filter(w =>
      w.orderId === o.id &&
      w.durum !== 'iptal' &&
      w.durum !== 'tamamlandi'
    )

    const hmGrup: Record<string, number> = {}

    // Kesim planındaki malzemeler — bu siparişin WO'larında varsa ekle
    for (const [mk, adet] of Object.entries(planBarMap)) {
      if (oWos.some(w => ((w.hm || []) as any[]).some((h: any) => h.malkod === mk))) {
        hmGrup[mk] = adet
      }
    }

    // Kesim planında olmayan WO hm'leri
    for (const w of oWos) {
      for (const h of ((w.hm || []) as any[])) {
        const mk = (h.malkod || '').trim()
        if (!mk || planliMalkodlar.has(mk)) continue
        if (materials) {
          const mat = materials.find(m => m.kod === mk)
          if (mat?.tip === 'YarıMamul') continue
        }
        hmGrup[mk] = (hmGrup[mk] || 0) + Number(h.miktarTotal || 0)
      }
    }

    const eksikSet = new Set<string>()
    for (const [malkod, ihtiyac] of Object.entries(hmGrup)) {
      const stok = getStok(malkod, stokHareketler)
      const yolda = tedarikler
        .filter(t => t.malkod === malkod && !t.geldi)
        .reduce((a, t) => a + t.miktar, 0)
      if (ihtiyac > stok + yolda) eksikSet.add(malkod)
    }
    if (eksikSet.size > 0) result.set(o.id, eksikSet)
  }

  return result
}
