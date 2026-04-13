import { useAuth } from '@/hooks/useAuth'
import { logAction } from '@/lib/activityLog'
import { useState, useMemo } from 'react'
import { buildWorkOrders, autoZincir } from '@/features/production/autoChain'
import { hesaplaMRP, mrpTedarikOlustur } from '@/features/production/mrp'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today, pctColor } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Plus, Search, Download, Trash2, Eye, Pencil, Calculator, Copy, Upload, ArrowUp, ArrowDown } from 'lucide-react'
import type { Order } from '@/types'
import { SearchSelect } from '@/components/ui/SearchSelect'

export function Orders() {
  const { orders, workOrders, logs, recipes, cuttingPlans, materials, loadAll } = useStore()
  const { isGuest } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selIds, setSelIds] = useState<Set<string>>(new Set())

  function selToggle(id: string) { setSelIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s }) }

  async function selDeleteAll() {
    if (!selIds.size) return
    if (!await showConfirm(`${selIds.size} sipariş SİLİNECEK. Devam?`)) return
    for (const id of selIds) {
      await supabase.from('uys_work_orders').delete().eq('order_id', id)
      await supabase.from('uys_orders').delete().eq('id', id)
    }
    setSelIds(new Set()); loadAll(); toast.success(selIds.size + ' sipariş silindi')
  }

  function orderPct(orderId: string): number {
    const wos = workOrders.filter(w => w.orderId === orderId)
    if (!wos.length) return 0
    const total = wos.reduce((s, w) => {
      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
      return s + (w.hedef > 0 ? Math.min(100, prod / w.hedef * 100) : 0)
    }, 0)
    return Math.round(total / wos.length)
  }

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (search) { const q = search.toLowerCase(); if (!(o.siparisNo + o.musteri + o.mamulAd).toLowerCase().includes(q)) return false }
      if (statusFilter === 'active') return o.durum !== 'kapalı' && orderPct(o.id) < 100
      if (statusFilter === 'done') return orderPct(o.id) >= 100
      if (statusFilter === 'late') return o.durum !== 'kapalı' && o.termin && o.termin < today() && orderPct(o.id) < 100
      if (statusFilter === 'closed') return o.durum === 'kapalı'
      return o.durum !== 'kapalı' // 'all' — kapalıları gizle
    })
  }, [orders, search, statusFilter, workOrders, logs])

  async function copyOrder(o: Order) {
    const newId = uid()
    const { error } = await supabase.from('uys_orders').insert({
      id: newId, siparis_no: o.siparisNo + '-KOPYA', musteri: o.musteri, tarih: today(), termin: o.termin,
      mamul_kod: o.mamulKod, mamul_ad: o.mamulAd, adet: o.adet, recete_id: o.receteId,
      urunler: o.urunler, mrp_durum: 'bekliyor', olusturma: today(),
    })
    if (!error) { loadAll(); toast.success('Sipariş kopyalandı: ' + o.siparisNo + '-KOPYA') }
  }
  async function deleteOrder(id: string) {
    if (!await showConfirm('Bu siparişi ve ilişkili iş emirlerini silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_work_orders').delete().eq('order_id', id)
    await supabase.from('uys_orders').delete().eq('id', id)
    logAction('Sipariş silindi', id)
    loadAll(); toast.success('Sipariş silindi')
  }

  // #11: Toplu Sipariş Excel Import
  async function topluSiparisYukle() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      if (!rows.length) { toast.error('Excel boş'); return }

      const { recipes: fullRecipes } = useStore.getState()
      let created = 0, woTotal = 0
      for (const row of rows) {
        const sipNo = String(row['Sipariş No'] || row['SiparisNo'] || row['siparis_no'] || '').trim()
        if (!sipNo) continue
        const must = String(row['Müşteri'] || row['musteri'] || '').trim()
        const term = String(row['Termin'] || row['termin'] || '').trim()
        const adet = parseInt(String(row['Adet'] || row['adet'] || '1')) || 1
        const mamulKod = String(row['Mamul Kod'] || row['mamulKod'] || row['mamul_kod'] || '').trim()
        const mamulAd = String(row['Mamul Ad'] || row['mamulAd'] || row['mamul_ad'] || '').trim()

        // Reçete eşleme
        const rc = fullRecipes.find(r => r.mamulKod === mamulKod || r.ad === mamulAd)

        const newId = uid()
        await supabase.from('uys_orders').insert({
          id: newId, siparis_no: sipNo, musteri: must, tarih: today(), termin: term,
          mamul_kod: mamulKod || rc?.mamulKod || '', mamul_ad: mamulAd || rc?.mamulAd || '',
          adet, recete_id: rc?.id || '', mrp_durum: 'bekliyor', olusturma: today(),
          urunler: rc ? [{ rcId: rc.id, mamulKod: rc.mamulKod, mamulAd: rc.mamulAd, adet }] : [],
        })
        created++
        if (rc) { woTotal += await buildWorkOrders(newId, sipNo, rc.id, adet, fullRecipes) }
      }
      loadAll()
      toast.success(`${created} sipariş oluşturuldu, ${woTotal} İE üretildi`)
    }
    input.click()
  }

  // Toplu MRP — seçili veya tüm açık siparişler
  async function topluMRP() {
    const { recipes: fullRecipes, stokHareketler, tedarikler, workOrders: wos, cuttingPlans: cp, materials: mats } = useStore.getState()
    const hedefOrders = selIds.size > 0
      ? orders.filter(o => selIds.has(o.id))
      : orders.filter(o => orderPct(o.id) < 100 && o.receteId)

    if (!hedefOrders.length) { toast.error('MRP çalıştırılacak sipariş yok'); return }
    if (!await showConfirm(`${hedefOrders.length} sipariş için MRP çalıştırılacak. Devam?`)) return

    const ordIds = hedefOrders.map(o => o.id)
    const cpMapped = cp.map((p: any) => ({ hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '', gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [] }))
    const mrpRows = hesaplaMRP(ordIds, orders as any, wos, fullRecipes, stokHareketler, tedarikler, cpMapped, mats)
    const count = await mrpTedarikOlustur(ordIds[0] || '', hedefOrders[0]?.siparisNo || '', mrpRows)

    for (const o of hedefOrders) {
      await supabase.from('uys_orders').update({ mrp_durum: 'tamamlandi' }).eq('id', o.id)
    }
    loadAll()
    toast.success(`${hedefOrders.length} sipariş için MRP tamamlandı — ${count} tedarik oluşturuldu`)
  }

  function downloadTemplate() {
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet([{ 'Sipariş No': 'SIP-001', 'Müşteri': 'ABC Ltd', 'Termin': '2026-05-01', 'Adet': 100, 'Mamul Kod': '', 'Mamul Ad': '' }])
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Siparişler')
      XLSX.writeFile(wb, 'siparis_sablonu.xlsx')
    })
  }

  // #19: Sipariş Önceliklendirme
  async function oncelikDegistir(orderId: string, delta: number) {
    const order = orders.find(o => o.id === orderId)
    if (!order) return
    await supabase.from('uys_orders').update({ oncelik: (order.oncelik || 0) + delta }).eq('id', orderId)
    loadAll()
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(o => ({ 'Sipariş No': o.siparisNo, 'Müşteri': o.musteri, 'Tarih': o.tarih, 'Termin': o.termin, 'Ürün': o.mamulAd || o.mamulKod, 'Adet': o.adet, 'İlerleme': orderPct(o.id) + '%' }))
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Siparişler'); XLSX.writeFile(wb, `siparisler_${today()}.xlsx`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Siparişler</h1><p className="text-xs text-zinc-500">{orders.length} sipariş{isGuest ? ' (salt okunur)' : ''}</p></div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white" title="Şablon indir"><Download size={13} /> Şablon</button>
          <button onClick={topluSiparisYukle} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Upload size={13} /> Excel Yükle</button>
          <button onClick={topluMRP} className="flex items-center gap-1.5 px-3 py-1.5 bg-green/10 border border-green/25 text-green rounded-lg text-xs hover:bg-green/20"><Calculator size={13} /> Toplu MRP</button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          <button onClick={async () => { setEditOrder(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Sipariş</button>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sipariş no veya müşteri ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="all">Tümü</option><option value="active">Üretimde</option><option value="done">Tamamlandı</option><option value="late">Gecikmeli</option><option value="closed">Kapalı</option>
        </select>
      </div>

      {selIds.size > 0 && (
        <div className="mb-3 p-2 bg-accent/5 border border-accent/20 rounded-lg flex items-center gap-2">
          <span className="text-xs font-semibold text-accent">{selIds.size} seçili</span>
          <button onClick={selDeleteAll} className="px-2 py-1 bg-red/10 text-red rounded text-[10px]">Toplu Sil</button>
          <span className="flex-1" />
          <button onClick={() => setSelIds(new Set(filtered.map(o => o.id)))} className="text-[10px] text-zinc-500 hover:text-white">Tümü</button>
          <button onClick={() => setSelIds(new Set())} className="text-[10px] text-zinc-500 hover:text-white">Temizle</button>
        </div>
      )}

      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {filtered.length ? (
          <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="px-2 py-2.5 w-6"><input type="checkbox" onChange={e => e.target.checked ? setSelIds(new Set(filtered.map(o => o.id))) : setSelIds(new Set())} className="accent-accent" /></th><th className="text-left px-4 py-2.5">Sipariş No</th><th className="text-left px-4 py-2.5">Müşteri</th><th className="text-left px-4 py-2.5">Ürün</th><th className="text-right px-4 py-2.5">Adet</th><th className="text-left px-4 py-2.5">Termin</th><th className="text-right px-4 py-2.5">İlerleme</th><th className="text-right px-4 py-2.5">İE</th><th className="text-center px-2 py-2.5">MRP</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody>
            {filtered.map(o => {
              const pct = orderPct(o.id); const woCount = workOrders.filter(w => w.orderId === o.id).length
              const isLate = o.termin && o.termin < today() && pct < 100
              const mrpBadge = o.mrpDurum === 'tamamlandi' ? { bg: 'bg-green/10', color: 'text-green', label: '✓' } : o.mrpDurum === 'calistirildi' ? { bg: 'bg-amber/10', color: 'text-amber', label: '⚡' } : { bg: 'bg-cyan-500/10', color: 'text-cyan-400', label: '📊' }
              return (
                <tr key={o.id} className={`border-b border-border/50 hover:bg-bg-3/50 ${selIds.has(o.id) ? 'bg-accent/5' : ''}`}>
                  <td className="px-2 py-2.5"><input type="checkbox" checked={selIds.has(o.id)} onChange={() => selToggle(o.id)} className="accent-accent" /></td>
                  <td className="px-4 py-2.5"><button onClick={() => setSelectedOrder(o)} className="font-mono text-accent hover:underline">{o.siparisNo}</button></td>
                  <td className="px-4 py-2.5">{o.musteri ? <button onClick={() => setSearch(o.musteri)} className="text-zinc-300 hover:text-accent hover:underline">{o.musteri}</button> : <span className="text-zinc-600">—</span>}</td>
                  <td className="px-4 py-2.5 text-zinc-400 max-w-[200px] truncate">{o.mamulAd || o.mamulKod || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{o.adet}</td>
                  <td className={`px-4 py-2.5 font-mono ${isLate ? 'text-red font-semibold' : 'text-zinc-500'}`}>{o.termin || '—'}</td>
                  <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-2"><div className="w-14 h-1.5 bg-bg-3 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${pct}%` }} /></div><span className={`font-mono text-[11px] w-8 text-right ${pctColor(pct)}`}>{pct}%</span></div></td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-500">{woCount}</td>
                  <td className="px-2 py-2.5 text-center">{woCount > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${mrpBadge.bg} ${mrpBadge.color}`}>{mrpBadge.label}</span>}</td>
                  <td className="px-4 py-2.5 text-right"><div className="flex gap-1 justify-end">
                    <button onClick={() => setSelectedOrder(o)} className="p-1 text-zinc-500 hover:text-accent" title="Detay"><Eye size={13} /></button>
                    <button onClick={() => oncelikDegistir(o.id, 1)} className="p-1 text-zinc-500 hover:text-amber" title="Öncelik artır"><ArrowUp size={11} /></button>
                    <button onClick={() => oncelikDegistir(o.id, -1)} className="p-1 text-zinc-500 hover:text-zinc-300" title="Öncelik azalt"><ArrowDown size={11} /></button>
                    <button onClick={() => copyOrder(o)} className="p-1 text-zinc-500 hover:text-green" title="Kopyala"><Copy size={13} /></button>
                    <button onClick={async () => { setEditOrder(o); setShowForm(true) }} className="p-1 text-zinc-500 hover:text-amber" title="Düzenle"><Pencil size={13} /></button>
                    <button onClick={async () => {
                      const yeniDurum = o.durum === 'kapalı' ? '' : 'kapalı'
                      await supabase.from('uys_orders').update({ durum: yeniDurum }).eq('id', o.id)
                      loadAll(); toast.success(o.siparisNo + (yeniDurum === 'kapalı' ? ' kapatıldı' : ' açıldı'))
                    }} className={`p-1 ${o.durum === 'kapalı' ? 'text-green hover:text-green' : 'text-zinc-500 hover:text-amber'}`} title={o.durum === 'kapalı' ? 'Aç' : 'Kapat'}>
                      {o.durum === 'kapalı' ? '🔓' : '🔒'}
                    </button>
                    <button onClick={() => deleteOrder(o.id)} className="p-1 text-zinc-500 hover:text-red" title="Sil"><Trash2 size={13} /></button>
                  </div></td>
                </tr>
              )
            })}
          </tbody></table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">{search ? 'Arama sonucu bulunamadı' : 'Henüz sipariş yok'}</div>}
      </div>
      {showForm && <OrderFormModal initial={editOrder} recipes={recipes} onClose={() => { setShowForm(false); setEditOrder(null) }} onSaved={() => { setShowForm(false); setEditOrder(null); loadAll(); toast.success(editOrder ? 'Güncellendi' : 'Oluşturuldu') }} />}
      {selectedOrder && <OrderDetailModal order={selectedOrder} workOrders={workOrders.filter(w => w.orderId === selectedOrder.id)} logs={logs} onClose={() => setSelectedOrder(null)} />}
    </div>
  )
}

function OrderFormModal({ initial, recipes, onClose, onSaved }: { initial: Order | null; recipes: { id: string; mamulKod: string; mamulAd: string; ad: string }[]; onClose: () => void; onSaved: () => void }) {
  const [siparisNo, setSiparisNo] = useState(initial?.siparisNo || '')
  const [musteri, setMusteri] = useState(initial?.musteri || '')
  const [termin, setTermin] = useState(initial?.termin || '')
  const [receteId, setReceteId] = useState(initial?.receteId || '')
  const [adet, setAdet] = useState(initial?.adet || 1)
  const [not_, setNot] = useState(initial?.not || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!siparisNo.trim()) { setError('Sipariş No zorunlu'); return }
    if (!termin) { setError('Termin tarihi zorunlu'); return }
    setSaving(true)
    const rc = recipes.find(r => r.id === receteId)
    const row = {
      siparis_no: siparisNo.trim(), musteri: musteri.trim(), termin, adet,
      mamul_kod: rc?.mamulKod || '', mamul_ad: rc?.mamulAd || rc?.ad || '',
      recete_id: receteId, not_: not_,
      urunler: receteId ? [{ rcId: receteId, mamulKod: rc?.mamulKod, mamulAd: rc?.mamulAd || rc?.ad, adet }] : [],
    }
    if (initial?.id) {
      await supabase.from('uys_orders').update(row).eq('id', initial.id)
    } else {
      const newId = uid()
      await supabase.from('uys_orders').insert({ id: newId, ...row, tarih: today(), mrp_durum: 'bekliyor', olusturma: today() })
      if (receteId) {
        const { recipes: fullRecipes } = useStore.getState(); const woCount = await buildWorkOrders(newId, siparisNo.trim(), receteId, adet, fullRecipes)
        toast.info(woCount + ' iş emri oluşturuldu')
      }
    }
    logAction(initial ? 'Sipariş güncellendi' : 'Sipariş oluşturuldu', siparisNo.trim())
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Sipariş Düzenle' : 'Yeni Sipariş'}</h2>
        {error && <div className="mb-3 p-2 bg-red/10 border border-red/25 rounded text-xs text-red">{error}</div>}
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Sipariş No *</label>
          <input value={siparisNo} onChange={e => setSiparisNo(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Müşteri</label>
          {(() => {
            const { customers, orders: allOrders } = useStore.getState()
            const musteriSet = new Set([...customers.map(c => c.ad || c.kod), ...allOrders.map(o => o.musteri)].filter(Boolean))
            const opts = [...musteriSet].sort((a, b) => a.localeCompare(b, 'tr')).map(m => ({ value: m, label: m }))
            return <SearchSelect options={opts} value={musteri} onChange={(v) => setMusteri(v)} placeholder="Müşteri ara veya yaz..." allowNew />
          })()}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Termin *</label>
            <input type="date" value={termin} onChange={e => setTermin(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Adet</label>
            <input type="number" min={1} value={adet} onChange={e => setAdet(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Reçete</label>
          <select value={receteId} onChange={e => setReceteId(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
            <option value="">— Seçin —</option>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.mamulKod || r.ad} — {r.mamulAd || r.ad}</option>)}
          </select></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
          <input value={not_} onChange={e => setNot(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" placeholder="Opsiyonel..." /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold">{saving ? 'Kaydediliyor...' : initial ? 'Güncelle' : 'Oluştur'}</button>
        </div>
      </div>
    </div>
  )
}

function OrderDetailModal({ order, workOrders, logs, onClose }: { order: Order; workOrders: { id: string; ieNo: string; malad: string; malkod: string; opAd: string; hedef: number }[]; logs: { woId: string; qty: number; tarih: string; fire: number; operatorlar: { ad: string }[] }[]; onClose: () => void }) {
  const { recipes, stokHareketler, tedarikler, cuttingPlans: cp, materials: mats, orders: allOrders, workOrders: allWOs, loadAll } = useStore()
  const [tab, setTab] = useState<'ie'|'mrp'>('ie')
  const [mrpRows, setMrpRows] = useState<ReturnType<typeof hesaplaMRP>>([])
  const [mrpDone, setMrpDone] = useState(false)

  async function runMRP() {
    const rc = recipes.find(r => r.id === order.receteId)
    if (!rc) { toast.error('Reçete bulunamadı'); return }
    const cpMapped = cp.map((p: any) => ({ hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '', gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [] }))
    const rows = hesaplaMRP([order.id], allOrders as any, allWOs, recipes, stokHareketler, tedarikler, cpMapped, mats)
    setMrpRows(rows); setMrpDone(true); setTab('mrp')
    await supabase.from('uys_orders').update({ mrp_durum: 'tamamlandi' }).eq('id', order.id)
    loadAll()
    toast.success(rows.length + ' malzeme hesaplandı')
  }

  async function createTedarik() {
    const count = await mrpTedarikOlustur(order.id, order.siparisNo, mrpRows)
    if (count > 0) { loadAll(); toast.success(count + ' tedarik kaydı oluşturuldu') }
    else toast.info('Tüm ihtiyaçlar karşılanmış')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div><h2 className="text-lg font-semibold">{order.siparisNo}</h2><p className="text-xs text-zinc-500">{order.musteri} · {order.tarih}</p></div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-bg-2 border border-border rounded-lg p-3"><div className="text-[10px] text-zinc-500">Ürün</div><div className="text-sm font-medium truncate">{order.mamulAd || '—'}</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-3"><div className="text-[10px] text-zinc-500">Adet</div><div className="text-sm font-mono">{order.adet}</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-3"><div className="text-[10px] text-zinc-500">Termin</div><div className={`text-sm font-mono ${order.termin && order.termin < today() ? 'text-red' : ''}`}>{order.termin}</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-3"><div className="text-[10px] text-zinc-500">Not</div><div className="text-sm truncate">{order.not || '—'}</div></div>
        </div>

        <div className="flex gap-1 mb-3">
          <select value={tab} onChange={e => { const v = e.target.value as 'ie'|'mrp'; if (v === 'mrp' && !mrpDone) runMRP(); setTab(v) }} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
            <option value="ie">İş Emirleri ({workOrders.length})</option>
            <option value="mrp">MRP {mrpDone ? `(${mrpRows.length})` : ''}</option>
          </select>
          <span className="flex-1" />
          {order.receteId && <button onClick={async () => {
            if (!await showConfirm('Mevcut İE\'ler silinip reçeteden yeniden oluşturulacak. Devam?')) return
            // Mevcut İE'leri sil
            for (const w of workOrders) { await supabase.from('uys_work_orders').delete().eq('id', w.id) }
            // Yeniden oluştur
            const { recipes: fullRecipes } = useStore.getState()
            const count = await buildWorkOrders(order.id, order.siparisNo, order.receteId, order.adet, fullRecipes)
            loadAll(); toast.success(count + ' İE yeniden oluşturuldu')
          }} className="px-3 py-1.5 bg-amber/10 text-amber rounded-lg text-xs hover:bg-amber/20">⛓ Yeniden Çalıştır</button>}
          {order.receteId && <button onClick={async () => {
            const { recipes: fullRecipes } = useStore.getState()
            const rc = fullRecipes.find(r => r.id === order.receteId)
            if (!rc) { toast.error('Reçete bulunamadı'); return }
            // Mevcut İE'lerin malkod listesi
            const mevcutKodlar = new Set(workOrders.map(w => w.malkod))
            const eksikSatirlar = (rc.satirlar || []).filter(s => !mevcutKodlar.has(s.malkod))
            if (!eksikSatirlar.length) { toast.info('Eksik İE yok — tüm bileşenler mevcut'); return }
            const count = await buildWorkOrders(order.id, order.siparisNo, order.receteId, order.adet, fullRecipes)
            loadAll(); toast.success(count + ' eksik İE oluşturuldu')
          }} className="px-3 py-1.5 bg-green/10 text-green rounded-lg text-xs hover:bg-green/20">+ Eksik İE Tamamla</button>}
          {order.receteId && <TamZincirButton order={order} workOrders={workOrders} loadAll={loadAll} onClose={onClose} />}
        </div>

        {tab === 'ie' && (
          <>
          {workOrders.length ? (
            <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">İE No</th><th className="text-left px-3 py-2">Ürün</th><th className="text-left px-3 py-2">Operasyon</th><th className="text-right px-3 py-2">Hedef</th><th className="text-right px-3 py-2">Üretilen</th><th className="text-right px-3 py-2">%</th></tr></thead>
            <tbody>
              {workOrders.map(w => {
                const woLogs = logs.filter(l => l.woId === w.id)
                const prod = woLogs.reduce((a, l) => a + l.qty, 0)
                const pct = w.hedef > 0 ? Math.min(100, Math.round(prod / w.hedef * 100)) : 0
                return (
                  <tr key={w.id} className="border-b border-border/50">
                    <td className="px-3 py-1.5 font-mono text-accent">{w.ieNo}</td>
                    <td className="px-3 py-1.5 text-zinc-300">{w.malad}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{w.opAd}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{w.hedef}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-green">{prod}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-semibold ${pctColor(pct)}`}>{pct}%</td>
                  </tr>
                )
              })}
            </tbody></table>
          ) : <div className="p-4 text-center text-zinc-600 text-xs">İş emri yok — reçete atanmış mı?</div>}
          </>
        )}

        {tab === 'mrp' && (
          <>
          {mrpRows.length ? (
            <>
            <div className="flex items-center gap-3 mb-3 text-xs">
              <div className="px-2 py-1 bg-red/10 text-red rounded font-semibold">⚠ {mrpRows.filter(r => r.net > 0).length} eksik</div>
              <div className="px-2 py-1 bg-green/10 text-green rounded font-semibold">✓ {mrpRows.filter(r => r.net <= 0).length} yeterli</div>
              <span className="flex-1" />
              <button onClick={() => {
                import('xlsx').then(XLSX => {
                  const rows = mrpRows.map(r => ({ 'Malzeme Kodu': r.malkod, 'Malzeme Adı': r.malad, 'Tip': r.tip, 'Birim': r.birim || 'Adet', 'Brüt İhtiyaç': r.brut, 'Stok': r.stok, 'Açık Tedarik': r.acikTedarik, 'Net İhtiyaç': r.net, 'Durum': r.net > 0 ? 'Eksik' : 'Yeterli' }))
                  const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'MRP'); XLSX.writeFile(wb, `mrp_${order.siparisNo}_${today()}.xlsx`)
                })
              }} className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">📥 Excel</button>
            </div>
            <table className="w-full text-xs mb-3"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Malzeme Kodu</th><th className="text-left px-3 py-2">Malzeme Adı</th><th className="text-left px-3 py-2">Tip</th><th className="text-right px-3 py-2">Brüt</th><th className="text-right px-3 py-2">Stok</th><th className="text-right px-3 py-2">Açık Ted.</th><th className="text-right px-3 py-2 font-semibold">Net</th><th className="text-left px-3 py-2">Durum</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {mrpRows.map(r => (
                <tr key={r.malkod} className={`border-b border-border/30 ${r.net > 0 ? 'bg-red/5' : ''}`}>
                  <td className="px-3 py-1.5 font-mono text-accent text-[11px]">{r.malkod}</td>
                  <td className="px-3 py-1.5 text-zinc-300">{r.malad}</td>
                  <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 bg-bg-3 rounded text-[10px]">{r.tip}</span></td>
                  <td className="px-3 py-1.5 text-right font-mono">{r.brut}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-green">{r.stok}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{r.acikTedarik}</td>
                  <td className={`px-3 py-1.5 text-right font-mono font-semibold ${r.net > 0 ? 'text-red' : 'text-green'}`}>{r.net}</td>
                  <td className="px-3 py-1.5"><span className={`text-[10px] font-semibold ${r.net > 0 ? 'text-red' : 'text-green'}`}>{r.net > 0 ? '⚠ Eksik' : '✓ Yeterli'}</span></td>
                  <td className="px-3 py-1.5">{r.net > 0 && <button onClick={async () => {
                    await supabase.from('uys_tedarikler').insert({ id: uid(), malkod: r.malkod, malad: r.malad, miktar: Math.ceil(r.net), birim: r.birim || 'Adet', tarih: today(), durum: 'bekliyor', geldi: false, siparis_no: order.siparisNo, order_id: order.id })
                    loadAll(); toast.success(r.malkod + ' tedarik oluşturuldu')
                  }} className="text-amber text-[10px] hover:underline">+ Tedarik</button>}</td>
                </tr>
              ))}
            </tbody></table>
            {mrpRows.some(r => r.net > 0) && (
              <button onClick={createTedarik} className="px-4 py-2 bg-amber hover:bg-amber/80 text-black rounded-lg text-xs font-semibold">
                📦 Toplu Tedarik Oluştur ({mrpRows.filter(r => r.net > 0).length} kalem)
              </button>
            )}
            {!mrpRows.some(r => r.net > 0) && (
              <div className="p-3 bg-green/5 border border-green/20 rounded-lg text-xs text-green">✅ Tüm malzeme ihtiyaçları karşılanmış</div>
            )}
            </>
          ) : (
            <div className="p-4 text-center">
              {order.receteId ? (
                <button onClick={runMRP} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Calculator size={13} className="inline mr-1" /> MRP Hesapla</button>
              ) : (
                <div className="text-zinc-600 text-xs">Bu siparişe reçete atanmamış — MRP hesaplanamaz</div>
              )}
            </div>
          )}
          </>
        )}
      </div>
    </div>
  )
}

function TamZincirButton({ order, workOrders, loadAll, onClose }: { order: Order; workOrders: any[]; loadAll: () => void; onClose: () => void }) {
  const [running, setRunning] = useState(false)
  const [adimlar, setAdimlar] = useState<string[]>([])
  const [sonuc, setSonuc] = useState<{ woCount: number; kesimCount: number; mrpCount: number; tedCount: number; eksikler: any[] } | null>(null)

  async function run() {
    if (!await showConfirm('Tam Zincir: İE → Kesim Planı → MRP → Tedarik çalıştırılacak. Devam?')) return
    setRunning(true)
    setAdimlar(['⏳ İş emirleri kontrol ediliyor...'])
    try {
      const s = useStore.getState()
      const woCount = workOrders.length || (await buildWorkOrders(order.id, order.siparisNo, order.receteId, order.adet, s.recipes))
      setAdimlar(['✅ ' + woCount + ' iş emri hazır'])

      const cpMapped = s.cuttingPlans.map((p: any) => ({ id: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, hamBoy: p.hamBoy, hamEn: p.hamEn || 0, kesimTip: p.kesimTip || 'boy', durum: p.durum || '', tarih: p.tarih || '', satirlar: p.satirlar || [], gerekliAdet: p.gerekliAdet || 0 }))
      const result = await autoZincir(
        order.id, woCount,
        s.orders as any, s.workOrders, s.recipes, s.operations as any,
        s.materials, s.stokHareketler, s.tedarikler,
        s.logs.map(l => ({ woId: l.woId, qty: l.qty })),
        cpMapped,
        (steps) => setAdimlar([...steps])
      )
      setSonuc(result)
      loadAll()
    } catch (e: any) {
      setAdimlar(prev => [...prev, '❌ Hata: ' + e.message])
    }
  }

  if (!running) {
    return <button onClick={run} className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20">⚙ Tam Zincir</button>
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={sonuc ? () => { setRunning(false); setSonuc(null) } : undefined}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">⚙ Sipariş Zinciri</h3>
        <div className="text-xs text-zinc-500 mb-4">{order.siparisNo} · {order.musteri}</div>

        {/* Adımlar */}
        <div className="space-y-2 mb-4">
          {adimlar.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span>{a.startsWith('✅') ? '✅' : a.startsWith('⚠') ? '⚠️' : a.startsWith('❌') ? '❌' : a.startsWith('ℹ') ? 'ℹ️' : '⏳'}</span>
              <span className="text-zinc-300">{a.replace(/^[✅⚠️❌ℹ️⏳]\s*/, '')}</span>
            </div>
          ))}
          {!sonuc && <div className="flex items-center gap-2 text-xs text-zinc-500"><span className="animate-spin">⏳</span> Çalışıyor...</div>}
        </div>

        {/* Sonuç */}
        {sonuc && (
          <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-accent/10 rounded-lg p-3 text-center"><div className="text-lg font-mono text-accent">{sonuc.woCount}</div><div className="text-[9px] text-zinc-500">İE</div></div>
            <div className="bg-green/10 rounded-lg p-3 text-center"><div className="text-lg font-mono text-green">{sonuc.kesimCount}</div><div className="text-[9px] text-zinc-500">Kesim</div></div>
            <div className="bg-cyan-500/10 rounded-lg p-3 text-center"><div className="text-lg font-mono text-cyan-400">{sonuc.mrpCount}</div><div className="text-[9px] text-zinc-500">MRP</div></div>
            <div className={`${sonuc.tedCount > 0 ? 'bg-amber/10' : 'bg-green/10'} rounded-lg p-3 text-center`}><div className={`text-lg font-mono ${sonuc.tedCount > 0 ? 'text-amber' : 'text-green'}`}>{sonuc.tedCount}</div><div className="text-[9px] text-zinc-500">Tedarik</div></div>
          </div>
          {sonuc.eksikler.length > 0 && (
            <div className="mb-4 max-h-[150px] overflow-y-auto">
              <div className="text-[10px] text-red font-semibold mb-1">Eksik Malzemeler ({sonuc.eksikler.length})</div>
              <table className="w-full text-[10px]"><thead><tr className="text-zinc-600"><th className="text-left">Kod</th><th className="text-left">Malzeme</th><th className="text-right">İhtiyaç</th><th className="text-right">Stok</th><th className="text-right font-semibold">Eksik</th></tr></thead>
              <tbody>{sonuc.eksikler.slice(0, 15).map((e, i) => (
                <tr key={i}><td className="font-mono text-accent">{e.malkod}</td><td className="text-zinc-400 truncate max-w-[120px]">{e.malad}</td><td className="text-right font-mono">{e.brut}</td><td className="text-right font-mono text-green">{Math.round(e.stok)}</td><td className="text-right font-mono text-red font-semibold">{e.net}</td></tr>
              ))}</tbody></table>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setRunning(false); setSonuc(null) }} className="flex-1 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">Kapat</button>
            <button onClick={() => { setRunning(false); setSonuc(null); window.location.hash = '#/mrp' }} className="px-3 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs">📊 MRP</button>
            <button onClick={() => { setRunning(false); setSonuc(null); window.location.hash = '#/cutting' }} className="px-3 py-2 bg-green/10 text-green rounded-lg text-xs">✂ Kesim</button>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
