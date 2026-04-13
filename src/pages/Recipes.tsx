import { useState } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import type { Recipe, RecipeRow } from '@/types'
import { Plus, Trash2, Pencil, Download } from 'lucide-react'

export function Recipes() {
  const { recipes, operations, loadAll } = useStore()
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [showNew, setShowNew] = useState(false)

  function exportRecipes() {
    import('xlsx').then(XLSX => {
      const rows = recipes.flatMap(r => (r.satirlar || []).map(s => ({
        'Reçete': r.ad, 'Mamul Kod': r.mamulKod, 'Kırılım': s.kirno, 'Malzeme Kod': s.malkod, 'Malzeme': s.malad, 'Tip': s.tip, 'Miktar': s.miktar, 'Birim': s.birim
      })))
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Reçeteler'); XLSX.writeFile(wb, 'receteler.xlsx')
    })
  }

  async function deleteRecipe(id: string) {
    if (!await showConfirm('Bu reçeteyi silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_recipes').delete().eq('id', id)
    loadAll(); toast.success('Reçete silindi')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Reçeteler</h1><p className="text-xs text-zinc-500">{recipes.length} reçete</p></div>
        <div className="flex gap-2">
          <button onClick={exportRecipes} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Reçete</button>
        </div>
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {recipes.length ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Reçete Adı</th><th className="text-left px-4 py-2.5">Mamul Kodu</th><th className="text-right px-4 py-2.5">Bileşen</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody>
              {recipes.map(r => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-2 font-mono text-accent">{r.rcKod || '—'}</td>
                  <td className="px-4 py-2 text-zinc-300">{r.ad}</td>
                  <td className="px-4 py-2 font-mono text-zinc-500">{r.mamulKod}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.satirlar?.length || 0}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setSelected(r)} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white mr-1"><Pencil size={10} className="inline" /> Düzenle</button>
                    <button onClick={() => deleteRecipe(r.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz reçete yok</div>}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
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
  const { materials } = useStore()

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

  // ✂ Kesim Hesapla — boy kesim (boru) + yüzey kesim (levha)
  function kesimHesapla() {
    const mamulRow = rows.find(r => r.kirno === '1' || r.tip === 'Mamul')
    if (!mamulRow) { toast.error('Mamul satırı bulunamadı'); return }
    const mamulMat = materials.find(m => m.kod === mamulRow.malkod || m.kod === recipe.mamulKod)
    if (!mamulMat) { toast.error('Mamul tanımı bulunamadı'); return }
    const uB = mamulMat.boy || 0; const uE = mamulMat.en || 0
    if (!uB && !uE) { toast.error('Mamul boy/en bilgisi yok'); return }

    let guncellenen = 0
    const detaylar: string[] = []
    const yeniRows = rows.map(r => {
      if (r.tip !== 'Hammadde') return r
      const hmMat = materials.find(m => m.kod === r.malkod)
      if (!hmMat || !hmMat.boy) return r
      const hB = hmMat.boy || 0; const hE = hmMat.en || 0
      let adetPer: number
      if (hE > 0 && uE > 0) {
        const hmBoy = Math.max(hB, hE); const hmEn = Math.min(hB, hE)
        const urunBoy = Math.min(uB, uE); const urunEn = Math.max(uB, uE)
        adetPer = Math.max(Math.floor(hmBoy / urunEn) * Math.floor(hmEn / urunBoy), Math.floor(hmBoy / urunBoy) * Math.floor(hmEn / urunEn))
        detaylar.push(`${hmEn}×${hmBoy} → ${urunBoy}×${urunEn}: ${adetPer}/plaka`)
      } else {
        const hmBoy = Math.max(hB, hE); const urunBoy = Math.max(uB, uE)
        if (!urunBoy) return r
        adetPer = Math.floor(hmBoy / urunBoy)
        detaylar.push(`${hmBoy}mm → ${urunBoy}mm: ${adetPer}/bar`)
      }
      if (adetPer <= 0) { toast.error(`${r.malkod}: sığmıyor`); return r }
      guncellenen++
      return { ...r, miktar: Math.round((1 / adetPer) * 10000) / 10000 }
    })
    if (guncellenen > 0) {
      setRows(yeniRows)
      toast.success(`${guncellenen} hammadde güncellendi — ${detaylar.join(' | ')}`)
    } else toast.error('Hesaplanacak hammadde bulunamadı (boy/en bilgisi gerekli)')
  }

  function addRow(parentKirno: string) {
    const children = rows.filter(r => r.kirno.startsWith(parentKirno + '.') && r.kirno.split('.').length === parentKirno.split('.').length + 1)
    const nextNum = children.length + 1
    const newKirno = parentKirno + '.' + nextNum
    setRows([...rows, { id: uid(), kirno: newKirno, malkod: '', malad: 'Yeni Bileşen', tip: 'YarıMamul', miktar: 1, birim: 'Adet', opId: '', istId: '', hazirlikSure: 0, islemSure: 0 }])
  }

  function deleteRow(idx: number) {
    const kirno = rows[idx].kirno
    // Alt kırılımları da sil
    setRows(prev => prev.filter((r, i) => i !== idx && !r.kirno.startsWith(kirno + '.')))
  }

  async function save() {
    await supabase.from('uys_recipes').update({ satirlar: rows }).eq('id', recipe.id)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-5xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <div><h2 className="text-lg font-semibold">{recipe.ad}</h2><p className="text-xs text-zinc-500">{recipe.mamulKod} · {rows.length} satır</p></div>
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
                <th className="text-right px-2 py-2 w-14">İşlem dk</th>
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
                      <input value={r.malkod || ''} onChange={e => onMalkodChange(i, e.target.value)}
                        className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 focus:outline-none focus:border-accent" placeholder="Kod yazın..." />
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
                        <input type="number" value={r.islemSure || 0} onChange={e => updateRow(i, 'islemSure', parseFloat(e.target.value) || 0)}
                          className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 text-right focus:outline-none" />
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
    </div>
  )
}
