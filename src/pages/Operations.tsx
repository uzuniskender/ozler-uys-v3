import { showConfirm } from '@/lib/prompt'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { Search, Plus } from 'lucide-react'

export function Operations() {
  const { operations, loadAll } = useStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<{ id: string; kod: string; ad: string } | null>(null)

  const filtered = useMemo(() => {
    if (!search) return operations
    const q = search.toLowerCase()
    return operations.filter(o => (o.kod + o.ad).toLowerCase().includes(q))
  }, [operations, search])

  async function save(kod: string, ad: string, bolum: string, editId?: string) {
    if (editId) await supabase.from('uys_operations').update({ kod, ad, bolum }).eq('id', editId)
    else await supabase.from('uys_operations').insert({ id: uid(), kod, ad, bolum })
    loadAll(); setShowForm(false); setEditItem(null)
  }

  async function del(id: string) {
    if (!await showConfirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_operations').delete().eq('id', id); loadAll()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Operasyonlar</h1><p className="text-xs text-zinc-500">{operations.length} operasyon</p></div>
        <button onClick={async () => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni</button>
      </div>
      <div className="relative max-w-xs mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Operasyon Adı</th><th className="text-left px-4 py-2.5">Bölüm</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} className="border-b border-border/30 hover:bg-bg-3/30">
                <td className="px-4 py-2 font-mono text-accent">{o.kod}</td>
                <td className="px-4 py-2 text-zinc-300">{o.ad}</td>
                <td className="px-4 py-2 text-zinc-500 text-[11px]">{o.bolum || '—'}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={async () => { setEditItem(o); setShowForm(true) }} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white mr-1">Düzenle</button>
                  <button onClick={() => del(o.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && <SimpleFormModal title={editItem ? 'Düzenle' : 'Yeni Operasyon'} initial={editItem} onClose={() => { setShowForm(false); setEditItem(null) }} onSave={save} />}
    </div>
  )
}

function SimpleFormModal({ title, initial, onClose, onSave }: { title: string; initial: { id: string; kod: string; ad: string; bolum?: string } | null; onClose: () => void; onSave: (kod: string, ad: string, bolum: string, id?: string) => void }) {
  const [kod, setKod] = useState(initial?.kod || '')
  const [ad, setAd] = useState(initial?.ad || '')
  const [bolum, setBolum] = useState(initial?.bolum || '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Kod</label><input value={kod} onChange={e => setKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Ad</label><input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Bölüm</label><input value={bolum} onChange={e => setBolum(e.target.value)} placeholder="Kaynak, Kesme, Montaj..." className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white">İptal</button>
          <button onClick={() => onSave(kod, ad, bolum, initial?.id)} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
    </div>
  )
}
