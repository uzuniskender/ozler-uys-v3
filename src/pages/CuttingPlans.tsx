
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

export function CuttingPlans() {
  const { cuttingPlans, loadAll } = useStore()
  const bekleyen = cuttingPlans.filter(p => p.durum !== 'tamamlandi')

  async function deletePlan(id: string) {
    if (!confirm('Bu kesim planını silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_kesim_planlari').delete().eq('id', id)
    loadAll(); toast.success('Kesim planı silindi')
  }

  async function updateDurum(id: string, durum: string) {
    await supabase.from('uys_kesim_planlari').update({ durum }).eq('id', id)
    loadAll(); toast.success('Durum güncellendi')
  }

  return (
    <div>
      <div className="mb-4"><h1 className="text-xl font-semibold">Kesim Planları</h1><p className="text-xs text-zinc-500">{cuttingPlans.length} plan · {bekleyen.length} bekleyen</p></div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {cuttingPlans.length ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Ham Malzeme</th><th className="text-left px-4 py-2.5">Tip</th><th className="text-right px-4 py-2.5">Boy</th><th className="text-right px-4 py-2.5">Satır</th><th className="text-right px-4 py-2.5">Gerekli</th><th className="text-left px-4 py-2.5">Durum</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody>
              {cuttingPlans.map(p => (
                <tr key={p.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-2"><div className="font-mono text-accent text-[11px]">{p.hamMalkod}</div><div className="text-zinc-500 text-[10px]">{p.hamMalad}</div></td>
                  <td className="px-4 py-2 text-zinc-400">{p.kesimTip}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-500">{p.hamBoy}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.satirlar?.length || 0}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.gerekliAdet}</td>
                  <td className="px-4 py-2">
                    <select value={p.durum} onChange={e => updateDurum(p.id, e.target.value)}
                      className={`px-1.5 py-0.5 rounded text-[10px] bg-bg-3 border border-border ${p.durum === 'tamamlandi' ? 'text-green' : p.durum === 'kismi' ? 'text-amber' : 'text-accent'}`}>
                      <option value="bekliyor">Bekliyor</option><option value="kismi">Kısmi</option><option value="tamamlandi">Tamamlandı</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right"><button onClick={() => deletePlan(p.id)} className="p-1 text-zinc-500 hover:text-red"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz kesim planı yok</div>}
      </div>
    </div>
  )
}
