import { useStore } from '@/store'

export function Shipment() {
  const { sevkler } = useStore()
  return (
    <div>
      <div className="mb-4"><h1 className="text-xl font-semibold">Sevkiyat</h1><p className="text-xs text-zinc-500">{sevkler.length} sevkiyat</p></div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {sevkler.length ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Sipariş No</th><th className="text-left px-4 py-2.5">Müşteri</th><th className="text-left px-4 py-2.5">Tarih</th><th className="text-right px-4 py-2.5">Kalem</th></tr></thead>
            <tbody>
              {sevkler.map(s => (
                <tr key={s.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-2 font-mono text-accent">{s.siparisNo}</td>
                  <td className="px-4 py-2 text-zinc-300">{s.musteri || '—'}</td>
                  <td className="px-4 py-2 font-mono text-zinc-500">{s.tarih}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.kalemler?.length || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz sevkiyat yok</div>}
      </div>
    </div>
  )
}
