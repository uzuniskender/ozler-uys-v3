import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm, showPrompt } from '@/lib/prompt'
import { Download, Plus, Pencil, Trash2, Upload, Copy } from 'lucide-react'
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown'
import type { Material } from '@/types'

export function Materials() {
  const { materials, operations, recipes, bomTrees, workOrders, hmTipler: dbHmTipler, loadAll } = useStore()
  const { can, isGuest } = useAuth()
  const [tipFilter, setTipFilter] = useState<Set<string>>(new Set())
  const [hmTipFilter, setHmTipFilter] = useState<Set<string>>(new Set())
  const [dimBoyUz, setDimBoyUz] = useState('')
  const [dimCap, setDimCap] = useState('')
  const [dimKalinlik, setDimKalinlik] = useState('')
  const [receteFilter, setReceteFilter] = useState<string>('')  // '' | 'var' | 'yok'
  const [showPasif, setShowPasif] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Material | null>(null)

  // ═══ Sütun başı filtreleri ═══
  const [fKod, setFKod] = useState('')
  const [fAd, setFAd] = useState('')
  const [fTip, setFTip] = useState('')
  const [fBirim, setFBirim] = useState('')
  const [fKisa, setFKisa] = useState('')
  const [fUzunluk, setFUzunluk] = useState('')
  const [fOp, setFOp] = useState('')

  const tipler = useMemo(() => [...new Set(materials.map(m => m.tip).filter(Boolean))].sort(), [materials])
  const hmTipler = useMemo(() => {
    // DB'deki tanımlı HM tipleri (Veri Yönetimi'nden yönetilir)
    const tanimli = [...dbHmTipler].sort((a, b) => a.sira - b.sira).map(t => t.kod)
    return tanimli
  }, [dbHmTipler])
  const receteKodSet = useMemo(() => new Set(recipes.map(r => r.mamulKod)), [recipes])

  // Ölçü eşleştirme: string başlangıç eşleşmesi
  // 60 → 60, 60.3, 600, 6000 ✓   160 ✗
  // 48 → 48, 48.3, 480 ✓         148 ✗
  // 60,3 → 60.3, 60.31 ✓         60, 600 ✗
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
      // Sütun başı filtreleri
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
    })
  }, [materials, tipFilter, hmTipFilter, dimBoyUz, dimCap, dimKalinlik, receteFilter, receteKodSet, showPasif, fKod, fAd, fTip, fBirim, fKisa, fUzunluk, fOp, operations])

  async function deleteMat(id: string) {
    if (!await showConfirm('Bu malzemeyi silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_malzemeler').delete().eq('id', id)
    loadAll(); toast.success('Malzeme silindi')
  }

  // Malzeme adı değişince BOM, reçete ve iş emirlerini de güncelle
  async function renameMaterial(m: Material, yeniAd: string) {
    const ad = yeniAd.trim()
    if (!ad || ad === m.ad) return

    // 1. Malzeme kartını güncelle
    await supabase.from('uys_malzemeler').update({ ad }).eq('id', m.id)

    let bomCount = 0, rcCount = 0, woCount = 0

    // 2. Ürün ağaçlarında — rows içinde malkod eşleşen satırları güncelle
    for (const bt of bomTrees) {
      const rows = bt.rows || []
      let changed = false
      const newRows = rows.map(r => {
        if (r.malkod === m.kod && r.malad !== ad) { changed = true; return { ...r, malad: ad } }
        return r
      })
      if (changed) {
        // mamulKod eşleşiyorsa BOM başlığını da güncelle
        const updates: Record<string, unknown> = { rows: newRows }
        if (bt.mamulKod === m.kod) { updates.ad = ad; updates.mamul_ad = ad }
        await supabase.from('uys_bom_trees').update(updates).eq('id', bt.id)
        bomCount++
      }
    }

    // 3. Reçetelerde — satirlar içinde malkod eşleşen satırları güncelle
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

    // 4. İş emirlerinde — malkod eşleşen satırları + hm array güncelle
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

  // Malzeme kodu değişince BOM, reçete ve iş emirlerindeki referansları da güncelle
  async function recodeMaterial(m: Material, yeniKod: string) {
    const kod = yeniKod.trim()
    if (!kod || kod === m.kod) return
    const eskiKod = m.kod

    // 1. Malzeme kartını güncelle
    await supabase.from('uys_malzemeler').update({ kod }).eq('id', m.id)

    let bomCount = 0, rcCount = 0, woCount = 0

    // 2. Ürün ağaçlarında — rows içinde malkod eşleşen satırları güncelle
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

    // 3. Reçetelerde — satirlar içinde malkod eşleşen satırları güncelle
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

    // 4. İş emirlerinde — malkod ve mamulKod eşleşenleri + hm array güncelle
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

  // #27: Malzeme Excel Import
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

      let created = 0; let updated = 0; let errors = 0
      for (const row of rows) {
        const kod = String(row['Kod'] || row['kod'] || row['Malzeme Kodu'] || '').trim()
        const ad = String(row['Ad'] || row['ad'] || row['Malzeme Adı'] || row['Malzeme'] || '').trim()
        if (!kod && !ad) continue

        const dataRow: Record<string, unknown> = {
          kod, ad,
          tip: String(row['Tip'] || row['tip'] || 'Hammadde'),
          hammadde_tipi: String(row['HM Tipi'] || row['Hammadde Tipi'] || row['hammadde_tipi'] || '').toLocaleUpperCase('tr-TR'),
          birim: String(row['Birim'] || row['birim'] || 'Adet'),
          boy: parseFloat(String(row['Boy'] || row['boy'] || 0)) || 0,
          en: parseFloat(String(row['En'] || row['en'] || 0)) || 0,
          kalinlik: parseFloat(String(row['Kalınlık'] || row['kalinlik'] || 0)) || 0,
          uzunluk: parseFloat(String(row['Uzunluk'] || row['uzunluk'] || 0)) || 0,
          cap: parseFloat(String(row['Çap'] || row['cap'] || 0)) || 0,
          min_stok: parseFloat(String(row['Min Stok'] || row['min_stok'] || 0)) || 0,
        }

        const existing = materials.find(m => m.kod === kod)
        if (existing) {
          // GÜNCELLE
          const { error } = await supabase.from('uys_malzemeler').update(dataRow).eq('id', existing.id)
          if (error) { errors++; if (errors === 1) console.error('Update hatası:', error.message) }
          else updated++
        } else {
          // YENİ EKLE
          const { error } = await supabase.from('uys_malzemeler').insert({ id: uid(), ...dataRow })
          if (error) { errors++; if (errors === 1) { console.error('Insert hatası:', error.message); toast.error('Hata: ' + error.message) } }
          else created++
        }
      }
      loadAll()
      toast.success(`${created} yeni eklendi · ${updated} güncellendi` + (errors > 0 ? ` · ${errors} hata` : ''))
    }
    input.click()
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(m => ({ Kod: m.kod, Ad: m.ad, Tip: m.tip, 'HM Tipi': m.hammaddeTipi, Birim: m.birim, Boy: m.boy, En: m.en, Kalınlık: m.kalinlik, Uzunluk: m.uzunluk, Çap: m.cap, 'Min Stok': m.minStok }))
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
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="max-h-[calc(100vh-160px)] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-bg-2 z-10">
              <tr className="border-b border-border text-zinc-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-3 py-2 w-[130px]">Kod</th><th className="text-left px-2 py-2">Malzeme Adı</th>
                <th className="text-left px-2 py-2 w-[110px]">Tip</th><th className="text-center px-2 py-2 w-[50px]">Birim</th>
                <th className="text-right px-2 py-2 w-[65px]">Uzun K.</th><th className="text-right px-2 py-2 w-[60px]">Kısa K.</th>
                <th className="text-right px-2 py-2 w-[50px]">Kalınlık</th><th className="text-right px-2 py-2 w-[45px]">Çap</th>
                <th className="text-right px-2 py-2 w-[60px] text-amber">Uzunluk</th>
                <th className="text-left px-2 py-2 w-[120px]">Operasyon</th><th className="px-1 py-2 w-[80px]"></th>
              </tr>
              {/* ═══ SÜTUN BAŞI FİLTRELERİ ═══ */}
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
                    <td className="px-3 py-[5px] cursor-pointer" onClick={async () => {
                      const yeni = await showPrompt('Malzeme kodu değiştir', 'Yeni kod', m.kod)
                      if (yeni) await recodeMaterial(m, yeni)
                    }}>
                      <span className="font-mono text-accent text-[10px] leading-tight break-all">{m.kod}</span>
                      {m.revizyon > 0 && <span className="ml-1 px-1 py-0.5 bg-purple-500/15 text-purple-400 rounded text-[8px] font-mono">R{m.revizyon}</span>}
                      {m.aktif === false && <span className="ml-1 px-1 py-0.5 bg-zinc-600/20 text-zinc-500 rounded text-[8px]">PASİF</span>}
                    </td>
                    <td className="px-2 py-[5px] text-zinc-300 cursor-pointer hover:text-accent truncate max-w-0" onClick={async () => {
                      const yeni = await showPrompt('Malzeme adı değiştir', 'Yeni ad', m.ad)
                      if (yeni) await renameMaterial(m, yeni)
                    }}><span className="truncate block">{m.ad}</span></td>
                    <td className="px-2 py-[5px]">
                      <span className="px-1.5 py-0.5 bg-bg-3 rounded text-[10px] text-zinc-400 whitespace-nowrap">{m.tip || '—'}{m.hammaddeTipi && ` · ${m.hammaddeTipi}`}</span>
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
                        const row = { id: newId, kod: m.kod + '-KOPYA', ad: m.ad + ' (Kopya)', tip: m.tip, hammadde_tipi: m.hammaddeTipi, birim: m.birim, boy: m.boy, en: m.en, kalinlik: m.kalinlik, uzunluk: m.uzunluk, cap: m.cap, min_stok: m.minStok, op_id: m.opId || null, op_kod: m.opKod || null }
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

function MatFormModal({ initial, operations, tipler, hmTipler, onClose, onSaved }: {
  initial: Material | null; operations: { id: string; kod: string; ad: string }[]
  tipler: string[]; hmTipler: string[]; onClose: () => void; onSaved: () => void
}) {
  const [kod, setKod] = useState(initial?.kod || '')
  const [ad, setAd] = useState(initial?.ad || '')
  const [tip, setTip] = useState(initial?.tip || 'Hammadde')
  const [hammaddeTipi, setHammaddeTipi] = useState(initial?.hammaddeTipi || '')
  const [birim, setBirim] = useState(initial?.birim || 'Adet')
  const [boy, setBoy] = useState(String(initial?.boy || ''))
  const [en, setEn] = useState(String(initial?.en || ''))
  const [kalinlik, setKalinlik] = useState(String(initial?.kalinlik || ''))
  const [uzunluk, setUzunluk] = useState(String(initial?.uzunluk || ''))
  const [cap, setCap] = useState(String(initial?.cap || ''))
  const [minStok, setMinStok] = useState(String(initial?.minStok || ''))
  const [opId, setOpId] = useState(initial?.opId || '')
  const [saving, setSaving] = useState(false)

  // #34: Boy/En Tahmin — benzer malzemelerden öner
  const { materials: allMaterials, bomTrees, recipes, workOrders } = useStore()
  function tahminEt() {
    if (!kod) return
    const prefix = kod.replace(/\d{2,}$/, '') // Son rakamları kaldır
    const benzerler = allMaterials.filter(m => m.kod.startsWith(prefix) && m.kod !== kod && m.boy > 0)
    if (benzerler.length) {
      const avg = { boy: Math.round(benzerler.reduce((a, m) => a + m.boy, 0) / benzerler.length), en: Math.round(benzerler.reduce((a, m) => a + (m.en || 0), 0) / benzerler.length) }
      // Uzun > kısa garanti et
      if (avg.en > avg.boy) { const t = avg.boy; avg.boy = avg.en; avg.en = t }
      if (!boy || boy === '0') setBoy(String(avg.boy))
      if ((!en || en === '0') && avg.en > 0) setEn(String(avg.en))
      toast.info(`${benzerler.length} benzer malzemeden tahmin: Uzun K=${avg.boy}, Kısa K=${avg.en}`)
    } else {
      // Ad'dan rakam çıkarmayı dene
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
    // Uzun kenar > Kısa kenar garanti et — swap gerekirse
    if (enNum > boyNum && boyNum > 0) {
      [boyNum, enNum] = [enNum, boyNum]
      toast.info('Uzun kenar / Kısa kenar otomatik düzeltildi')
    }
    const row: Record<string, unknown> = {
      kod: kod.trim(), ad: ad.trim(), tip, hammadde_tipi: tip === 'Hammadde' ? (hammaddeTipi || '').toLocaleUpperCase('tr-TR') : '', birim, boy: boyNum,
      en: enNum, kalinlik: parseFloat(kalinlik) || 0, uzunluk: parseFloat(uzunluk) || 0, cap: parseFloat(cap) || 0,
      min_stok: parseFloat(minStok) || 0, op_id: opId || null, op_kod: op?.kod || null,
    }

    // ═══ YENİ MALZEME ═══
    if (!initial?.id) {
      await supabase.from('uys_malzemeler').insert({ id: uid(), ...row, revizyon: 0, aktif: true })
      setSaving(false); onSaved(); return
    }

    // ═══ MEVCUT MALZEME DÜZENLEME ═══
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

    // Değişiklik yoksa sadece kaydet
    if (!anyMeaningfulChange) {
      await supabase.from('uys_malzemeler').update(row).eq('id', initial.id)
      setSaving(false); onSaved(); return
    }

    // ═══ REVİZYON SEÇİMİ ═══
    const tumunuGuncelle = await showConfirm(
      'Değişiklik algılandı.\n\n' +
      '✅ EVET → Tümünü Güncelle\nGeçmiş kayıtlar dahil tüm BOM, reçete ve iş emirlerini günceller.\n\n' +
      '❌ HAYIR → Yeni Revizyon\nGeçmiş kayıtlara dokunmaz. Yeni malzeme kartı oluşturur, sadece aktif referansları günceller.'
    )

    if (tumunuGuncelle) {
      // ═══ TÜMÜNÜ GÜNCELLE — mevcut ID, tüm zincir ═══
      await supabase.from('uys_malzemeler').update(row).eq('id', initial.id)
      await cascadeAdKod(eskiKod, yeniKod, yeniAd, adChanged, kodChanged, null) // null = tüm İE'ler
      if (dimChanged) await cascadeKesim(eskiKod, kodChanged ? yeniKod : eskiKod)

    } else {
      // ═══ YENİ REVİZYON — eski kalır, yeni oluşur ═══
      const newId = uid()
      const yeniRevizyon = (initial.revizyon || 0) + 1

      // Eski malzemeyi pasif yap
      await supabase.from('uys_malzemeler').update({ aktif: false }).eq('id', initial.id)

      // Yeni malzeme oluştur
      await supabase.from('uys_malzemeler').insert({
        id: newId, ...row, revizyon: yeniRevizyon, revizyon_tarihi: today(),
        onceki_id: initial.id, aktif: true,
      })

      // Şablonları güncelle (BOM + Reçete → her zaman güncel olmalı)
      await cascadeAdKod(eskiKod, yeniKod, yeniAd, adChanged, kodChanged, 'sadece_acik')
      if (dimChanged) await cascadeKesim(eskiKod, kodChanged ? yeniKod : eskiKod)

      toast.success(`Yeni revizyon oluşturuldu (Rev ${yeniRevizyon}). Geçmiş kayıtlar korundu.`)
    }

    setSaving(false); onSaved()
  }

  // ── Zincirleme ad/kod güncelleme ──
  async function cascadeAdKod(eskiKod: string, yeniKod: string, yeniAd: string, adChanged: boolean, kodChanged: boolean, mode: 'sadece_acik' | null) {
    if (!adChanged && !kodChanged) return
    let bomC = 0, rcC = 0, woC = 0

    // BOM'lar — her zaman güncelle (şablon)
    for (const bt of bomTrees) {
      let changed = false
      const newRows = (bt.rows || []).map(r => {
        if (r.malkod === eskiKod) { changed = true; return { ...r, malkod: kodChanged ? yeniKod : r.malkod, malad: adChanged ? yeniAd : r.malad } }
        return r
      })
      const updates: Record<string, unknown> = {}
      if (changed) updates.rows = newRows
      if (bt.mamulKod === eskiKod) { if (kodChanged) updates.mamul_kod = yeniKod; if (adChanged) { updates.ad = yeniAd; updates.mamul_ad = yeniAd } }
      if (Object.keys(updates).length > 0) { await supabase.from('uys_bom_trees').update(updates).eq('id', bt.id); bomC++ }
    }

    // Reçeteler — her zaman güncelle (şablon)
    for (const rc of recipes) {
      let changed = false
      const newSatirlar = (rc.satirlar || []).map(r => {
        if (r.malkod === eskiKod) { changed = true; return { ...r, malkod: kodChanged ? yeniKod : r.malkod, malad: adChanged ? yeniAd : r.malad } }
        return r
      })
      const updates: Record<string, unknown> = {}
      if (changed) updates.satirlar = newSatirlar
      if (rc.mamulKod === eskiKod) { if (kodChanged) { updates.mamul_kod = yeniKod; updates.rc_kod = 'RC-' + yeniKod }; if (adChanged) { updates.ad = yeniAd; updates.mamul_ad = yeniAd } }
      if (Object.keys(updates).length > 0) { await supabase.from('uys_recipes').update(updates).eq('id', rc.id); rcC++ }
    }

    // İş emirleri — hm array dahil
    const linkedWOs = workOrders.filter(w => w.malkod === eskiKod || w.mamulKod === eskiKod || (w.hm || []).some(h => h.malkod === eskiKod))
    for (const wo of linkedWOs) {
      if (mode === 'sadece_acik' && (wo.durum === 'tamamlandi' || wo.durum === 'iptal')) continue
      const updates: Record<string, unknown> = {}
      if (wo.malkod === eskiKod) { if (kodChanged) updates.malkod = yeniKod; if (adChanged) updates.malad = yeniAd }
      if (wo.mamulKod === eskiKod) { if (kodChanged) updates.mamul_kod = yeniKod; if (adChanged) updates.mamul_ad = yeniAd }
      // hm array içindeki referansları güncelle
      if ((wo.hm || []).some(h => h.malkod === eskiKod)) {
        updates.hm = (wo.hm || []).map(h => h.malkod === eskiKod ? { ...h, malkod: kodChanged ? yeniKod : h.malkod, malad: adChanged ? yeniAd : h.malad } : h)
      }
      if (Object.keys(updates).length > 0) { await supabase.from('uys_work_orders').update(updates).eq('id', wo.id); woC++ }
    }
    const extras = [bomC && `${bomC} ürün ağacı`, rcC && `${rcC} reçete`, woC && `${woC} iş emri`].filter(Boolean).join(' + ')
    if (extras) toast.info(extras + ' güncellendi')
  }

  // ── Zincirleme kesim hesaplama ──
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Malzeme Düzenle' : 'Yeni Malzeme'}</h2>
        <div className="space-y-3">
          {/* ═══ Malzeme Tipi — tam genişlik, belirgin ═══ */}
          <div className="p-3 bg-accent/5 border border-accent/30 rounded-lg">
            <label className="text-[11px] text-accent font-semibold mb-1.5 block uppercase tracking-wide">Malzeme Tipi *</label>
            <div className="grid grid-cols-4 gap-2">
              {(['Hammadde','YarıMamul','Mamul','Sarf'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTip(t); if (t !== 'Hammadde') setHammaddeTipi('') }}
                  className={`px-2 py-2 rounded-lg text-xs font-semibold transition ${tip === t ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-bg-2 border border-border text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'}`}
                >
                  {t === 'YarıMamul' ? 'Yarı Mamul' : t}
                </button>
              ))}
            </div>
            {initial?.id && initial.tip !== tip && (
              <div className="text-[10px] text-amber mt-2">⚠ Tip değiştiriliyor: {initial.tip} → {tip}. İlişkili BOM/reçete kayıtları etkilenebilir.</div>
            )}
          </div>
          {tip === 'Hammadde' && (
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Hammadde Tipi</label>
            <select
              value={hammaddeTipi}
              onChange={e => setHammaddeTipi(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent"
            >
              <option value="">— Seçin —</option>
              {hmTipler.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {hmTipler.length === 0 && (
              <div className="text-[10px] text-amber mt-1">⚠ HM Tipi tanımlı değil. Veri Yönetimi → Hammadde Tipleri'nden ekleyin.</div>
            )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Kodu *</label>
            <input value={kod} onChange={e => setKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Adı *</label>
            <input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Birim</label>
            <select value={birim} onChange={e => setBirim(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
              <option>Adet</option><option>Kg</option><option>Metre</option><option>m²</option><option>Litre</option><option>Takım</option>
            </select></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Çap (mm)</label>
            <input type="number" value={cap} onChange={e => setCap(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Min Stok</label>
            <input type="number" value={minStok} onChange={e => setMinStok(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          {/* Ölçü alanları — Sarf hariç */}
          {tip !== 'Sarf' && (
          <div className="p-3 bg-bg-3/30 border border-border/50 rounded-lg">
            <div className="text-[10px] text-zinc-500 mb-2">
              {['PROFİL','BORU'].includes((hammaddeTipi || '').toLocaleUpperCase('tr-TR')) ? '📐 Kesit: Uzun Kenar × Kısa Kenar × Et Kalınlığı + Bar Uzunluğu' : '📐 Plaka/Parça Ölçüleri'}
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Uzun Kenar (mm)</label>
              <input type="number" value={boy} onChange={e => setBoy(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Kısa Kenar (mm)</label>
              <input type="number" value={en} onChange={e => setEn(e.target.value)} className={`w-full px-3 py-2 bg-bg-2 border rounded-lg text-sm text-zinc-200 focus:outline-none ${parseFloat(en) > parseFloat(boy) && parseFloat(boy) > 0 ? 'border-red focus:border-red' : 'border-border focus:border-accent'}`} /></div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">{['PROFİL','BORU'].includes((hammaddeTipi || '').toLocaleUpperCase('tr-TR')) ? 'Et Kalınlığı (mm)' : 'Kalınlık (mm)'}</label>
              <input type="number" value={kalinlik} onChange={e => setKalinlik(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-amber mb-1 block font-semibold">Uzunluk (mm)</label>
              <input type="number" value={uzunluk} onChange={e => setUzunluk(e.target.value)} placeholder="ör: 6000" className="w-full px-3 py-2 bg-bg-2 border border-amber/30 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber" /></div>
            </div>
            {parseFloat(en) > parseFloat(boy) && parseFloat(boy) > 0 && (
              <div className="text-[10px] text-red mt-2">⚠ Kısa kenar, uzun kenardan büyük olamaz. Kaydetme sırasında otomatik düzeltilecek.</div>
            )}
          </div>
          )}
          {tip !== 'Sarf' && <button type="button" onClick={tahminEt} className="text-[11px] text-accent hover:underline">🔮 Benzer malzemelerden uzun/kısa kenar tahmin et</button>}
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Operasyon</label>
            <select value={opId} onChange={e => setOpId(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
              <option value="">— Seçin —</option>
              {operations.map(o => <option key={o.id} value={o.id}>{o.kod} — {o.ad}</option>)}
            </select></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white">İptal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  )
}
