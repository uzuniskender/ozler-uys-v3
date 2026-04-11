import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { today, pctColor } from '@/lib/utils'
import { Search, Download } from 'lucide-react'

export function WorkOrders() {
  const { workOrders, logs, orders } = useStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [groupBy, setGroupBy] = useState('siparis')

  function wProd(woId: string): number {
    return logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0)
  }
  function wPct(w: { id: string; hedef: number }): number {
    return w.hedef > 0 ? Math.min(100, Math.round(wProd(w.id) / w.hedef * 100)) : 0
  }

  const filtered = useMemo(() => {
    return workOrders.filter(w => {
      const pct = wPct(w)
      if (statusFilter === 'active' && pct >= 100) return false
      if (statusFilter === 'done' && pct < 100) return false
      if (search) {
        const q = search.toLowerCase()
        const ord = orders.find(o => o.id === w.orderId)
        if (!(w.ieNo + w.malad + w.malkod + w.opAd + (ord?.siparisNo || '')).toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [workOrders, logs, search, statusFilter, orders])

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {}
    filtered.forEach(w => {
      const key = groupBy === 'siparis'
        ? (orders.find(o => o.id === w.orderId)?.siparisNo || 'Bağımsız')
        : (w.opAd || 'Tanımsız')
      if (!map[key]) map[key] = []
      map[key].push(w)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [filtered, groupBy, orders])

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(w => {
        const ord = orders.find(o => o.id === w.orderId)
        return { 'İE No': w.ieNo, 'Sipariş': ord?.siparisNo || '', 'Malzeme': w.malad, 'Operasyon': w.opAd, 'Hedef': w.hedef, 'Üretilen': wProd(w.id), '%': wPct(w) }
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'İş Emirleri')
      XLSX.writeFile(wb, `is_emirleri_${today()}.xlsx`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">İş Emirleri</h1><p className="text-xs text-zinc-500">{workOrders.length} toplam</p></div>
        <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="İE no, malzeme veya operasyon ara..."
            className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="all">Tümü</option>
          <option value="active">Açık</option>
          <option value="done">Tamamlandı</option>
        </select>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="siparis">Siparişe Göre</option>
          <option value="operasyon">Operasyona Göre</option>
        </select>
      </div>

      {grouped.map(([group, wos]) => (
        <div key={group} className="mb-4">
          <div className="px-3 py-1.5 bg-bg-3/50 border border-border rounded-t-lg text-[11px] font-semibold text-accent font-mono flex items-center justify-between">
            <span>{group}</span>
            <span className="text-zinc-500 font-normal">{wos.length} iş emri</span>
          </div>
          <div className="bg-bg-2 border border-border border-t-0 rounded-b-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-zinc-500">
                  <th className="text-left px-3 py-2">İE No</th>
                  <th className="text-left px-3 py-2">Malzeme</th>
                  <th className="text-left px-3 py-2">Operasyon</th>
                  <th className="text-left px-3 py-2">İstasyon</th>
                  <th className="text-right px-3 py-2">Hedef</th>
                  <th className="text-right px-3 py-2">Üretilen</th>
                  <th className="text-right px-3 py-2">Kalan</th>
                  <th className="text-right px-3 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {wos.map(w => {
                  const prod = wProd(w.id)
                  const pct = wPct(w)
                  const kalan = Math.max(0, w.hedef - prod)
                  return (
                    <tr key={w.id} className="border-b border-border/30 hover:bg-bg-3/30">
                      <td className="px-3 py-1.5 font-mono text-accent">{w.ieNo}</td>
                      <td className="px-3 py-1.5 text-zinc-300 max-w-[180px] truncate">{w.malad}</td>
                      <td className="px-3 py-1.5 text-zinc-500">{w.opAd || '—'}</td>
                      <td className="px-3 py-1.5 text-zinc-600">{w.istAd || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{w.hedef}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-green">{prod}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-amber">{kalan || '—'}</td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-10 h-1 bg-bg-3 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`font-mono text-[10px] ${pctColor(pct)}`}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {!grouped.length && <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-zinc-600 text-sm">İş emri bulunamadı</div>}
    </div>
  )
}
