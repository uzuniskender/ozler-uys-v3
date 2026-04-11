import { useStore } from '@/store'

export function ProductionEntry() {
  const { workOrders, logs } = useStore()
  const acikWOs = workOrders.filter(w => {
    const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    return w.hedef > 0 && prod < w.hedef
  })

  return (
    <div>
      <div className="mb-4"><h1 className="text-xl font-semibold">Üretim Girişi</h1><p className="text-xs text-zinc-500">{acikWOs.length} açık iş emri</p></div>
      <div className="bg-amber/5 border border-amber/20 rounded-lg p-4 mb-4 text-xs text-amber">
        ⚠ Üretim girişi Faz 2'de tam fonksiyonel olacaktır. Şu an eski sistemden (v2) giriş yapabilirsiniz.
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">İE No</th><th className="text-left px-4 py-2.5">Malzeme</th><th className="text-left px-4 py-2.5">Operasyon</th><th className="text-right px-4 py-2.5">Hedef</th><th className="text-right px-4 py-2.5">Üretilen</th><th className="text-right px-4 py-2.5">Kalan</th></tr></thead>
          <tbody>
            {acikWOs.slice(0, 30).map(w => {
              const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
              return (
                <tr key={w.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-2 font-mono text-accent">{w.ieNo}</td>
                  <td className="px-4 py-2 text-zinc-300">{w.malad}</td>
                  <td className="px-4 py-2 text-zinc-500">{w.opAd}</td>
                  <td className="px-4 py-2 text-right font-mono">{w.hedef}</td>
                  <td className="px-4 py-2 text-right font-mono text-green">{prod}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber">{Math.max(0, w.hedef - prod)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
