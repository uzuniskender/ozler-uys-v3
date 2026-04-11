import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { today } from '@/lib/utils'

export function Reports() {
  const { workOrders, logs, operators, fireLogs, stokHareketler } = useStore()
  const [tab, setTab] = useState('ozet')
  const todayStr = today()

  const tabs = [
    { id: 'ozet', label: 'Özet' },
    { id: 'gunluk', label: 'Günlük Üretim' },
    { id: 'fire', label: 'Fire / Iskarta' },
    { id: 'operasyon', label: 'Operasyon Bazlı' },
  ]

  // Özet verileri
  const toplamUretim = logs.reduce((a, l) => a + l.qty, 0)
  const toplamFire = fireLogs.reduce((a, f) => a + f.qty, 0)
  const bugunUretim = logs.filter(l => l.tarih === todayStr).reduce((a, l) => a + l.qty, 0)
  const bugunFire = fireLogs.filter(f => f.tarih === todayStr).reduce((a, f) => a + f.qty, 0)

  // Günlük üretim
  const gunlukData = useMemo(() => {
    const map: Record<string, { tarih: string; uretim: number; fire: number }> = {}
    logs.forEach(l => { if (!map[l.tarih]) map[l.tarih] = { tarih: l.tarih, uretim: 0, fire: 0 }; map[l.tarih].uretim += l.qty })
    fireLogs.forEach(f => { if (!map[f.tarih]) map[f.tarih] = { tarih: f.tarih, uretim: 0, fire: 0 }; map[f.tarih].fire += f.qty })
    return Object.values(map).sort((a, b) => b.tarih.localeCompare(a.tarih))
  }, [logs, fireLogs])

  // Operasyon bazlı
  const opData = useMemo(() => {
    const map: Record<string, { op: string; hedef: number; uretim: number; woCount: number }> = {}
    workOrders.forEach(w => {
      const k = w.opAd || 'Tanımsız'
      if (!map[k]) map[k] = { op: k, hedef: 0, uretim: 0, woCount: 0 }
      map[k].hedef += w.hedef; map[k].woCount++
      map[k].uretim += logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    })
    return Object.values(map).sort((a, b) => b.hedef - a.hedef)
  }, [workOrders, logs])

  return (
    <div>
      <div className="mb-4"><h1 className="text-xl font-semibold">Raporlar</h1></div>
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${tab === t.id ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'ozet' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono text-accent">{toplamUretim}</div><div className="text-[11px] text-zinc-500">Toplam Üretim</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono text-red">{toplamFire}</div><div className="text-[11px] text-zinc-500">Toplam Fire</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono text-green">{bugunUretim}</div><div className="text-[11px] text-zinc-500">Bugün Üretim</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono text-amber">{bugunFire}</div><div className="text-[11px] text-zinc-500">Bugün Fire</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono">{workOrders.length}</div><div className="text-[11px] text-zinc-500">Toplam İE</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono">{logs.length}</div><div className="text-[11px] text-zinc-500">Üretim Kaydı</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono">{operators.length}</div><div className="text-[11px] text-zinc-500">Operatör</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono">{stokHareketler.length}</div><div className="text-[11px] text-zinc-500">Stok Hareketi</div></div>
        </div>
      )}

      {tab === 'gunluk' && (
        <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Tarih</th><th className="text-right px-4 py-2.5">Üretim</th><th className="text-right px-4 py-2.5">Fire</th><th className="text-right px-4 py-2.5">Fire %</th></tr></thead>
            <tbody>
              {gunlukData.map(d => (
                <tr key={d.tarih} className="border-b border-border/30"><td className="px-4 py-1.5 font-mono text-zinc-400">{d.tarih}</td><td className="px-4 py-1.5 text-right font-mono text-green">{d.uretim}</td><td className="px-4 py-1.5 text-right font-mono text-red">{d.fire}</td><td className="px-4 py-1.5 text-right font-mono text-zinc-500">{d.uretim > 0 ? Math.round(d.fire / d.uretim * 100) : 0}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'fire' && (
        <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
          {fireLogs.length ? (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Tarih</th><th className="text-left px-4 py-2.5">İE No</th><th className="text-left px-4 py-2.5">Malzeme</th><th className="text-right px-4 py-2.5">Adet</th></tr></thead>
              <tbody>
                {[...fireLogs].sort((a, b) => b.tarih.localeCompare(a.tarih)).map(f => (
                  <tr key={f.id} className="border-b border-border/30"><td className="px-4 py-1.5 font-mono text-zinc-500">{f.tarih}</td><td className="px-4 py-1.5 font-mono text-accent">{f.ieNo}</td><td className="px-4 py-1.5 text-zinc-300">{f.malad}</td><td className="px-4 py-1.5 text-right font-mono text-red">{f.qty}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <div className="p-8 text-center text-zinc-600 text-sm">Fire kaydı yok</div>}
        </div>
      )}

      {tab === 'operasyon' && (
        <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Operasyon</th><th className="text-right px-4 py-2.5">İE</th><th className="text-right px-4 py-2.5">Hedef</th><th className="text-right px-4 py-2.5">Üretim</th><th className="text-right px-4 py-2.5">%</th></tr></thead>
            <tbody>
              {opData.map(d => {
                const pct = d.hedef > 0 ? Math.round(d.uretim / d.hedef * 100) : 0
                return (
                  <tr key={d.op} className="border-b border-border/30"><td className="px-4 py-1.5 text-zinc-300">{d.op}</td><td className="px-4 py-1.5 text-right font-mono">{d.woCount}</td><td className="px-4 py-1.5 text-right font-mono">{d.hedef}</td><td className="px-4 py-1.5 text-right font-mono text-green">{d.uretim}</td><td className="px-4 py-1.5 text-right font-mono text-accent">{pct}%</td></tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
