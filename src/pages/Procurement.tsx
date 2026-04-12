import { SearchSelect } from '@/components/ui/SearchSelect'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { Search, Plus, Pencil, Trash2, Check, Download } from 'lucide-react'

export function Procurement() {
  const { tedarikler, tedarikciler, orders, loadAll } = useStore()
  const [search, setSearch] = useState('')
  const [durumFilter, setDurumFilter] = useState('bekliyor')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<typeof tedarikler[0] | null>(null)

  const filtered = useMemo(() => {
    return tedarikler.filter(t => {
      if (durumFilter === 'bekliyor' && t.geldi) return false
      if (durumFilter === 'geldi' && !t.geldi) return false
      if (search) {
        const q = search.toLowerCase()
        return (t.malkod + t.malad + t.siparisNo + t.tedarikcAd).toLowerCase().includes(q)
      }
      return true
    }).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
  }, [tedarikler, search, durumFilter])

  async function markGeldi(id: string) {
    await supabase.from('uys_tedarikler').update({ geldi: true, durum: 'geldi' }).eq('id', id)
    loadAll(); toast.success('Tedarik geldi olarak işaretlendi')
  }

  async function del(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_tedarikler').delete().eq('id', id)
    loadAll(); toast.success('Tedarik silindi')
  }

  async function save(data: Record<string, unknown>, editId?: string) {
    if (editId) await supabase.from('uys_tedarikler').update(data).eq('id', editId)
    else await supabase.from('uys_tedarikler').insert({ id: uid(), ...data })
    loadAll(); setShowForm(false); setEditItem(null); toast.success(editId ? 'Güncellendi' : 'Eklendi')
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(t => ({ 'Malzeme Kod': t.malkod, 'Malzeme': t.malad, 'Miktar': t.miktar, 'Birim': t.birim, 'Sipariş': t.siparisNo, 'Tedarikçi': t.tedarikcAd, 'Durum': t.geldi ? 'Geldi' : 'Bekliyor', 'Tarih': t.tarih, 'Teslim': t.teslimTarihi }))
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Tedarikler'); XLSX.writeFile(wb, `tedarikler_${today()}.xlsx`)
    })
  }

  const toplamBekleyen = tedarikler.filter(t => !t.geldi).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Tedarik Yönetimi</h1><p className="text-xs text-zinc-500">{tedarikler.length} kayıt · {toplamBekleyen} bekleyen</p></div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          <button onClick={() => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Tedarik</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Malzeme veya sipariş ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>
        <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="all">Tümü</option><option value="bekliyor">Bekleyen</option><option value="geldi">Teslim Alınan</option>
        </select>
      </div>

      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
        {filtered.length ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Malzeme</th><th className="text-right px-4 py-2.5">Miktar</th><th className="text-left px-4 py-2.5">Sipariş</th><th className="text-left px-4 py-2.5">Tedarikçi</th><th className="text-left px-4 py-2.5">Teslim</th><th className="text-left px-4 py-2.5">Durum</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className={`border-b border-border/30 hover:bg-bg-3/30 ${t.geldi ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2"><div className="font-mono text-accent text-[11px]">{t.malkod}</div><div className="text-zinc-400 text-[10px]">{t.malad}</div></td>
                  <td className="px-4 py-2 text-right font-mono">{t.miktar} <span className="text-zinc-600">{t.birim}</span></td>
                  <td className="px-4 py-2 font-mono text-zinc-500 text-[11px]">{t.siparisNo || '—'}</td>
                  <td className="px-4 py-2 text-zinc-400">{t.tedarikcAd || '—'}</td>
                  <td className="px-4 py-2 font-mono text-zinc-500">{t.teslimTarihi || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.geldi ? 'bg-green/10 text-green' : 'bg-amber/10 text-amber'}`}>
                      {t.geldi ? '✓ Geldi' : 'Bekliyor'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      {!t.geldi && <button onClick={() => markGeldi(t.id)} className="p-1 text-zinc-500 hover:text-green" title="Geldi işaretle"><Check size={12} /></button>}
                      <button onClick={() => { setEditItem(t); setShowForm(true) }} className="p-1 text-zinc-500 hover:text-accent"><Pencil size={12} /></button>
                      <button onClick={() => del(t.id)} className="p-1 text-zinc-500 hover:text-red"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Tedarik kaydı yok</div>}
      </div>

      {showForm && <TedarikFormModal initial={editItem as unknown as Record<string, unknown>} tedarikciler={tedarikciler} orders={orders} onClose={() => { setShowForm(false); setEditItem(null) }} onSave={save} />}
    </div>
  )
}

function TedarikFormModal({ initial, tedarikciler, orders, onClose, onSave }: {
  initial: Record<string, unknown> | null
  tedarikciler: { id: string; kod: string; ad: string }[]
  orders: { id: string; siparisNo: string; musteri?: string }[]
  onClose: () => void; onSave: (data: Record<string, unknown>, editId?: string) => void
}) {
  const [malkod, setMalkod] = useState((initial as Record<string, unknown>)?.malkod as string || '')
  const [malad, setMalad] = useState((initial as Record<string, unknown>)?.malad as string || '')
  const [miktar, setMiktar] = useState(String((initial as Record<string, unknown>)?.miktar || ''))
  const [birim, setBirim] = useState((initial as Record<string, unknown>)?.birim as string || 'Adet')
  const [tedarikcId, setTedarikcId] = useState((initial as Record<string, unknown>)?.tedarikcId as string || '')
  const [orderId, setOrderId] = useState((initial as Record<string, unknown>)?.orderId as string || '')
  const [teslim, setTeslim] = useState((initial as Record<string, unknown>)?.teslimTarihi as string || '')
  const [not_, setNot] = useState((initial as Record<string, unknown>)?.not as string || '')
  const { materials } = useStore()

  const ted = tedarikciler.find(t => t.id === tedarikcId)
  const ord = orders.find(o => o.id === orderId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Tedarik Düzenle' : 'Yeni Tedarik'}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Kodu *</label><SearchSelect options={materials.map(m => ({ value: m.kod, label: m.kod, sub: m.ad }))} value={malkod} onChange={(v, l) => { setMalkod(v); if (!malad) setMalad(materials.find(m => m.kod === v)?.ad || l) }} placeholder="Malzeme kodu ara..." /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Miktar *</label><input type="number" value={miktar} onChange={e => setMiktar(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Adı</label><input value={malad} onChange={e => setMalad(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Tedarikçi</label>
            <SearchSelect options={tedarikciler.map(t => ({ value: t.id, label: t.ad }))} value={tedarikcId} onChange={(v) => setTedarikcId(v)} placeholder="Tedarikçi ara..." allowNew={false} />
            </div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Sipariş</label>
            <SearchSelect options={orders.map(o => ({ value: o.id, label: o.siparisNo, sub: o.musteri }))} value={orderId} onChange={(v) => setOrderId(v)} placeholder="Sipariş ara..." allowNew={false} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Teslim Tarihi</label><input type="date" value={teslim} onChange={e => setTeslim(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Birim</label>
            <select value={birim} onChange={e => setBirim(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none"><option>Adet</option><option>Kg</option><option>Metre</option><option>m²</option></select></div>
          </div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Not</label><input value={not_} onChange={e => setNot(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={() => {
            if (!malkod || !miktar) { toast.error('Malzeme kodu ve miktar zorunlu'); return }
            onSave({ malkod, malad, miktar: parseFloat(miktar), birim, tedarikci_id: tedarikcId, tedarikci_ad: ted?.ad || '', order_id: orderId, siparis_no: ord?.siparisNo || '', teslim_tarihi: teslim, durum: 'bekliyor', geldi: false, tarih: today(), not_: not_ }, (initial as Record<string, unknown>)?.id as string)
          }} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
    </div>
  )
}
