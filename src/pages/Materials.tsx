import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { Search, Download } from 'lucide-react'
import { today } from '@/lib/utils'

export function Materials() {
  const { materials } = useStore()
  const [search, setSearch] = useState('')
  const [tipFilter, setTipFilter] = useState('')

  const tipler = useMemo(() => [...new Set(materials.map(m => m.tip).filter(Boolean))].sort(), [materials])

  const filtered = useMemo(() => {
    return materials.filter(m => {
      if (tipFilter && m.tip !== tipFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (m.kod + m.ad).toLowerCase().includes(q)
      }
      return true
    })
  }, [materials, search, tipFilter])

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(m => ({ Kod: m.kod, Ad: m.ad, Tip: m.tip, Birim: m.birim, Boy: m.boy, En: m.en }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Malzemeler')
      XLSX.writeFile(wb, `malzemeler_${today()}.xlsx`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Malzeme Listesi</h1><p className="text-xs text-zinc-500">{materials.length} malzeme</p></div>
        <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kod veya ad ara..."
            className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>
        <select value={tipFilter} onChange={e => setTipFilter(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="">Tüm Tipler</option>
          {tipler.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2">
              <tr className="border-b border-border text-zinc-500">
                <th className="text-left px-4 py-2.5">Kod</th>
                <th className="text-left px-4 py-2.5">Malzeme Adı</th>
                <th className="text-left px-4 py-2.5">Tip</th>
                <th className="text-left px-4 py-2.5">Birim</th>
                <th className="text-right px-4 py-2.5">Boy</th>
                <th className="text-right px-4 py-2.5">En</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(m => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-bg-3/50">
                  <td className="px-4 py-1.5 font-mono text-accent text-[11px]">{m.kod}</td>
                  <td className="px-4 py-1.5 text-zinc-300">{m.ad}</td>
                  <td className="px-4 py-1.5"><span className="px-1.5 py-0.5 bg-bg-3 rounded text-[10px] text-zinc-400">{m.tip || '—'}</span></td>
                  <td className="px-4 py-1.5 text-zinc-500">{m.birim}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-zinc-500">{m.boy || '—'}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-zinc-500">{m.en || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && <div className="p-2 text-center text-zinc-600 text-xs">+{filtered.length - 200} daha (arama ile daraltın)</div>}
        </div>
      </div>
    </div>
  )
}
