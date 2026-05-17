import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { showConfirm } from '@/lib/prompt'
import { useState, useMemo } from 'react'
import { useProductionStore, useOrderStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { Search, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

const operationSchema = z.object({
  kod: z.string().trim().min(1, 'Kod zorunlu'),
  ad: z.string().trim().min(1, 'Ad zorunlu'),
})

export function Operations() {
  const operations = useProductionStore(s => s.operations)
  const workOrders = useProductionStore(s => s.workOrders)
  const logs = useProductionStore(s => s.logs)
  const loadOwn = useProductionStore(s => s.loadOwn)
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<{ id: string; kod: string; ad: string } | null>(null)
  const [selectedOp, setSelectedOp] = useState<typeof operations[0] | null>(null)

  // İstatistik hesaplama: tek geçişte tüm operasyonlar için
  const opStats = useMemo(() => {
    const woByOp: Record<string, typeof workOrders> = {}
    const woOpId: Record<string, string> = {}
    for (const w of workOrders) {
      if (!woByOp[w.opId]) woByOp[w.opId] = []
      woByOp[w.opId].push(w)
      woOpId[w.id] = w.opId
    }
    const logByOp: Record<string, { qty: number; fire: number }> = {}
    for (const l of logs) {
      const opId = woOpId[l.woId]
      if (!opId) continue
      if (!logByOp[opId]) logByOp[opId] = { qty: 0, fire: 0 }
      logByOp[opId].qty += l.qty
      logByOp[opId].fire += l.fire
    }
    const result: Record<string, { totalIE: number; tamamlanan: number; avgIslemSure: number; fireOran: number; totalUretim: number; totalFire: number }> = {}
    for (const op of operations) {
      const opWOs = woByOp[op.id] || []
      const tamamlanan = opWOs.filter(w => w.durum === 'tamamlandi').length
      const sureler = opWOs.map(w => w.islemSure || 0).filter(s => s > 0)
      const avgIslemSure = sureler.length ? Math.round(sureler.reduce((a, b) => a + b, 0) / sureler.length) : 0
      const { qty: totalUretim = 0, fire: totalFire = 0 } = logByOp[op.id] || {}
      const fireOran = (totalUretim + totalFire) > 0 ? Math.round(totalFire / (totalUretim + totalFire) * 1000) / 10 : 0
      result[op.id] = { totalIE: opWOs.length, tamamlanan, avgIslemSure, fireOran, totalUretim, totalFire }
    }
    return result
  }, [operations, workOrders, logs])

  const filtered = useMemo(() => {
    if (!search) return operations
    const q = search.toLowerCase()
    return operations.filter(o => (o.kod + o.ad).toLowerCase().includes(q))
  }, [operations, search])

  async function save(kod: string, ad: string, bolum: string, editId?: string) {
    const parsed = operationSchema.safeParse({ kod, ad })
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }
    const kodN = parsed.data.kod
    const adN = parsed.data.ad
    const dupKod = operations.find(o => o.kod.trim().toLowerCase() === kodN.toLowerCase() && o.id !== editId)
    if (dupKod) { toast.error(`"${kodN}" kodu zaten kullanımda`); return }
    const dupAd = operations.find(o => o.ad.trim().toLowerCase() === adN.toLowerCase() && o.id !== editId)
    if (dupAd) { toast.error(`"${adN}" adı zaten kullanımda`); return }
    if (editId) await supabase.from('uys_operations').update({ kod: kodN, ad: adN, bolum }).eq('id', editId)
    else await supabase.from('uys_operations').insert({ id: uid(), kod: kodN, ad: adN, bolum })
    loadOwn(); setShowForm(false); setEditItem(null)
  }

  async function del(id: string) {
    if (!await showConfirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_operations').delete().eq('id', id); loadOwn()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Operasyonlar</h1><p className="text-xs text-zinc-500">{operations.length} operasyon</p></div>
        <div className="flex gap-2">
          <button onClick={async () => {
            const bos = operations.filter(o => !o.bolum)
            if (!bos.length) { toast.info('Tüm operasyonların bölümü zaten dolu'); return }
            // Akıllı bölüm çıkarma: son kelimeyi al (PRES, LAZER, TESTERE vb.)
            for (const o of bos) {
              const kelimeler = (o.ad || '').trim().split(/\s+/)
              const sonKelime = kelimeler[kelimeler.length - 1] || o.ad
              await supabase.from('uys_operations').update({ bolum: sonKelime }).eq('id', o.id)
            }
            loadOwn(); toast.success(bos.length + ' operasyonun bölümü güncellendi (son kelime → bölüm)')
          }} className="px-3 py-1.5 bg-amber/10 border border-amber/25 text-amber rounded-lg text-xs hover:bg-amber/20">🔄 Bölümleri Doldur</button>
          <button onClick={() => { import('xlsx').then(XLSX => {
            const rows = operations.map(o => ({ Kod: o.kod, Ad: o.ad, Bölüm: o.bolum || '' }))
            const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Operasyonlar'); XLSX.writeFile(wb, 'operasyonlar.xlsx')
          })}} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
          {can('op_add') && <button onClick={async () => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni</button>}
        </div>
      </div>
      <div className="relative max-w-xs mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Operasyon Adı</th><th className="text-left px-4 py-2.5">Bölüm</th><th className="text-right px-3 py-2.5" title="Toplam İş Emri">İE</th><th className="text-right px-3 py-2.5" title="Tamamlanan İE">Tamam</th><th className="text-right px-3 py-2.5" title="Ortalama işlem süresi (dk/adet)">dk/adet</th><th className="text-right px-3 py-2.5" title="Fire oranı">Fire %</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody>
            {filtered.map(o => {
              const s = opStats[o.id] || { totalIE: 0, tamamlanan: 0, avgIslemSure: 0, fireOran: 0, totalUretim: 0, totalFire: 0 }
              return (
                <tr key={o.id} className="border-b border-border/30 hover:bg-bg-3/30 cursor-pointer" onClick={e => { if ((e.target as HTMLElement).closest('button')) return; setSelectedOp(o) }}>
                  <td className="px-4 py-2 font-mono text-accent">{o.kod}</td>
                  <td className="px-4 py-2 text-zinc-300">{o.ad}</td>
                  <td className="px-4 py-2 text-zinc-500 text-[11px]">{o.bolum || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-[11px] text-zinc-400">{s.totalIE || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    {s.totalIE > 0 ? <span className={s.tamamlanan === s.totalIE ? 'text-green' : 'text-zinc-400'}>{s.tamamlanan}</span> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[11px] text-zinc-500">{s.avgIslemSure > 0 ? s.avgIslemSure : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-[11px]">
                    {(s.totalUretim + s.totalFire) > 0
                      ? <span className={s.fireOran >= 5 ? 'text-red font-semibold' : s.fireOran >= 2 ? 'text-amber' : 'text-green'}>{s.fireOran.toFixed(1)}%</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {can('op_edit') && <button onClick={async e => { e.stopPropagation(); setEditItem(o); setShowForm(true) }} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white mr-1">Düzenle</button>}
                    {can('op_delete') && <button onClick={e => { e.stopPropagation(); del(o.id) }} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {showForm && <SimpleFormModal title={editItem ? 'Düzenle' : 'Yeni Operasyon'} initial={editItem} onClose={() => { setShowForm(false); setEditItem(null) }} onSave={save} />}
      {selectedOp && (
        <OpDetailModal
          op={selectedOp}
          allWorkOrders={workOrders}
          allLogs={logs}
          stats={opStats[selectedOp.id] || { totalIE: 0, tamamlanan: 0, avgIslemSure: 0, fireOran: 0, totalUretim: 0, totalFire: 0 }}
          onClose={() => setSelectedOp(null)}
        />
      )}
    </div>
  )
}

function OpDetailModal({ op, allWorkOrders, allLogs, stats, onClose }: {
  op: { id: string; kod: string; ad: string; bolum?: string }
  allWorkOrders: { id: string; orderId: string; ieNo: string; malad: string; hedef: number; durum: string; islemSure: number; opId: string }[]
  allLogs: { woId: string; qty: number; fire: number }[]
  stats: { totalIE: number; tamamlanan: number; avgIslemSure: number; fireOran: number; totalUretim: number; totalFire: number }
  onClose: () => void
}) {
  const orders = useOrderStore(s => s.orders)
  const opWOs = useMemo(() =>
    allWorkOrders
      .filter(w => w.opId === op.id)
      .sort((a, b) => {
        const ord = ['uretimde', 'bekliyor', 'tamamlandi', 'iptal']
        return (ord.indexOf(a.durum) - ord.indexOf(b.durum)) || a.ieNo.localeCompare(b.ieNo)
      }),
    [allWorkOrders, op.id]
  )
  const woIdSet = useMemo(() => new Set(opWOs.map(w => w.id)), [opWOs])
  const woLogMap = useMemo(() => {
    const m: Record<string, { uretim: number; fire: number }> = {}
    for (const l of allLogs) {
      if (!woIdSet.has(l.woId)) continue
      if (!m[l.woId]) m[l.woId] = { uretim: 0, fire: 0 }
      m[l.woId].uretim += l.qty
      m[l.woId].fire += l.fire
    }
    return m
  }, [allLogs, woIdSet])

  function durumBadge(d: string) {
    if (d === 'tamamlandi') return 'bg-green/15 text-green'
    if (d === 'uretimde')   return 'bg-accent/15 text-accent'
    if (d === 'iptal')      return 'bg-red/15 text-red'
    return 'bg-zinc-700/30 text-zinc-400'
  }
  function durumLabel(d: string) {
    if (d === 'tamamlandi') return 'Tamamlandı'
    if (d === 'uretimde')   return 'Üretimde'
    if (d === 'iptal')      return 'İptal'
    return 'Bekliyor'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{op.kod} — {op.ad}</h2>
            {op.bolum && <p className="text-[11px] text-zinc-500 mt-0.5">{op.bolum}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        {/* İstatistik Kartları */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-bg-2 border border-border rounded-lg p-3 text-center">
            <div className="text-[10px] text-zinc-500 mb-1">Toplam İE</div>
            <div className="text-2xl font-mono font-semibold">{stats.totalIE}</div>
          </div>
          <div className="bg-bg-2 border border-border rounded-lg p-3 text-center">
            <div className="text-[10px] text-zinc-500 mb-1">Tamamlanan</div>
            <div className={`text-2xl font-mono font-semibold ${stats.totalIE > 0 && stats.tamamlanan === stats.totalIE ? 'text-green' : ''}`}>
              {stats.tamamlanan}
              {stats.totalIE > 0 && <span className="text-xs text-zinc-600 ml-1">/ {stats.totalIE}</span>}
            </div>
          </div>
          <div className="bg-bg-2 border border-border rounded-lg p-3 text-center">
            <div className="text-[10px] text-zinc-500 mb-1">Ort. İşlem Süresi</div>
            <div className="text-2xl font-mono font-semibold">
              {stats.avgIslemSure > 0 ? stats.avgIslemSure : '—'}
              {stats.avgIslemSure > 0 && <span className="text-xs text-zinc-600 ml-1">dk</span>}
            </div>
          </div>
          <div className="bg-bg-2 border border-border rounded-lg p-3 text-center">
            <div className="text-[10px] text-zinc-500 mb-1">Fire Oranı</div>
            <div className={`text-2xl font-mono font-semibold ${stats.fireOran >= 5 ? 'text-red' : stats.fireOran >= 2 ? 'text-amber' : (stats.totalFire > 0 ? 'text-green' : '')}`}>
              {(stats.totalUretim + stats.totalFire) > 0 ? `${stats.fireOran.toFixed(1)}%` : '—'}
            </div>
            {(stats.totalUretim + stats.totalFire) > 0 && (
              <div className="text-[9px] text-zinc-600">{stats.totalUretim} üretim · {stats.totalFire} fire</div>
            )}
          </div>
        </div>

        {/* İş Emirleri Listesi */}
        <h3 className="text-xs font-semibold text-zinc-400 mb-2">İş Emirleri ({opWOs.length})</h3>
        {opWOs.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-600">Bu operasyon için henüz iş emri yok.</div>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-zinc-500">
                  <th className="text-left px-3 py-2">İE No</th>
                  <th className="text-left px-3 py-2">Sipariş</th>
                  <th className="text-left px-3 py-2">Malzeme</th>
                  <th className="text-right px-3 py-2">Hedef</th>
                  <th className="text-right px-3 py-2">Üretim</th>
                  <th className="text-right px-3 py-2">Fire</th>
                  <th className="text-right px-3 py-2">%</th>
                  <th className="text-left px-3 py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {opWOs.slice(0, 50).map(w => {
                  const wl = woLogMap[w.id] || { uretim: 0, fire: 0 }
                  const pct = w.hedef > 0 ? Math.min(100, Math.round(wl.uretim / w.hedef * 100)) : 0
                  const sipNo = orders.find(o => o.id === w.orderId)?.siparisNo || '—'
                  return (
                    <tr key={w.id} className="border-b border-border/30">
                      <td className="px-3 py-1.5 font-mono text-accent text-[11px]">{w.ieNo}</td>
                      <td className="px-3 py-1.5 text-zinc-400 text-[11px] font-mono">{sipNo}</td>
                      <td className="px-3 py-1.5 text-zinc-300 truncate max-w-[140px]">{w.malad}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{w.hedef}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-green">{wl.uretim || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-red">{wl.fire || '—'}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className={`font-mono font-semibold ${pct >= 100 ? 'text-green' : pct > 0 ? 'text-accent' : 'text-zinc-600'}`}>{pct}%</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${durumBadge(w.durum)}`}>{durumLabel(w.durum)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {opWOs.length > 50 && <div className="px-3 py-1.5 text-[10px] text-zinc-600">+{opWOs.length - 50} daha</div>}
          </>
        )}
      </div>
    </div>
  )
}

function SimpleFormModal({ title, initial, onClose, onSave }: { title: string; initial: { id: string; kod: string; ad: string; bolum?: string } | null; onClose: () => void; onSave: (kod: string, ad: string, bolum: string, id?: string) => void }) {
  const operations = useProductionStore(s => s.operations)
  const { can } = useAuth()
  const [kod, setKod] = useState(initial?.kod || '')
  const [ad, setAd] = useState(initial?.ad || '')
  const [bolum, setBolum] = useState(initial?.bolum || '')
  const onceTanimli = ['PRES', 'LAZER', 'TESTERE', 'KAYNAK', 'MONTAJ', 'BOYA', 'TALAŞLI', 'DELME', 'BÜKME', 'TAŞLAMA', 'PAKETLEME', 'KALİTE']
  const mevcutBolumler = [...new Set(operations.map(o => o.bolum).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'))
  const tumBolumler = [...new Set([...onceTanimli, ...mevcutBolumler])].sort((a, b) => a.localeCompare(b, 'tr'))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Kod</label><input value={kod} onChange={e => setKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Ad</label><input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Bölüm</label>
            <select value={bolum} onChange={e => setBolum(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent">
              <option value="">— Seçin veya yazın —</option>
              {tumBolumler.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <input value={bolum} onChange={e => setBolum(e.target.value)} placeholder="veya yeni bölüm yazın..." className="w-full px-3 py-1.5 bg-bg-3 border border-border/50 rounded-lg text-xs text-zinc-400 mt-1 focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white">İptal</button>
          <button onClick={() => onSave(kod, ad, bolum, initial?.id)} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
    </div>
  )
}
