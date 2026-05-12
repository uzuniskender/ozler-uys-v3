/**
 * hammaddeHesap.ts — Tek kaynak hammadde hesaplama modülü
 * KURAL: Stok / ihtiyaç / net durum hesabı yalnızca buradan yapılır.
 */

// ─── 1. FİZİKSEL STOK ────────────────────────────────────────────────────────
export function getStok(malkod: string, stokHareketler: any[]): number {
  return Math.floor(
    stokHareketler
      .filter((h: any) => h.malkod === malkod)
      .reduce((a: number, h: any) => {
        if (h.tip === 'giris') return a + Number(h.miktar)
        if (h.tip === 'cikis' || h.tip === 'bar_acilis' || h.tip === 'rezerv') return a - Number(h.miktar)
        return a
      }, 0)
  )
}

// ─── 2. İHTİYAÇ HARİTASI ─────────────────────────────────────────────────────
// Kesim planı olan malzeme → plan bar adedi
// Kesim planı olmayan      → WO hm.miktarTotal
export function buildIhtiyacMap(
  allWos: any[],
  cuttingPlans: any[],
  materials?: any[]
): Record<string, { malkod: string; malad: string; ihtiyac: number }> {
  const map: Record<string, { malkod: string; malad: string; ihtiyac: number }> = {}
  const planliMalkodlar = new Set<string>()

  for (const p of (cuttingPlans || [])) {
    if (p.durum === 'tamamlandi' || p.durum === 'iptal') continue
    const toplamBar = (p.satirlar || []).reduce((a: number, s: any) => a + (Number(s.hamAdet) || 0), 0)
    if (toplamBar <= 0) continue
    const mk: string = p.hamMalkod
    if (!mk) continue
    if (!map[mk]) map[mk] = { malkod: mk, malad: p.hamMalad || '', ihtiyac: 0 }
    map[mk].ihtiyac += toplamBar
    planliMalkodlar.add(mk)
  }

  for (const w of (allWos || [])) {
    if (w.durum === 'iptal' || w.durum === 'tamamlandi' || w.durum === 'kismi_tamam') continue
    for (const h of (w.hm || [])) {
      const mk: string = (h.malkod || '').trim()
      if (!mk || planliMalkodlar.has(mk)) continue
      if (materials) {
        const mat = materials.find((m: any) => m.kod === mk)
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
  stokHareketler: any[],
  allWos: any[],
  cuttingPlans: any[],
  tedarikler: any[],
  materials?: any[]
): { stok: number; ihtiyac: number; yolda: number; net: number } {
  const stok = getStok(malkod, stokHareketler)
  const ihtiyacMapResult = buildIhtiyacMap(allWos, cuttingPlans, materials)
  const ihtiyac = Math.ceil(ihtiyacMapResult[malkod]?.ihtiyac || 0)
  const yolda = (tedarikler || [])
    .filter((t: any) => t.malkod === malkod && !t.geldi)
    .reduce((a: number, t: any) => a + Number(t.miktar || 0), 0)
  return { stok, ihtiyac, yolda, net: Math.max(0, ihtiyac - stok - yolda) }
}

// ─── 4. SİPARİŞ BAZINDA EKSİK ────────────────────────────────────────────────
export function computeOrderEksik(
  orders: any[],
  allWos: any[],
  stokHareketler: any[],
  tedarikler: any[],
  cuttingPlans: any[],
  materials?: any[]
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()

  const planBarMap: Record<string, number> = {}
  const planliMalkodlar = new Set<string>()
  for (const p of (cuttingPlans || [])) {
    if (p.durum === 'tamamlandi' || p.durum === 'iptal') continue
    const toplam = (p.satirlar || []).reduce((a: number, s: any) => a + (Number(s.hamAdet) || 0), 0)
    if (toplam > 0 && p.hamMalkod) {
      planBarMap[p.hamMalkod] = (planBarMap[p.hamMalkod] || 0) + toplam
      planliMalkodlar.add(p.hamMalkod)
    }
  }

  for (const o of (orders || [])) {
    const oWos = (allWos || []).filter((w: any) =>
      w.orderId === o.id && w.durum !== 'iptal' && w.durum !== 'tamamlandi'
    )
    const hmGrup: Record<string, number> = {}

    for (const [mk, adet] of Object.entries(planBarMap)) {
      if (oWos.some((w: any) => (w.hm || []).some((h: any) => h.malkod === mk))) {
        hmGrup[mk] = adet as number
      }
    }

    for (const w of oWos) {
      for (const h of (w.hm || [])) {
        const mk: string = (h.malkod || '').trim()
        if (!mk || planliMalkodlar.has(mk)) continue
        if (materials) {
          const mat = materials.find((m: any) => m.kod === mk)
          if (mat?.tip === 'YarıMamul') continue
        }
        hmGrup[mk] = (hmGrup[mk] || 0) + Number(h.miktarTotal || 0)
      }
    }

    const eksikSet = new Set<string>()
    for (const [malkod, ihtiyac] of Object.entries(hmGrup)) {
      const stok = getStok(malkod, stokHareketler)
      const yolda = (tedarikler || [])
        .filter((t: any) => t.malkod === malkod && !t.geldi)
        .reduce((a: number, t: any) => a + Number(t.miktar || 0), 0)
      if ((ihtiyac as number) > stok + yolda) eksikSet.add(malkod)
    }
    if (eksikSet.size > 0) result.set(o.id, eksikSet)
  }

  return result
}
