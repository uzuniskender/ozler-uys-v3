import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { Search, Plus, UserCheck, UserX } from 'lucide-react'
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown'

export function Operators() {
  const { operators, izinler, loadAll } = useStore()
  const [search, setSearch] = useState('')
  const [bolumFilter, setBolumFilter] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editOpr, setEditOpr] = useState<typeof operators[0] | null>(null)
  const [tab, setTab] = useState<'liste'|'izin'>('liste')
  const [izinForm, setIzinForm] = useState<boolean | 'toplu' | Record<string, any>>(false)

  const bolumler = useMemo(() => [...new Set(operators.map(o => o.bolum).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [operators])

  const filtered = useMemo(() => {
    return operators.filter(o => {
      if (bolumFilter.size > 0 && !bolumFilter.has(o.bolum)) return false
      if (search) return (o.kod + o.ad + o.bolum).toLowerCase().includes(search.toLowerCase())
      return true
    })
  }, [operators, search, bolumFilter])

  const grouped = useMemo(() => {
    const map: Record<string, typeof operators> = {}
    filtered.forEach(o => { const b = o.bolum || 'Tanımsız'; if (!map[b]) map[b] = []; map[b].push(o) })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [filtered])

  async function toggleAktif(id: string, aktif: boolean) {
    await supabase.from('uys_operators').update({ aktif }).eq('id', id)
    loadAll()
  }

  async function deleteOpr(id: string) {
    if (!await showConfirm('Bu operatörü silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_operators').delete().eq('id', id)
    loadAll()
  }

  async function saveOpr(data: { kod: string; ad: string; bolum: string; sifre: string }, editId?: string) {
    if (editId) {
      await supabase.from('uys_operators').update({ kod: data.kod, ad: data.ad, bolum: data.bolum, sifre: data.sifre }).eq('id', editId)
    } else {
      await supabase.from('uys_operators').insert({ id: uid(), kod: data.kod, ad: data.ad, bolum: data.bolum, sifre: data.sifre, aktif: true })
    }
    loadAll()
    setShowForm(false)
    setEditOpr(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Operatörler</h1><p className="text-xs text-zinc-500">{operators.length} operatör · {operators.filter(o => o.aktif).length} aktif</p></div>
        <div className="flex gap-2">
          <button onClick={async () => {
            if (!await showConfirm('Tüm operatör oturumları kapatılacak. Devam?')) return
            await supabase.channel('uys-force-logout').send({ type: 'broadcast', event: 'logout', payload: { ts: Date.now() } })
            toast.success('Çıkış sinyali gönderildi — aktif operatörler çıkış yapacak')
          }} className="px-3 py-1.5 bg-red/10 border border-red/20 text-red rounded-lg text-xs hover:bg-red/20">🚪 Tüm Oturumları Kapat</button>
          <button onClick={() => { import('xlsx').then(XLSX => {
            const rows = operators.map(o => ({ Kod: o.kod, Ad: o.ad, Bölüm: o.bolum, Aktif: o.aktif ? 'Evet' : 'Hayır' }))
            const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Operatörler'); XLSX.writeFile(wb, 'operatorler.xlsx')
          })}} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
          <button onClick={async () => { setEditOpr(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Operatör</button>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        <select value={tab} onChange={e => setTab(e.target.value as 'liste'|'izin')} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="liste">Operatör Listesi</option>
          <option value="izin">İzin / Mesai</option>
        </select>
      </div>

      {tab === 'liste' && (<>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ad veya kod ara..."
            className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>
        <MultiCheckDropdown label="Bölüm" options={bolumler} selected={bolumFilter} onChange={setBolumFilter} />
      </div>

      {grouped.map(([bolum, oprs]) => (
        <div key={bolum} className="mb-4">
          <div className="px-3 py-1.5 bg-accent/5 border border-accent/15 rounded-t-lg text-[11px] font-semibold text-accent font-mono flex justify-between">
            <span>{bolum}</span><span className="text-zinc-500 font-normal">{oprs.length} kişi</span>
          </div>
          <div className="bg-bg-2 border border-border border-t-0 rounded-b-lg overflow-hidden divide-y divide-border/30">
            {oprs.map(o => (
              <div key={o.id} className="flex items-center gap-3 px-3 py-2 hover:bg-bg-3/30">
                <div className={`w-2 h-2 rounded-full ${o.aktif ? 'bg-green' : 'bg-zinc-600'}`} />
                <span className="font-mono text-[11px] text-accent w-20">{o.kod}</span>
                <span className="flex-1 text-xs font-medium">{o.ad}</span>
                <div className="flex gap-1">
                  <button onClick={async () => { setEditOpr(o); setShowForm(true) }} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">Düzenle</button>
                  <button onClick={() => toggleAktif(o.id, !o.aktif)} className="p-1 text-zinc-500 hover:text-amber" title={o.aktif ? 'Pasife al' : 'Aktifleştir'}>
                    {o.aktif ? <UserX size={12} /> : <UserCheck size={12} />}
                  </button>
                  <button onClick={() => deleteOpr(o.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      </>)}

      {tab === 'izin' && (
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">İzin / Mesai Kayıtları ({izinler.length})</h3>
            <div className="flex gap-2">
              <button onClick={() => setIzinForm(true)} className="flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={12} /> İzin Ekle</button>
              <button onClick={() => setIzinForm('toplu')} className="flex items-center gap-1 px-3 py-1.5 bg-green/20 hover:bg-green/30 text-green border border-green/30 rounded-lg text-xs font-semibold"><Plus size={12} /> Toplu İzin</button>
            </div>
          </div>
          {izinler.length ? (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-zinc-500">
                <th className="text-left px-3 py-2">Operatör</th>
                <th className="text-left px-3 py-2">Tarih</th>
                <th className="text-left px-3 py-2">Tip</th>
                <th className="text-left px-3 py-2">Oluşturan</th>
                <th className="text-left px-3 py-2">Durum</th>
                <th className="text-left px-3 py-2">Onaylayan</th>
                <th className="text-right px-3 py-2">İşlem</th>
              </tr></thead>
              <tbody>
                {izinler.sort((a, b) => b.baslangic.localeCompare(a.baslangic)).map(iz => {
                  const durumColor = iz.durum === 'onaylandi' ? 'bg-green/10 text-green' : iz.durum === 'reddedildi' ? 'bg-red/10 text-red' : iz.durum === 'duzenlendi' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-amber/10 text-amber'
                  const tipColor = iz.tip === 'mesai' ? 'bg-cyan-500/10 text-cyan-400' : iz.tip === 'rapor' ? 'bg-red/10 text-red' : 'bg-amber/10 text-amber'
                  const saatStr = iz.saatBaslangic && iz.saatBitis ? ` (${iz.saatBaslangic}–${iz.saatBitis})` : ''
                  const olusturanBadge = iz.olusturan === 'operator' ? '👷 Operatör' : '🏢 Admin'
                  const canEdit = iz.durum !== 'onaylandi' && iz.durum !== 'reddedildi'
                  return (
                    <tr key={iz.id} className="border-b border-border/30">
                      <td className="px-3 py-1.5 text-zinc-300 font-medium">{iz.opAd}</td>
                      <td className="px-3 py-1.5 font-mono text-zinc-500 text-[10px]">{iz.baslangic}{iz.bitis !== iz.baslangic ? ' → ' + iz.bitis : ''}{saatStr}</td>
                      <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${tipColor}`}>{iz.tip}</span></td>
                      <td className="px-3 py-1.5 text-[10px] text-zinc-500">{olusturanBadge}</td>
                      <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${durumColor}`}>{iz.durum}</span></td>
                      <td className="px-3 py-1.5 text-zinc-500 text-[10px]">{iz.onaylayan || '—'}</td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {iz.durum === 'bekliyor' && iz.olusturan === 'operator' && (
                            <>
                              <button onClick={async () => {
                                await supabase.from('uys_izinler').update({ durum: 'onaylandi', onaylayan: 'Admin', onay_tarihi: today() }).eq('id', iz.id)
                                loadAll(); toast.success(iz.opAd + ' izni onaylandı')
                              }} className="px-2 py-0.5 bg-green/10 text-green rounded text-[10px] hover:bg-green/20">✓ Onayla</button>
                              <button onClick={async () => {
                                await supabase.from('uys_izinler').update({ durum: 'reddedildi', onaylayan: 'Admin', onay_tarihi: today() }).eq('id', iz.id)
                                loadAll(); toast.success(iz.opAd + ' izni reddedildi')
                              }} className="px-2 py-0.5 bg-red/10 text-red rounded text-[10px] hover:bg-red/20">✕ Red</button>
                            </>
                          )}
                          {canEdit && (
                            <button onClick={() => setIzinForm(iz)} className="px-2 py-0.5 bg-accent/10 text-accent rounded text-[10px] hover:bg-accent/20">✏ Düzenle</button>
                          )}
                          {iz.durum === 'onaylandi' && (
                            <button onClick={() => toast.info('Onaylanan izin düzenlenemez. İptal edip yeniden oluşturabilirsiniz.')} className="px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded text-[10px] cursor-not-allowed">🔒</button>
                          )}
                          <button onClick={async () => {
                            if (!await showConfirm('İzni silmek istediğinize emin misiniz?')) return
                            await supabase.from('uys_izinler').delete().eq('id', iz.id)
                            loadAll(); toast.success('İzin silindi')
                          }} className="text-zinc-600 hover:text-red text-[10px]">Sil</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <div className="p-4 text-center text-zinc-600 text-xs">Henüz izin kaydı yok</div>}
        </div>
      )}

      {izinForm && <IzinFormModal
        operators={operators}
        editData={typeof izinForm === 'object' && izinForm !== true ? izinForm : undefined}
        toplu={izinForm === 'toplu'}
        onClose={() => setIzinForm(false)}
        onSave={async (dataList) => {
          for (const data of dataList) {
            if (data._update) {
              await supabase.from('uys_izinler').update({
                baslangic: data.baslangic, bitis: data.bitis, tip: data.tip,
                saat_baslangic: data.saat_baslangic, saat_bitis: data.saat_bitis,
                not_: data.not_, durum: data.olusturan === 'operator' ? 'duzenlendi' : data.durum,
              }).eq('id', data.id)
            } else {
              await supabase.from('uys_izinler').insert(data)
            }
          }
          loadAll(); setIzinForm(false)
          toast.success(dataList.length > 1 ? dataList.length + ' izin oluşturuldu' : (dataList[0]._update ? 'İzin düzenlendi' : 'İzin eklendi'))
        }}
      />}

      {showForm && <OprFormModal initial={editOpr} bolumler={bolumler} onClose={() => { setShowForm(false); setEditOpr(null) }} onSave={saveOpr} />}
    </div>
  )
}

function OprFormModal({ initial, bolumler, onClose, onSave }: {
  initial: { id: string; kod: string; ad: string; bolum: string; sifre: string } | null
  bolumler: string[]; onClose: () => void
  onSave: (data: { kod: string; ad: string; bolum: string; sifre: string }, editId?: string) => void
}) {
  const [kod, setKod] = useState(initial?.kod || '')
  const [ad, setAd] = useState(initial?.ad || '')
  const [bolum, setBolum] = useState(initial?.bolum || '')
  const [sifre, setSifre] = useState(initial?.sifre || '123456')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Operatör Düzenle' : 'Yeni Operatör'}</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Sicil No</label>
          <input value={kod} onChange={e => setKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Ad Soyad</label>
          <input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Bölüm</label>
          <input list="bolum-list" value={bolum} onChange={e => setBolum(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          <datalist id="bolum-list">{bolumler.map(b => <option key={b} value={b} />)}</datalist></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Şifre</label>
          <input value={sifre} onChange={e => setSifre(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white">İptal</button>
          <button onClick={() => onSave({ kod, ad, bolum, sifre }, initial?.id)} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
    </div>
  )
}

/* İzin Modalı — Yeni/Düzenle/Toplu */
function IzinFormModal({ operators, editData, toplu, onClose, onSave }: {
  operators: { id: string; kod: string; ad: string; bolum: string; aktif?: boolean }[]
  editData?: Record<string, any>
  toplu?: boolean
  onClose: () => void
  onSave: (dataList: Record<string, any>[]) => void
}) {
  const isEdit = !!editData
  const aktifOps = operators.filter(o => (o as any).aktif !== false).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))

  // Tekil mod state
  const [oprId, setOprId] = useState(editData?.opId || '')
  const [baslangic, setBaslangic] = useState(editData?.baslangic || today())
  const [bitis, setBitis] = useState(editData?.bitis || today())
  const [tip, setTip] = useState(editData?.tip || 'yıllık')
  const [saatlik, setSaatlik] = useState(!!(editData?.saatBaslangic))
  const [saatBas, setSaatBas] = useState(editData?.saatBaslangic || '')
  const [saatBit, setSaatBit] = useState(editData?.saatBitis || '')
  const [not_, setNot] = useState(editData?.not || '')

  // Toplu mod state
  const [selectedOps, setSelectedOps] = useState<Set<string>>(new Set())

  const opr = operators.find(o => o.id === oprId)
  const title = isEdit ? 'İzin Düzenle' : toplu ? 'Toplu İzin Oluştur' : 'İzin / Mesai Ekle'

  function toggleOp(id: string) {
    setSelectedOps(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function selectAll() { setSelectedOps(new Set(aktifOps.map(o => o.id))) }
  function clearAll() { setSelectedOps(new Set()) }

  function handleSave() {
    if (isEdit) {
      if (!baslangic) { toast.error('Başlangıç tarihi girilmeli'); return }
      onSave([{
        ...editData, _update: true,
        baslangic, bitis: bitis || baslangic, tip,
        saat_baslangic: saatlik ? saatBas : '', saat_bitis: saatlik ? saatBit : '',
        not_: not_,
      }])
    } else if (toplu) {
      if (!selectedOps.size) { toast.error('En az bir operatör seçin'); return }
      if (!baslangic) { toast.error('Başlangıç tarihi girilmeli'); return }
      const list = [...selectedOps].map(opId => {
        const op = operators.find(o => o.id === opId)!
        return {
          id: uid(), op_id: op.id, op_ad: op.ad,
          baslangic, bitis: bitis || baslangic, tip,
          durum: 'bekliyor', olusturan: 'admin',
          saat_baslangic: saatlik ? saatBas : '', saat_bitis: saatlik ? saatBit : '',
          onaylayan: '', onay_tarihi: '', not_: not_,
        }
      })
      onSave(list)
    } else {
      if (!oprId || !opr) { toast.error('Operatör seçiniz'); return }
      if (!baslangic) { toast.error('Başlangıç tarihi girilmeli'); return }
      onSave([{
        id: uid(), op_id: opr.id, op_ad: opr.ad,
        baslangic, bitis: bitis || baslangic, tip,
        durum: 'bekliyor', olusturan: 'admin',
        saat_baslangic: saatlik ? saatBas : '', saat_bitis: saatlik ? saatBit : '',
        onaylayan: '', onay_tarihi: '', not_: not_,
      }])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <div className="space-y-3">
          {/* Operatör seçimi */}
          {isEdit ? (
            <div className="px-3 py-2 bg-bg-2 rounded-lg text-sm text-zinc-300">{editData.opAd}</div>
          ) : toplu ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-zinc-500">Operatörler ({selectedOps.size} seçili)</label>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[10px] text-accent hover:underline">Tümünü Seç</button>
                  <button onClick={clearAll} className="text-[10px] text-zinc-500 hover:underline">Temizle</button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto bg-bg-2 border border-border rounded-lg p-2 space-y-0.5">
                {aktifOps.map(o => (
                  <label key={o.id} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer hover:bg-bg-3/50 rounded px-1">
                    <input type="checkbox" checked={selectedOps.has(o.id)} onChange={() => toggleOp(o.id)} className="rounded" />
                    <span className="text-zinc-300">{o.ad}</span>
                    <span className="text-[10px] text-zinc-600">({o.kod})</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Operatör</label>
              <select value={oprId} onChange={e => setOprId(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent">
                <option value="">Seçiniz...</option>
                {aktifOps.map(o => <option key={o.id} value={o.id}>{o.ad} ({o.kod})</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Başlangıç</label>
            <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Bitiş</label>
            <input type="date" value={bitis} onChange={e => setBitis(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={saatlik} onChange={e => setSaatlik(e.target.checked)} id="saatlik2" className="rounded" />
            <label htmlFor="saatlik2" className="text-[11px] text-zinc-400">Saatlik izin</label>
          </div>
          {saatlik && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Saat Başlangıç</label>
              <input type="time" value={saatBas} onChange={e => setSaatBas(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Saat Bitiş</label>
              <input type="time" value={saatBit} onChange={e => setSaatBit(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            </div>
          )}
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Tip</label>
          <select value={tip} onChange={e => setTip(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent">
            <option value="yıllık">Yıllık İzin</option><option value="mazeret">Mazeret İzni</option><option value="rapor">Rapor</option><option value="mesai">Mesai</option><option value="ücretsiz">Ücretsiz İzin</option>
          </select></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
          <input value={not_} onChange={e => setNot(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          {toplu && <div className="text-[10px] text-amber italic">⚠ Toplu izin oluşturulduğunda her operatör kendi panelinden onaylamalıdır.</div>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white">İptal</button>
          <button onClick={handleSave} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">
            {isEdit ? 'Güncelle' : toplu ? `${selectedOps.size} Kişiye İzin Oluştur` : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
