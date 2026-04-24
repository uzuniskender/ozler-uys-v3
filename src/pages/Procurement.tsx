import { useAuth } from '@/hooks/useAuth'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { MaterialSearchModal } from '@/components/MaterialSearchModal'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Search, Plus, Pencil, Trash2, Check, Download, Upload, X, ChevronDown } from 'lucide-react'
import { markTedarikGeldi, markTedarikGelmedi, tedarikStokId } from '@/lib/tedarikHelpers'
import { FlowProgress } from '@/components/FlowProgress'

export function Procurement() {
  const { tedarikler, tedarikciler, orders, pendingFlows, loadAll } = useStore()
  const { can } = useAuth()
  const [searchParams] = useSearchParams()
  const activeFlowId = searchParams.get('flow') || ''
  // v15.36 — Bu flow tamamlanmış mı? (Procurement'a tedarik sonrası yönlenildi)
  const tamamlananFlow = activeFlowId
    ? pendingFlows.find(f => f.id === activeFlowId && f.durum === 'tamamlandi')
    : null
  const [search, setSearch] = useState('')
  const [durumFilter, setDurumFilter] = useState('bekliyor')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<typeof tedarikler[0] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
    const ted = tedarikler.find(t => t.id === id)
    if (!ted) return
    await markTedarikGeldi(ted)
    loadAll(); toast.success('Tedarik geldi + stok girişi yapıldı: ' + ted.malkod + ' × ' + ted.miktar)
  }

  async function markGelmedi(id: string) {
    const ted = tedarikler.find(t => t.id === id)
    if (!ted) return
    if (!await showConfirm(`"${ted.malkod}" tedariki bekliyor durumuna dönecek, stok girişi silinecek. Devam?`)) return
    await markTedarikGelmedi(id)
    loadAll(); toast.success('Tedarik bekliyor durumuna alındı, stok girişi silindi')
  }

  async function markGeldiBulk() {
    const bekleyenler = [...selectedIds].map(id => tedarikler.find(t => t.id === id)).filter(t => t && !t.geldi) as typeof tedarikler
    if (!bekleyenler.length) { toast.info('Seçili bekleyen tedarik yok'); return }
    if (!await showConfirm(`${bekleyenler.length} tedarik "geldi" olarak işaretlenecek ve stok girişleri yapılacak. Devam?`)) return
    for (const ted of bekleyenler) {
      await markTedarikGeldi(ted)
    }
    setSelectedIds(new Set())
    loadAll(); toast.success(`${bekleyenler.length} tedarik geldi + stok girişi yapıldı`)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function toggleSelectAll() {
    const bekleyenIds = filtered.filter(t => !t.geldi).map(t => t.id)
    if (selectedIds.size === bekleyenIds.length && bekleyenIds.every(id => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(bekleyenIds))
    }
  }

  async function del(id: string) {
    const ted = tedarikler.find(t => t.id === id)
    const wasGeldi = ted?.geldi
    const msg = wasGeldi
      ? 'Bu tedarik "geldi" durumda. Silinirse stok girişi de silinecek. Devam?'
      : 'Silmek istediğinize emin misiniz?'
    if (!await showConfirm(msg)) return
    // Silinen tedarikin order_id'sini DB'den al (state kirli olabilir)
    const { data: tedRow } = await supabase.from('uys_tedarikler').select('order_id').eq('id', id).maybeSingle()
    const orderId = (tedRow as { order_id?: string } | null)?.order_id
    // Geldi ise ilgili stok hareketini de sil
    if (wasGeldi) {
      await supabase.from('uys_stok_hareketler').delete().eq('id', tedarikStokId(id))
    }
    await supabase.from('uys_tedarikler').delete().eq('id', id)
    if (orderId) {
      await supabase.from('uys_orders').update({ mrp_durum: 'bekliyor' }).eq('id', orderId)
      console.log('[del] sipariş bekliyor:', orderId)
    } else {
      console.log('[del] tedarikin order_id yok, sipariş güncellenmedi')
    }
    loadAll(); toast.success(wasGeldi ? 'Tedarik + stok girişi silindi' : 'Tedarik silindi')
  }

  async function save(data: Record<string, unknown>, editId?: string) {
    // Geldi toggle değişimi yakala — edit modundaysa eski state ile karşılaştır
    const oncekiTed = editId ? tedarikler.find(t => t.id === editId) : null
    const yeniGeldi = !!data.geldi
    const eskiGeldi = !!oncekiTed?.geldi

    if (editId) await supabase.from('uys_tedarikler').update(data).eq('id', editId)
    else await supabase.from('uys_tedarikler').insert({ id: uid(), ...data })

    // Geldi → true olduysa stok hareketi yaz
    if (editId && yeniGeldi && !eskiGeldi) {
      const tedarikFull = {
        id: editId,
        malkod: String(data.malkod || oncekiTed?.malkod || ''),
        malad: String(data.malad || oncekiTed?.malad || ''),
        miktar: Number(data.miktar || oncekiTed?.miktar || 0),
        siparisNo: String(data.siparis_no || oncekiTed?.siparisNo || ''),
        tedarikcAd: String(data.tedarikci_ad || oncekiTed?.tedarikcAd || ''),
      }
      await markTedarikGeldi(tedarikFull)
    }
    // Geldi → false olduysa stok hareketini sil
    if (editId && !yeniGeldi && eskiGeldi) {
      await markTedarikGelmedi(editId)
    }

    loadAll(); setShowForm(false); setEditItem(null)
    toast.success(editId ? 'Güncellendi' : 'Eklendi')
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(t => ({ 'Malzeme Kod': t.malkod, 'Malzeme': t.malad, 'Miktar': t.miktar, 'Birim': t.birim, 'Sipariş': t.siparisNo, 'Tedarikçi': t.tedarikcAd, 'Durum': t.geldi ? 'Geldi' : 'Bekliyor', 'Tarih': t.tarih, 'Teslim': t.teslimTarihi }))
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Tedarikler'); XLSX.writeFile(wb, `tedarikler_${today()}.xlsx`)
    })
  }

  // Excel import — v2 tedarikExcelYukle portu
  async function importExcel() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.xlsx,.xls,.csv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf); const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[]
      if (!rows.length) { toast.error('Dosya boş'); return }
      let count = 0
      const { materials: mats } = useStore.getState()
      for (const row of rows) {
        const malkod = String(row['Malzeme Kodu'] || row['malkod'] || row['Malzeme Kod'] || '').trim(); if (!malkod) continue
        const miktar = parseFloat(String(row['Sipariş Miktarı'] || row['Miktar'] || row['miktar'] || '0')); if (!miktar) continue
        const mat = mats.find(m => m.kod === malkod)
        const malad = String(row['Malzeme Adı'] || row['malad'] || row['Malzeme'] || mat?.ad || malkod)
        const teslim = String(row['Beklenen Tarih'] || row['Teslim'] || row['teslim'] || '').trim()
        const tedAd = String(row['Tedarikçi'] || row['Tedarikci'] || row['tedarikci'] || '').trim()
        await supabase.from('uys_tedarikler').insert({
          id: uid(), malkod, malad, miktar, birim: String(row['Birim'] || mat?.birim || 'Adet'),
          teslim_tarihi: teslim, tedarikci_ad: tedAd,
          tarih: today(), durum: 'bekliyor', geldi: false, not_: 'Excel import',
        })
        count++
      }
      loadAll(); toast.success(count + ' tedarik yüklendi')
    }
    input.click()
  }

  const toplamBekleyen = tedarikler.filter(t => !t.geldi).length

  return (
    <div>
      {/* v15.36 — Akış tamamlandı banner'ı */}
      {tamamlananFlow && (
        <div className="mb-4 p-3 bg-green/10 border border-green/30 rounded-lg">
          <div className="text-xs">
            <span className="font-semibold text-green">✓ Akış tamamlandı</span>
            <span className="ml-2 text-zinc-300">
              {tamamlananFlow.stateData.baslik} — oluşan tedarikler aşağıda. Tedarik geldiğinde "Geldi" ile işaretle, stok hareketi otomatik oluşur.
            </span>
          </div>
        </div>
      )}

      {/* Aktif flow varsa progress (nadiren — tedarik adımı genelde MRP'de çözülür) */}
      {activeFlowId && !tamamlananFlow && (
        <FlowProgress flowId={activeFlowId} current="tedarik" />
      )}

      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Tedarik Yönetimi</h1><p className="text-xs text-zinc-500">{tedarikler.length} kayıt · {toplamBekleyen} bekleyen</p></div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && can('ted_geldi') && (
            <button onClick={markGeldiBulk}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green/10 border border-green/25 text-green rounded-lg text-xs font-semibold hover:bg-green/20 transition-colors">
              <Check size={13} /> {selectedIds.size} Kaydı Geldi İşaretle
            </button>
          )}
          {selectedIds.size > 0 && (
            <button onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1 px-2 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"
              title="Seçimi temizle">
              <X size={12} />
            </button>
          )}
          <button onClick={importExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Upload size={13} /> Excel Yükle</button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          {can('ted_add') && <button onClick={async () => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Tedarik</button>}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Malzeme veya sipariş ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>
        <div className="flex gap-3 items-center">
          {[
            { id: 'all', label: 'Tümü', color: 'text-zinc-400' },
            { id: 'bekliyor', label: 'Bekleyen', color: 'text-amber' },
            { id: 'geldi', label: 'Teslim Alınan', color: 'text-green' },
          ].map(s => (
            <label key={s.id} className={`flex items-center gap-1 text-xs cursor-pointer ${durumFilter === s.id ? s.color : 'text-zinc-600'}`}>
              <input type="radio" name="durumFilter" checked={durumFilter === s.id} onChange={() => setDurumFilter(s.id)} className="accent-accent" />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
        {filtered.length ? (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2 z-10"><tr className="border-b border-border text-zinc-500">
              <th className="w-8 px-3 py-2.5">
                {can('ted_geldi') && filtered.some(t => !t.geldi) && (
                  <input type="checkbox"
                    checked={filtered.filter(t => !t.geldi).length > 0 && filtered.filter(t => !t.geldi).every(t => selectedIds.has(t.id))}
                    onChange={toggleSelectAll}
                    className="accent-accent"
                    title="Bekleyen tüm tedarikleri seç/bırak"
                  />
                )}
              </th>
              <th className="text-left px-4 py-2.5">Malzeme</th><th className="text-right px-4 py-2.5">Miktar</th><th className="text-left px-4 py-2.5">Sipariş</th><th className="text-left px-4 py-2.5">Tedarikçi</th><th className="text-left px-4 py-2.5">Teslim</th><th className="text-left px-4 py-2.5">Durum</th><th className="px-4 py-2.5"></th>
            </tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className={`border-b border-border/30 hover:bg-bg-3/30 ${t.geldi ? 'opacity-60' : ''} ${selectedIds.has(t.id) ? 'bg-accent/5' : ''}`}>
                  <td className="px-3 py-2">
                    {can('ted_geldi') && !t.geldi && (
                      <input type="checkbox" checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="accent-accent" />
                    )}
                  </td>
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
                      {can('ted_geldi') && !t.geldi && <button onClick={() => markGeldi(t.id)} className="p-1 text-zinc-500 hover:text-green" title="Geldi işaretle (stok girişi yazılır)"><Check size={12} /></button>}
                      {can('ted_geldi') && t.geldi && <button onClick={() => markGelmedi(t.id)} className="p-1 text-zinc-500 hover:text-amber" title="Geri al (stok girişi silinir)"><ChevronDown size={12} className="rotate-180" /></button>}
                      {can('ted_edit') && <button onClick={async () => { setEditItem(t); setShowForm(true) }} className="p-1 text-zinc-500 hover:text-accent" title="Düzenle"><Pencil size={12} /></button>}
                      {can('ted_delete') && <button onClick={() => del(t.id)} className="p-1 text-zinc-500 hover:text-red" title="Sil"><Trash2 size={12} /></button>}
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
  const [geldi, setGeldi] = useState(!!(initial as Record<string, unknown>)?.geldi)
  const { materials } = useStore()
  const [showMatSearch, setShowMatSearch] = useState(false)

  const ted = tedarikciler.find(t => t.id === tedarikcId)
  const ord = orders.find(o => o.id === orderId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Tedarik Düzenle' : 'Yeni Tedarik'}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Kodu *</label>
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <SearchSelect options={materials.map(m => ({ value: m.kod, label: m.kod, sub: m.ad }))} value={malkod} onChange={(v, l) => { setMalkod(v); if (!malad) setMalad(materials.find(m => m.kod === v)?.ad || l) }} placeholder="Malzeme kodu ara..." />
                </div>
                <button type="button" onClick={() => setShowMatSearch(true)} title="Detaylı arama (ölçü filtreli)"
                  className="w-8 h-8 flex items-center justify-center rounded bg-bg-3 border border-border/50 text-zinc-400 hover:text-accent hover:border-accent/50 shrink-0">
                  <Search size={12} />
                </button>
              </div>
            </div>
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
          {/* Düzenlemede "Geldi" toggle — formdan açıp kapatabilir */}
          {initial && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-bg-3/50 border border-border rounded-lg">
              <input type="checkbox" id="ted-geldi-toggle" checked={geldi} onChange={e => setGeldi(e.target.checked)} className="accent-accent w-4 h-4" />
              <label htmlFor="ted-geldi-toggle" className="flex-1 text-xs text-zinc-300 cursor-pointer">
                <span className="font-semibold">Geldi olarak işaretle</span>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {geldi && !((initial as Record<string, unknown>)?.geldi)
                    ? '⚠ Kaydettiğinde stok girişi otomatik yazılacak'
                    : !geldi && ((initial as Record<string, unknown>)?.geldi)
                    ? '⚠ Kaydettiğinde stok girişi otomatik silinecek'
                    : geldi ? 'Durum: geldi · stok girişi mevcut' : 'Durum: bekliyor'}
                </div>
              </label>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={async () => {
            if (!malkod || !miktar) { toast.error('Malzeme kodu ve miktar zorunlu'); return }
            onSave({
              malkod, malad, miktar: parseFloat(miktar), birim,
              tedarikci_id: tedarikcId, tedarikci_ad: ted?.ad || '',
              order_id: orderId, siparis_no: ord?.siparisNo || '',
              teslim_tarihi: teslim,
              durum: geldi ? 'geldi' : 'bekliyor',
              geldi, tarih: today(), not_: not_,
            }, (initial as Record<string, unknown>)?.id as string)
          }} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
      {showMatSearch && (
        <MaterialSearchModal
          materials={materials}
          title="Malzeme Ara — Ölçü Filtreli"
          onSelect={(mat) => { setMalkod(mat.kod); if (!malad) setMalad(mat.ad); setShowMatSearch(false) }}
          onClose={() => setShowMatSearch(false)}
        />
      )}
    </div>
  )
}
