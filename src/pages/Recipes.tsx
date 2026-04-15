import { useState, useRef, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm, showPrompt } from '@/lib/prompt'
import type { Recipe, RecipeRow } from '@/types'
import { Plus, Trash2, Pencil, Download, Upload, Search, Copy } from 'lucide-react'
import { SearchSelect } from '@/components/ui/SearchSelect'

export function Recipes() {
  const { recipes, operations, bomTrees, loadAll } = useStore()
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!search) return recipes
    const q = search.toLowerCase()
    return recipes.filter(r => (r.rcKod + ' ' + r.ad + ' ' + r.mamulKod).toLowerCase().includes(q))
  }, [recipes, search])

  function toggleCheck(id: string) { setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleAll() { checkedIds.size === filtered.length ? setCheckedIds(new Set()) : setCheckedIds(new Set(filtered.map(r => r.id))) }

  async function deleteSelected() {
    if (!checkedIds.size) return
    if (!await showConfirm(`${checkedIds.size} reçeteyi silmek istediğinize emin misiniz?`)) return
    for (const id of checkedIds) { await supabase.from('uys_recipes').delete().eq('id', id) }
    setCheckedIds(new Set()); loadAll(); toast.success(checkedIds.size + ' reçete silindi')
  }

  function exportRecipes() {
    import('xlsx').then(XLSX => {
      const rows = recipes.flatMap(r => (r.satirlar || []).map(s => ({
        'Reçete': r.ad, 'Mamul Kod': r.mamulKod, 'Kırılım': s.kirno, 'Malzeme Kod': s.malkod, 'Malzeme': s.malad, 'Tip': s.tip, 'Miktar': s.miktar, 'Birim': s.birim, 'OpId': s.opId || '', 'HazırlıkSüre': s.hazirlikSure || 0, 'İşlemSüre': s.islemSure || 0, 'SüreBirim': s.sureBirim || 'dk'
      })))
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Reçeteler'); XLSX.writeFile(wb, 'receteler.xlsx')
      toast.success(rows.length + ' satır dışa aktarıldı')
    })
  }

  // #11: Excel Import
  function importExcel(file: File) {
    import('xlsx').then(async XLSX => {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws)
      if (!rows.length) { toast.error('Boş dosya'); return }

      const gruplar: Record<string, { ad: string; mamulKod: string; satirlar: RecipeRow[] }> = {}
      for (const r of rows) {
        const mk = r['Mamul Kod'] || r.mamulKod || r.MamulKod || ''
        if (!mk) continue
        if (!gruplar[mk]) gruplar[mk] = { ad: r['Reçete'] || r.Recete || mk, mamulKod: mk, satirlar: [] }
        gruplar[mk].satirlar.push({
          id: uid(), kirno: r['Kırılım'] || r.Kirno || r.kirno || '1',
          malkod: r['Malzeme Kod'] || r.MalKod || r.malkod || '', malad: r['Malzeme'] || r.MalAd || r.malad || '',
          tip: (r.Tip || r.tip || 'Hammadde') as RecipeRow['tip'], miktar: parseFloat(r.Miktar || r.miktar) || 1, birim: r.Birim || r.birim || 'Adet',
          opId: r.OpId || r.opId || '', istId: '', hazirlikSure: parseFloat(r['HazırlıkSüre'] || r.hazirlikSure) || 0, islemSure: parseFloat(r['İşlemSüre'] || r.islemSure) || 0, sureBirim: r['SüreBirim'] || r.sureBirim || 'dk',
        })
      }

      let yeni = 0, guncellenen = 0
      for (const g of Object.values(gruplar)) {
        const existing = recipes.find(r => r.mamulKod === g.mamulKod)
        if (existing) {
          await supabase.from('uys_recipes').update({ satirlar: g.satirlar, ad: g.ad }).eq('id', existing.id)
          guncellenen++
        } else {
          await supabase.from('uys_recipes').insert({ id: uid(), rc_kod: 'RC-' + g.mamulKod, ad: g.ad, mamul_kod: g.mamulKod, mamul_ad: g.ad, satirlar: g.satirlar })
          yeni++
        }
      }
      loadAll(); toast.success(`${yeni} yeni · ${guncellenen} güncellendi`)
    })
  }

  async function deleteRecipe(id: string) {
    if (!await showConfirm('Bu reçeteyi silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_recipes').delete().eq('id', id)
    loadAll(); toast.success('Reçete silindi')
  }

  async function copyRecipe(r: Recipe) {
    const newSatirlar = (r.satirlar || []).map(s => ({ ...s, id: uid() }))
    await supabase.from('uys_recipes').insert({
      id: uid(), rc_kod: (r.rcKod || '') + '-KOPYA', ad: r.ad + ' (Kopya)',
      mamul_kod: r.mamulKod + '-KOPYA', mamul_ad: (r.mamulAd || r.ad) + ' (Kopya)',
      bom_id: null, satirlar: newSatirlar,
    })
    loadAll(); toast.success('Reçete kopyalandı')
  }

  async function renameRecipe(r: Recipe) {
    const yeniAd = await showPrompt('Yeni reçete adı', 'Reçete adı', r.ad)
    if (!yeniAd || yeniAd.trim() === r.ad) return
    await supabase.from('uys_recipes').update({ ad: yeniAd.trim() }).eq('id', r.id)
    loadAll(); toast.success('Reçete adı güncellendi')
  }

  // BOM'dan Reçete Oluştur — tüm ürün ağaçlarını reçeteye dönüştür
  async function bomDanReceteOlustur() {
    if (!bomTrees.length) { toast.error('Ürün ağacı bulunamadı'); return }
    const mevcutMamulKodlar = new Set(recipes.map(r => r.mamulKod))
    const yeniler = bomTrees.filter(b => !mevcutMamulKodlar.has(b.mamulKod))
    if (!yeniler.length) { toast.info('Tüm ürün ağaçları zaten reçete olarak mevcut'); return }
    if (!await showConfirm(`${yeniler.length} ürün ağacından reçete oluşturulacak. Devam?`)) return

    let count = 0
    for (const bom of yeniler) {
      const satirlar = (bom.rows || []).map(r => ({
        id: r.id || uid(), kirno: r.kirno, malkod: r.malkod, malad: r.malad,
        tip: r.tip, miktar: r.miktar, birim: r.birim,
        opId: '', istId: '', hazirlikSure: 0, islemSure: 0,
      }))
      await supabase.from('uys_recipes').insert({
        id: uid(), rc_kod: 'RC-' + bom.mamulKod, ad: bom.ad || bom.mamulAd || bom.mamulKod,
        bom_id: bom.id, mamul_kod: bom.mamulKod, mamul_ad: bom.mamulAd || bom.ad,
        satirlar,
      })
      count++
    }
    loadAll(); toast.success(`${count} reçete oluşturuldu (Ürün Ağaçlarından)`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Reçeteler</h1><p className="text-xs text-zinc-500">{recipes.length} reçete{search ? ` · ${filtered.length} gösterilen` : ''}</p></div>
        <div className="flex gap-2">
          {checkedIds.size > 0 && <button onClick={deleteSelected} className="flex items-center gap-1 px-3 py-1.5 bg-red/10 border border-red/20 text-red rounded-lg text-xs font-semibold hover:bg-red/20"><Trash2 size={12} /> Seçili Sil ({checkedIds.size})</button>}
          {bomTrees.length > 0 && <button onClick={bomDanReceteOlustur} className="flex items-center gap-1.5 px-3 py-1.5 bg-green/10 border border-green/25 text-green rounded-lg text-xs hover:bg-green/20">🌳 BOM'dan ({bomTrees.length})</button>}
          <button onClick={exportRecipes} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> İndir</button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Upload size={13} /> Yükle</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) importExcel(e.target.files[0]); e.target.value = '' }} />
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni</button>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kod, ad veya mamul kodu ara..."
            className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {filtered.length ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500">
              <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={checkedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-accent" /></th>
              <th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Reçete Adı</th><th className="text-left px-4 py-2.5">Mamul Kodu</th><th className="text-right px-4 py-2.5">Bileşen</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={`border-b border-border/30 hover:bg-bg-3/30 ${checkedIds.has(r.id) ? 'bg-accent/5' : ''}`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={checkedIds.has(r.id)} onChange={() => toggleCheck(r.id)} className="accent-accent" /></td>
                  <td className="px-4 py-2 font-mono text-accent cursor-pointer hover:text-white group" onClick={async () => {
                    const yeni = await showPrompt('Reçete kodu değiştir', 'Yeni kod', r.rcKod)
                    if (yeni && yeni.trim() !== r.rcKod) { await supabase.from('uys_recipes').update({ rc_kod: yeni.trim() }).eq('id', r.id); loadAll(); toast.success('Kod güncellendi') }
                  }}>{r.rcKod || '—'} <Pencil size={9} className="inline opacity-0 group-hover:opacity-50" /></td>
                  <td className="px-4 py-2 text-zinc-300 cursor-pointer hover:text-accent group" onClick={() => renameRecipe(r)}>{r.ad} <Pencil size={10} className="inline opacity-0 group-hover:opacity-50" /></td>
                  <td className="px-4 py-2 font-mono text-zinc-500 cursor-pointer hover:text-accent group" onClick={async () => {
                    const yeni = await showPrompt('Mamul kodu değiştir', 'Yeni kod', r.mamulKod)
                    if (yeni && yeni.trim() !== r.mamulKod) { await supabase.from('uys_recipes').update({ mamul_kod: yeni.trim() }).eq('id', r.id); loadAll(); toast.success('Mamul kodu güncellendi') }
                  }}>{r.mamulKod} <Pencil size={9} className="inline opacity-0 group-hover:opacity-50" /></td>
                  <td className="px-4 py-2 text-right font-mono">{r.satirlar?.length || 0}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => copyRecipe(r)} className="px-2 py-0.5 bg-amber/10 text-amber rounded text-[10px] hover:bg-amber/20 mr-1"><Copy size={10} className="inline" /> Kopyala</button>
                    <button onClick={() => setSelected(r)} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white mr-1"><Pencil size={10} className="inline" /> Düzenle</button>
                    <button onClick={() => deleteRecipe(r.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center">
          <div className="text-zinc-600 text-sm mb-3">{search ? 'Aramayla eşleşen reçete yok' : 'Henüz reçete yok'}</div>
          {!search && bomTrees.length > 0 && <button onClick={bomDanReceteOlustur} className="px-4 py-2 bg-green/10 border border-green/25 text-green rounded-lg text-xs hover:bg-green/20">🌳 {bomTrees.length} Ürün Ağacından Reçete Oluştur</button>}
        </div>}
      </div>
      {selected && <RecipeEditor recipe={selected} operations={operations} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); loadAll(); toast.success('Reçete güncellendi') }} />}
      {showNew && <NewRecipeModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); loadAll(); toast.success('Reçete oluşturuldu') }} />}
    </div>
  )
}

function NewRecipeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [rcKod, setRcKod] = useState('')
  const [ad, setAd] = useState('')
  const [mamulKod, setMamulKod] = useState('')
  const [mamulAd, setMamulAd] = useState('')

  async function save() {
    if (!ad.trim()) { toast.error('Reçete adı zorunlu'); return }
    await supabase.from('uys_recipes').insert({
      id: uid(), rc_kod: rcKod.trim(), ad: ad.trim(), mamul_kod: mamulKod.trim(), mamul_ad: mamulAd.trim(),
      satirlar: [{ id: uid(), kirno: '1', malkod: mamulKod.trim(), malad: mamulAd.trim() || ad.trim(), tip: 'Mamul', miktar: 1, birim: 'Adet', opId: null, istId: null, hazirlikSure: 0, islemSure: 0 }],
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Yeni Reçete</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Reçete Kodu</label><input value={rcKod} onChange={e => setRcKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Mamul Kodu</label><input value={mamulKod} onChange={e => setMamulKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Reçete Adı *</label><input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Mamul Adı</label><input value={mamulAd} onChange={e => setMamulAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Oluştur</button>
        </div>
      </div>
    </div>
  )
}

function RecipeEditor({ recipe, operations, onClose, onSaved }: {
  recipe: Recipe; operations: { id: string; kod: string; ad: string }[]
  
  onClose: () => void; onSaved: () => void
}) {
  const [rows, setRows] = useState<RecipeRow[]>(recipe.satirlar || [])
  const [ad, setAd] = useState(recipe.ad || '')
  const [rcKod, setRcKod] = useState(recipe.rcKod || '')
  const { materials, loadAll: storeLoadAll } = useStore()
  const matOptions = materials.map(m => ({ value: m.kod, label: `${m.kod} — ${m.ad}`, sub: m.tip }))
  const [dimFixList, setDimFixList] = useState<{ kod: string; ad: string; id: string; boy: number; en: number; kalinlik: number; uzunluk: number; cap: number; hmTipi: string }[] | null>(null)

  function updateRow(idx: number, field: keyof RecipeRow, value: string | number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  // Malkod değiştiğinde malzeme listesinden otomatik doldur
  function onMalkodChange(idx: number, malkod: string) {
    const mat = materials.find(m => m.kod === malkod)
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      const updated = { ...r, malkod }
      if (mat) {
        updated.malad = mat.ad
        if (mat.tip) updated.tip = mat.tip as RecipeRow['tip']
        if (mat.birim) updated.birim = mat.birim
      }
      return updated
    }))
  }

  // Adından ölçü tahmin et
  function parseDimsFromName(ad: string): { boy: number; en: number; kalinlik: number; uzunluk: number; cap: number } {
    const r = { boy: 0, en: 0, kalinlik: 0, uzunluk: 0, cap: 0 }
    const capM = ad.match(/Ø([\d,]+)[xX×]([\d,]+)/)
    if (capM) { r.cap = parseFloat(capM[1].replace(',', '.')); r.kalinlik = parseFloat(capM[2].replace(',', '.')) }
    const mmM = ad.match(/(\d+)[xX×](\d+)\s*mm/i)
    if (mmM) { r.boy = parseInt(mmM[1]); r.en = parseInt(mmM[2]) }
    else {
      const singleMM = ad.match(/[-–]\s*(\d+)\s*mm/i) || ad.match(/(\d{3,})\s*mm/i)
      if (singleMM) r.uzunluk = parseInt(singleMM[1])
    }
    const thkM = ad.match(/(\d+)\s*mm\s*PLYWOOD/i)
    if (thkM) r.kalinlik = parseInt(thkM[1])
    return r
  }

  function needsDims(mat: { boy: number; en: number; uzunluk: number; cap: number }): boolean {
    return !mat.boy && !mat.en && !mat.uzunluk && !mat.cap
  }

  // ✂ Kesim Hesapla
  function kesimHesapla() {
    const eksikler: NonNullable<typeof dimFixList> = []
    for (const r of rows) {
      if (r.tip !== 'Hammadde' && r.tip !== 'YarıMamul') continue
      if (r.kirno === '1') continue
      const parts = (r.kirno || '').split('.')
      const parentKirno = parts.slice(0, -1).join('.')
      const parentRow = rows.find(pr => pr.kirno === parentKirno)
      if (!parentRow || !isKesimRow(parentRow)) continue

      const parentMat = materials.find(m => m.kod === parentRow.malkod)
      if (parentMat && needsDims(parentMat) && !eksikler.some(e => e.kod === parentMat.kod)) {
        const guess = parseDimsFromName(parentMat.ad)
        eksikler.push({ kod: parentMat.kod, ad: parentMat.ad, id: parentMat.id, ...guess, hmTipi: parentMat.hammaddeTipi })
      }
      const hmMat = materials.find(m => m.kod === r.malkod)
      if (hmMat && needsDims(hmMat) && !eksikler.some(e => e.kod === hmMat.kod)) {
        const guess = parseDimsFromName(hmMat.ad)
        eksikler.push({ kod: hmMat.kod, ad: hmMat.ad, id: hmMat.id, ...guess, hmTipi: hmMat.hammaddeTipi })
      }
    }

    if (eksikler.length > 0) { setDimFixList(eksikler); return }
    runKesimCalc()
  }

  // Üst satırın adı veya operasyonu kesim mi?
  function isKesimRow(r: RecipeRow): boolean {
    const ad = (r.malad || '').toUpperCase()
    if (ad.includes('KESİM') || ad.includes('KESME')) return true
    if (r.opId) {
      const op = operations.find(o => o.id === r.opId)
      if (op) {
        const opAd = (op.ad || '').toUpperCase()
        if (opAd.includes('KESME') || opAd.includes('KESİM')) return true
      }
    }
    return false
  }

  function runKesimCalc() {
    let guncellenen = 0
    const detaylar: string[] = []
    const yeniRows = rows.map(r => {
      if (r.tip !== 'Hammadde' && r.tip !== 'YarıMamul') return r
      if (r.kirno === '1') return r

      // Üst satırı bul
      const parts = (r.kirno || '').split('.')
      const parentKirno = parts.slice(0, -1).join('.')
      const parentRow = rows.find(pr => pr.kirno === parentKirno)
      if (!parentRow) return r

      // Üst satır kesim işlemi mi?
      if (!isKesimRow(parentRow)) return r

      // Üst satırın malzeme ölçüleri
      const parentMat = materials.find(m => m.kod === parentRow.malkod)
      if (!parentMat) return r
      const uB = parentMat.boy || 0; const uE = parentMat.en || 0; const uUz = parentMat.uzunluk || 0
      if (!uB && !uE && !uUz) return r
      const urunParBoy = uUz > 0 ? uUz : Math.max(uB, uE)

      const hmMat = materials.find(m => m.kod === r.malkod)
      if (!hmMat) return r
      const hB = hmMat.boy || 0; const hE = hmMat.en || 0; const hUz = hmMat.uzunluk || 0
      let adetPer: number
      if (hUz > 0) {
        if (!urunParBoy || hUz <= urunParBoy) return r
        adetPer = Math.floor(hUz / urunParBoy)
        detaylar.push(`${hUz}mm bar → ${urunParBoy}mm: ${adetPer}/bar`)
      } else if (hE > 0 && hB > 0 && uE > 0 && uB > 0) {
        const hmBoy = Math.max(hB, hE); const hmEn = Math.min(hB, hE)
        const urunBoy = Math.min(uB, uE); const urunEn = Math.max(uB, uE)
        adetPer = Math.max(Math.floor(hmBoy / urunEn) * Math.floor(hmEn / urunBoy), Math.floor(hmBoy / urunBoy) * Math.floor(hmEn / urunEn))
        detaylar.push(`${hmEn}×${hmBoy} → ${urunBoy}×${urunEn}: ${adetPer}/plaka`)
      } else {
        const hmBoy = Math.max(hB, hE); if (!hmBoy || !urunParBoy || hmBoy <= urunParBoy) return r
        adetPer = Math.floor(hmBoy / urunParBoy)
        detaylar.push(`${hmBoy}mm → ${urunParBoy}mm: ${adetPer}/bar`)
      }
      if (adetPer <= 0) { toast.error(`${r.malkod}: sığmıyor`); return r }
      guncellenen++
      return { ...r, miktar: Math.round((1 / adetPer) * 10000) / 10000 }
    })
    if (guncellenen > 0) {
      setRows(yeniRows)
      toast.success(`${guncellenen} hammadde güncellendi — ${detaylar.join(' | ')}`)
    } else toast.error('Kesim işlemi bulunamadı (üst satır adında/operasyonunda KESİM/KESME olmalı)')
  }

  async function saveDimFixes(fixes: NonNullable<typeof dimFixList>) {
    for (const f of fixes) {
      await supabase.from('uys_malzemeler').update({
        boy: f.boy, en: f.en, kalinlik: f.kalinlik, uzunluk: f.uzunluk, cap: f.cap,
      }).eq('id', f.id)
    }
    await storeLoadAll()
    setDimFixList(null)
    toast.success(`${fixes.length} malzeme kartı güncellendi`)
    setTimeout(() => runKesimCalc(), 300)
  }

  function addRow(parentKirno: string) {
    const children = rows.filter(r => r.kirno.startsWith(parentKirno + '.') && r.kirno.split('.').length === parentKirno.split('.').length + 1)
    const nextNum = children.length + 1
    const newKirno = parentKirno + '.' + nextNum
    setRows([...rows, { id: uid(), kirno: newKirno, malkod: '', malad: 'Yeni Bileşen', tip: 'YarıMamul', miktar: 1, birim: 'Adet', opId: '', istId: '', hazirlikSure: 0, islemSure: 0, sureBirim: 'dk' }])
  }

  function deleteRow(idx: number) {
    const kirno = rows[idx].kirno
    // Alt kırılımları da sil
    setRows(prev => prev.filter((r, i) => i !== idx && !r.kirno.startsWith(kirno + '.')))
  }

  async function save() {
    if (!ad.trim()) { toast.error('Reçete adı zorunlu'); return }
    await supabase.from('uys_recipes').update({ satirlar: rows, ad: ad.trim(), rc_kod: rcKod.trim() }).eq('id', recipe.id)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-5xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <input value={rcKod} onChange={e => setRcKod(e.target.value)} placeholder="RC-..."
                className="px-2 py-1 bg-bg-3/50 border border-border/50 rounded text-xs font-mono text-accent w-28 focus:outline-none focus:border-accent" />
              <input value={ad} onChange={e => setAd(e.target.value)} placeholder="Reçete Adı *"
                className="flex-1 px-2 py-1 bg-bg-3/50 border border-border/50 rounded text-sm font-semibold text-zinc-200 focus:outline-none focus:border-accent" />
            </div>
            <p className="text-xs text-zinc-500">{recipe.mamulKod} · {rows.length} satır</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500">
                <th className="text-left px-2 py-2 w-20">Kırılım</th>
                <th className="text-left px-2 py-2">Malzeme Kodu</th>
                <th className="text-left px-2 py-2">Malzeme Adı</th>
                <th className="text-left px-2 py-2 w-24">Tip</th>
                <th className="text-right px-2 py-2 w-16">Miktar</th>
                <th className="text-left px-2 py-2 w-16">Birim</th>
                <th className="text-left px-2 py-2">Operasyon</th>
                <th className="text-right px-2 py-2 w-28">Hazırlık</th>
                <th className="text-right px-2 py-2 w-28">İşlem</th>
                <th className="text-left px-2 py-2 w-14">Birim</th>
                <th className="px-2 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const depth = (r.kirno || '').split('.').length - 1
                return (
                  <tr key={r.id || i} className="border-b border-border/20 hover:bg-bg-3/20">
                    <td className="px-2 py-1"><span className="font-mono text-zinc-500">{r.kirno}</span></td>
                    <td className="px-2 py-1">
                      <SearchSelect options={matOptions} value={r.malkod || ''} onChange={(val) => onMalkodChange(i, val)} placeholder="Kod arayın..." allowNew={true} inputClassName="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 focus:outline-none focus:border-accent" />
                    </td>
                    <td className="px-2 py-1" style={{ paddingLeft: `${8 + depth * 12}px` }}>
                      <input value={r.malad || ''} onChange={e => updateRow(i, 'malad', e.target.value)}
                        className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 focus:outline-none focus:border-accent" />
                    </td>
                    <td className="px-2 py-1">
                      <select value={r.tip} onChange={e => updateRow(i, 'tip', e.target.value)} className="w-full px-1 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200">
                        <option value="Mamul">Mamul</option><option value="YarıMamul">Yarı Mamul</option>
                        <option value="Hammadde">Hammadde</option><option value="Sarf">Sarf</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" value={r.miktar} onChange={e => updateRow(i, 'miktar', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 text-right focus:outline-none" />
                    </td>
                    <td className="px-2 py-1">
                      <select value={r.birim} onChange={e => updateRow(i, 'birim', e.target.value)} className="w-full px-1 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200">
                        <option>Adet</option><option>Kg</option><option>Metre</option><option>m²</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      {(r.tip === 'YarıMamul' || r.tip === 'Mamul') && (
                        <select value={r.opId || ''} onChange={e => updateRow(i, 'opId', e.target.value)} className="w-full px-1 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200">
                          <option value="">—</option>
                          {operations.map(o => <option key={o.id} value={o.id}>{o.ad}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {(r.tip === 'YarıMamul' || r.tip === 'Mamul') && (
                        <input type="number" value={r.hazirlikSure || 0} onChange={e => updateRow(i, 'hazirlikSure', parseFloat(e.target.value) || 0)}
                          className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 text-right focus:outline-none" placeholder="0" />
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {(r.tip === 'YarıMamul' || r.tip === 'Mamul') && (
                        <input type="number" value={r.islemSure || 0} onChange={e => updateRow(i, 'islemSure', parseFloat(e.target.value) || 0)}
                          className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 text-right focus:outline-none" placeholder="0" />
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {(r.tip === 'YarıMamul' || r.tip === 'Mamul') && (
                        <select value={r.sureBirim || 'dk'} onChange={e => updateRow(i, 'sureBirim', e.target.value)} className="w-full px-1 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200">
                          <option value="dk">dk</option><option value="sn">sn</option>
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button onClick={() => addRow(r.kirno)} className="p-0.5 text-zinc-500 hover:text-accent" title="Alt bileşen ekle"><Plus size={11} /></button>
                      {r.kirno !== '1' && <button onClick={() => deleteRow(i)} className="p-0.5 text-zinc-500 hover:text-red" title="Sil"><Trash2 size={11} /></button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between mt-4">
          <div className="flex gap-2">
            <button onClick={() => addRow('1')} className="flex items-center gap-1 px-3 py-1.5 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white"><Plus size={12} /> Kök Bileşen</button>
            <button onClick={kesimHesapla} className="flex items-center gap-1 px-3 py-1.5 bg-amber/10 text-amber rounded-lg text-xs hover:bg-amber/20">✂ Kesim Hesapla</button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
            <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
          </div>
        </div>
      </div>
      {dimFixList && <DimFixModal items={dimFixList} onSave={saveDimFixes} onClose={() => setDimFixList(null)} />}
    </div>
  )
}

// ═══ ÖLÇÜ DÜZELTME MODALI ═══
function DimFixModal({ items, onSave, onClose }: {
  items: { kod: string; ad: string; id: string; boy: number; en: number; kalinlik: number; uzunluk: number; cap: number; hmTipi: string }[]
  onSave: (fixes: typeof items) => void; onClose: () => void
}) {
  const [fixes, setFixes] = useState(items.map(it => ({ ...it })))
  const [saving, setSaving] = useState(false)

  function updateFix(i: number, field: string, val: number) {
    setFixes(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f))
  }

  async function handleSave() {
    const hepsiBosMu = fixes.every(f => !f.boy && !f.en && !f.uzunluk && !f.cap)
    if (hepsiBosMu) { toast.error('En az bir malzeme için ölçü girin'); return }
    setSaving(true)
    await onSave(fixes)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="bg-bg-1 border border-amber/30 rounded-xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-amber mb-1">⚠ Eksik Ölçüler</h2>
        <p className="text-xs text-zinc-500 mb-4">Aşağıdaki malzemelerin ölçüleri eksik. Adından tahmin edilenler dolduruldu — kontrol edip onaylayın.</p>
        <div className="space-y-3">
          {fixes.map((f, i) => (
            <div key={f.id} className="bg-bg-2 border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-accent text-[11px]">{f.kod}</span>
                <span className="text-zinc-300 text-xs truncate">{f.ad}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div><label className="text-[10px] text-zinc-500 block">Boy (mm)</label>
                  <input type="number" value={f.boy || ''} onChange={e => updateFix(i, 'boy', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" /></div>
                <div><label className="text-[10px] text-zinc-500 block">En (mm)</label>
                  <input type="number" value={f.en || ''} onChange={e => updateFix(i, 'en', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" /></div>
                <div><label className="text-[10px] text-zinc-500 block">Kalınlık</label>
                  <input type="number" value={f.kalinlik || ''} onChange={e => updateFix(i, 'kalinlik', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" /></div>
                <div><label className="text-[10px] text-amber block font-semibold">Uzunluk</label>
                  <input type="number" value={f.uzunluk || ''} onChange={e => updateFix(i, 'uzunluk', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-bg-3 border border-amber/30 rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" /></div>
                <div><label className="text-[10px] text-zinc-500 block">Çap (mm)</label>
                  <input type="number" value={f.cap || ''} onChange={e => updateFix(i, 'cap', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" /></div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white">İptal</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-amber hover:bg-amber/80 disabled:opacity-40 text-black rounded-lg text-xs font-semibold">
            {saving ? 'Kaydediliyor...' : `✓ Kaydet ve Hesapla (${fixes.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
