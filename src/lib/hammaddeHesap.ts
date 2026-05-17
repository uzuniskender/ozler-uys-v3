/**
 * hammaddeHesap.ts — Tek kaynak hammadde hesaplama modülü
 * KURAL: Stok / ihtiyaç / net durum hesabı yalnızca buradan yapılır.
 */

// WO aktif kontrolü — circular import önlemek için statusUtils'ten bağımsız mini helper
function _isWoAktif(w: any): boolean {
  const d = w.durum || ''
  return d !== 'iptal' && d !== 'tamamlandi' && d !== 'kismi_tamam'
}

// Stok hareketi delta — getStok ve buildStokMap ortak semantiği
function _stokDelta(h: any): number {
  if (h.tip === 'giris') return Number(h.miktar)
  if (h.tip === 'cikis' || h.tip === 'bar_acilis' || h.tip === 'rezerv') return -Number(h.miktar)
  return 0
}

// ─── 1. FİZİKSEL STOK ────────────────────────────────────────────────────────
export function getStok(malkod: string, stokHareketler: any[]): number {
  return Math.floor(
    stokHareketler
      .filter((h: any) => h.malkod === malkod)
      .reduce((a: number, h: any) => a + _stokDelta(h), 0)
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
    if (!_isWoAktif(w)) continue
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

// ─── 3. SİPARİŞ BAZINDA EKSİK ────────────────────────────────────────────────
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
      w.orderId === o.id && _isWoAktif(w)
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
      if ((ihtiyac as number) > getStok(malkod, stokHareketler) + getYolda(malkod, tedarikler)) {
        eksikSet.add(malkod)
      }
    }
    if (eksikSet.size > 0) result.set(o.id, eksikSet)
  }

  return result
}

// ─── 4. TOPLU STOK MAP ───────────────────────────────────────────────────────
// Tüm stokHareketler'den malkod → net stok haritası (tek geçiş, O(n))
export function buildStokMap(stokHareketler: any[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const h of (stokHareketler || [])) {
    const mk: string = h.malkod
    if (!mk) continue
    const delta = _stokDelta(h)
    if (delta !== 0) map[mk] = (map[mk] ?? 0) + delta
  }
  return map
}

// ─── 5. TEDARİK YOLDA ────────────────────────────────────────────────────────
// Malkod için açık (gelmemiş) tedarik toplamı
export function getYolda(malkod: string, tedarikler: any[]): number {
  return (tedarikler || [])
    .filter((t: any) => t.malkod === malkod && !t.geldi)
    .reduce((a: number, t: any) => a + Number(t.miktar || 0), 0)
}
