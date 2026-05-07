import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Plus, Truck, Download, Eye, Search, FileText, Edit2, Archive } from 'lucide-react'
import { MaterialSearchModal } from '@/components/MaterialSearchModal'

export function Shipment() {
  const { sevkler, orders, workOrders, logs, materials, loadAll } = useStore()
  const { can } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')   // S6 — liste araması
  const [showArsiv, setShowArsiv] = useState(false)  // S3 — arşiv toggle

  // Sipariş tamamen sevk edilmiş mi? → arşiv kriteri
  function isTamamSevk(orderId: string | undefined): boolean {
    if (!orderId) return false
    const ord = orders.find(o => o.id === orderId)
    return (ord as any)?.sevkDurum === 'tamamen_sevk'
  }

  const sorted = useMemo(() => [...sevkler].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '')), [sevkler])

  // S3 + S6 — arşiv ve arama filtresi birlikte
  const filtered = useMemo(() => {
    const q = listSearch.toLowerCase()
    return sorted.filter(s => {
      const arsiv = isTamamSevk(s.orderId)
      if (showArsiv ? !arsiv : arsiv) return false
      if (!q) return true
      return (s.siparisNo || '').toLowerCase().includes(q) ||
             (s.musteri || '').toLowerCase().includes(q) ||
             (s.not || '').toLowerCase().includes(q)
    })
  }, [sorted, listSearch, showArsiv, orders])

  const arsivSayisi = useMemo(() => sorted.filter(s => isTamamSevk(s.orderId)).length, [sorted, orders])

  async function deleteSevk(id: string) {
    if (!await showConfirm('Bu sevkiyatı silmek istediğinize emin misiniz?')) return
    const silinenSevk = sevkler.find(s => s.id === id)
    await supabase.from('uys_sevkler').delete().eq('id', id)
    await supabase.from('uys_stok_hareketler').delete().eq('aciklama', 'Sevkiyat — ' + id)
    if (silinenSevk?.orderId) {
      const ord = orders.find(o => o.id === silinenSevk.orderId)
      if (ord) {
        const { data: kalanSevkler } = await supabase.from('uys_sevkler').select('kalemler').eq('order_id', silinenSevk.orderId)
        let toplamSevk = 0
        for (const s of (kalanSevkler || [])) {
          const kk = (s.kalemler || []) as { malkod: string; miktar: number }[]
          toplamSevk += kk.filter(k => k.malkod === (ord as any).mamulKod).reduce((a, k) => a + (k.miktar || 0), 0)
        }
        const yeniDurum = toplamSevk <= 0 ? 'sevk_yok' : toplamSevk >= (ord as any).adet ? 'tamamen_sevk' : 'kismi_sevk'
        await supabase.from('uys_orders').update({ sevk_durum: yeniDurum }).eq('id', silinenSevk.orderId)
      }
    }
    loadAll(); toast.success('Sevkiyat silindi')
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = sevkler.flatMap(s => (s.kalemler || []).map(k => ({
        'Sipariş': s.siparisNo, 'Müşteri': s.musteri, 'Tarih': s.tarih,
        'Malzeme Kodu': k.malkod, 'Malzeme': k.malad, 'Miktar': k.miktar, 'Not': s.not,
      })))
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sevkiyat'); XLSX.writeFile(wb, `sevkiyat_${today()}.xlsx`)
    })
  }

  async function indirSevkBelgePDF(s: typeof sevkler[number]) {
    try {
      const ord = orders.find(o => o.id === s.orderId)
      const { generateSevkBelgePDF } = await import('@/lib/sevk-belge-pdf')
      await generateSevkBelgePDF({ sevk: s, order: ord })
      const sevkNo = (s as any).sevkNo || (s as any).sevk_no || s.id
      toast.success(sevkNo + ' Sevk Belgesi indirildi')
    } catch (e: any) {
      toast.error('Sevk Belgesi PDF oluşturulamadı: ' + (e?.message || 'bilinmeyen hata'))
    }
  }

  const detail = detailId ? sevkler.find(s => s.id === detailId) : null
  const editSevk = editId ? sevkler.find(s => s.id === editId) : null

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Sevkiyat</h1>
          <p className="text-xs text-zinc-500">
            {filtered.length} sevkiyat
            {arsivSayisi > 0 && ` · ${arsivSayisi} arşivde`}
          </p>
        </div>
        <div className="flex gap-2">
          {arsivSayisi > 0 && (
            <button onClick={() => setShowArsiv(!showArsiv)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${showArsiv ? 'bg-amber/10 border-amber/25 text-amber' : 'bg-bg-2 border-border text-zinc-400 hover:text-white'}`}>
              <Archive size={13} /> {showArsiv ? 'Aktif Göster' : `+ Arşiv (${arsivSayisi})`}
            </button>
          )}
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">
            <Download size={13} /> Excel
          </button>
          {can('sevk_add') && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">
              <Plus size={13} /> Yeni Sevkiyat
            </button>
          )}
        </div>
      </div>

      {/* S6 — Liste araması */}
      <div className="relative mb-3">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          placeholder="Sipariş no, müşteri veya not ara..."
          value={listSearch}
          onChange={e => setListSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent"
        />
      </div>

      {/* Liste */}
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {filtered.length ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500">
                <th className="text-left px-4 py-2.5">Sipariş No</th>
                <th className="text-left px-4 py-2.5">Müşteri</th>
                <th className="text-left px-4 py-2.5">Tarih</th>
                <th className="text-right px-4 py-2.5">Kalem</th>
                <th className="text-right px-4 py-2.5">Toplam</th>
                <th className="text-left px-4 py-2.5">Not</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const topMiktar = (s.kalemler || []).reduce((a, k) => a + (k.miktar || 0), 0)
                return (
                  <tr key={s.id} className="border-b border-border/30 hover:bg-bg-3/30">
                    <td className="px-4 py-2 font-mono text-accent">{s.siparisNo || '—'}</td>
                    <td className="px-4 py-2 text-zinc-300">{s.musteri || '—'}</td>
                    <td className="px-4 py-2 font-mono text-zinc-500">{s.tarih}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.kalemler?.length || 0}</td>
                    <td className="px-4 py-2 text-right font-mono text-green">{topMiktar}</td>
                    <td className="px-4 py-2 text-zinc-500 max-w-[200px] truncate">{s.not || '—'}</td>
                    <td className="px-4 py-2 flex gap-1 justify-end">
                      <button onClick={() => indirSevkBelgePDF(s)} className="p-1 text-zinc-500 hover:text-accent" title="Sevk Belgesi PDF"><FileText size={12} /></button>
                      <button onClick={() => setDetailId(s.id)} className="p-1 text-zinc-500 hover:text-accent" title="Detay"><Eye size={12} /></button>
                      {/* S7 — Düzenleme butonu */}
                      {can('sevk_edit') && (
                        <button onClick={() => setEditId(s.id)} className="p-1 text-zinc-500 hover:text-accent" title="Düzenle"><Edit2 size={12} /></button>
                      )}
                      {can('sevk_delete') && (
                        <button onClick={() => deleteSevk(s.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-zinc-600 text-sm">
            {showArsiv ? 'Arşivde sevkiyat yok' : listSearch ? 'Aramayla eşleşen sevkiyat yok' : 'Henüz sevkiyat yok'}
          </div>
        )}
      </div>

      {/* Detay Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{detail.siparisNo || 'Sevkiyat'}</h2>
                <p className="text-xs text-zinc-500">{detail.musteri} · {detail.tarih}</p>
              </div>
              <button onClick={() => setDetailId(null)} className="text-zinc-500 hover:text-white text-lg">✕</button>
            </div>
            <table className="w-full text-xs mb-4">
              <thead><tr className="border-b border-border text-zinc-500">
                <th className="text-left px-3 py-2">Malzeme</th>
                <th className="text-right px-3 py-2">Miktar</th>
              </tr></thead>
              <tbody>
                {(detail.kalemler || []).map((k, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-1.5"><span className="font-mono text-accent text-[11px]">{k.malkod}</span> {k.malad}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{k.miktar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.not && <div className="text-xs text-zinc-500 mb-3">Not: {detail.not}</div>}
            <div className="flex gap-2">
              <button onClick={() => setDetailId(null)} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">Kapat</button>
              {can('sevk_edit') && (
                <button onClick={() => { setDetailId(null); setEditId(detail.id) }} className="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Edit2 size={12} /> Düzenle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* S7 — Düzenleme Modali */}
      {editSevk && (
        <SevkEditModal
          sevk={editSevk}
          materials={materials}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); loadAll(); toast.success('Sevkiyat güncellendi') }}
        />
      )}

      {/* Yeni Sevkiyat Modali */}
      {showForm && (
        <SevkFormModal
          orders={orders}
          sevkler={sevkler}
          workOrders={workOrders}
          logs={logs}
          materials={materials}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadAll(); toast.success('Sevkiyat oluşturuldu') }}
        />
      )}
    </div>
  )
}

// ═══ S7 — DÜZENLEME MODALI ═══
function SevkEditModal({ sevk, materials, onClose, onSaved }: {
  sevk: any
  materials: import('@/types').Material[]
  onClose: () => void
  onSaved: () => void
}) {
  const [kalemler, setKalemler] = useState<{ malkod: string; malad: string; miktar: number }[]>(
    (sevk.kalemler || []).map((k: any) => ({ malkod: k.malkod || '', malad: k.malad || '', miktar: k.miktar || 0 }))
  )
  const [not_, setNot] = useState(sevk.not || '')
  const [searchIdx, setSearchIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  function addKalem() { setKalemler([...kalemler, { malkod: '', malad: '', miktar: 1 }]) }
  function removeKalem(i: number) { setKalemler(prev => prev.filter((_, idx) => idx !== i)) }
  function updateKalem(i: number, field: string, value: string | number) {
    setKalemler(prev => prev.map((k, idx) => idx === i ? { ...k, [field]: value } : k))
  }

  async function save() {
    const validKalemler = kalemler.filter(k => k.malad && k.miktar > 0)
    if (!validKalemler.length) { toast.error('En az bir kalem ekleyin'); return }
    setSaving(true)
    await supabase.from('uys_sevkler').update({ kalemler: validKalemler, not_: not_ }).eq('id', sevk.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2"><Edit2 size={16} className="text-accent" /> Sevkiyat Düzenle</h2>
        <p className="text-xs text-zinc-500 mb-4">{sevk.siparisNo || '—'} · {sevk.musteri} · {sevk.tarih}</p>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Kalemler</label>
            {kalemler.map((k, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input value={k.malkod} onChange={e => updateKalem(i, 'malkod', e.target.value)}
                  placeholder="Malzeme kodu" className="w-28 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-accent" />
                <button type="button" onClick={() => setSearchIdx(i)}
                  className="w-8 h-8 flex items-center justify-center rounded bg-bg-3 border border-border/50 text-zinc-400 hover:text-accent shrink-0">
                  <Search size={12} />
                </button>
                <input value={k.malad} onChange={e => updateKalem(i, 'malad', e.target.value)}
                  placeholder="Malzeme adı" className="flex-1 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
                <input type="number" min={1} value={k.miktar} onChange={e => updateKalem(i, 'miktar', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 text-right focus:outline-none" />
                {kalemler.length > 1 && <button onClick={() => removeKalem(i)} className="text-zinc-500 hover:text-red text-xs">✕</button>}
              </div>
            ))}
            <button onClick={addKalem} className="text-[11px] text-accent hover:underline mt-1">+ Kalem Ekle</button>
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
            <input value={not_} onChange={e => setNot(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold disabled:opacity-50">
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {searchIdx !== null && (
        <MaterialSearchModal
          materials={materials}
          title="Malzeme Ara"
          allowedTypes={['Mamul', 'YarıMamul']}
          onSelect={(mat) => {
            setKalemler(prev => prev.map((k, idx) => idx === searchIdx ? { ...k, malkod: mat.kod, malad: mat.ad } : k))
            setSearchIdx(null)
          }}
          onClose={() => setSearchIdx(null)}
        />
      )}
    </div>
  )
}

// ═══ YENİ SEVKİYAT MODALI (S1 sipariş arama, S2 duplicate, S5 bakiye) ═══
function SevkFormModal({ orders, sevkler, workOrders, logs, materials, onClose, onSaved }: {
  orders: { id: string; siparisNo: string; musteri: string; mamulKod: string; mamulAd: string; adet: number }[]
  sevkler: any[]
  workOrders: { id: string; orderId: string; malkod: string; malad: string; hedef: number }[]
  logs: { woId: string; qty: number }[]
  materials: import('@/types').Material[]
  onClose: () => void
  onSaved: () => void
}) {
  const [orderId, setOrderId] = useState('')
  const [orderSearch, setOrderSearch] = useState('')  // S1 — sipariş arama
  const [showOrderList, setShowOrderList] = useState(false)
  const [not_, setNot] = useState('')
  const [kalemler, setKalemler] = useState<{ malkod: string; malad: string; miktar: number }[]>([{ malkod: '', malad: '', miktar: 1 }])
  const [stokCikis, setStokCikis] = useState(true)
  const [searchIdx, setSearchIdx] = useState<number | null>(null)

  const ord = orders.find(o => o.id === orderId)

  // S5 — Bakiye: daha önce bu siparişe ait kaç adet sevk edilmiş
  const mevcutSevkAdet = useMemo(() => {
    if (!orderId || !ord) return 0
    return sevkler
      .filter(s => s.orderId === orderId)
      .flatMap((s: any) => s.kalemler || [])
      .filter((k: any) => k.malkod === ord.mamulKod)
      .reduce((a: number, k: any) => a + (k.miktar || 0), 0)
  }, [orderId, ord, sevkler])

  const kalanAdet = ord ? Math.max(0, ord.adet - mevcutSevkAdet) : 0

  // S1 — Sipariş arama filtresi
  const filteredOrders = useMemo(() => {
    const q = orderSearch.toLowerCase()
    if (!q) return orders
    return orders.filter(o =>
      (o.siparisNo || '').toLowerCase().includes(q) ||
      (o.musteri || '').toLowerCase().includes(q) ||
      (o.mamulAd || '').toLowerCase().includes(q)
    )
  }, [orders, orderSearch])

  function selectOrder(o: typeof orders[number]) {
    // S2 — Tamamen sevk edilmiş siparişi engelle
    const mevcutSevk = sevkler
      .filter((s: any) => s.orderId === o.id)
      .flatMap((s: any) => s.kalemler || [])
      .filter((k: any) => k.malkod === o.mamulKod)
      .reduce((a: number, k: any) => a + (k.miktar || 0), 0)
    if (mevcutSevk >= o.adet) {
      toast.warning(`${o.siparisNo} zaten tamamen sevk edilmiş (${mevcutSevk}/${o.adet})`)
    }
    setOrderId(o.id)
    setOrderSearch(o.siparisNo + ' — ' + o.musteri)
    setShowOrderList(false)

    // Otomatik kalem doldur
    const sipWOs = workOrders.filter(w => w.orderId === o.id)
    const mamulWOs = sipWOs.filter(w => !w.malkod?.includes('.') || w.malkod === o.mamulKod)
    if (mamulWOs.length) {
      const auto = mamulWOs.map(w => {
        const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
        return { malkod: w.malkod, malad: w.malad, miktar: Math.min(prod, w.hedef) }
      }).filter(k => k.miktar > 0)
      if (auto.length) setKalemler(auto)
      else setKalemler([{ malkod: o.mamulKod, malad: o.mamulAd || o.mamulKod, miktar: o.adet }])
    } else if (o.mamulKod) {
      setKalemler([{ malkod: o.mamulKod, malad: o.mamulAd || o.mamulKod, miktar: o.adet }])
    }
  }

  function addKalem() { setKalemler([...kalemler, { malkod: '', malad: '', miktar: 1 }]) }
  function removeKalem(i: number) { setKalemler(prev => prev.filter((_, idx) => idx !== i)) }
  function updateKalem(i: number, field: string, value: string | number) {
    setKalemler(prev => prev.map((k, idx) => idx === i ? { ...k, [field]: value } : k))
  }

  async function save() {
    const validKalemler = kalemler.filter(k => k.malad && k.miktar > 0)
    if (!validKalemler.length) { toast.error('En az bir kalem ekleyin'); return }
    const sevkId = uid()
    await supabase.from('uys_sevkler').insert({
      id: sevkId, order_id: orderId || null, siparis_no: ord?.siparisNo || '',
      musteri: ord?.musteri || '', tarih: today(), kalemler: validKalemler, not_: not_,
    })
    if (stokCikis) {
      for (const k of validKalemler) {
        await supabase.from('uys_stok_hareketler').insert({
          id: uid(), tarih: today(), malkod: k.malkod, malad: k.malad,
          miktar: k.miktar, tip: 'cikis',
          aciklama: 'Sevkiyat — ' + (ord?.siparisNo || '') + ' — ' + (ord?.musteri || ''),
        })
      }
    }
    if (orderId && ord) {
      const yeniSevkDurum = await hesaplaSevkDurum(orderId, ord.adet, ord.mamulKod, validKalemler)
      await supabase.from('uys_orders').update({ sevk_durum: yeniSevkDurum }).eq('id', orderId)
      if (yeniSevkDurum === 'tamamen_sevk' && (ord as any).durum !== 'kapalı') {
        toast.success('🎯 Sipariş tamamen sevk edildi.', { duration: 6000 })
      }
    }
    onSaved()
  }

  async function hesaplaSevkDurum(ordId: string, toplamAdet: number, mamulKod: string, yeniKalemler: { malkod: string; miktar: number }[]): Promise<string> {
    const { data: mevcutSevkler } = await supabase.from('uys_sevkler').select('kalemler').eq('order_id', ordId)
    let toplamSevk = 0
    for (const s of (mevcutSevkler || [])) {
      const kk = (s.kalemler || []) as { malkod: string; miktar: number }[]
      toplamSevk += kk.filter(k => k.malkod === mamulKod).reduce((a, k) => a + (k.miktar || 0), 0)
    }
    toplamSevk += yeniKalemler.filter(k => k.malkod === mamulKod).reduce((a, k) => a + (k.miktar || 0), 0)
    if (toplamSevk <= 0) return 'sevk_yok'
    if (toplamSevk >= toplamAdet) return 'tamamen_sevk'
    return 'kismi_sevk'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Truck size={18} className="text-accent" /> Yeni Sevkiyat</h2>
        <div className="space-y-3">

          {/* S1 — Sipariş arama */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Sipariş</label>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={orderSearch}
                onChange={e => { setOrderSearch(e.target.value); setOrderId(''); setShowOrderList(true) }}
                onFocus={() => setShowOrderList(true)}
                placeholder="Sipariş no veya müşteri ara..."
                className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
              {showOrderList && filteredOrders.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-bg-1 border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredOrders.slice(0, 30).map(o => (
                    <button key={o.id} onMouseDown={() => selectOrder(o)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-bg-3 border-b border-border/30 last:border-0">
                      <span className="font-mono text-accent">{o.siparisNo}</span>
                      <span className="text-zinc-400 ml-2">{o.musteri}</span>
                      <span className="text-zinc-600 ml-2 truncate">{o.mamulAd}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* S5 — Bakiye */}
            {ord && (
              <div className="mt-1.5 flex gap-3 text-[11px]">
                <span className="text-zinc-500">Sipariş: <span className="text-zinc-300 font-mono">{ord.adet}</span></span>
                <span className="text-zinc-500">Sevk edilen: <span className="text-zinc-300 font-mono">{mevcutSevkAdet}</span></span>
                <span className={`font-semibold ${kalanAdet <= 0 ? 'text-red' : 'text-green'}`}>
                  Kalan: {kalanAdet <= 0 ? '⚠ Tamamen sevk edilmiş' : kalanAdet}
                </span>
              </div>
            )}
          </div>

          {/* Kalemler */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Kalemler</label>
            {kalemler.map((k, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input value={k.malkod} onChange={e => updateKalem(i, 'malkod', e.target.value)}
                  placeholder="Malzeme kodu" className="w-28 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-accent" />
                <button type="button" onClick={() => setSearchIdx(i)}
                  className="w-8 h-8 flex items-center justify-center rounded bg-bg-3 border border-border/50 text-zinc-400 hover:text-accent shrink-0">
                  <Search size={12} />
                </button>
                <input value={k.malad} onChange={e => updateKalem(i, 'malad', e.target.value)}
                  placeholder="Malzeme adı" className="flex-1 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
                <input type="number" min={1} value={k.miktar} onChange={e => updateKalem(i, 'miktar', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 text-right focus:outline-none" />
                {kalemler.length > 1 && <button onClick={() => removeKalem(i)} className="text-zinc-500 hover:text-red text-xs">✕</button>}
              </div>
            ))}
            <button onClick={addKalem} className="text-[11px] text-accent hover:underline mt-1">+ Kalem Ekle</button>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={stokCikis} onChange={e => setStokCikis(e.target.checked)} className="accent-accent" />
            Sevkiyatta stok çıkışı yap
          </label>

          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
            <input value={not_} onChange={e => setNot(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Oluştur</button>
        </div>
      </div>

      {searchIdx !== null && (
        <MaterialSearchModal
          materials={materials}
          title="Malzeme Ara — Ölçü Filtreli"
          allowedTypes={['Mamul', 'YarıMamul']}
          onSelect={(mat) => {
            setKalemler(prev => prev.map((k, idx) => idx === searchIdx ? { ...k, malkod: mat.kod, malad: mat.ad } : k))
            setSearchIdx(null)
          }}
          onClose={() => setSearchIdx(null)}
        />
      )}
    </div>
  )
}
