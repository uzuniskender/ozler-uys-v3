import { useState } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { toast } from 'sonner'
import type { BomTree } from '@/types'
import { Plus, Trash2, Pencil } from 'lucide-react'

export function BomTrees() {
  const { bomTrees, loadAll } = useStore()
  const [selected, setSelected] = useState<BomTree | null>(null)
  const [showNew, setShowNew] = useState(false)

  async function deleteBom(id: string) {
    if (!confirm('Bu ürün ağacını silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_bom_trees').delete().eq('id', id)
    loadAll(); toast.success('Ürün ağacı silindi')
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

  function updateRow(i: number, field: string, value: string | number) { setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r)) }
  function addRow(parentKirno: string) {
    const children = rows.filter(r => r.kirno.startsWith(parentKirno + '.') && r.kirno.split('.').length === parentKirno.split('.').length + 1)
    const newKirno = parentKirno + '.' + (children.length + 1)
    setRows([...rows, { id: uid(), kirno: newKirno, malkod: '', malad: 'Yeni Bileşen', tip: 'Hammadde', miktar: 1, birim: 'Adet' }])
  }
  function deleteRow(i: number) { const k = rows[i].kirno; setRows(prev => prev.filter((r, idx) => idx !== i && !r.kirno.startsWith(k + '.'))) }

  async function save() {
    await supabase.from('uys_bom_trees').update({ rows }).eq('id', bom.id)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <div><h2 className="text-lg font-semibold">{bom.ad || bom.mamulAd}</h2><p className="text-xs text-zinc-500">{bom.mamulKod} · {rows.length} satır</p></div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-2 py-2 w-20">Kırılım</th><th className="text-left px-2 py-2">Malzeme Kodu</th><th className="text-left px-2 py-2">Malzeme Adı</th><th className="text-left px-2 py-2 w-24">Tip</th><th className="text-right px-2 py-2 w-16">Miktar</th><th className="text-left px-2 py-2 w-16">Birim</th><th className="px-2 py-2 w-16"></th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const depth = (r.kirno || '').split('.').length - 1
              return (
                <tr key={i} className="border-b border-border/20 hover:bg-bg-3/20">
                  <td className="px-2 py-1 font-mono text-zinc-500">{r.kirno}</td>
                  <td className="px-2 py-1"><input value={r.malkod || ''} onChange={e => updateRow(i, 'malkod', e.target.value)} className="w-full px-1.5 py-1 bg-bg-3/50 border border-border/50 rounded text-[11px] text-zinc-200 focus:outline-none focus:border-accent" /></td>
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
        <div className="flex justify-between mt-4">
          <button onClick={() => addRow('1')} className="flex items-center gap-1 px-3 py-1.5 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white"><Plus size={12} /> Kök Bileşen</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
            <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
          </div>
        </div>
      </div>
    </div>
  )
}
