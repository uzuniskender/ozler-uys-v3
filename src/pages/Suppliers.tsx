import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'

export function Suppliers() {
  const { tedarikciler, loadAll } = useStore()

  async function del(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_tedarikciler').delete().eq('id', id); loadAll()
  }

  return (
    <div>
      <div className="mb-4"><h1 className="text-xl font-semibold">Tedarikçiler</h1><p className="text-xs text-zinc-500">{tedarikciler.length} tedarikçi</p></div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {tedarikciler.length ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Firma Adı</th><th className="text-left px-4 py-2.5">Telefon</th><th className="text-left px-4 py-2.5">Email</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody>
              {tedarikciler.map(t => (
                <tr key={t.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-2 font-mono text-accent">{t.kod}</td>
                  <td className="px-4 py-2 text-zinc-300">{t.ad}</td>
                  <td className="px-4 py-2 text-zinc-500">{t.tel || '—'}</td>
                  <td className="px-4 py-2 text-zinc-500">{t.email || '—'}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => del(t.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz tedarikçi yok</div>}
      </div>
    </div>
  )
}
