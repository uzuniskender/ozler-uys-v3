import { useStore } from '@/store'

export function CuttingPlans() {
  const { cuttingPlans } = useStore()
  const bekleyen = cuttingPlans.filter(p => p.durum !== 'tamamlandi')
  

  return (
    <div>
      <div className="mb-4"><h1 className="text-xl font-semibold">Kesim Planları</h1><p className="text-xs text-zinc-500">{cuttingPlans.length} plan · {bekleyen.length} bekleyen</p></div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {cuttingPlans.length ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Ham Malzeme</th><th className="text-left px-4 py-2.5">Tip</th><th className="text-right px-4 py-2.5">Boy</th><th className="text-right px-4 py-2.5">Satır</th><th className="text-right px-4 py-2.5">Gerekli</th><th className="text-left px-4 py-2.5">Durum</th></tr></thead>
            <tbody>
              {cuttingPlans.map(p => (
                <tr key={p.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-2"><div className="font-mono text-accent text-[11px]">{p.hamMalkod}</div><div className="text-zinc-500 text-[10px]">{p.hamMalad}</div></td>
                  <td className="px-4 py-2 text-zinc-400">{p.kesimTip}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-500">{p.hamBoy}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.satirlar?.length || 0}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.gerekliAdet}</td>
                  <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${p.durum === 'tamamlandi' ? 'bg-green/10 text-green' : p.durum === 'kismi' ? 'bg-amber/10 text-amber' : 'bg-accent/10 text-accent'}`}>{p.durum === 'tamamlandi' ? 'Tamamlandı' : p.durum === 'kismi' ? 'Kısmi' : 'Bekliyor'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz kesim planı yok</div>}
      </div>
    </div>
  )
}
