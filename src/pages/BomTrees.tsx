import { useState } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import type { BomTree } from '@/types'
import { Plus, Trash2, Pencil } from 'lucide-react'

export function BomTrees() {
  const { bomTrees, recipes, loadAll } = useStore()
  const [selected, setSelected] = useState<BomTree | null>(null)
  const [showNew, setShowNew] = useState(false)

  async function deleteBom(id: string) {
    if (!await showConfirm('Bu ürün ağacını silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_bom_trees').delete().eq('id', id)
    loadAll(); toast.success('Ürün ağacı silindi')
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
        <div><h1 className="text-xl font-semibold">Ürün Ağaçları</h1><p className="text-xs text-zinc-500">{bomTrees.length} ağaç</p></div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Ürün Ağacı</button>
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {bomTrees.length ? (
          <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Mamul Kodu</th><th className="text-left px-4 py-2.5">Ürün Adı</th><th className="text-right px-4 py-2.5">Bileşen</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody>
            {bomTrees.map(bt => (
              <tr key={bt.id} className="border-b border-border/30 hover:bg-bg-3/30">
                <td className="px-4 py-2 font-mono text-accent">{bt.mamulKod}</td>
                <td className="px-4 py-2 text-zinc-300">{bt.ad || bt.mamulAd}</td>
                <td className="px-4 py-2 text-right font-mono">{bt.rows?.length || 0}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => createRecipeFromBom(bt)} className="px-2 py-0.5 bg-green/10 text-green rounded text-[10px] hover:bg-green/20 mr-1">📋 Reçete Oluştur</button>
                  <button onClick={() => setSelected(bt)} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white mr-1"><Pencil size={10} className="inline" /> Düzenle</button>
                  <button onClick={() => deleteBom(bt.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>
                </td>
              </tr>
            ))}
          </tbody></table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz ürün ağacı yok</div>}
      </div>
      {selected && <BomEditor bom={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); loadAll(); toast.success('Ürün ağacı güncellendi') }} />}
      {showNew && <NewBomModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); loadAll(); toast.success('Ürün ağacı oluşturuldu') }} />}
    </div>
  )
}

function NewBomModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [mamulKod, setMamulKod] = useState('')
  const [ad, setAd] = useState('')
  async function save() {
    if (!ad.trim()) { toast.error('Ürün adı zorunlu'); return }
    await supabase.from('uys_bom_trees').insert({ id: uid(), mamul_kod: mamulKod.trim(), mamul_ad: ad.trim(), ad: ad.trim(), rows: [{ id: uid(), kirno: '1', malkod: mamulKod.trim(), malad: ad.trim(), tip: 'Mamul', miktar: 1, birim: 'Adet' }] })
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Yeni Ürün Ağacı</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Mamul Kodu</label><input value={mamulKod} onChange={e => setMamulKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
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
  const [dimFixList, setDimFixList] = useState<{ kod: string; ad: string; id: string; boy: number; en: number; kalinlik: number; uzunluk: number; cap: number; hmTipi: string }[] | null>(null)

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
    const mamulRow = rows.find(r => r.kirno === '1' || r.tip === 'Mamul')
    if (!mamulRow) { toast.error('Mamul satırı bulunamadı'); return }

    const mamulMat = materials.find(m => m.kod === mamulRow.malkod)
    if (!mamulMat) { toast.error('Mamul malzeme tanımı bulunamadı: ' + mamulRow.malkod); return }

    // Ölçüsü eksik malzemeleri topla
    const eksikler: typeof dimFixList = []
    // Mamul kontrolü
    if (needsDims(mamulMat)) {
      const guess = parseDimsFromName(mamulMat.ad)
      eksikler.push({ kod: mamulMat.kod, ad: mamulMat.ad, id: mamulMat.id, boy: guess.boy, en: guess.en, kalinlik: guess.kalinlik, uzunluk: guess.uzunluk, cap: guess.cap, hmTipi: mamulMat.hammaddeTipi })
    }
    // Hammadde kontrolü
    for (const r of rows) {
      if (r.tip !== 'Hammadde') continue
      const hmMat = materials.find(m => m.kod === r.malkod)
      if (!hmMat) continue
      if (needsDims(hmMat)) {
        const guess = parseDimsFromName(hmMat.ad)
        eksikler.push({ kod: hmMat.kod, ad: hmMat.ad, id: hmMat.id, boy: guess.boy, en: guess.en, kalinlik: guess.kalinlik, uzunluk: guess.uzunluk, cap: guess.cap, hmTipi: hmMat.hammaddeTipi })
      }
    }

    if (eksikler.length > 0) {
      setDimFixList(eksikler)
      return
    }

    // Ölçüler tamam — hesapla
    runKesimCalc()
  }

  function runKesimCalc() {
    const mamulRow = rows.find(r => r.kirno === '1' || r.tip === 'Mamul')
    if (!mamulRow) return
    const mamulMat = materials.find(m => m.kod === mamulRow.malkod)
    if (!mamulMat) return

    const uB = mamulMat.boy || 0
    const uE = mamulMat.en || 0
    const uUz = mamulMat.uzunluk || 0
    if (!uB && !uE && !uUz) { toast.error('Mamul boy/en/uzunluk bilgisi yok'); return }
    const urunParBoy = uUz > 0 ? uUz : Math.max(uB, uE)

    let guncellenen = 0
    const detaylar: string[] = []
    const yeniRows = rows.map(r => {
      if (r.tip !== 'Hammadde') return r
      const hmMat = materials.find(m => m.kod === r.malkod)
      if (!hmMat) return r

      let adetPer: number
      const hB = hmMat.boy || 0
      const hE = hmMat.en || 0
      const hUz = hmMat.uzunluk || 0

      if (hUz > 0) {
        if (!urunParBoy) return r
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
        if (!hmBoy || !urunParBoy) return r
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
      toast.error('Hesaplanacak hammadde bulunamadı (boy/en/uzunluk bilgisi gerekli)')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
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
                  <td className="px-2 py-1"><input value={r.malkod || ''} onChange={e => onMalkodChange(i, e.target.value)} className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 focus:outline-none focus:border-accent" placeholder="Kod yazın..." /></td>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={onClose}>
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
