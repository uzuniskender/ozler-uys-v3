import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today, pctColor } from '@/lib/utils'
import { toast } from 'sonner'
import { Search, Download, Eye, CheckSquare, Plus } from 'lucide-react'

export function WorkOrders() {
  const { workOrders, logs, orders, operations, loadAll } = useStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [groupBy, setGroupBy] = useState('siparis')
  const [detailWO, setDetailWO] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showNewIE, setShowNewIE] = useState(false)

  function toggleSelect(id: string) { setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s }) }
  function selectAll() { setSelected(new Set(filtered.map(w => w.id))) }
  function selectNone() { setSelected(new Set()) }

  // #13: Toplu İE Güncelleme
  async function topluDurumGuncelle(durum: string) {
    if (!selected.size) return
    if (!confirm(`${selected.size} İE'nin durumu "${durum}" olarak güncellenecek. Devam?`)) return
    for (const id of selected) {
      await supabase.from('uys_work_orders').update({ durum }).eq('id', id)
    }
    setSelected(new Set()); loadAll(); toast.success(`${selected.size} İE güncellendi`)
  }

  async function topluSil() {
    if (!selected.size) return
    if (!confirm(`${selected.size} İE SİLİNECEK. Bu işlem geri alınamaz!`)) return
    for (const id of selected) {
      await supabase.from('uys_work_orders').delete().eq('id', id)
    }
    setSelected(new Set()); loadAll(); toast.success(`${selected.size} İE silindi`)
  }

  function wProd(woId: string): number { return logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0) }
  function wPct(w: { id: string; hedef: number }): number { return w.hedef > 0 ? Math.min(100, Math.round(wProd(w.id) / w.hedef * 100)) : 0 }

  const filtered = useMemo(() => {
    return workOrders.filter(w => {
      const pct = wPct(w)
      if (statusFilter === 'active' && pct >= 100) return false
      if (statusFilter === 'done' && pct < 100) return false
      if (search) {
        const q = search.toLowerCase(); const ord = orders.find(o => o.id === w.orderId)
        if (!(w.ieNo + w.malad + w.malkod + w.opAd + (ord?.siparisNo || '')).toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [workOrders, logs, search, statusFilter, orders])

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {}
    filtered.forEach(w => {
      const key = groupBy === 'siparis' ? (orders.find(o => o.id === w.orderId)?.siparisNo || 'Bağımsız') : (w.opAd || 'Tanımsız')
      if (!map[key]) map[key] = []; map[key].push(w)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [filtered, groupBy, orders])

  async function setDurum(id: string, durum: string) {
    await supabase.from('uys_work_orders').update({ durum }).eq('id', id)
    loadAll(); toast.success('Durum güncellendi: ' + durum)
  }

  async function updateHedef(id: string) {
    const val = prompt('Yeni hedef adet:')
    if (!val) return
    const hedef = parseInt(val)
    if (isNaN(hedef) || hedef < 0) return
    await supabase.from('uys_work_orders').update({ hedef }).eq('id', id)
    loadAll(); toast.success('Hedef güncellendi: ' + hedef)
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(w => {
        const ord = orders.find(o => o.id === w.orderId)
        return { 'İE No': w.ieNo, 'Sipariş': ord?.siparisNo || '', 'Malzeme': w.malad, 'Operasyon': w.opAd, 'Hedef': w.hedef, 'Üretilen': wProd(w.id), '%': wPct(w), 'Durum': w.durum || '' }
      })
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'İş Emirleri'); XLSX.writeFile(wb, `is_emirleri_${today()}.xlsx`)
    })
  }

  const detailW = detailWO ? workOrders.find(w => w.id === detailWO) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">İş Emirleri</h1><p className="text-xs text-zinc-500">{workOrders.length} toplam</p></div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          <button onClick={() => setShowNewIE(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni İE</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="İE no, malzeme veya operasyon ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="all">Tümü</option><option value="active">Açık</option><option value="done">Tamamlandı</option>
        </select>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="siparis">Siparişe Göre</option><option value="operasyon">Operasyona Göre</option>
        </select>
      </div>

      {/* Toplu İşlem Toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 p-2 bg-accent/5 border border-accent/20 rounded-lg flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-accent"><CheckSquare size={13} className="inline" /> {selected.size} seçili</span>
          <button onClick={() => topluDurumGuncelle('uretimde')} className="px-2 py-1 bg-accent/20 text-accent rounded text-[10px] hover:bg-accent/30">→ Üretimde</button>
          <button onClick={() => topluDurumGuncelle('tamamlandi')} className="px-2 py-1 bg-green/20 text-green rounded text-[10px] hover:bg-green/30">→ Tamamlandı</button>
          <button onClick={() => topluDurumGuncelle('iptal')} className="px-2 py-1 bg-red/10 text-red rounded text-[10px] hover:bg-red/20">→ İptal</button>
          <button onClick={topluSil} className="px-2 py-1 bg-red/10 text-red rounded text-[10px] hover:bg-red/20">Sil</button>
          <span className="flex-1" />
          <button onClick={selectAll} className="text-[10px] text-zinc-500 hover:text-white">Tümünü Seç</button>
          <button onClick={selectNone} className="text-[10px] text-zinc-500 hover:text-white">Seçimi Kaldır</button>
        </div>
      )}

      {grouped.map(([group, wos]) => (
        <div key={group} className="mb-4">
          <div className="px-3 py-1.5 bg-bg-3/50 border border-border rounded-t-lg text-[11px] font-semibold text-accent font-mono flex justify-between">
            <span>{group}</span><span className="text-zinc-500 font-normal">{wos.length} iş emri</span>
          </div>
          <div className="bg-bg-2 border border-border border-t-0 rounded-b-lg overflow-hidden">
            <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="px-2 py-2 w-6"><input type="checkbox" onChange={e => e.target.checked ? selectAll() : selectNone()} className="accent-accent" /></th><th className="text-left px-3 py-2">İE No</th><th className="text-left px-3 py-2">Malzeme</th><th className="text-left px-3 py-2">Operasyon</th><th className="text-right px-3 py-2">Hedef</th><th className="text-right px-3 py-2">Üretilen</th><th className="text-right px-3 py-2">%</th><th className="text-left px-3 py-2">Durum</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>
              {wos.map(w => {
                const prod = wProd(w.id); const pct = wPct(w)
                return (
                  <tr key={w.id} className="border-b border-border/30 hover:bg-bg-3/30">
                    <td className="px-2 py-1.5"><input type="checkbox" checked={selected.has(w.id)} onChange={() => toggleSelect(w.id)} className="accent-accent" /></td>
                    <td className="px-3 py-1.5 font-mono text-accent">{w.ieNo}</td>
                    <td className="px-3 py-1.5 text-zinc-300 max-w-[180px] truncate">{w.malad}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{w.opAd || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono cursor-pointer hover:text-accent" onClick={() => updateHedef(w.id)} title="Tıkla: hedef güncelle">{w.hedef}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-green">{prod}</td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-10 h-1 bg-bg-3 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${pct}%` }} /></div>
                        <span className={`font-mono text-[10px] ${pctColor(pct)}`}>{pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <select value={w.durum || 'bekliyor'} onChange={e => setDurum(w.id, e.target.value)}
                        className={`px-1.5 py-0.5 rounded text-[10px] bg-bg-3 border border-border ${w.durum === 'tamamlandi' ? 'text-green' : w.durum === 'iptal' ? 'text-red' : 'text-accent'}`}>
                        <option value="bekliyor">Bekliyor</option><option value="uretimde">Üretimde</option><option value="tamamlandi">Tamamlandı</option><option value="iptal">İptal</option>
                      </select>
                    </td>
                    <td className="px-3 py-1.5 text-right"><button onClick={() => setDetailWO(w.id)} className="p-1 text-zinc-500 hover:text-accent"><Eye size={12} /></button></td>
                  </tr>
                )
              })}
            </tbody></table>
          </div>
        </div>
      ))}
      {!grouped.length && <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-zinc-600 text-sm">İş emri bulunamadı</div>}

      {detailW && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDetailWO(null)}>
          <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <div><h2 className="text-lg font-semibold">{detailW.ieNo}</h2><p className="text-xs text-zinc-500">{detailW.malad} · {detailW.opAd}</p></div>
              <button onClick={() => setDetailWO(null)} className="text-zinc-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="grid grid-cols-5 gap-3 mb-4">
              <div className="bg-bg-2 border border-border rounded-lg p-3"><div className="text-[10px] text-zinc-500">Hedef</div><div className="text-sm font-mono">{detailW.hedef}</div></div>
              <div className="bg-bg-2 border border-border rounded-lg p-3"><div className="text-[10px] text-zinc-500">Üretilen</div><div className="text-sm font-mono text-green">{wProd(detailW.id)}</div></div>
              <div className="bg-bg-2 border border-border rounded-lg p-3"><div className="text-[10px] text-zinc-500">Kalan</div><div className="text-sm font-mono text-amber">{Math.max(0, detailW.hedef - wProd(detailW.id))}</div></div>
              <div className="bg-bg-2 border border-border rounded-lg p-3"><div className="text-[10px] text-zinc-500">İlerleme</div><div className={`text-sm font-mono font-semibold ${pctColor(wPct(detailW))}`}>{wPct(detailW)}%</div></div>
              {(() => {
                const woLogs = logs.filter(l => l.woId === detailW.id)
                const gunler = new Set(woLogs.map(l => l.tarih))
                const gunlukOrt = gunler.size > 0 ? Math.round(wProd(detailW.id) / gunler.size) : 0
                const kalan = Math.max(0, detailW.hedef - wProd(detailW.id))
                const tahminiGun = gunlukOrt > 0 ? Math.ceil(kalan / gunlukOrt) : 0
                return (
                  <div className="bg-bg-2 border border-border rounded-lg p-3"><div className="text-[10px] text-zinc-500">Tahmini Bitiş</div><div className="text-sm font-mono text-accent">{kalan <= 0 ? '✅' : tahminiGun > 0 ? tahminiGun + ' gün' : '—'}</div></div>
                )
              })()}
            </div>
            {detailW.hm?.length > 0 && (
              <><h3 className="text-sm font-semibold mb-2">Hammadde Bileşenleri</h3>
              <div className="bg-bg-2 border border-border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Malzeme</th><th className="text-right px-3 py-2">Toplam İhtiyaç</th></tr></thead>
                <tbody>{detailW.hm.map((h, i) => (<tr key={i} className="border-b border-border/30"><td className="px-3 py-1.5"><span className="font-mono text-accent text-[11px]">{h.malkod}</span> {h.malad}</td><td className="px-3 py-1.5 text-right font-mono">{h.miktarTotal}</td></tr>))}</tbody>
                </table>
              </div></>
            )}
            <h3 className="text-sm font-semibold mb-2">Üretim Logları</h3>
            {(() => { const woLogs = logs.filter(l => l.woId === detailW.id).sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '')); return woLogs.length ? (
              <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Tarih</th><th className="text-left px-3 py-2">Operatör</th><th className="text-right px-3 py-2">Adet</th><th className="text-right px-3 py-2">Fire</th></tr></thead>
              <tbody>{woLogs.map((l, i) => (<tr key={i} className="border-b border-border/30"><td className="px-3 py-1.5 font-mono text-zinc-500">{l.tarih}</td><td className="px-3 py-1.5 text-zinc-300">{l.operatorlar?.map(o => o.ad).join(', ') || '—'}</td><td className="px-3 py-1.5 text-right font-mono text-green">+{l.qty}</td><td className="px-3 py-1.5 text-right font-mono text-red">{l.fire > 0 ? l.fire : ''}</td><td className="px-3 py-1.5 text-right"><button onClick={async () => { if (!confirm('Bu üretim logunu silmek istediğinize emin misiniz?')) return; await supabase.from('uys_logs').delete().eq('id', l.id); await supabase.from('uys_stok_hareketler').delete().eq('log_id', l.id); loadAll(); toast.success('Log silindi') }} className="text-zinc-600 hover:text-red text-[10px]">Sil</button></td></tr>))}</tbody></table>
            ) : <div className="text-zinc-600 text-xs p-3">Henüz üretim logu yok</div> })()}
          </div>
        </div>
      )}

      {showNewIE && <NewIEModal operations={operations} orders={orders} onClose={() => setShowNewIE(false)} onSaved={() => { setShowNewIE(false); loadAll(); toast.success('İş emri oluşturuldu') }} />}
    </div>
  )
}

// #33: Yeni İE (YM/bağımsız) oluşturma
function NewIEModal({ operations, orders, onClose, onSaved }: {
  operations: { id: string; kod: string; ad: string }[]
  orders: { id: string; siparisNo: string }[]
  onClose: () => void; onSaved: () => void
}) {
  const [malkod, setMalkod] = useState('')
  const [malad, setMalad] = useState('')
  const [hedef, setHedef] = useState('')
  const [opId, setOpId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [not_, setNot] = useState('')

  async function save() {
    if (!malad.trim() || !hedef) { toast.error('Malzeme adı ve hedef zorunlu'); return }
    const op = operations.find(o => o.id === opId)
    
    const ieNo = `IE-MANUAL-${Date.now().toString(36).toUpperCase()}`

    await supabase.from('uys_work_orders').insert({
      id: uid(), order_id: orderId || null, sira: 1, kirno: '1',
      op_id: opId || null, op_kod: op?.kod || '', op_ad: op?.ad || '',
      malkod: malkod.trim(), malad: malad.trim(), hedef: parseInt(hedef) || 0,
      mpm: 1, hm: [], ie_no: ieNo, durum: 'bekliyor',
      bagimsiz: !orderId, siparis_disi: !orderId,
      mamul_kod: malkod.trim(), mamul_ad: malad.trim(),
      not_: not_, olusturma: today(),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Yeni İş Emri</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Kodu</label>
            <input value={malkod} onChange={e => setMalkod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Hedef Adet *</label>
            <input type="number" min={1} value={hedef} onChange={e => setHedef(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Adı *</label>
          <input value={malad} onChange={e => setMalad(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Operasyon</label>
            <select value={opId} onChange={e => setOpId(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
              <option value="">— Seçin —</option>
              {operations.map(o => <option key={o.id} value={o.id}>{o.kod} — {o.ad}</option>)}
            </select></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Sipariş (opsiyonel)</label>
            <select value={orderId} onChange={e => setOrderId(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
              <option value="">— Bağımsız —</option>
              {orders.map(o => <option key={o.id} value={o.id}>{o.siparisNo}</option>)}
            </select></div>
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
