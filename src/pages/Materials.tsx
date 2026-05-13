import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo, useEffect } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm, showPrompt } from '@/lib/prompt'
import { Download, Plus, Pencil, Trash2, Upload, Copy } from 'lucide-react'
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown'
import type { Material } from '@/types'

// ─── Malzeme cinsi → yoğunluk (g/cm³) ───
const MALZEME_CINSLERI: { label: string; yogunluk: number }[] = [
  { label: 'Demir',     yogunluk: 7.85 },
  { label: 'Çelik',     yogunluk: 7.85 },
  { label: 'Alüminyum', yogunluk: 2.72 },
]

// ─── IH standart profil tablosu (EN 19-57) ───
// [kod, h(mm), b(mm), kg/m]
const IH_STANDARTLAR: { grup: string; items: { ad: string; h: number; b: number; kgm: number }[] }[] = [
  { grup: 'IPE', items: [
    { ad: 'IPE 80',  h: 80,  b: 46,  kgm: 6.00  },
    { ad: 'IPE 100', h: 100, b: 55,  kgm: 8.10  },
    { ad: 'IPE 120', h: 120, b: 64,  kgm: 10.40 },
    { ad: 'IPE 140', h: 140, b: 73,  kgm: 12.90 },
    { ad: 'IPE 160', h: 160, b: 82,  kgm: 15.80 },
    { ad: 'IPE 180', h: 180, b: 91,  kgm: 18.80 },
    { ad: 'IPE 200', h: 200, b: 100, kgm: 22.40 },
    { ad: 'IPE 220', h: 220, b: 110, kgm: 26.20 },
    { ad: 'IPE 240', h: 240, b: 120, kgm: 30.70 },
    { ad: 'IPE 270', h: 270, b: 135, kgm: 36.10 },
    { ad: 'IPE 300', h: 300, b: 150, kgm: 42.20 },
    { ad: 'IPE 330', h: 330, b: 160, kgm: 49.10 },
    { ad: 'IPE 360', h: 360, b: 170, kgm: 57.10 },
    { ad: 'IPE 400', h: 400, b: 180, kgm: 66.30 },
    { ad: 'IPE 450', h: 450, b: 190, kgm: 77.60 },
    { ad: 'IPE 500', h: 500, b: 200, kgm: 90.70 },
    { ad: 'IPE 550', h: 550, b: 210, kgm: 106.00},
    { ad: 'IPE 600', h: 600, b: 220, kgm: 122.00},
  ]},
  { grup: 'IPN', items: [
    { ad: 'IPN 80',  h: 80,  b: 42,  kgm: 5.94  },
    { ad: 'IPN 100', h: 100, b: 50,  kgm: 8.34  },
    { ad: 'IPN 120', h: 120, b: 58,  kgm: 11.10 },
    { ad: 'IPN 140', h: 140, b: 66,  kgm: 14.30 },
    { ad: 'IPN 160', h: 160, b: 74,  kgm: 17.90 },
    { ad: 'IPN 180', h: 180, b: 82,  kgm: 21.90 },
    { ad: 'IPN 200', h: 200, b: 90,  kgm: 26.20 },
    { ad: 'IPN 220', h: 220, b: 98,  kgm: 31.10 },
    { ad: 'IPN 240', h: 240, b: 106, kgm: 36.20 },
    { ad: 'IPN 260', h: 260, b: 113, kgm: 41.90 },
    { ad: 'IPN 280', h: 280, b: 119, kgm: 47.90 },
    { ad: 'IPN 300', h: 300, b: 125, kgm: 54.20 },
    { ad: 'IPN 320', h: 320, b: 131, kgm: 61.00 },
    { ad: 'IPN 340', h: 340, b: 137, kgm: 68.00 },
    { ad: 'IPN 360', h: 360, b: 143, kgm: 76.10 },
    { ad: 'IPN 380', h: 380, b: 149, kgm: 84.00 },
    { ad: 'IPN 400', h: 400, b: 155, kgm: 92.40 },
  ]},
  { grup: 'HE-B', items: [
    { ad: 'HE 100 B', h: 100, b: 100, kgm: 20.40 },
    { ad: 'HE 120 B', h: 120, b: 120, kgm: 26.70 },
    { ad: 'HE 140 B', h: 140, b: 140, kgm: 33.70 },
    { ad: 'HE 160 B', h: 160, b: 160, kgm: 42.60 },
    { ad: 'HE 180 B', h: 180, b: 180, kgm: 51.20 },
    { ad: 'HE 200 B', h: 200, b: 200, kgm: 61.30 },
    { ad: 'HE 220 B', h: 220, b: 220, kgm: 71.50 },
    { ad: 'HE 240 B', h: 240, b: 240, kgm: 83.20 },
    { ad: 'HE 260 B', h: 260, b: 260, kgm: 93.00 },
    { ad: 'HE 280 B', h: 280, b: 280, kgm: 103.00},
    { ad: 'HE 300 B', h: 300, b: 300, kgm: 117.00},
    { ad: 'HE 320 B', h: 320, b: 300, kgm: 127.00},
    { ad: 'HE 340 B', h: 340, b: 300, kgm: 134.00},
    { ad: 'HE 360 B', h: 360, b: 300, kgm: 142.00},
    { ad: 'HE 400 B', h: 400, b: 300, kgm: 155.00},
    { ad: 'HE 450 B', h: 450, b: 300, kgm: 171.00},
    { ad: 'HE 500 B', h: 500, b: 300, kgm: 187.00},
  ]},
  { grup: 'HE-A', items: [
    { ad: 'HE 100 A', h: 96,  b: 100, kgm: 16.70 },
    { ad: 'HE 120 A', h: 114, b: 120, kgm: 19.90 },
    { ad: 'HE 140 A', h: 133, b: 140, kgm: 24.70 },
    { ad: 'HE 160 A', h: 152, b: 160, kgm: 30.40 },
    { ad: 'HE 180 A', h: 171, b: 180, kgm: 35.50 },
    { ad: 'HE 200 A', h: 190, b: 200, kgm: 42.30 },
    { ad: 'HE 220 A', h: 210, b: 220, kgm: 50.50 },
    { ad: 'HE 240 A', h: 230, b: 240, kgm: 60.30 },
    { ad: 'HE 260 A', h: 250, b: 260, kgm: 68.20 },
    { ad: 'HE 280 A', h: 270, b: 280, kgm: 76.40 },
    { ad: 'HE 300 A', h: 290, b: 300, kgm: 88.30 },
  ]},
  { grup: 'HE-M', items: [
    { ad: 'HE 100 M', h: 120, b: 106, kgm: 41.80 },
    { ad: 'HE 120 M', h: 140, b: 126, kgm: 52.10 },
    { ad: 'HE 140 M', h: 160, b: 146, kgm: 63.20 },
    { ad: 'HE 160 M', h: 180, b: 166, kgm: 76.20 },
    { ad: 'HE 180 M', h: 200, b: 186, kgm: 88.90 },
    { ad: 'HE 200 M', h: 220, b: 206, kgm: 103.00},
    { ad: 'HE 220 M', h: 240, b: 226, kgm: 117.00},
    { ad: 'HE 240 M', h: 270, b: 248, kgm: 157.00},
    { ad: 'HE 260 M', h: 290, b: 268, kgm: 172.00},
    { ad: 'HE 280 M', h: 310, b: 288, kgm: 189.00},
    { ad: 'HE 300 M', h: 340, b: 310, kgm: 238.00},
  ]},
]

// ─── kg/m hesaplama ───
function hesaplaKgm(
  hammaddeTipi: string,
  boy: number, en: number, kalinlik: number, cap: number,
  yogunluk: number,
  ihKgm?: number
): number | null {
  const tip = (hammaddeTipi || '').toUpperCase()
  const ro = yogunluk // g/cm³

  // IH — standart tablo
  if (tip === 'IH') return ihKgm ?? null

  // Kesit alanı (mm²)
  let A = 0
  if (tip === 'BORU') {
    // Içi boş silindir: A = pi*t*(D-t)
    const D = cap, t = kalinlik
    if (D <= 0 || t <= 0 || t >= D / 2) return null
    A = Math.PI * t * (D - t)
  } else if (tip === 'MIL') {
    // Dolu silindir
    const d = cap
    if (d <= 0) return null
    A = Math.PI * (d / 2) ** 2
  } else if (tip === 'ALTK') {
    // Altıköşe — genişlik açıklığı s (across flats)
    const s = boy
    if (s <= 0) return null
    A = (Math.sqrt(3) / 2) * s * s
  } else if (tip === 'KARE') {
    // Kare çubuk
    const a = boy
    if (a <= 0) return null
    A = a * a
  } else if (tip === 'KSB') {
    // L kesit: A = t*(b1+b2-t)
    if (boy <= 0 || en <= 0 || kalinlik <= 0) return null
    A = kalinlik * (boy + en - kalinlik)
  } else if (tip === 'UPRF') {
    // U/C kesit: A = t*(b + 2*(h-t))
    const h = boy, b = en, t = kalinlik
    if (h <= 0 || b <= 0 || t <= 0) return null
    A = t * (b + 2 * (h - t))
  } else if (tip === 'TPRF') {
    // T kesit: A = t*(h+b-t)
    if (boy <= 0 || en <= 0 || kalinlik <= 0) return null
    A = kalinlik * (boy + en - kalinlik)
  } else if (tip === 'PRF') {
    // İçi boş dikdörtgen profil: A = 2t(b+h-2t)
    if (boy <= 0 || en <= 0 || kalinlik <= 0) return null
    A = 2 * kalinlik * (boy + en - 2 * kalinlik)
  } else if (tip === 'SAC' || tip === 'LEVHA') {
    // kg/m² = kalinlik(mm) * ro(g/cm³) = kalinlik * ro * 0.001 * 1000 = kalinlik * ro
    if (kalinlik <= 0) return null
    return Math.round(kalinlik * ro * 1000) / 1000 // kg/m²
  } else {
    return null
  }

  if (A <= 0) return null
  // kg/m = A(mm²) * ro(g/cm³) * 0.001
  return Math.round(A * ro * 0.001 * 1000) / 1000
}

// ─── Alan etiketi ───
function kgmLabel(hammaddeTipi: string): string {
  const tip = (hammaddeTipi || '').toUpperCase()
  if (tip === 'SAC' || tip === 'LEVHA') return 'kg/m²'
  return 'kg/m'
}

export function Materials() {
  const { materials, operations, recipes, bomTrees, workOrders, hmTipler: dbHmTipler, loadAll } = useStore()
  const { can, isGuest } = useAuth()
  const [tipFilter, setTipFilter] = useState<Set<string>>(new Set())
  const [hmTipFilter, setHmTipFilter] = useState<Set<string>>(new Set())
  const [dimBoyUz, setDimBoyUz] = useState('')
  const [dimCap, setDimCap] = useState('')
  const [dimKalinlik, setDimKalinlik] = useState('')
  const [receteFilter, setReceteFilter] = useState<string>('')
  const [showPasif, setShowPasif] = useState(false)
  const [density, setDensity] = useState<'compact'|'normal'|'comfortable'>(() => {
    return (localStorage.getItem('uys_table_density') as any) || 'compact'
  })
  function changeDensity(d: 'compact'|'normal'|'comfortable') {
    setDensity(d); localStorage.setItem('uys_table_density', d)
  }
  const rowStyle = { paddingTop: density === 'compact' ? '2px' : density === 'normal' ? '6px' : '10px', paddingBottom: density === 'compact' ? '2px' : density === 'normal' ? '6px' : '10px' }
  const [sortCol, setSortCol] = useState<'kod'|'ad'|'tip'|'uzunluk'>('kod')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Material | null>(null)

  const [fKod, setFKod] = useState('')
  const [fAd, setFAd] = useState('')
  const [fTip, setFTip] = useState('')
  const [fBirim, setFBirim] = useState('')
  const [fKisa, setFKisa] = useState('')
  const [fUzunluk, setFUzunluk] = useState('')
  const [fOp, setFOp] = useState('')

  const tipler = useMemo(() => [...new Set(materials.map(m => m.tip).filter(Boolean))].sort(), [materials])
  const hmTipler = useMemo(() => {
    const tanimli = [...dbHmTipler].sort((a, b) => a.sira - b.sira).map(t => t.kod)
    return tanimli
  }, [dbHmTipler])
  const receteKodSet = useMemo(() => new Set(recipes.map(r => r.mamulKod)), [recipes])

  function dimMatch(value: number, searchStr: string): boolean {
    if (!searchStr) return true
    if (!value) return false
    const s = searchStr.replace(',', '.').trim()
    if (!s) return true
    return String(value).startsWith(s)
  }

  const filtered = useMemo(() => {
    return materials.filter(m => {
      if (!showPasif && m.aktif === false) return false
      if (tipFilter.size > 0 && !tipFilter.has(m.tip)) return false
      if (hmTipFilter.size > 0 && !hmTipFilter.has((m.hammaddeTipi || '').toLocaleUpperCase('tr-TR'))) return false
      if (receteFilter === 'var' && (m.tip !== 'YarıMamul' || !receteKodSet.has(m.kod))) return false
      if (receteFilter === 'yok' && (m.tip !== 'YarıMamul' || receteKodSet.has(m.kod))) return false
      if (dimBoyUz && !dimMatch(m.boy, dimBoyUz)) return false
      if (dimCap && !dimMatch(m.cap, dimCap)) return false
      if (dimKalinlik && !dimMatch(m.kalinlik, dimKalinlik)) return false
      if (fKod && !m.kod.toLowerCase().includes(fKod.toLowerCase())) return false
      if (fAd && !m.ad.toLowerCase().includes(fAd.toLowerCase())) return false
      if (fTip && !m.tip.toLowerCase().includes(fTip.toLowerCase())) return false
      if (fBirim && !(m.birim || '').toLowerCase().includes(fBirim.toLowerCase())) return false
      if (fKisa && !dimMatch(m.en, fKisa)) return false
      if (fUzunluk && !dimMatch(m.uzunluk, fUzunluk)) return false
      if (fOp) {
        const op = operations.find(o => o.id === m.opId)
        if (!op || !(op.ad || '').toLowerCase().includes(fOp.toLowerCase())) return false
      }
      return true
    }).sort((a, b) => {
      let v = 0
      if (sortCol === 'kod')     v = (a.kod||'').localeCompare(b.kod||'', 'tr')
      if (sortCol === 'ad')      v = (a.ad||'').localeCompare(b.ad||'', 'tr')
      if (sortCol === 'tip')     v = (a.tip||'').localeCompare(b.tip||'', 'tr')
      if (sortCol === 'uzunluk') v = (a.uzunluk||0) - (b.uzunluk||0)
      return sortDir === 'asc' ? v : -v
    })
  }, [materials, tipFilter, hmTipFilter, dimBoyUz, dimCap, dimKalinlik, receteFilter, receteKodSet, showPasif, fKod, fAd, fTip, fBirim, fKisa, fUzunluk, fOp, operations, sortCol, sortDir])

  async function deleteMat(id: string) {
    if (!await showConfirm('Bu malzemeyi silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_malzemeler').delete().eq('id', id)
    loadAll(); toast.success('Malzeme silindi')
  }

  async function renameMaterial(m: Material, yeniAd: string) {
    const ad = yeniAd.trim()
    if (!ad || ad === m.ad) return
    await supabase.from('uys_malzemeler').update({ ad }).eq('id', m.id)
    let bomCount = 0, rcCount = 0, woCount = 0
    for (const bt of bomTrees) {
      const rows = bt.rows || []
      let changed = false
      const newRows = rows.map(r => {
        if (r.malkod === m.kod && r.malad !== ad) { changed = true; return { ...r, malad: ad } }
        return r
      })
      if (changed) {
        const updates: Record<string, unknown> = { rows: newRows }
        if (bt.mamulKod === m.kod) { updates.ad = ad; updates.mamul_ad = ad }
        await supabase.from('uys_bom_trees').update(updates).eq('id', bt.id)
        bomCount++
      }
    }
    for (const rc of recipes) {
      const satirlar = rc.satirlar || []
      let changed = false
      const newSatirlar = satirlar.map(r => {
        if (r.malkod === m.kod && r.malad !== ad) { changed = true; return { ...r, malad: ad } }
        return r
      })
      if (changed) {
        const updates: Record<string, unknown> = { satirlar: newSatirlar }
        if (rc.mamulKod === m.kod) { updates.ad = ad; updates.mamul_ad = ad }
        await supabase.from('uys_recipes').update(updates).eq('id', rc.id)
        rcCount++
      }
    }
    const linkedWOs = workOrders.filter(w => w.malkod === m.kod || w.mamulKod === m.kod || (w.hm || []).some(h => h.malkod === m.kod))
    for (const wo of linkedWOs) {
      const updates: Record<string, unknown> = {}
      if (wo.malkod === m.kod && wo.malad !== ad) updates.malad = ad
      if (wo.mamulKod === m.kod && wo.mamulAd !== ad) updates.mamul_ad = ad
      if ((wo.hm || []).some(h => h.malkod === m.kod)) {
        updates.hm = (wo.hm || []).map(h => h.malkod === m.kod ? { ...h, malad: ad } : h)
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('uys_work_orders').update(updates).eq('id', wo.id)
        woCount++
      }
    }
    loadAll()
    const extras = [bomCount && `${bomCount} ürün ağacı`, rcCount && `${rcCount} reçete`, woCount && `${woCount} iş emri`].filter(Boolean).join(' + ')
    toast.success(`Ad güncellendi${extras ? ' · ' + extras + ' güncellendi' : ''}`)
  }

  async function recodeMaterial(m: Material, yeniKod: string) {
    const kod = yeniKod.trim()
    if (!kod || kod === m.kod) return
    const eskiKod = m.kod
    await supabase.from('uys_malzemeler').update({ kod }).eq('id', m.id)
    let bomCount = 0, rcCount = 0, woCount = 0
    for (const bt of bomTrees) {
      const rows = bt.rows || []
      let changed = false
      const newRows = rows.map(r => {
        if (r.malkod === eskiKod) { changed = true; return { ...r, malkod: kod } }
        return r
      })
      if (changed || bt.mamulKod === eskiKod) {
        const updates: Record<string, unknown> = {}
        if (changed) updates.rows = newRows
        if (bt.mamulKod === eskiKod) updates.mamul_kod = kod
        await supabase.from('uys_bom_trees').update(updates).eq('id', bt.id)
        bomCount++
      }
    }
    for (const rc of recipes) {
      const satirlar = rc.satirlar || []
      let changed = false
      const newSatirlar = satirlar.map(r => {
        if (r.malkod === eskiKod) { changed = true; return { ...r, malkod: kod } }
        return r
      })
      if (changed || rc.mamulKod === eskiKod) {
        const updates: Record<string, unknown> = {}
        if (changed) updates.satirlar = newSatirlar
        if (rc.mamulKod === eskiKod) { updates.mamul_kod = kod; updates.rc_kod = 'RC-' + kod }
        await supabase.from('uys_recipes').update(updates).eq('id', rc.id)
        rcCount++
      }
    }
    const linkedWOs = workOrders.filter(w => w.malkod === eskiKod || w.mamulKod === eskiKod || (w.hm || []).some(h => h.malkod === eskiKod))
    for (const wo of linkedWOs) {
      const updates: Record<string, unknown> = {}
      if (wo.malkod === eskiKod) updates.malkod = kod
      if (wo.mamulKod === eskiKod) updates.mamul_kod = kod
      if ((wo.hm || []).some(h => h.malkod === eskiKod)) {
        updates.hm = (wo.hm || []).map(h => h.malkod === eskiKod ? { ...h, malkod: kod } : h)
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('uys_work_orders').update(updates).eq('id', wo.id)
        woCount++
      }
    }
    loadAll()
    const extras = [bomCount && `${bomCount} ürün ağacı`, rcCount && `${rcCount} reçete`, woCount && `${woCount} iş emri`].filter(Boolean).join(' + ')
    toast.success(`Kod güncellendi${extras ? ' · ' + extras + ' güncellendi' : ''}`)
  }

  function importExcel() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      if (!rows.length) { toast.error('Excel boş'); return }
      let created = 0; let updated = 0; let errors = 0; let cascadeBom = 0; let cascadeRc = 0; let cascadeWo = 0
      const [{ data: freshBom }, { data: freshRc }, { data: freshWo }] = await Promise.all([
        supabase.from('uys_bom_trees').select('*'),
        supabase.from('uys_recipes').select('*'),
        supabase.from('uys_work_orders').select('*'),
      ])
      for (const row of rows) {
        const kod = String(row['Kod'] || row['kod'] || row['Malzeme Kodu'] || '').trim()
        const ad = String(row['Ad'] || row['ad'] || row['Malzeme Adı'] || row['Malzeme'] || '').trim()
        if (!kod && !ad) continue
        const dataRow: Record<string, unknown> = {
          kod, ad,
          tip: String(row['Tip'] || row['tip'] || 'Hammadde'),
          hammadde_tipi: String(row['HM Tipi'] || row['Hammadde Tipi'] || row['hammadde_tipi'] || '').toLocaleUpperCase('tr-TR'),
          malzeme_cinsi: String(row['Malzeme Cinsi'] || row['malzeme_cinsi'] || ''),
          birim: String(row['Birim'] || row['birim'] || 'Adet'),
          boy: parseFloat(String(row['Boy'] || row['boy'] || 0)) || 0,
          en: parseFloat(String(row['En'] || row['en'] || 0)) || 0,
          kalinlik: parseFloat(String(row['Kalınlık'] || row['kalinlik'] || 0)) || 0,
          uzunluk: parseFloat(String(row['Uzunluk'] || row['uzunluk'] || 0)) || 0,
          cap: parseFloat(String(row['Çap'] || row['cap'] || 0)) || 0,
          min_stok: parseFloat(String(row['Min Stok'] || row['min_stok'] || 0)) || 0,
        }
        const existing = materials.find(m => (m.kod || '').toLocaleUpperCase('tr-TR').trim() === kod.toLocaleUpperCase('tr-TR').trim())
        if (existing) {
          const { error } = await supabase.from('uys_malzemeler').update(dataRow).eq('id', existing.id)
          if (error) { errors++; if (errors === 1) console.error('Update hatası:', error.message) }
          else {
            updated++
            const adChanged = existing.ad !== ad
            if (adChanged) {
              for (const bt of (freshBom || [])) {
                const btRows = bt.rows || []
                let changed = false
                const newRows = btRows.map((r: any) => {
                  if (r.malkod === kod) { changed = true; return { ...r, malad: ad } }
                  return r
                })
                const updates: Record<string, unknown> = {}
                if (changed) updates.rows = newRows
                if (bt.mamul_kod === kod) { updates.ad = ad; updates.mamul_ad = ad }
                if (Object.keys(updates).length > 0) { await supabase.from('uys_bom_trees').update(updates).eq('id', bt.id); cascadeBom++ }
              }
              for (const rc of (freshRc || [])) {
                const rcRows = rc.satirlar || []
                let changed = false
                const newSatirlar = rcRows.map((r: any) => {
                  if (r.malkod === kod) { changed = true; return { ...r, malad: ad } }
                  return r
                })
                const updates: Record<string, unknown> = {}
                if (changed) updates.satirlar = newSatirlar
                if (rc.mamul_kod === kod) { updates.ad = ad; updates.mamul_ad = ad }
                if (Object.keys(updates).length > 0) { await supabase.from('uys_recipes').update(updates).eq('id', rc.id); cascadeRc++ }
              }
              for (const wo of (freshWo || [])) {
                const updates: Record<string, unknown> = {}
                if (wo.malkod === kod) updates.malad = ad
                if (wo.mamul_kod === kod) updates.mamul_ad = ad
                if ((wo.hm || []).some((h: any) => h.malkod === kod)) {
                  updates.hm = (wo.hm || []).map((h: any) => h.malkod === kod ? { ...h, malad: ad } : h)
                }
                if (Object.keys(updates).length > 0) { await supabase.from('uys_work_orders').update(updates).eq('id', wo.id); cascadeWo++ }
              }
            }
          }
        } else {
          const { error } = await supabase.from('uys_malzemeler').insert({ id: uid(), ...dataRow })
          if (error) { errors++; if (errors === 1) { console.error('Insert hatası:', error.message); toast.error('Hata: ' + error.message) } }
          else created++
        }
      }
      loadAll()
      const cascadeInfo = (cascadeBom || cascadeRc || cascadeWo) ? ` · Bağlı: ${cascadeBom} BOM, ${cascadeRc} reçete, ${cascadeWo} İE` : ''
      toast.success(`${created} yeni · ${updated} güncellendi${cascadeInfo}` + (errors > 0 ? ` · ${errors} hata` : ''))
    }
    input.click()
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(m => ({ Kod: m.kod, Ad: m.ad, Tip: m.tip, 'HM Tipi': m.hammaddeTipi, 'Malzeme Cinsi': m.malzemeCinsi || '', Birim: m.birim, Boy: m.boy, En: m.en, Kalınlık: m.kalinlik, Uzunluk: m.uzunluk, Çap: m.cap, 'Min Stok': m.minStok, 'kg/m': m.birimKgMetre || '' }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Malzemeler')
      XLSX.writeFile(wb, `malzemeler_${today()}.xlsx`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Malzeme Listesi</h1><p className="text-xs text-zinc-500">{materials.filter(m => m.aktif !== false).length} aktif malzeme{materials.some(m => m.aktif === false) ? ` · ${materials.filter(m => m.aktif === false).length} pasif` : ''}</p></div>
        <div className="flex gap-2">
          {can('mat_excel') && <button onClick={importExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Upload size={13} /> Excel Yükle</button>}
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          {can('mat_add') && <button onClick={async () => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Malzeme</button>}
        </div>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <MultiCheckDropdown label="Malzeme Tipi" options={tipler} selected={tipFilter} onChange={setTipFilter} />
        {hmTipler.length > 0 && <MultiCheckDropdown label="HM Tipi" options={hmTipler} selected={hmTipFilter} onChange={setHmTipFilter} />}
        <select value={receteFilter} onChange={e => setReceteFilter(e.target.value)}
          className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-accent">
          <option value="">YM Reçete</option>
          <option value="var">✅ Var</option>
          <option value="yok">⚠ Yok</option>
        </select>
        {(tipFilter.size > 0 || hmTipFilter.size > 0 || receteFilter || fKod || fAd || fTip || fBirim || fKisa || fUzunluk || fOp || dimBoyUz || dimCap || dimKalinlik) && (
          <button onClick={() => {
            setTipFilter(new Set()); setHmTipFilter(new Set()); setReceteFilter('')
            setFKod(''); setFAd(''); setFTip(''); setFBirim(''); setFKisa(''); setFUzunluk(''); setFOp('')
            setDimBoyUz(''); setDimCap(''); setDimKalinlik('')
          }} className="px-2 py-2 text-zinc-500 hover:text-red text-[10px]">✕ Tüm filtreleri temizle</button>
        )}
        {materials.some(m => m.aktif === false) && (
          <button onClick={() => setShowPasif(!showPasif)}
            className={`px-2 py-2 text-[10px] ${showPasif ? 'text-amber' : 'text-zinc-600 hover:text-zinc-400'}`}>
            {showPasif ? '📋 Pasifler gösteriliyor' : '📋 Pasifleri göster'}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-zinc-600">{filtered.length} / {materials.length} malzeme gösteriliyor</p>
        <div className="flex items-center gap-0.5">
          {(['compact','normal','comfortable'] as const).map(d => (
            <button key={d} onClick={() => changeDensity(d)}
              title={d === 'compact' ? 'Dar' : d === 'normal' ? 'Normal' : 'Geniş'}
              className={`px-2 py-1 rounded text-[10px] border transition-colors ${density===d ? 'bg-accent/15 border-accent/30 text-accent' : 'bg-bg-2 border-border text-zinc-500 hover:text-zinc-200'}`}>
              {d === 'compact' ? '━' : d === 'normal' ? '═' : '≡'}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="max-h-[calc(100vh-160px)] overflow-y-auto">
          <table className={`w-full text-[11px] density-${density}`}>
            <thead className="sticky top-0 bg-bg-2 z-10">
              <tr className="border-b border-border text-zinc-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-3 py-2 w-[130px]"><button onClick={() => toggleSort('kod')} className={`hover:text-zinc-200 ${sortCol==='kod'?'text-accent':''}`}>Kod {sortCol==='kod'?(sortDir==='asc'?'↑':'↓'):''}</button></th>
                <th className="text-left px-2 py-2"><button onClick={() => toggleSort('ad')} className={`hover:text-zinc-200 ${sortCol==='ad'?'text-accent':''}`}>Malzeme Adı {sortCol==='ad'?(sortDir==='asc'?'↑':'↓'):''}</button></th>
                <th className="text-left px-2 py-2 w-[110px]"><button onClick={() => toggleSort('tip')} className={`hover:text-zinc-200 ${sortCol==='tip'?'text-accent':''}`}>Tip {sortCol==='tip'?(sortDir==='asc'?'↑':'↓'):''}</button></th><th className="text-center px-2 py-2 w-[50px]">Birim</th>
                <th className="text-right px-2 py-2 w-[65px]">Uzun K.</th><th className="text-right px-2 py-2 w-[60px]">Kısa K.</th>
                <th className="text-right px-2 py-2 w-[50px]">Kalınlık</th><th className="text-right px-2 py-2 w-[45px]">Çap</th>
                <th className="text-right px-2 py-2 w-[60px] text-amber">Uzunluk</th>
                <th className="text-left px-2 py-2 w-[120px]">Operasyon</th><th className="px-1 py-2 w-[80px]"></th>
              </tr>
              <tr className="border-b border-border/50 bg-bg-3/20">
                <th className="px-2 py-1"><input value={fKod} onChange={e => setFKod(e.target.value)} placeholder="Ara..." className="w-full px-1.5 py-1 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent font-mono" /></th>
                <th className="px-2 py-1"><input value={fAd} onChange={e => setFAd(e.target.value)} placeholder="Ara..." className="w-full px-1.5 py-1 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></th>
                <th className="px-2 py-1"><input value={fTip} onChange={e => setFTip(e.target.value)} placeholder="Ara..." className="w-full px-1.5 py-1 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></th>
                <th className="px-2 py-1"><input value={fBirim} onChange={e => setFBirim(e.target.value)} placeholder="..." className="w-full px-1 py-1 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent text-center" /></th>
                <th className="px-2 py-1"><input value={dimBoyUz} onChange={e => setDimBoyUz(e.target.value)} placeholder="..." inputMode="decimal" className="w-full px-1 py-1 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent text-right font-mono" /></th>
                <th className="px-2 py-1"><input value={fKisa} onChange={e => setFKisa(e.target.value)} placeholder="..." inputMode="decimal" className="w-full px-1 py-1 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent text-right font-mono" /></th>
                <th className="px-2 py-1"><input value={dimKalinlik} onChange={e => setDimKalinlik(e.target.value)} placeholder="..." inputMode="decimal" className="w-full px-1 py-1 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent text-right font-mono" /></th>
                <th className="px-2 py-1"><input value={dimCap} onChange={e => setDimCap(e.target.value)} placeholder="..." inputMode="decimal" className="w-full px-1 py-1 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent text-right font-mono" /></th>
                <th className="px-2 py-1"><input value={fUzunluk} onChange={e => setFUzunluk(e.target.value)} placeholder="..." inputMode="decimal" className="w-full px-1 py-1 bg-bg-2 border border-amber/30 rounded text-[10px] text-amber placeholder:text-zinc-600 focus:outline-none focus:border-amber text-right font-mono" /></th>
                <th className="px-2 py-1"><input value={fOp} onChange={e => setFOp(e.target.value)} placeholder="Ara..." className="w-full px-1.5 py-1 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></th>
                <th className="px-1 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map(m => {
                const op = operations.find(o => o.id === m.opId)
                return (
                  <tr key={m.id} className={`border-b border-border/20 hover:bg-bg-3/30 group/row ${m.aktif === false ? 'opacity-40' : ''}`}>
                    <td className="px-3 py-[5px] cursor-pointer whitespace-nowrap" onClick={async () => {
                      const yeni = await showPrompt('Malzeme kodu değiştir', 'Yeni kod', m.kod)
                      if (yeni) await recodeMaterial(m, yeni)
                    }}>
                      <span className="font-mono text-accent text-[10px] leading-tight">{m.kod}</span>
                      {m.revizyon > 0 && <span className="ml-1 px-1 py-0.5 bg-purple-500/15 text-purple-400 rounded text-[8px] font-mono">R{m.revizyon}</span>}
                      {m.aktif === false && <span className="ml-1 px-1 py-0.5 bg-zinc-600/20 text-zinc-500 rounded text-[8px]">PASİF</span>}
                    </td>
                    <td className="px-2 py-[5px] text-zinc-300 cursor-pointer hover:text-accent truncate max-w-0" onClick={async () => {
                      const yeni = await showPrompt('Malzeme adı değiştir', 'Yeni ad', m.ad)
                      if (yeni) await renameMaterial(m, yeni)
                    }}><span className="truncate block">{m.ad}</span></td>
                    <td className="px-2 py-[5px] whitespace-nowrap">
                      <span className="px-1.5 py-0.5 bg-bg-3 rounded text-[10px] text-zinc-400 whitespace-nowrap">{m.tip || '—'}{m.hammaddeTipi && ` · ${m.hammaddeTipi}`}</span>
                      {m.malzemeCinsi && <span className="ml-1 px-1 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px]">{m.malzemeCinsi.split(' ')[0]}</span>}
                      {m.tip === 'YarıMamul' && (
                        receteKodSet.has(m.kod)
                          ? <span className="ml-1 px-1 py-0.5 bg-green/10 text-green rounded text-[9px]">RC ✓</span>
                          : <span className="ml-1 px-1 py-0.5 bg-amber/10 text-amber rounded text-[9px]">RC ✗</span>
                      )}
                    </td>
                    <td className="px-2 py-[5px] text-zinc-500 text-center">{m.birim}</td>
                    <td className="px-2 py-[5px] text-right font-mono text-zinc-500">{m.boy || '—'}</td>
                    <td className="px-2 py-[5px] text-right font-mono text-zinc-500">{m.en || '—'}</td>
                    <td className="px-2 py-[5px] text-right font-mono text-zinc-500">{m.kalinlik || '—'}</td>
                    <td className="px-2 py-[5px] text-right font-mono text-zinc-500">{m.cap || '—'}</td>
                    <td className="px-2 py-[5px] text-right font-mono text-amber">{m.uzunluk || '—'}</td>
                    <td className="px-2 py-[5px] text-zinc-500 text-[10px] truncate">{op?.ad || '—'}</td>
                    <td className="px-1 py-[5px] text-right whitespace-nowrap opacity-0 group-hover/row:opacity-100 transition-opacity">
                      {can('mat_add') && <button onClick={async () => {
                        const newId = uid()
                        const row = { id: newId, kod: m.kod + '-KOPYA', ad: m.ad + ' (Kopya)', tip: m.tip, hammadde_tipi: m.hammaddeTipi, malzeme_cinsi: m.malzemeCinsi || null, birim: m.birim, boy: m.boy, en: m.en, kalinlik: m.kalinlik, uzunluk: m.uzunluk, cap: m.cap, min_stok: m.minStok, op_id: m.opId || null, op_kod: m.opKod || null }
                        await supabase.from('uys_malzemeler').insert(row)
                        loadAll(); toast.success('Malzeme kopyalandı')
                      }} className="p-0.5 text-zinc-600 hover:text-amber" title="Kopyala"><Copy size={11} /></button>}
                      {can('mat_edit') && <button onClick={async () => { setEditItem(m); setShowForm(true) }} className="p-0.5 text-zinc-600 hover:text-accent"><Pencil size={11} /></button>}
                      {can('mat_delete') && <button onClick={() => deleteMat(m.id)} className="p-0.5 text-zinc-600 hover:text-red"><Trash2 size={11} /></button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > 300 && <div className="p-2 text-center text-zinc-600 text-[10px]">+{filtered.length - 300} daha</div>}
        </div>
      </div>
      {showForm && <MatFormModal initial={editItem} operations={operations} tipler={tipler} hmTipler={hmTipler} onClose={() => { setShowForm(false); setEditItem(null) }} onSaved={() => { setShowForm(false); setEditItem(null); loadAll(); toast.success(editItem ? 'Güncellendi' : 'Eklendi') }} />}
    </div>
  )
}

// ─── Form alanı konfigürasyonu ───
type AlanConfig = {
  boy?: string    // label
  en?: string
  kalinlik?: string
  cap?: string
  uzunluk?: boolean
  ihStandart?: boolean
  sacMod?: boolean  // SAC/PLY/LEVHA — uzunluk yok
}

function getAlanConfig(hmTip: string): AlanConfig {
  const t = hmTip.toUpperCase()
  if (t === 'BORU')  return { cap: 'Dış Çap (mm)', kalinlik: 'Et Kalınlığı (mm)', uzunluk: true }
  if (t === 'MIL')   return { cap: 'Çap (mm)', uzunluk: true }
  if (t === 'ALTK')  return { boy: 'Genişlik Açıklığı — s (mm)', uzunluk: true }
  if (t === 'KARE')  return { boy: 'Kenar (mm)', uzunluk: true }
  if (t === 'KSB')   return { boy: 'Boy — h (mm)', en: 'En — b (mm)', kalinlik: 'Et Kalınlığı (mm)', uzunluk: true }
  if (t === 'PRF')   return { boy: 'Uzun Kenar (mm)', en: 'Kısa Kenar (mm)', kalinlik: 'Et Kalınlığı (mm)', uzunluk: true }
  if (t === 'UPRF')  return { boy: 'Yükseklik — h (mm)', en: 'Flanş Genişliği — b (mm)', kalinlik: 'Et Kalınlığı (mm)', uzunluk: true }
  if (t === 'TPRF')  return { boy: 'Yükseklik — h (mm)', en: 'Flanş Genişliği — b (mm)', kalinlik: 'Et Kalınlığı (mm)', uzunluk: true }
  if (t === 'IH')    return { ihStandart: true, uzunluk: true }
  if (t === 'SAC' || t === 'LEVHA') return { boy: 'Boy (mm)', en: 'En (mm)', kalinlik: 'Kalınlık (mm)', sacMod: true }
  if (t === 'PLY')   return { boy: 'Uzun Kenar (mm)', en: 'Kısa Kenar (mm)', kalinlik: 'Kalınlık (mm)', sacMod: true }
  // default
  return { boy: 'Uzun Kenar (mm)', en: 'Kısa Kenar (mm)', kalinlik: 'Kalınlık (mm)', uzunluk: true }
}

function MatFormModal({ initial, operations, tipler, hmTipler, onClose, onSaved }: {
  initial: Material | null; operations: { id: string; kod: string; ad: string }[]
  tipler: string[]; hmTipler: string[]; onClose: () => void; onSaved: () => void
}) {
  const [kod, setKod] = useState(initial?.kod || '')
  const [ad, setAd] = useState(initial?.ad || '')
  const [tip, setTip] = useState(initial?.tip || 'Hammadde')
  const [hammaddeTipi, setHammaddeTipi] = useState(initial?.hammaddeTipi || '')
  const [malzemeCinsi, setMalzemeCinsi] = useState(initial?.malzemeCinsi || '')
  const [birim, setBirim] = useState(initial?.birim || 'Adet')
  const [boy, setBoy] = useState(String(initial?.boy || ''))
  const [en, setEn] = useState(String(initial?.en || ''))
  const [kalinlik, setKalinlik] = useState(String(initial?.kalinlik || ''))
  const [uzunluk, setUzunluk] = useState(String(initial?.uzunluk || ''))
  const [cap, setCap] = useState(String(initial?.cap || ''))
  const [minStok, setMinStok] = useState(String(initial?.minStok || ''))
  const [birimKgMetre, setBirimKgMetre] = useState(String(initial?.birimKgMetre || ''))
  const [ihSecim, setIhSecim] = useState('')  // IH standart seçimi
  const [opId, setOpId] = useState(initial?.opId || '')
  const [saving, setSaving] = useState(false)

  const { materials: allMaterials, bomTrees, recipes, workOrders } = useStore()

  const alan = useMemo(() => getAlanConfig(hammaddeTipi), [hammaddeTipi])

  // ─── IH standart seçilince otomatik doldur ───
  useEffect(() => {
    if (!ihSecim) return
    for (const grup of IH_STANDARTLAR) {
      const item = grup.items.find(i => i.ad === ihSecim)
      if (item) {
        setBoy(String(item.h))
        setEn(String(item.b))
        setBirimKgMetre(String(item.kgm))
        break
      }
    }
  }, [ihSecim])

  // ─── Anlık kg/m hesaplama ───
  const hesaplananKgm = useMemo(() => {
    if (alan.ihStandart) return null  // IH: tablo değeri kullanılır
    const cins = MALZEME_CINSLERI.find(c => c.label === malzemeCinsi)
    if (!cins) return null
    return hesaplaKgm(
      hammaddeTipi,
      parseFloat(boy) || 0,
      parseFloat(en) || 0,
      parseFloat(kalinlik) || 0,
      parseFloat(cap) || 0,
      cins.yogunluk,
    )
  }, [hammaddeTipi, malzemeCinsi, boy, en, kalinlik, cap, alan.ihStandart])

  // Hesaplanan değer değişince birimKgMetre'yi güncelle
  useEffect(() => {
    if (hesaplananKgm !== null) {
      setBirimKgMetre(String(hesaplananKgm))
    }
  }, [hesaplananKgm])

  function tahminEt() {
    if (!kod) return
    const prefix = kod.replace(/\d{2,}$/, '')
    const benzerler = allMaterials.filter(m => m.kod.startsWith(prefix) && m.kod !== kod && m.boy > 0)
    if (benzerler.length) {
      const avg = { boy: Math.round(benzerler.reduce((a, m) => a + m.boy, 0) / benzerler.length), en: Math.round(benzerler.reduce((a, m) => a + (m.en || 0), 0) / benzerler.length) }
      if (avg.en > avg.boy) { const t = avg.boy; avg.boy = avg.en; avg.en = t }
      if (!boy || boy === '0') setBoy(String(avg.boy))
      if ((!en || en === '0') && avg.en > 0) setEn(String(avg.en))
      toast.info(`${benzerler.length} benzer malzemeden tahmin: Uzun K=${avg.boy}, Kısa K=${avg.en}`)
    } else {
      const nums = ad.match(/(\d{3,})/g)
      if (nums && nums.length >= 1) { setBoy(nums[0]); toast.info('Ad\'dan tahmin: Uzun K=' + nums[0]) }
      else toast.info('Tahmin yapılamadı — benzer malzeme yok')
    }
  }

  async function save() {
    if (!kod.trim() || !ad.trim()) { toast.error('Kod ve Ad zorunlu'); return }
    setSaving(true)
    const op = operations.find(o => o.id === opId)
    let boyNum = parseFloat(boy) || 0
    let enNum = parseFloat(en) || 0
    const isPly = (hammaddeTipi || '').toUpperCase() === 'PLY'
    if (!isPly && enNum > boyNum && boyNum > 0) {
      [boyNum, enNum] = [enNum, boyNum]
      toast.info('Uzun kenar / Kısa kenar otomatik düzeltildi')
    }
    const row: Record<string, unknown> = {
      kod: kod.trim(), ad: ad.trim(), tip,
      hammadde_tipi: (tip === 'Hammadde' || tip === 'YarıMamul') ? (hammaddeTipi || '').toLocaleUpperCase('tr-TR') : '',
      malzeme_cinsi: malzemeCinsi || null,
      birim,
      boy: boyNum, en: enNum,
      kalinlik: parseFloat(kalinlik) || 0,
      uzunluk: parseFloat(uzunluk) || 0,
      cap: parseFloat(cap) || 0,
      min_stok: parseFloat(minStok) || 0,
      op_id: opId || null, op_kod: op?.kod || null,
      birim_kg_metre: parseFloat(birimKgMetre) || null,
    }

    if (!initial?.id) {
      await supabase.from('uys_malzemeler').insert({ id: uid(), ...row, revizyon: 0, aktif: true })
      setSaving(false); onSaved(); return
    }

    const eskiKod = initial.kod
    const yeniKod = kod.trim()
    const yeniAd = ad.trim()
    const adChanged = yeniAd !== initial.ad
    const kodChanged = yeniKod !== eskiKod
    const dimChanged = (
      (parseFloat(boy) || 0) !== (initial.boy || 0) || (parseFloat(en) || 0) !== (initial.en || 0) ||
      (parseFloat(kalinlik) || 0) !== (initial.kalinlik || 0) || (parseFloat(uzunluk) || 0) !== (initial.uzunluk || 0) ||
      (parseFloat(cap) || 0) !== (initial.cap || 0)
    )
    const anyMeaningfulChange = adChanged || kodChanged || dimChanged

    if (!anyMeaningfulChange) {
      await supabase.from('uys_malzemeler').update(row).eq('id', initial.id)
      setSaving(false); onSaved(); return
    }

    const tumunuGuncelle = await showConfirm(
      'Değişiklik algılandı.\n\n' +
      '✅ EVET → Tümünü Güncelle\nGeçmiş kayıtlar dahil tüm BOM, reçete ve iş emirlerini günceller.\n\n' +
      '❌ HAYIR → Yeni Revizyon\nGeçmiş kayıtlara dokunmaz. Yeni malzeme kartı oluşturur, sadece aktif referansları günceller.'
    )

    if (tumunuGuncelle) {
      await supabase.from('uys_malzemeler').update(row).eq('id', initial.id)
      await cascadeAdKod(eskiKod, yeniKod, yeniAd, adChanged, kodChanged, null)
      if (dimChanged) await cascadeKesim(eskiKod, kodChanged ? yeniKod : eskiKod)
    } else {
      const newId = uid()
      const yeniRevizyon = (initial.revizyon || 0) + 1
      await supabase.from('uys_malzemeler').update({ aktif: false }).eq('id', initial.id)
      await supabase.from('uys_malzemeler').insert({
        id: newId, ...row, revizyon: yeniRevizyon, revizyon_tarihi: today(),
        onceki_id: initial.id, aktif: true,
      })
      await cascadeAdKod(eskiKod, yeniKod, yeniAd, adChanged, kodChanged, 'sadece_acik')
      if (dimChanged) await cascadeKesim(eskiKod, kodChanged ? yeniKod : eskiKod)
      toast.success(`Yeni revizyon oluşturuldu (Rev ${yeniRevizyon}). Geçmiş kayıtlar korundu.`)
    }

    setSaving(false); onSaved()
  }

  async function cascadeAdKod(eskiKod: string, yeniKod: string, yeniAd: string, adChanged: boolean, kodChanged: boolean, mode: 'sadece_acik' | null) {
    if (!adChanged && !kodChanged) return
    let bomC = 0, rcC = 0, woC = 0, abC = 0, kpC = 0, stkC = 0, fireC = 0, logC = 0
    const [{ data: freshBom }, { data: freshRc }, { data: freshWo }] = await Promise.all([
      supabase.from('uys_bom_trees').select('*'),
      supabase.from('uys_recipes').select('*'),
      supabase.from('uys_work_orders').select('*'),
    ])
    for (const bt of (freshBom || [])) {
      const btRows = bt.rows || []
      let changed = false
      const newRows = btRows.map((r: any) => {
        if (r.malkod === eskiKod) { changed = true; return { ...r, malkod: kodChanged ? yeniKod : r.malkod, malad: adChanged ? yeniAd : r.malad } }
        return r
      })
      const updates: Record<string, unknown> = {}
      if (changed) updates.rows = newRows
      if (bt.mamul_kod === eskiKod) { if (kodChanged) updates.mamul_kod = yeniKod; if (adChanged) { updates.ad = yeniAd; updates.mamul_ad = yeniAd } }
      if (Object.keys(updates).length > 0) { await supabase.from('uys_bom_trees').update(updates).eq('id', bt.id); bomC++ }
    }
    for (const rc of (freshRc || [])) {
      const rcRows = rc.satirlar || []
      let changed = false
      const newSatirlar = rcRows.map((r: any) => {
        if (r.malkod === eskiKod) { changed = true; return { ...r, malkod: kodChanged ? yeniKod : r.malkod, malad: adChanged ? yeniAd : r.malad } }
        return r
      })
      const updates: Record<string, unknown> = {}
      if (changed) updates.satirlar = newSatirlar
      if (rc.mamul_kod === eskiKod) { if (kodChanged) { updates.mamul_kod = yeniKod; updates.rc_kod = 'RC-' + yeniKod }; if (adChanged) { updates.ad = yeniAd; updates.mamul_ad = yeniAd } }
      if (Object.keys(updates).length > 0) { await supabase.from('uys_recipes').update(updates).eq('id', rc.id); rcC++ }
    }
    const linkedWOs = (freshWo || []).filter((w: any) => w.malkod === eskiKod || w.mamul_kod === eskiKod || (w.hm || []).some((h: any) => h.malkod === eskiKod))
    for (const wo of linkedWOs) {
      if (mode === 'sadece_acik' && (wo.durum === 'tamamlandi' || wo.durum === 'iptal')) continue
      const updates: Record<string, unknown> = {}
      if (wo.malkod === eskiKod) { if (kodChanged) updates.malkod = yeniKod; if (adChanged) updates.malad = yeniAd }
      if (wo.mamul_kod === eskiKod) { if (kodChanged) updates.mamul_kod = yeniKod; if (adChanged) updates.mamul_ad = yeniAd }
      if ((wo.hm || []).some((h: any) => h.malkod === eskiKod)) {
        updates.hm = (wo.hm || []).map((h: any) => h.malkod === eskiKod ? { ...h, malkod: kodChanged ? yeniKod : h.malkod, malad: adChanged ? yeniAd : h.malad } : h)
      }
      if (Object.keys(updates).length > 0) { await supabase.from('uys_work_orders').update(updates).eq('id', wo.id); woC++ }
    }
    if (kodChanged || adChanged) {
      let q = supabase.from('uys_acik_barlar').select('id, ham_malkod, ham_malad, durum').eq('ham_malkod', eskiKod)
      if (mode === 'sadece_acik') q = q.eq('durum', 'acik')
      const { data: abList } = await q
      for (const ab of (abList || [])) {
        const updates: Record<string, unknown> = {}
        if (kodChanged) updates.ham_malkod = yeniKod
        if (adChanged && ab.ham_malad !== yeniAd) updates.ham_malad = yeniAd
        if (Object.keys(updates).length > 0) { await supabase.from('uys_acik_barlar').update(updates).eq('id', ab.id); abC++ }
      }
    }
    if (kodChanged || adChanged) {
      let q = supabase.from('uys_kesim_planlari').select('*').or(`ham_malkod.eq.${eskiKod},artik_malzeme_kod.eq.${eskiKod}`)
      if (mode === 'sadece_acik') q = q.eq('durum', 'bekliyor')
      const { data: kpList } = await q
      let qSat = supabase.from('uys_kesim_planlari').select('*')
      if (mode === 'sadece_acik') qSat = qSat.eq('durum', 'bekliyor')
      const { data: kpAll } = await qSat
      const kpUnion = new Map<string, any>()
      for (const k of (kpList || [])) kpUnion.set(k.id, k)
      for (const k of (kpAll || [])) {
        const sat = k.satirlar || []
        if (sat.some((s: any) => (s.kesimler || []).some((c: any) => c.malkod === eskiKod))) kpUnion.set(k.id, k)
      }
      for (const kp of kpUnion.values()) {
        const updates: Record<string, unknown> = {}
        if (kodChanged && kp.ham_malkod === eskiKod) updates.ham_malkod = yeniKod
        if (adChanged && kp.ham_malkod === eskiKod && kp.ham_malad !== yeniAd) updates.ham_malad = yeniAd
        if (kodChanged && kp.artik_malzeme_kod === eskiKod) updates.artik_malzeme_kod = yeniKod
        const sat = kp.satirlar || []
        let satChanged = false
        const newSat = sat.map((s: any) => {
          const newKesimler = (s.kesimler || []).map((c: any) => {
            if (c.malkod !== eskiKod) return c
            satChanged = true
            const nc: any = { ...c }
            if (kodChanged) nc.malkod = yeniKod
            if (adChanged) nc.malad = yeniAd
            return nc
          })
          return satChanged ? { ...s, kesimler: newKesimler } : s
        })
        if (satChanged) updates.satirlar = newSat
        if (Object.keys(updates).length > 0) { await supabase.from('uys_kesim_planlari').update(updates).eq('id', kp.id); kpC++ }
      }
    }
    if (mode === null && kodChanged) {
      const stkUpd: Record<string, unknown> = { malkod: yeniKod }
      if (adChanged) stkUpd.malad = yeniAd
      const { count: stkCnt } = await supabase.from('uys_stok_hareketler').update(stkUpd, { count: 'exact' }).eq('malkod', eskiKod)
      stkC = stkCnt || 0
      const fireUpd: Record<string, unknown> = { malkod: yeniKod }
      if (adChanged) fireUpd.malad = yeniAd
      const { count: fireCnt } = await supabase.from('uys_fire_logs').update(fireUpd, { count: 'exact' }).eq('malkod', eskiKod)
      fireC = fireCnt || 0
      const { count: logCnt } = await supabase.from('uys_logs').update({ malkod: yeniKod }, { count: 'exact' }).eq('malkod', eskiKod)
      logC = logCnt || 0
    } else if (mode === null && adChanged && !kodChanged) {
      const { count: stkCnt } = await supabase.from('uys_stok_hareketler').update({ malad: yeniAd }, { count: 'exact' }).eq('malkod', eskiKod)
      stkC = stkCnt || 0
      const { count: fireCnt } = await supabase.from('uys_fire_logs').update({ malad: yeniAd }, { count: 'exact' }).eq('malkod', eskiKod)
      fireC = fireCnt || 0
    }
    const extras = [bomC && `${bomC} ürün ağacı`, rcC && `${rcC} reçete`, woC && `${woC} iş emri`, abC && `${abC} açık bar`, kpC && `${kpC} kesim planı`, stkC && `${stkC} stok hareketi`, fireC && `${fireC} fire log`, logC && `${logC} log`].filter(Boolean).join(' + ')
    if (extras) toast.info(extras + ' güncellendi')
  }

  async function cascadeKesim(eskiKod: string, matKod: string) {
    const updatedMat = { ...(initial!), kod: matKod, boy: parseFloat(boy) || 0, en: parseFloat(en) || 0, kalinlik: parseFloat(kalinlik) || 0, uzunluk: parseFloat(uzunluk) || 0, cap: parseFloat(cap) || 0 }
    const mats = allMaterials.map(m => m.id === initial!.id ? updatedMat : m)
    function isKesimRow(r: { malad: string; opId?: string }) {
      const a = (r.malad || '').toUpperCase()
      if (a.includes('KESİM') || a.includes('KESME')) return true
      if (r.opId) { const o = operations.find(x => x.id === r.opId); if (o && ((o.ad || '').toUpperCase().includes('KESME') || (o.ad || '').toUpperCase().includes('KESİM'))) return true }
      return false
    }
    let kesimRC = 0
    for (const rc of recipes) {
      if (!(rc.satirlar || []).some(r => r.malkod === matKod || r.malkod === eskiKod)) continue
      let changed = false
      const newSatirlar = (rc.satirlar || []).map(r => {
        if ((r.tip !== 'Hammadde' && r.tip !== 'YarıMamul') || r.kirno === '1') return r
        const parts = (r.kirno || '').split('.'); const parentKirno = parts.slice(0, -1).join('.')
        const parentRow = (rc.satirlar || []).find(pr => pr.kirno === parentKirno)
        if (!parentRow || !isKesimRow(parentRow)) return r
        const parentMat = mats.find(m => m.kod === parentRow.malkod); if (!parentMat) return r
        const urunParBoy = (parentMat.uzunluk || 0) > 0 ? parentMat.uzunluk : Math.max(parentMat.boy || 0, parentMat.en || 0)
        if (!urunParBoy) return r
        const hmMat = mats.find(m => m.kod === r.malkod); if (!hmMat) return r
        const hB = hmMat.boy || 0; const hE = hmMat.en || 0; const hUz = hmMat.uzunluk || 0
        let adetPer = 0
        if (hUz > 0 && hUz > urunParBoy) adetPer = Math.floor(hUz / urunParBoy)
        else if (hE > 0 && hB > 0 && (parentMat.en || 0) > 0 && (parentMat.boy || 0) > 0) {
          const hmB = Math.max(hB, hE); const hmE = Math.min(hB, hE)
          const uB = Math.min(parentMat.boy || 0, parentMat.en || 0); const uE = Math.max(parentMat.boy || 0, parentMat.en || 0)
          adetPer = Math.max(Math.floor(hmB / uE) * Math.floor(hmE / uB), Math.floor(hmB / uB) * Math.floor(hmE / uE))
        } else { const hmB = Math.max(hB, hE); if (hmB > urunParBoy) adetPer = Math.floor(hmB / urunParBoy) }
        if (adetPer > 0) { const ym = Math.round((1 / adetPer) * 10000) / 10000; if (ym !== r.miktar) { changed = true; return { ...r, miktar: ym } } }
        return r
      })
      if (changed) { await supabase.from('uys_recipes').update({ satirlar: newSatirlar }).eq('id', rc.id); kesimRC++ }
    }
    if (kesimRC > 0) toast.info(`${kesimRC} reçetede kesim miktarları yeniden hesaplandı`)
  }

  const kgmLbl = kgmLabel(hammaddeTipi)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-4 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-3">{initial ? 'Malzeme Düzenle' : 'Yeni Malzeme'}</h2>
        <div className="space-y-2">

          {/* Malzeme Tipi */}
          <div className="p-2 bg-accent/5 border border-accent/30 rounded-lg">
            <label className="text-[11px] text-accent font-semibold mb-1 block uppercase tracking-wide">Malzeme Tipi *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['Hammadde','YarıMamul','Mamul','Sarf'] as const).map(t => (
                <button key={t} type="button" onClick={() => { setTip(t); if (t !== 'Hammadde') setHammaddeTipi('') }}
                  className={`px-2 py-1.5 rounded text-xs font-semibold transition ${tip === t ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-bg-2 border border-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'}`}>
                  {t === 'YarıMamul' ? 'Yarı Mamul' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Hammadde Tipi */}
          {(tip === 'Hammadde' || tip === 'YarıMamul') && (
            <div>
              <label className="text-[11px] text-zinc-500 mb-0.5 block">
                {tip === 'Hammadde' ? 'Hammadde Tipi' : 'Yarı Mamul Tipi'}
              </label>
              <select value={hammaddeTipi} onChange={e => { setHammaddeTipi(e.target.value); setIhSecim(''); setBirimKgMetre('') }}
                className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent">
                <option value="">— Seçin —</option>
                {hmTipler.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Malzeme Cinsi */}
          {(tip === 'Hammadde' || tip === 'YarıMamul') && hammaddeTipi && !alan.ihStandart && (
            <div>
              <label className="text-[11px] text-zinc-500 mb-0.5 block">Malzeme Cinsi</label>
              <select value={malzemeCinsi} onChange={e => setMalzemeCinsi(e.target.value)}
                className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent">
                <option value="">— Seçin —</option>
                {MALZEME_CINSLERI.map(c => <option key={c.label} value={c.label}>{c.label} ({c.yogunluk} g/cm³)</option>)}
              </select>
            </div>
          )}

          {/* Kod + Ad */}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-zinc-500 mb-0.5 block">Malzeme Kodu *</label>
            <input value={kod} onChange={e => setKod(e.target.value)} className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
            <div><label className="text-[11px] text-zinc-500 mb-0.5 block">Malzeme Adı *</label>
            <input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>

          {/* Birim + Min Stok */}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-zinc-500 mb-0.5 block">Birim</label>
            <select value={birim} onChange={e => setBirim(e.target.value)} className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none">
              <option>Adet</option><option>Kg</option><option>Metre</option><option>m²</option><option>Litre</option><option>Takım</option>
            </select></div>
            <div><label className="text-[11px] text-zinc-500 mb-0.5 block">Min Stok</label>
            <input type="number" value={minStok} onChange={e => setMinStok(e.target.value)} className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>

          {/* Ölçü alanları — Sarf hariç, tipe göre dinamik */}
          {tip !== 'Sarf' && (
            <div className="p-2 bg-bg-3/30 border border-border/50 rounded-lg space-y-2">
              <div className="text-[10px] text-zinc-500">
                {hammaddeTipi ? `📐 ${hammaddeTipi} ölçüleri` : '📐 Plaka/Parça Ölçüleri'}
              </div>

              {/* IH — Standart seçici */}
              {alan.ihStandart && (
                <div>
                  <label className="text-[11px] text-zinc-500 mb-0.5 block">Standart Profil</label>
                  <select value={ihSecim} onChange={e => setIhSecim(e.target.value)}
                    className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent">
                    <option value="">— Standart seçin —</option>
                    {IH_STANDARTLAR.map(grup => (
                      <optgroup key={grup.grup} label={grup.grup}>
                        {grup.items.map(item => (
                          <option key={item.ad} value={item.ad}>{item.ad} ({item.h}×{item.b}mm · {item.kgm} kg/m)</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {ihSecim && (
                    <div className="text-[10px] text-green mt-1">✓ h={boy}mm · b={en}mm · {birimKgMetre} kg/m otomatik dolduruldu</div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                {/* boy */}
                {alan.boy && (
                  <div className={alan.ihStandart ? 'col-span-2' : ''}>
                    <label className="text-[11px] text-zinc-500 mb-0.5 block">{alan.boy}</label>
                    <input type="number" value={boy} onChange={e => setBoy(e.target.value)}
                      className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent" />
                  </div>
                )}
                {/* en */}
                {alan.en && (
                  <div>
                    <label className={`text-[11px] mb-0.5 block ${parseFloat(en) > parseFloat(boy) && parseFloat(boy) > 0 && hammaddeTipi !== 'PLY' ? 'text-red' : 'text-zinc-500'}`}>{alan.en}</label>
                    <input type="number" value={en} onChange={e => setEn(e.target.value)}
                      className={`w-full px-2 py-1.5 bg-bg-2 border rounded text-sm text-zinc-200 focus:outline-none ${parseFloat(en) > parseFloat(boy) && parseFloat(boy) > 0 && hammaddeTipi !== 'PLY' ? 'border-red focus:border-red' : 'border-border focus:border-accent'}`} />
                  </div>
                )}
                {/* cap */}
                {alan.cap && (
                  <div>
                    <label className="text-[11px] text-zinc-500 mb-0.5 block">{alan.cap}</label>
                    <input type="number" value={cap} onChange={e => setCap(e.target.value)}
                      className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent" />
                  </div>
                )}
                {/* kalinlik */}
                {alan.kalinlik && (
                  <div>
                    <label className="text-[11px] text-zinc-500 mb-0.5 block">{alan.kalinlik}</label>
                    <input type="number" value={kalinlik} onChange={e => setKalinlik(e.target.value)}
                      className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent" />
                  </div>
                )}
                {/* uzunluk */}
                {(alan.uzunluk && !alan.sacMod) && (
                  <div>
                    <label className="text-[11px] text-amber mb-0.5 block font-semibold">Uzunluk (mm)</label>
                    <input type="number" value={uzunluk} onChange={e => setUzunluk(e.target.value)} placeholder="ör: 6000"
                      className="w-full px-2 py-1.5 bg-bg-2 border border-amber/30 rounded text-sm text-zinc-200 focus:outline-none focus:border-amber" />
                  </div>
                )}
              </div>

              {/* PLY uyarısı */}
              {hammaddeTipi === 'PLY' && parseFloat(en) > parseFloat(boy) && parseFloat(boy) > 0 && (
                <div className="text-[10px] text-blue-400 mt-1">ℹ Plywood/panel malzemede yön önemlidir — giriş sıranız korunacak.</div>
              )}
              {/* PRF/KSB/vb swap uyarısı */}
              {hammaddeTipi !== 'PLY' && alan.en && parseFloat(en) > parseFloat(boy) && parseFloat(boy) > 0 && (
                <div className="text-[10px] text-red mt-1">⚠ Kısa kenar büyük olamaz — kaydetme sırasında otomatik düzeltilecek.</div>
              )}

              {/* kg/m hesaplama alanı */}
              {tip === 'Hammadde' && (
                <div className="mt-1 p-2 bg-bg-2 border border-border/60 rounded flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] text-zinc-400 mb-0.5 block font-semibold">
                      {kgmLbl} <span className="text-zinc-600 font-normal">(birim ağırlık)</span>
                    </label>
                    <input type="number" step="0.001" value={birimKgMetre} onChange={e => setBirimKgMetre(e.target.value)} placeholder={`ör: 4.12`}
                      className="w-full px-2 py-1.5 bg-bg-3 border border-zinc-600 rounded text-sm text-zinc-200 focus:outline-none focus:border-accent" />
                  </div>
                  {hesaplananKgm !== null && (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-zinc-500">Hesaplanan</div>
                      <div className="text-sm font-semibold text-green">{hesaplananKgm} {kgmLbl}</div>
                      <div className="text-[9px] text-zinc-600">{malzemeCinsi.split(' ')[0]}</div>
                    </div>
                  )}
                  {!hesaplananKgm && malzemeCinsi && hammaddeTipi && !alan.ihStandart && (
                    <div className="text-[10px] text-zinc-600 shrink-0">Ölçü eksik</div>
                  )}
                </div>
              )}
            </div>
          )}

          {tip !== 'Sarf' && !alan.ihStandart && (
            <button type="button" onClick={tahminEt} className="text-[11px] text-accent hover:underline">
              🔮 Benzer malzemelerden uzun/kısa kenar tahmin et
            </button>
          )}

          {/* Operasyon */}
          <div><label className="text-[11px] text-zinc-500 mb-0.5 block">Operasyon</label>
            <select value={opId} onChange={e => setOpId(e.target.value)} className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none">
              <option value="">— Seçin —</option>
              {operations.map(o => <option key={o.id} value={o.id}>{o.kod} — {o.ad}</option>)}
            </select></div>
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-3 py-1.5 bg-bg-3 text-zinc-400 rounded text-xs hover:text-white">İptal</button>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded text-xs font-semibold">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  )
}
