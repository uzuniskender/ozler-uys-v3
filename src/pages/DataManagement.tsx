import { useStore } from '@/store'

import { Download, RefreshCw } from 'lucide-react'
import { today } from '@/lib/utils'

export function DataManagement() {
  const store = useStore()
  const tables = [
    { label: 'Siparişler', key: 'orders' }, { label: 'İş Emirleri', key: 'workOrders' },
    { label: 'Üretim Logları', key: 'logs' }, { label: 'Malzemeler', key: 'materials' },
    { label: 'Operasyonlar', key: 'operations' }, { label: 'İstasyonlar', key: 'stations' },
    { label: 'Operatörler', key: 'operators' }, { label: 'Reçeteler', key: 'recipes' },
    { label: 'Ürün Ağaçları', key: 'bomTrees' }, { label: 'Stok Hareketleri', key: 'stokHareketler' },
    { label: 'Kesim Planları', key: 'cuttingPlans' }, { label: 'Tedarikler', key: 'tedarikler' },
    { label: 'Tedarikçiler', key: 'tedarikciler' }, { label: 'Duruş Kodları', key: 'durusKodlari' },
    { label: 'Müşteriler', key: 'customers' }, { label: 'Sevkiyatlar', key: 'sevkler' },
    { label: 'Operatör Mesajları', key: 'operatorNotes' }, { label: 'Aktif Çalışmalar', key: 'activeWork' },
    { label: 'Fire Logları', key: 'fireLogs' },
  ]

  function exportJSON() {
    const data: Record<string, unknown> = {}
    tables.forEach(t => { data[t.key] = (store as unknown as Record<string, unknown>)[t.key] })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `uys_backup_${today()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Veri Yönetimi</h1></div>
        <div className="flex gap-2">
          <button onClick={() => store.loadAll()} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><RefreshCw size={13} /> Yenile</button>
          <button onClick={exportJSON} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Download size={13} /> JSON Yedek</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tables.map(t => {
          const arr = (store as unknown as Record<string, unknown[]>)[t.key] || []
          return (
            <div key={t.key} className="bg-bg-2 border border-border rounded-lg p-3">
              <div className="text-xs text-zinc-400">{t.label}</div>
              <div className="text-lg font-mono font-light text-accent">{arr.length}</div>
              <div className="text-[10px] text-zinc-600 font-mono">{t.key}</div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 bg-bg-2 border border-border rounded-lg p-4">
        <div className="text-xs text-zinc-400 mb-2">Bağlantı Durumu</div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${store.synced ? 'bg-green' : 'bg-red'}`} />
          <span className="text-sm">{store.synced ? 'Supabase bağlı — normalize tablolardan okunuyor' : 'Çevrimdışı'}</span>
        </div>
      </div>
    </div>
  )
}
