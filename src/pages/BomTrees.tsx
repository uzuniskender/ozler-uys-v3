import { useState } from 'react'
import { useStore } from '@/store'
import type { BomTree } from '@/types'

export function BomTrees() {
  const { bomTrees } = useStore()
  const [selected, setSelected] = useState<BomTree | null>(null)

  return (
    <div>
      <div className="mb-4"><h1 className="text-xl font-semibold">Ürün Ağaçları</h1><p className="text-xs text-zinc-500">{bomTrees.length} ağaç</p></div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {bomTrees.length ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Mamul Kodu</th><th className="text-left px-4 py-2.5">Ürün Adı</th><th className="text-right px-4 py-2.5">Bileşen</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody>
              {bomTrees.map(bt => (
                <tr key={bt.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-2 font-mono text-accent">{bt.mamulKod}</td>
                  <td className="px-4 py-2 text-zinc-300">{bt.ad || bt.mamulAd}</td>
                  <td className="px-4 py-2 text-right font-mono">{bt.rows?.length || 0}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => setSelected(bt)} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">Görüntüle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz ürün ağacı yok</div>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelected(null)}>
          <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <div><h2 className="text-lg font-semibold">{selected.ad || selected.mamulAd}</h2><p className="text-xs text-zinc-500">{selected.mamulKod} · {selected.rows?.length || 0} bileşen</p></div>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white text-lg">✕</button>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Kırılım</th><th className="text-left px-3 py-2">Malzeme</th><th className="text-left px-3 py-2">Tip</th><th className="text-right px-3 py-2">Miktar</th><th className="text-left px-3 py-2">Birim</th></tr></thead>
              <tbody>
                {(selected.rows || []).map((r, i) => {
                  const depth = (r.kirno || '').split('.').length - 1
                  return (
                    <tr key={i} className="border-b border-border/30">
                      <td className="px-3 py-1.5 font-mono text-zinc-500">{r.kirno}</td>
                      <td className="px-3 py-1.5" style={{ paddingLeft: `${12 + depth * 16}px` }}>
                        <span className={r.tip === 'Hammadde' ? 'text-amber' : r.tip === 'Mamul' ? 'text-green' : 'text-zinc-300'}>{r.malad}</span>
                      </td>
                      <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 bg-bg-3 rounded text-[10px]">{r.tip}</span></td>
                      <td className="px-3 py-1.5 text-right font-mono">{r.miktar}</td>
                      <td className="px-3 py-1.5 text-zinc-500">{r.birim}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
