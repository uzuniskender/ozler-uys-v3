import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Search, Plus, Pencil } from 'lucide-react'

export function Stations() {
  const { stations, operations, loadAll } = useStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<typeof stations[0] | null>(null)

  const filtered = useMemo(() => {
    if (!search) return stations
    const q = search.toLowerCase()
    return stations.filter(s => (s.kod + s.ad).toLowerCase().includes(q))
  }, [stations, search])

  async function del(id: string) {
    if (!await showConfirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_stations').delete().eq('id', id); loadAll(); toast.success('İstasyon silindi')
  }

  async function save(data: { kod: string; ad: string; opIds: string[] }, editId?: string) {
    if (editId) await supabase.from('uys_stations').update({ kod: data.kod, ad: data.ad, op_ids: data.opIds }).eq('id', editId)
    else await supabase.from('uys_stations').insert({ id: uid(), kod: data.kod, ad: data.ad, op_ids: data.opIds })
    loadAll(); setShowForm(false); setEditItem(null); toast.success(editId ? 'Güncellendi' : 'Eklendi')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">İstasyonlar</h1><p className="text-xs text-zinc-500">{stations.length} istasyon</p></div>
        <div className="flex gap-2">
          <button onClick={() => { import('xlsx').then(XLSX => {
            const rows = stations.map(s => ({ Kod: s.kod, Ad: s.ad }))
            const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'İstasyonlar'); XLSX.writeFile(wb, 'istasyonlar.xlsx')
          })}} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
          <button onClick={async () => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni</button>
        </div>
      </div>
      <div className="relative max-w-xs mb-4"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden max-h-[70vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">İstasyon Adı</th><th className="text-left px-4 py-2.5">Operasyonlar</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-border/30 hover:bg-bg-3/30">
                <td className="px-4 py-1.5 font-mono text-accent text-[11px]">{s.kod}</td>
                <td className="px-4 py-1.5 text-zinc-300">{s.ad}</td>
                <td className="px-4 py-1.5 text-zinc-500 text-[11px]">
                  {(s.opIds || []).map(id => operations.find(o => o.id === id)?.ad).filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-1.5 text-right">
                  <button onClick={async () => { setEditItem(s); setShowForm(true) }} className="p-1 text-zinc-500 hover:text-accent"><Pencil size={12} /></button>
                  <button onClick={() => del(s.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red ml-1">Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && <StationFormModal initial={editItem} operations={operations} onClose={() => { setShowForm(false); setEditItem(null) }} onSave={save} />}
    </div>
  )
}

function StationFormModal({ initial, operations, onClose, onSave }: {
  initial: { id: string; kod: string; ad: string; opIds: string[] } | null
  operations: { id: string; kod: string; ad: string }[]; onClose: () => void
  onSave: (data: { kod: string; ad: string; opIds: string[] }, editId?: string) => void
}) {
  const [kod, setKod] = useState(initial?.kod || '')
  const [ad, setAd] = useState(initial?.ad || '')
  const [opIds, setOpIds] = useState<string[]>(initial?.opIds || [])

  function toggleOp(id: string) { setOpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'İstasyon Düzenle' : 'Yeni İstasyon'}</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Kod</label><input value={kod} onChange={e => setKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Ad</label><input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Operasyonlar ({opIds.length} seçili)</label>
            <div className="max-h-40 overflow-y-auto bg-bg-2 border border-border rounded-lg p-2 space-y-1">
              {operations.map(o => (
                <label key={o.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-bg-3/50 px-2 py-1 rounded">
                  <input type="checkbox" checked={opIds.includes(o.id)} onChange={() => toggleOp(o.id)} className="accent-accent" />
                  <span className="font-mono text-[11px] text-accent">{o.kod}</span> {o.ad}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={() => onSave({ kod, ad, opIds }, initial?.id)} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
    </div>
  )
}
