import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { Search, Download } from 'lucide-react'
import { today } from '@/lib/utils'

export function Warehouse() {
  const { stokHareketler } = useStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'stok'|'hareketler'>('stok')

  // Stok hesapla
  const stokMap = useMemo(() => {
    const map: Record<string, { malkod: string; malad: string; miktar: number }> = {}
    stokHareketler.forEach(h => {
      if (!map[h.malkod]) map[h.malkod] = { malkod: h.malkod, malad: h.malad, miktar: 0 }
      map[h.malkod].miktar += h.tip === 'giris' ? h.miktar : -h.miktar
    })
    return Object.values(map).filter(s => Math.abs(s.miktar) > 0.01).sort((a, b) => a.malad.localeCompare(b.malad, 'tr'))
  }, [stokHareketler])

  const filteredStok = useMemo(() => {
    if (!search) return stokMap
    const q = search.toLowerCase()
    return stokMap.filter(s => (s.malkod + s.malad).toLowerCase().includes(q))
  }, [stokMap, search])

  const filteredHareketler = useMemo(() => {
    const sorted = [...stokHareketler].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
    if (!search) return sorted.slice(0, 200)
    const q = search.toLowerCase()
    return sorted.filter(h => (h.malkod + h.malad + h.aciklama).toLowerCase().includes(q)).slice(0, 200)
  }, [stokHareketler, search])

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filteredStok.map(s => ({ Kod: s.malkod, Malzeme: s.malad, Stok: Math.round(s.miktar * 100) / 100 }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stok')
      XLSX.writeFile(wb, `stok_${today()}.xlsx`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Depolar</h1><p className="text-xs text-zinc-500">{stokHareketler.length} hareket · {stokMap.length} malzeme</p></div>
        <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
      </div>

      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab('stok')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'stok' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400'}`}>Anlık Stok</button>
        <button onClick={() => setTab('hareketler')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'hareketler' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400'}`}>Hareketler</button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
      </div>

      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
        {tab === 'stok' ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Malzeme</th><th className="text-right px-4 py-2.5">Stok</th></tr></thead>
            <tbody>
              {filteredStok.map(s => (
                <tr key={s.malkod} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-1.5 font-mono text-accent text-[11px]">{s.malkod}</td>
                  <td className="px-4 py-1.5 text-zinc-300">{s.malad}</td>
                  <td className={`px-4 py-1.5 text-right font-mono font-semibold ${s.miktar < 0 ? 'text-red' : 'text-green'}`}>{Math.round(s.miktar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Tarih</th><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Malzeme</th><th className="text-left px-4 py-2.5">Tip</th><th className="text-right px-4 py-2.5">Miktar</th><th className="text-left px-4 py-2.5">Açıklama</th></tr></thead>
            <tbody>
              {filteredHareketler.map(h => (
                <tr key={h.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-1.5 font-mono text-zinc-500">{h.tarih}</td>
                  <td className="px-4 py-1.5 font-mono text-accent text-[11px]">{h.malkod}</td>
                  <td className="px-4 py-1.5 text-zinc-300">{h.malad}</td>
                  <td className="px-4 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${h.tip === 'giris' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>{h.tip === 'giris' ? '↑ Giriş' : '↓ Çıkış'}</span></td>
                  <td className="px-4 py-1.5 text-right font-mono">{h.miktar}</td>
                  <td className="px-4 py-1.5 text-zinc-500 max-w-[200px] truncate">{h.aciklama || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
