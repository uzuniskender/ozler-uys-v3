import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useProductionStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Search, Plus, Pencil, X, Activity, Target, ChevronRight } from 'lucide-react'

const stationSchema = z.object({
  kod: z.string().trim().min(1, 'Kod zorunlu'),
  ad: z.string().trim().min(1, 'Ad zorunlu'),
})

export function Stations() {
  const stations = useProductionStore(s => s.stations)
  const operations = useProductionStore(s => s.operations)
  const workOrders = useProductionStore(s => s.workOrders)
  const logs = useProductionStore(s => s.logs)
  const loadOwn = useProductionStore(s => s.loadOwn)
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<typeof stations[0] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search) return stations
    const q = search.toLowerCase()
    return stations.filter(s => (s.kod + s.ad).toLowerCase().includes(q))
  }, [stations, search])

  // İstasyon başına istatistik
  const istasyonStats = useMemo(() => {
    const todayStr = today()
    const woIstMap: Record<string, string> = {}
    const activeWosByIst: Record<string, typeof workOrders> = {}
    for (const wo of workOrders) {
      if (wo.istId) woIstMap[wo.id] = wo.istId
      if (wo.durum === 'tamamlandi' || wo.durum === 'iptal') continue
      if (!activeWosByIst[wo.istId]) activeWosByIst[wo.istId] = []
      activeWosByIst[wo.istId].push(wo)
    }
    const bugunByIst: Record<string, number> = {}
    for (const log of logs) {
      if (log.tarih !== todayStr) continue
      const istId = woIstMap[log.woId]
      if (istId) bugunByIst[istId] = (bugunByIst[istId] || 0) + log.qty
    }
    const maxAktif = Math.max(1, ...stations.map(s => (activeWosByIst[s.id] || []).length))
    return stations.reduce((acc, s) => {
      const aktifWO = activeWosByIst[s.id] || []
      acc[s.id] = {
        aktifIE: aktifWO.length,
        acikHedef: aktifWO.reduce((sum, wo) => sum + (wo.hedef || 0), 0),
        bugunUretim: bugunByIst[s.id] || 0,
        doluluk: Math.round(aktifWO.length / maxAktif * 100),
      }
      return acc
    }, {} as Record<string, { aktifIE: number; acikHedef: number; bugunUretim: number; doluluk: number }>)
  }, [workOrders, logs, stations])

  // Seçili istasyonun son 5 logu
  const selectedStation = selectedId ? stations.find(s => s.id === selectedId) : null
  const sonLoglar = useMemo(() => {
    if (!selectedId) return []
    const istWoIds = new Set(workOrders.filter(wo => wo.istId === selectedId).map(wo => wo.id))
    return logs
      .filter(l => istWoIds.has(l.woId))
      .sort((a, b) => (b.tarih + b.saat).localeCompare(a.tarih + a.saat))
      .slice(0, 5)
  }, [logs, workOrders, selectedId])

  function toggleSelected(id: string) { setSelectedId(prev => prev === id ? null : id) }

  async function del(id: string) {
    if (!await showConfirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_stations').delete().eq('id', id)
    if (selectedId === id) setSelectedId(null)
    loadOwn(); toast.success('İstasyon silindi')
  }

  async function save(data: { kod: string; ad: string; opIds: string[] }, editId?: string) {
    const parsed = stationSchema.safeParse({ kod: data.kod, ad: data.ad })
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }
    const kodN = parsed.data.kod
    const adN = parsed.data.ad
    const dupKod = stations.find(s => s.kod.trim().toLowerCase() === kodN.toLowerCase() && s.id !== editId)
    if (dupKod) { toast.error(`"${kodN}" kodu zaten kullanımda`); return }
    const dupAd = stations.find(s => s.ad.trim().toLowerCase() === adN.toLowerCase() && s.id !== editId)
    if (dupAd) { toast.error(`"${adN}" adı zaten kullanımda`); return }
    if (editId) await supabase.from('uys_stations').update({ kod: kodN, ad: adN, op_ids: data.opIds }).eq('id', editId)
    else await supabase.from('uys_stations').insert({ id: uid(), kod: kodN, ad: adN, op_ids: data.opIds })
    loadOwn(); setShowForm(false); setEditItem(null); toast.success(editId ? 'Güncellendi' : 'Eklendi')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">İstasyonlar</h1><p className="text-xs text-zinc-500">{stations.length} istasyon</p></div>
        <div className="flex gap-2">
          <button onClick={() => { import('xlsx').then(XLSX => {
            const rows = stations.map(s => ({ Kod: s.kod, Ad: s.ad }))
            const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'İstasyonlar'); XLSX.writeFile(wb, 'istasyonlar.xlsx')
          })}} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
          {can('st_add') && <button onClick={async () => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni</button>}
        </div>
      </div>
      <div className="relative max-w-xs mb-4"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>

      <div className="flex gap-4 items-start">
        {/* Ana tablo */}
        <div className="flex-1 min-w-0 bg-bg-2 border border-border rounded-lg overflow-hidden max-h-[70vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2 z-10"><tr className="border-b border-border text-zinc-500">
              <th className="text-left px-4 py-2.5">Kod</th>
              <th className="text-left px-4 py-2.5">İstasyon Adı</th>
              <th className="text-right px-4 py-2.5">Aktif İE</th>
              <th className="text-right px-4 py-2.5">Bugün</th>
              <th className="text-right px-4 py-2.5">Açık Hedef</th>
              <th className="px-4 py-2.5 w-28">Doluluk</th>
              <th className="px-4 py-2.5"></th>
            </tr></thead>
            <tbody>
              {filtered.map(s => {
                const st = istasyonStats[s.id] || { aktifIE: 0, acikHedef: 0, bugunUretim: 0, doluluk: 0 }
                const isSelected = selectedId === s.id
                return (
                  <tr key={s.id}
                    onClick={() => toggleSelected(s.id)}
                    className={`border-b border-border/30 cursor-pointer transition-colors ${isSelected ? 'bg-accent/8 border-l-2 border-l-accent' : 'hover:bg-bg-3/30'}`}>
                    <td className="px-4 py-2 font-mono text-accent text-[11px]">{s.kod}</td>
                    <td className="px-4 py-2 text-zinc-300">{s.ad}</td>
                    <td className="px-4 py-2 text-right">
                      {st.aktifIE > 0
                        ? <span className="font-mono font-semibold text-zinc-200">{st.aktifIE}</span>
                        : <span className="text-zinc-700">0</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {st.bugunUretim > 0
                        ? <span className="font-mono text-green font-semibold">{st.bugunUretim}</span>
                        : <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {st.acikHedef > 0
                        ? <span className="font-mono text-zinc-400">{st.acikHedef.toLocaleString('tr-TR')}</span>
                        : <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-bg-3 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-1.5 rounded-full transition-all ${st.doluluk >= 80 ? 'bg-red' : st.doluluk >= 50 ? 'bg-amber' : st.doluluk > 0 ? 'bg-accent' : ''}`}
                            style={{ width: `${st.doluluk}%` }} />
                        </div>
                        <span className="text-[10px] text-zinc-600 font-mono w-7 text-right">{st.doluluk}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 justify-end items-center">
                        {can('st_edit') && <button onClick={e => { e.stopPropagation(); setEditItem(s); setShowForm(true) }} className="p-1 text-zinc-500 hover:text-accent"><Pencil size={12} /></button>}
                        {can('st_delete') && <button onClick={e => { e.stopPropagation(); del(s.id) }} className="px-1.5 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>}
                        <ChevronRight size={12} className={`text-zinc-600 transition-transform ${isSelected ? 'rotate-90 text-accent' : ''}`} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Detay paneli */}
        {selectedId && selectedStation && (() => {
          const st = istasyonStats[selectedId] || { aktifIE: 0, acikHedef: 0, bugunUretim: 0, doluluk: 0 }
          const stOps = (selectedStation.opIds || []).map(id => operations.find(o => o.id === id)).filter(Boolean)
          return (
            <div className="w-72 shrink-0 bg-bg-2 border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-3/30">
                <div>
                  <div className="font-semibold text-sm text-zinc-200">{selectedStation.ad}</div>
                  <div className="text-[10px] text-zinc-600 font-mono">{selectedStation.kod}</div>
                </div>
                <button onClick={() => setSelectedId(null)} className="p-1 text-zinc-500 hover:text-zinc-200"><X size={14} /></button>
              </div>

              {/* İstatistik kartları */}
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                <div className="px-3 py-3 text-center">
                  <Activity size={13} className={`mx-auto mb-1 ${st.aktifIE > 0 ? 'text-accent' : 'text-zinc-600'}`} />
                  <div className={`text-lg font-semibold font-mono ${st.aktifIE > 0 ? 'text-zinc-200' : 'text-zinc-600'}`}>{st.aktifIE}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">Aktif İE</div>
                </div>
                <div className="px-3 py-3 text-center">
                  <Target size={13} className={`mx-auto mb-1 ${st.bugunUretim > 0 ? 'text-green' : 'text-zinc-600'}`} />
                  <div className={`text-lg font-semibold font-mono ${st.bugunUretim > 0 ? 'text-green' : 'text-zinc-600'}`}>{st.bugunUretim}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">Bugün Üretim</div>
                </div>
              </div>
              <div className="px-4 py-2.5 border-b border-border">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-600">Açık Hedef</span>
                  <span className="text-xs font-mono text-zinc-400">{st.acikHedef.toLocaleString('tr-TR')} adet</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600">Doluluk</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-bg-3 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${st.doluluk >= 80 ? 'bg-red' : st.doluluk >= 50 ? 'bg-amber' : 'bg-accent'}`}
                        style={{ width: `${st.doluluk}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{st.doluluk}%</span>
                  </div>
                </div>
              </div>

              {/* Operasyonlar */}
              {stOps.length > 0 && (
                <div className="px-4 py-2.5 border-b border-border">
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-1.5">Operasyonlar</div>
                  <div className="flex flex-wrap gap-1">
                    {stOps.map(o => o && (
                      <span key={o.id} className="px-1.5 py-0.5 bg-accent/10 text-accent rounded text-[10px] font-mono">{o.kod}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Son 5 üretim logu */}
              <div className="px-4 py-2.5">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-2">Son 5 Üretim Logu</div>
                {sonLoglar.length ? (
                  <div className="space-y-2">
                    {sonLoglar.map(l => {
                      const wo = workOrders.find(w => w.id === l.woId)
                      return (
                        <div key={l.id} className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
                          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-green shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10px] text-accent truncate">{wo?.ieNo || wo?.malkod || l.woId.slice(0, 8)}</div>
                            <div className="text-[10px] text-zinc-500 truncate">{wo?.malad || '—'}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-zinc-700 font-mono">{l.tarih} {l.saat}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[11px] font-semibold font-mono text-green">+{l.qty}</div>
                            {l.fire > 0 && <div className="text-[9px] text-red font-mono">-{l.fire}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-600 py-3 text-center">Üretim logu yok</div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {showForm && <StationFormModal initial={editItem} operations={operations} onClose={() => { setShowForm(false); setEditItem(null) }} onSave={save} />}
    </div>
  )
}

function StationFormModal({ initial, operations, onClose, onSave }: {
  initial: { id: string; kod: string; ad: string; opIds: string[] } | null
  operations: { id: string; kod: string; ad: string }[]; onClose: () => void
  onSave: (data: { kod: string; ad: string; opIds: string[] }, editId?: string) => void
}) {
  const [kod, setKod] = useState(initial?.kod || '')
  const [ad, setAd] = useState(initial?.ad || '')
  const [opIds, setOpIds] = useState<string[]>(initial?.opIds || [])

  function toggleOp(id: string) { setOpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'İstasyon Düzenle' : 'Yeni İstasyon'}</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Kod</label><input value={kod} onChange={e => setKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Ad</label><input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Operasyonlar ({opIds.length} seçili)</label>
            <div className="max-h-40 overflow-y-auto bg-bg-2 border border-border rounded-lg p-2 space-y-1">
              {operations.map(o => (
                <label key={o.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-bg-3/50 px-2 py-1 rounded">
                  <input type="checkbox" checked={opIds.includes(o.id)} onChange={() => toggleOp(o.id)} className="accent-accent" />
                  <span className="font-mono text-[11px] text-accent">{o.kod}</span> {o.ad}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={() => onSave({ kod, ad, opIds }, initial?.id)} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
    </div>
  )
}
