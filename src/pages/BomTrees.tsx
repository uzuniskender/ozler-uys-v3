import { useAuth } from '@/hooks/useAuth'
import { useState, useRef, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm, showPrompt } from '@/lib/prompt'
import type { BomTree } from '@/types'
import { Plus, Trash2, Pencil, Download, Upload, Search, Copy } from 'lucide-react'
import { SearchSelect } from '@/components/ui/SearchSelect'

export function BomTrees() {
  const { bomTrees, recipes, loadAll } = useStore()
  const { can } = useAuth()
  const [selected, setSelected] = useState<BomTree | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!search) return bomTrees
    const q = search.toLowerCase()
    return bomTrees.filter(bt => (bt.mamulKod + ' ' + (bt.ad || bt.mamulAd)).toLowerCase().includes(q))
  }, [bomTrees, search])

  function toggleCheck(id: string) {
    setCheckedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    if (checkedIds.size === filtered.length) setCheckedIds(new Set())
    else setCheckedIds(new Set(filtered.map(b => b.id)))
  }

  async function deleteSelected() {
    if (!checkedIds.size) return
    const count = checkedIds.size
    if (!await showConfirm(`${count} ürün ağacını silmek istediğinize emin misiniz?`)) return
    for (const id of checkedIds) { await supabase.from('uys_bom_trees').delete().eq('id', id) }
    setCheckedIds(new Set()); loadAll(); toast.success(count + ' ürün ağacı silindi')
  }

  async function deleteBom(id: string) {
    if (!await showConfirm('Bu ürün ağacını silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_bom_trees').delete().eq('id', id)
    loadAll(); toast.success('Ürün ağacı silindi')
  }

  async function copyBom(bt: BomTree) {
    const newRows = (bt.rows || []).map(r => ({ ...r, id: uid() }))
    await supabase.from('uys_bom_trees').insert({
      id: uid(), mamul_kod: bt.mamulKod + '-KOPYA', mamul_ad: (bt.mamulAd || bt.ad) + ' (Kopya)',
      ad: (bt.ad || bt.mamulAd) + ' (Kopya)', rows: newRows,
    })
    loadAll(); toast.success('Ürün ağacı kopyalandı')
  }

  async function renameBom(bt: BomTree) {
    const yeniAd = await showPrompt('Yeni ürün ağacı adı', 'Ürün adı', bt.ad || bt.mamulAd)
    if (!yeniAd || yeniAd.trim() === (bt.ad || bt.mamulAd)) return
    await supabase.from('uys_bom_trees').update({ ad: yeniAd.trim(), mamul_ad: yeniAd.trim() }).eq('id', bt.id)
    loadAll(); toast.success('Ad güncellendi')
  }

  // #10: Excel Export
  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows: any[] = []
      bomTrees.forEach(bt => {
        (bt.rows || []).forEach(r => {
          rows.push({ MamulKod: bt.mamulKod, UrunAdi: bt.ad, Kirno: r.kirno, MalKod: r.malkod, MalAd: r.malad, Tip: r.tip, Miktar: r.miktar, Birim: r.birim })
        })
      })
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'UrunAgaclari'); XLSX.writeFile(wb, 'urun_agaclari.xlsx')
      toast.success(rows.length + ' satır dışa aktarıldı')
    })
  }

  // #10: Excel Import
  function importExcel(file: File) {
    import('xlsx').then(async XLSX => {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data); const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(ws)
      if (!rows.length) { toast.error('Boş dosya'); return }

      // MamulKod bazlı grupla
      const gruplar: Record<string, { mamulKod: string; ad: string; rows: any[] }> = {}
      for (const r of rows) {
        const mk = r.MamulKod || r.mamulKod || r.mamulkod || ''
        if (!mk) continue
        if (!gruplar[mk]) gruplar[mk] = { mamulKod: mk, ad: r.UrunAdi || r.urunAdi || mk, rows: [] }
        gruplar[mk].rows.push({
          id: uid(), kirno: r.Kirno || r.kirno || '1',
          malkod: r.MalKod || r.malKod || r.malkod || '', malad: r.MalAd || r.malAd || r.malad || '',
          tip: r.Tip || r.tip || 'Hammadde', miktar: parseFloat(r.Miktar || r.miktar) || 1, birim: r.Birim || r.birim || 'Adet',
        })
      }

      let yeni = 0, guncellenen = 0
      for (const g of Object.values(gruplar)) {
        const existing = bomTrees.find(bt => bt.mamulKod === g.mamulKod)
        if (existing) {
          await supabase.from('uys_bom_trees').update({ rows: g.rows, ad: g.ad, mamul_ad: g.ad }).eq('id', existing.id)
          guncellenen++
        } else {
          await supabase.from('uys_bom_trees').insert({ id: uid(), mamul_kod: g.mamulKod, mamul_ad: g.ad, ad: g.ad, rows: g.rows })
          yeni++
        }
      }
      loadAll(); toast.success(`${yeni} yeni · ${guncellenen} güncellendi`)
    })
  }

  async function createRecipeFromBom(bt: BomTree) {
    const existing = recipes.find(r => r.mamulKod === bt.mamulKod)
    if (existing && !await showConfirm(`"${bt.mamulKod}" için reçete zaten var. Üzerine yazılsın mı?`)) return
    const satirlar = (bt.rows || []).map(row => ({
      id: uid(), kirno: row.kirno || '1', malkod: row.malkod, malad: row.malad,
      tip: row.tip || 'Hammadde', miktar: row.miktar || 1, birim: row.birim || 'Adet',
      opId: '', istId: '', hazirlikSure: 0, islemSure: 0,
    }))
    if (existing) {
      await supabase.from('uys_recipes').update({ satirlar, bom_id: bt.id }).eq('id', existing.id)
    } else {
      await supabase.from('uys_recipes').insert({
        id: uid(), rc_kod: 'RC-' + bt.mamulKod, ad: bt.ad || bt.mamulAd,
        bom_id: bt.id, mamul_kod: bt.mamulKod, mamul_ad: bt.mamulAd || bt.ad, satirlar,
      })
    }
    loadAll(); toast.success(`"${bt.mamulKod}" reçetesi ${existing ? 'güncellendi' : 'oluşturuldu'} — ${satirlar.length} satır`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Ürün Ağaçları</h1><p className="text-xs text-zinc-500">{bomTrees.length} ağaç{search ? ` · ${filtered.length} gösterilen` : ''}</p></div>
        <div className="flex gap-2">
          {can('bom_delete') && checkedIds.size > 0 && <button onClick={deleteSelected} className="flex items-center gap-1 px-3 py-1.5 bg-red/10 border border-red/20 text-red rounded-lg text-xs font-semibold hover:bg-red/20"><Trash2 size={12} /> Seçili Sil ({checkedIds.size})</button>}
          <button onClick={exportExcel} className="flex items-center gap-1 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={12} /> Excel İndir</button>
          {can('bom_excel') && <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Upload size={12} /> Excel Yükle</button>}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) importExcel(e.target.files[0]); e.target.value = '' }} />
          {can('bom_add') && <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni</button>}
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mamul kodu veya ad ara..."
            className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {filtered.length ? (
          <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500">
            <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={checkedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-accent" /></th>
            <th className="text-left px-4 py-2.5">Mamul Kodu</th><th className="text-left px-4 py-2.5">Ürün Adı</th><th className="text-right px-4 py-2.5">Bileşen</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody>
            {filtered.map(bt => (
              <tr key={bt.id} className={`border-b border-border/30 hover:bg-bg-3/30 ${checkedIds.has(bt.id) ? 'bg-accent/5' : ''}`}>
                <td className="px-3 py-2"><input type="checkbox" checked={checkedIds.has(bt.id)} onChange={() => toggleCheck(bt.id)} className="accent-accent" /></td>
                <td className="px-4 py-2 font-mono text-accent cursor-pointer hover:text-white group" onClick={async () => {
                  const yeni = await showPrompt('Mamul kodu değiştir', 'Yeni kod', bt.mamulKod)
                  if (yeni && yeni.trim() !== bt.mamulKod) { await supabase.from('uys_bom_trees').update({ mamul_kod: yeni.trim() }).eq('id', bt.id); loadAll(); toast.success('Kod güncellendi') }
                }}>{bt.mamulKod} <Pencil size={9} className="inline opacity-0 group-hover:opacity-50" /></td>
                <td className="px-4 py-2 text-zinc-300 cursor-pointer hover:text-accent group" onClick={() => renameBom(bt)}>{bt.ad || bt.mamulAd} <Pencil size={10} className="inline opacity-0 group-hover:opacity-50" /></td>
                <td className="px-4 py-2 text-right font-mono">{bt.rows?.length || 0}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => createRecipeFromBom(bt)} className="px-2 py-0.5 bg-green/10 text-green rounded text-[10px] hover:bg-green/20 mr-1">📋 Reçete Oluştur</button>
                  {can('bom_add') && <button onClick={() => copyBom(bt)} className="px-2 py-0.5 bg-amber/10 text-amber rounded text-[10px] hover:bg-amber/20 mr-1"><Copy size={10} className="inline" /> Kopyala</button>}
                  {can('bom_edit') && <button onClick={() => setSelected(bt)} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white mr-1"><Pencil size={10} className="inline" /> Düzenle</button>}
                  {can('bom_delete') && <button onClick={() => deleteBom(bt.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>}
                </td>
              </tr>
            ))}
          </tbody></table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">{search ? 'Aramayla eşleşen ürün ağacı yok' : 'Henüz ürün ağacı yok'}</div>}
      </div>
      {selected && <BomEditor bom={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); loadAll(); toast.success('Ürün ağacı güncellendi') }} />}
      {showNew && <NewBomModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); loadAll(); toast.success('Ürün ağacı oluşturuldu') }} />}
    </div>
  )
}

function NewBomModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { materials } = useStore()
  const { can } = useAuth()
  const [mamulKod, setMamulKod] = useState('')
  const [ad, setAd] = useState('')

  const matOptions = materials.map(m => ({ value: m.kod, label: `${m.kod} — ${m.ad}`, sub: m.tip }))

  function onMamulKodChange(kod: string, label: string) {
    setMamulKod(kod)
    const mat = materials.find(m => m.kod === kod)
    if (mat) setAd(mat.ad)
  }

  async function save() {
    if (!ad.trim()) { toast.error('Ürün adı zorunlu'); return }
    await supabase.from('uys_bom_trees').insert({ id: uid(), mamul_kod: mamulKod.trim(), mamul_ad: ad.trim(), ad: ad.trim(), rows: [{ id: uid(), kirno: '1', malkod: mamulKod.trim(), malad: ad.trim(), tip: 'Mamul', miktar: 1, birim: 'Adet' }] })
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Yeni Ürün Ağacı</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Mamul Kodu (Malzeme listesinden arayın)</label>
          <SearchSelect options={matOptions} value={mamulKod} onChange={onMamulKodChange} placeholder="Kod yazın veya arayın..." allowNew={true} /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Ürün Adı *</label><input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Oluştur</button>
        </div>
      </div>
    </div>
  )
}

function BomEditor({ bom, onClose, onSaved }: { bom: BomTree; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState(bom.rows || [])
  const [viewMode, setViewMode] = useState<'edit'|'tree'>('edit')
  const { materials, loadAll: storeLoadAll } = useStore()
  const { can } = useAuth()
  const [dimFixList, setDimFixList] = useState<{ kod: string; ad: string; id: string; boy: number; en: number; kalinlik: number; uzunluk: number; cap: number; hmTipi: string }[] | null>(null)
  const matOptions = materials.map(m => ({ value: m.kod, label: `${m.kod} — ${m.ad}`, sub: m.tip }))

  function updateRow(i: number, field: string, value: string | number) { setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r)) }

  // Malkod değiştiğinde malzeme listesinden otomatik doldur
  function onMalkodChange(i: number, malkod: string) {
    const mat = materials.find(m => m.kod === malkod)
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const updated = { ...r, malkod }
      if (mat) {
        updated.malad = mat.ad
        if (mat.tip) updated.tip = mat.tip as 'Mamul' | 'YarıMamul' | 'Hammadde' | 'Sarf'
        if (mat.birim) updated.birim = mat.birim
      }
      return updated
    }))
  }

  function addRow(parentKirno: string) {
    const children = rows.filter(r => r.kirno.startsWith(parentKirno + '.') && r.kirno.split('.').length === parentKirno.split('.').length + 1)
    const newKirno = parentKirno + '.' + (children.length + 1)
    setRows([...rows, { id: uid(), kirno: newKirno, malkod: '', malad: 'Yeni Bileşen', tip: 'Hammadde', miktar: 1, birim: 'Adet' }])
  }
  function deleteRow(i: number) { const k = rows[i].kirno; setRows(prev => prev.filter((r, idx) => idx !== i && !r.kirno.startsWith(k + '.'))) }

  // Adından ölçü tahmin et
  function parseDimsFromName(ad: string): { boy: number; en: number; kalinlik: number; uzunluk: number; cap: number } {
    const r = { boy: 0, en: 0, kalinlik: 0, uzunluk: 0, cap: 0 }
    // Ø38x2,5 veya Ø48,3x3 → çap × et
    const capM = ad.match(/Ø([\d,]+)[xX×]([\d,]+)/)
    if (capM) { r.cap = parseFloat(capM[1].replace(',', '.')); r.kalinlik = parseFloat(capM[2].replace(',', '.')) }
    // Son mm değeri → uzunluk veya boyxen
    const mmM = ad.match(/(\d+)[xX×](\d+)\s*mm/i)
    if (mmM) { r.boy = parseInt(mmM[1]); r.en = parseInt(mmM[2]) }
    else {
      const singleMM = ad.match(/[-–]\s*(\d+)\s*mm/i) || ad.match(/(\d{3,})\s*mm/i)
      if (singleMM) r.uzunluk = parseInt(singleMM[1])
    }
    // kalınlık mm önce: "21mm" veya "15mm" plywood'da
    const thkM = ad.match(/(\d+)\s*mm\s*PLYWOOD/i)
    if (thkM) r.kalinlik = parseInt(thkM[1])
    return r
  }

  function needsDims(mat: { boy: number; en: number; kalinlik: number; uzunluk: number; cap: number }): boolean {
    return !mat.boy && !mat.en && !mat.uzunluk && !mat.cap
  }

  // ✂ KESİM HESAPLA — hammadde ölçüsünden ürün ölçüsüne verim hesabı
  function kesimHesapla() {
    // Ölçüsü eksik malzemeleri topla — sadece kesim ilişkisindeki satırlarda
    const eksikler: typeof dimFixList = []
    for (const r of rows) {
      if (r.tip !== 'Hammadde' && r.tip !== 'YarıMamul') continue
      if (r.kirno === '1') continue
      // Üst satırı bul
      const parts = (r.kirno || '').split('.')
      const parentKirno = parts.slice(0, -1).join('.')
      const parentRow = rows.find(pr => pr.kirno === parentKirno)
      if (!parentRow || !isKesimRow(parentRow)) continue // Kesim değilse atla

      // Üst satırın ölçüleri eksik mi?
      const parentMat = materials.find(m => m.kod === parentRow.malkod)
      if (parentMat && needsDims(parentMat) && !eksikler.some(e => e.kod === parentMat.kod)) {
        const guess = parseDimsFromName(parentMat.ad)
        eksikler.push({ kod: parentMat.kod, ad: parentMat.ad, id: parentMat.id, ...guess, hmTipi: parentMat.hammaddeTipi })
      }
      // Bu satırın ölçüleri eksik mi?
      const hmMat = materials.find(m => m.kod === r.malkod)
      if (hmMat && needsDims(hmMat) && !eksikler.some(e => e.kod === hmMat.kod)) {
        const guess = parseDimsFromName(hmMat.ad)
        eksikler.push({ kod: hmMat.kod, ad: hmMat.ad, id: hmMat.id, ...guess, hmTipi: hmMat.hammaddeTipi })
      }
    }

    if (eksikler.length > 0) {
      setDimFixList(eksikler)
      return
    }

    runKesimCalc()
  }

  // Üst satırın adı/operasyonu kesim mi?
  function isKesimRow(r: { malad?: string; malkod?: string }): boolean {
    const ad = (r.malad || '').toUpperCase()
    return ad.includes('KESİM') || ad.includes('KESME') || ad.includes('KESİM') || ad.includes('BANT KESİM')
  }

  function runKesimCalc() {
    let guncellenen = 0
    const detaylar: string[] = []
    const yeniRows = rows.map(r => {
      if (r.tip !== 'Hammadde' && r.tip !== 'YarıMamul') return r
      if (r.kirno === '1') return r

      // Üst satırı bul (1.1 → parent 1, 1.1.2 → parent 1.1)
      const parts = (r.kirno || '').split('.')
      const parentKirno = parts.slice(0, -1).join('.')
      const parentRow = rows.find(pr => pr.kirno === parentKirno)
      if (!parentRow) return r

      // Üst satır kesim işlemi mi?
      if (!isKesimRow(parentRow)) return r

      // Üst satırın malzeme ölçüleri — ürün boyutları
      const parentMat = materials.find(m => m.kod === parentRow.malkod)
      if (!parentMat) return r
      const uB = parentMat.boy || 0
      const uE = parentMat.en || 0
      const uUz = parentMat.uzunluk || 0
      if (!uB && !uE && !uUz) return r
      const urunParBoy = uUz > 0 ? uUz : Math.max(uB, uE)

      // Bu satırın malzeme ölçüleri — kaynak boyutları
      const hmMat = materials.find(m => m.kod === r.malkod)
      if (!hmMat) return r
      const hB = hmMat.boy || 0
      const hE = hmMat.en || 0
      const hUz = hmMat.uzunluk || 0

      let adetPer: number
      if (hUz > 0) {
        if (!urunParBoy || hUz <= urunParBoy) return r // Kaynak küçükse kesim değil
        adetPer = Math.floor(hUz / urunParBoy)
        detaylar.push(`${hUz}mm bar → ${urunParBoy}mm parça: ${adetPer} adet/bar`)
      } else if (hE > 0 && hB > 0 && uE > 0 && uB > 0) {
        const hmBoy = Math.max(hB, hE); const hmEn = Math.min(hB, hE)
        const urunBoy = Math.min(uB, uE); const urunEn = Math.max(uB, uE)
        const n1 = Math.floor(hmBoy / urunEn) * Math.floor(hmEn / urunBoy)
        const n2 = Math.floor(hmBoy / urunBoy) * Math.floor(hmEn / urunEn)
        adetPer = Math.max(n1, n2)
        detaylar.push(`${hmEn}×${hmBoy} → ${urunBoy}×${urunEn}: ${adetPer} adet/plaka`)
      } else {
        const hmBoy = Math.max(hB, hE)
        if (!hmBoy || !urunParBoy || hmBoy <= urunParBoy) return r
        adetPer = Math.floor(hmBoy / urunParBoy)
        detaylar.push(`${hmBoy}mm → ${urunParBoy}mm: ${adetPer} adet/bar`)
      }

      if (adetPer <= 0) { toast.error(`${r.malkod}: ürün sığmıyor`); return r }
      guncellenen++
      return { ...r, miktar: Math.round((1 / adetPer) * 10000) / 10000 }
    })

    if (guncellenen > 0) {
      setRows(yeniRows)
      toast.success(`${guncellenen} hammadde güncellendi — ${detaylar.join(' | ')}`)
    } else {
      toast.error('Kesim işlemi bulunamadı (üst satır adında KESİM/KESME olmalı)')
    }
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
    // Store güncellenince kesim hesabını tekrar çalıştır
    setTimeout(() => runKesimCalc(), 300)
  }

  async function save() {
    await supabase.from('uys_bom_trees').update({ rows }).eq('id', bom.id)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <div><h2 className="text-lg font-semibold">{bom.ad || bom.mamulAd}</h2><p className="text-xs text-zinc-500">{bom.mamulKod} · {rows.length} satır</p></div>
          <div className="flex gap-2 items-center">
            <button onClick={() => setViewMode('edit')} className={`px-2 py-1 rounded text-[10px] ${viewMode === 'edit' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400'}`}>Düzenle</button>
            <button onClick={() => setViewMode('tree')} className={`px-2 py-1 rounded text-[10px] ${viewMode === 'tree' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400'}`}>Ağaç Görünüm</button>
            <button onClick={kesimHesapla} className="px-2 py-1 bg-amber/10 text-amber rounded text-[10px] hover:bg-amber/20">✂ Kesim Hesapla</button>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg ml-2">✕</button>
          </div>
        </div>

        {viewMode === 'tree' ? (
          <div className="bg-bg-2 border border-border rounded-lg p-4 font-mono text-xs">
            {rows.sort((a, b) => a.kirno.localeCompare(b.kirno)).map((r, i) => {
              const depth = (r.kirno || '').split('.').length - 1
              const tipColor = r.tip === 'Hammadde' ? 'text-green' : r.tip === 'YarıMamul' ? 'text-amber' : r.tip === 'Mamul' ? 'text-accent' : 'text-zinc-400'
              return (
                <div key={i} style={{ paddingLeft: `${depth * 20}px` }} className="py-1 flex items-center gap-2">
                  <span className="text-zinc-600">{depth > 0 ? '├─' : '●'}</span>
                  <span className={tipColor}>{r.kirno}</span>
                  <span className="text-accent">{r.malkod}</span>
                  <span className="text-zinc-300">{r.malad}</span>
                  <span className="text-zinc-500">×{r.miktar} {r.birim}</span>
                  <span className={`text-[9px] px-1 py-0.5 rounded ${r.tip === 'Hammadde' ? 'bg-green/10 text-green' : r.tip === 'YarıMamul' ? 'bg-amber/10 text-amber' : 'bg-accent/10 text-accent'}`}>{r.tip}</span>
                </div>
              )
            })}
          </div>
        ) : (<>

        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-2 py-2 w-20">Kırılım</th><th className="text-left px-2 py-2">Malzeme Kodu</th><th className="text-left px-2 py-2">Malzeme Adı</th><th className="text-left px-2 py-2 w-24">Tip</th><th className="text-right px-2 py-2 w-16">Miktar</th><th className="text-left px-2 py-2 w-16">Birim</th><th className="px-2 py-2 w-16"></th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const depth = (r.kirno || '').split('.').length - 1
              return (
                <tr key={i} className="border-b border-border/20 hover:bg-bg-3/20">
                  <td className="px-2 py-1 font-mono text-zinc-500">{r.kirno}</td>
                  <td className="px-2 py-1"><SearchSelect options={matOptions} value={r.malkod || ''} onChange={(val) => onMalkodChange(i, val)} placeholder="Kod arayın..." allowNew={true} inputClassName="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 focus:outline-none focus:border-accent" /></td>
                  <td className="px-2 py-1" style={{ paddingLeft: `${8 + depth * 12}px` }}><input value={r.malad || ''} onChange={e => updateRow(i, 'malad', e.target.value)} className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 focus:outline-none focus:border-accent" /></td>
                  <td className="px-2 py-1"><select value={r.tip} onChange={e => updateRow(i, 'tip', e.target.value)} className="w-full px-1 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200"><option value="Mamul">Mamul</option><option value="YarıMamul">Yarı Mamul</option><option value="Hammadde">Hammadde</option><option value="Sarf">Sarf</option></select></td>
                  <td className="px-2 py-1"><input type="number" value={r.miktar} onChange={e => updateRow(i, 'miktar', parseFloat(e.target.value) || 0)} className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 text-right focus:outline-none" /></td>
                  <td className="px-2 py-1"><select value={r.birim} onChange={e => updateRow(i, 'birim', e.target.value)} className="w-full px-1 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200"><option>Adet</option><option>Kg</option><option>Metre</option><option>m²</option></select></td>
                  <td className="px-2 py-1 text-right">
                    <button onClick={() => addRow(r.kirno)} className="p-0.5 text-zinc-500 hover:text-accent" title="Alt bileşen"><Plus size={11} /></button>
                    {r.kirno !== '1' && <button onClick={() => deleteRow(i)} className="p-0.5 text-zinc-500 hover:text-red" title="Sil"><Trash2 size={11} /></button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </>)}
        <div className="flex justify-between mt-4">
          <button onClick={() => addRow('1')} className="flex items-center gap-1 px-3 py-1.5 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white"><Plus size={12} /> Kök Bileşen</button>
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
    // En az bir ölçü girilmiş mi kontrol et
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
                <div>
                  <label className="text-[10px] text-zinc-500 block">Boy (mm)</label>
                  <input type="number" value={f.boy || ''} onChange={e => updateFix(i, 'boy', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" placeholder="0" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block">En (mm)</label>
                  <input type="number" value={f.en || ''} onChange={e => updateFix(i, 'en', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" placeholder="0" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block">Kalınlık</label>
                  <input type="number" value={f.kalinlik || ''} onChange={e => updateFix(i, 'kalinlik', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" placeholder="0" />
                </div>
                <div>
                  <label className="text-[10px] text-amber block font-semibold">Uzunluk</label>
                  <input type="number" value={f.uzunluk || ''} onChange={e => updateFix(i, 'uzunluk', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-bg-3 border border-amber/30 rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" placeholder="0" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block">Çap (mm)</label>
                  <input type="number" value={f.cap || ''} onChange={e => updateFix(i, 'cap', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-amber" placeholder="0" />
                </div>
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
