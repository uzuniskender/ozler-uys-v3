import { useAuth } from '@/hooks/useAuth'
import { showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { Plus } from 'lucide-react'

export function DowntimeCodes() {
  const { durusKodlari, loadAll } = useStore()
  const { can } = useAuth()
  const [showForm, setShowForm] = useState(false)

  const grouped = useMemo(() => {
    const map: Record<string, typeof durusKodlari> = {}
    durusKodlari.forEach(d => { const k = d.kategori || 'Genel'; if (!map[k]) map[k] = []; map[k].push(d) })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [durusKodlari])

  async function del(id: string) {
    if (!await showConfirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_durus_kodlari').delete().eq('id', id); loadAll()
  }

  async function add(kod: string, ad: string, kategori: string) {
    await supabase.from('uys_durus_kodlari').insert({ id: uid(), kod, ad, kategori }); loadAll(); setShowForm(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Duruş Kodları</h1><p className="text-xs text-zinc-500">{durusKodlari.length} kod</p></div>
        <div className="flex gap-2">
          <button onClick={() => {
            import('xlsx').then(XLSX => {
              const rows = durusKodlari.map(d => ({ Kod: d.kod, Ad: d.ad, Kategori: d.kategori || '' }))
              const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
              XLSX.utils.book_append_sheet(wb, ws, 'Duruş Kodları'); XLSX.writeFile(wb, 'durus_kodlari.xlsx')
            })
          }} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
          <button onClick={async () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls'
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
              const XLSX = await import('xlsx')
              const data = await file.arrayBuffer(); const wb = XLSX.read(data)
              const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
              let count = 0
              for (const row of rows) {
                const kod = String(row['Kod'] || row['kod'] || '').trim()
                const ad = String(row['Ad'] || row['ad'] || '').trim()
                if (!kod || !ad) continue
                await supabase.from('uys_durus_kodlari').insert({ id: uid(), kod, ad, kategori: String(row['Kategori'] || '') })
                count++
              }
              loadAll(); toast.success(count + ' duruş kodu yüklendi')
            }
            input.click()
          }} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📤 Yükle</button>
          {can('durus_add') && <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni</button>}
        </div>
      </div>
      {grouped.map(([kat, codes]) => (
        <div key={kat} className="mb-4">
          <div className="px-3 py-1.5 bg-bg-3/50 border border-border rounded-t-lg text-[11px] font-semibold text-zinc-400">{kat} ({codes.length})</div>
          <div className="bg-bg-2 border border-border border-t-0 rounded-b-lg divide-y divide-border/30">
            {codes.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-2 hover:bg-bg-3/30">
                <span className="font-mono text-[11px] text-accent w-16">{d.kod}</span>
                <span className="flex-1 text-xs">{d.ad}</span>
                {can('durus_delete') && <button onClick={() => del(d.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Yeni Duruş Kodu</h2>
            <div className="space-y-3">
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Kod</label><input id="dk-kod" className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Ad</label><input id="dk-ad" className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Kategori</label><input id="dk-kat" className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
              <button onClick={async () => { const k=(document.getElementById('dk-kod') as HTMLInputElement).value; const a=(document.getElementById('dk-ad') as HTMLInputElement).value; const c=(document.getElementById('dk-kat') as HTMLInputElement).value; if(k&&a)add(k,a,c) }} className="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
