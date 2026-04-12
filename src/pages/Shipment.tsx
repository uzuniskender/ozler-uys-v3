import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Truck } from 'lucide-react'

export function Shipment() {
  const { sevkler, orders, loadAll } = useStore()
  const [showForm, setShowForm] = useState(false)

  const sorted = useMemo(() => [...sevkler].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '')), [sevkler])

  async function deleteSevk(id: string) {
    if (!confirm('Bu sevkiyatı silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_sevkler').delete().eq('id', id)
    loadAll(); toast.success('Sevkiyat silindi')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Sevkiyat</h1><p className="text-xs text-zinc-500">{sevkler.length} sevkiyat</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Sevkiyat</button>
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {sorted.length ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Sipariş No</th><th className="text-left px-4 py-2.5">Müşteri</th><th className="text-left px-4 py-2.5">Tarih</th><th className="text-right px-4 py-2.5">Kalem</th><th className="text-left px-4 py-2.5">Not</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-2 font-mono text-accent">{s.siparisNo || '—'}</td>
                  <td className="px-4 py-2 text-zinc-300">{s.musteri || '—'}</td>
                  <td className="px-4 py-2 font-mono text-zinc-500">{s.tarih}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.kalemler?.length || 0}</td>
                  <td className="px-4 py-2 text-zinc-500 max-w-[200px] truncate">{s.not || '—'}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => deleteSevk(s.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz sevkiyat yok</div>}
      </div>
      {showForm && <SevkFormModal orders={orders} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadAll(); toast.success('Sevkiyat oluşturuldu') }} />}
    </div>
  )
}

function SevkFormModal({ orders, onClose, onSaved }: {
  orders: { id: string; siparisNo: string; musteri: string }[]
  onClose: () => void; onSaved: () => void
}) {
  const [orderId, setOrderId] = useState('')
  const [not_, setNot] = useState('')
  const [kalemler, setKalemler] = useState<{ malkod: string; malad: string; miktar: number }[]>([{ malkod: '', malad: '', miktar: 1 }])

  const ord = orders.find(o => o.id === orderId)

  function addKalem() { setKalemler([...kalemler, { malkod: '', malad: '', miktar: 1 }]) }
  function removeKalem(i: number) { setKalemler(prev => prev.filter((_, idx) => idx !== i)) }
  function updateKalem(i: number, field: string, value: string | number) { setKalemler(prev => prev.map((k, idx) => idx === i ? { ...k, [field]: value } : k)) }

  async function save() {
    const validKalemler = kalemler.filter(k => k.malad && k.miktar > 0)
    if (!validKalemler.length) { toast.error('En az bir kalem ekleyin'); return }
    await supabase.from('uys_sevkler').insert({
      id: uid(), order_id: orderId || null, siparis_no: ord?.siparisNo || '',
      musteri: ord?.musteri || '', tarih: today(), kalemler: validKalemler, not_: not_,
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Truck size={18} className="text-accent" /> Yeni Sevkiyat</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Sipariş</label>
          <select value={orderId} onChange={e => setOrderId(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
            <option value="">— Siparişsiz —</option>
            {orders.map(o => <option key={o.id} value={o.id}>{o.siparisNo} — {o.musteri}</option>)}
          </select></div>

          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Kalemler</label>
            {kalemler.map((k, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input value={k.malkod} onChange={e => updateKalem(i, 'malkod', e.target.value)} placeholder="Malzeme kodu" className="flex-1 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
                <input value={k.malad} onChange={e => updateKalem(i, 'malad', e.target.value)} placeholder="Malzeme adı" className="flex-[2] px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
                <input type="number" min={1} value={k.miktar} onChange={e => updateKalem(i, 'miktar', parseInt(e.target.value) || 0)} className="w-16 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 text-right focus:outline-none" />
                {kalemler.length > 1 && <button onClick={() => removeKalem(i)} className="text-zinc-500 hover:text-red text-xs">✕</button>}
              </div>
            ))}
            <button onClick={addKalem} className="text-[11px] text-accent hover:underline mt-1">+ Kalem Ekle</button>
          </div>

          <div><label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
          <input value={not_} onChange={e => setNot(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Oluştur</button>
        </div>
      </div>
    </div>
  )
}
