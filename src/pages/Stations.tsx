import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'

import { Search } from 'lucide-react'

export function Stations() {
  const { stations, operations, loadAll } = useStore()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return stations
    const q = search.toLowerCase()
    return stations.filter(s => (s.kod + s.ad).toLowerCase().includes(q))
  }, [stations, search])

  function opNames(opIds: string[]): string {
    return opIds.map(id => operations.find(o => o.id === id)?.ad || '').filter(Boolean).join(', ') || '—'
  }

  async function del(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_stations').delete().eq('id', id); loadAll()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">İstasyonlar</h1><p className="text-xs text-zinc-500">{stations.length} istasyon</p></div>
      </div>
      <div className="relative max-w-xs mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden max-h-[70vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">İstasyon Adı</th><th className="text-left px-4 py-2.5">Operasyonlar</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-border/30 hover:bg-bg-3/30">
                <td className="px-4 py-1.5 font-mono text-accent text-[11px]">{s.kod}</td>
                <td className="px-4 py-1.5 text-zinc-300">{s.ad}</td>
                <td className="px-4 py-1.5 text-zinc-500 text-[11px] max-w-[300px] truncate">{opNames(s.opIds || [])}</td>
                <td className="px-4 py-1.5 text-right"><button onClick={() => del(s.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
