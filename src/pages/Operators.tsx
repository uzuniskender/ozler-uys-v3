import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { showMultiPrompt, showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { Search, Plus, UserCheck, UserX } from 'lucide-react'

export function Operators() {
  const { operators, loadAll } = useStore()
  const [search, setSearch] = useState('')
  const [bolumFilter, setBolumFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editOpr, setEditOpr] = useState<typeof operators[0] | null>(null)
  const [tab, setTab] = useState<'liste'|'izin'>('liste')
  const [izinler, setIzinler] = useState<{ id: string; oprId: string; oprAd: string; baslangic: string; bitis: string; tip: string; not: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('uys_izinler') || '[]') } catch { return [] }
  })

  const bolumler = useMemo(() => [...new Set(operators.map(o => o.bolum).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [operators])

  const filtered = useMemo(() => {
    return operators.filter(o => {
      if (bolumFilter && o.bolum !== bolumFilter) return false
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
        <button onClick={async () => { setEditOpr(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Operatör</button>
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
        <select value={bolumFilter} onChange={e => setBolumFilter(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="">Tüm Bölümler</option>
          {bolumler.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
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
            <button onClick={async () => {
              const result = await showMultiPrompt('İzin / Mesai Ekle', [
                { label: 'Operatör (sicil no veya isim)', key: 'oprId' },
                { label: 'Başlangıç (YYYY-MM-DD)', key: 'baslangic', defaultValue: today() },
                { label: 'Bitiş (YYYY-MM-DD)', key: 'bitis' },
                { label: 'Tip (yıllık/mazeret/rapor/mesai)', key: 'tip', defaultValue: 'yıllık' },
              ])
              if (!result) return
              const opr = operators.find(o => o.kod === result.oprId || o.ad.toLowerCase().includes((result.oprId || '').toLowerCase()))
              if (!opr) { toast.error('Operatör bulunamadı'); return }
              if (!result.baslangic || !result.bitis) { toast.error('Tarih girilmeli'); return }
              const yeni = { id: uid(), oprId: opr.id, oprAd: opr.ad, baslangic: result.baslangic, bitis: result.bitis || result.baslangic, tip: result.tip || 'yıllık', not: '' }
              const updated = [...izinler, yeni]
              setIzinler(updated); localStorage.setItem('uys_izinler', JSON.stringify(updated))
              toast.success(opr.ad + ' için izin eklendi')
            }} className="flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={12} /> İzin Ekle</button>
          </div>
          {izinler.length ? (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Operatör</th><th className="text-left px-3 py-2">Başlangıç</th><th className="text-left px-3 py-2">Bitiş</th><th className="text-left px-3 py-2">Tip</th><th className="text-right px-3 py-2">Gün</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {izinler.sort((a, b) => b.baslangic.localeCompare(a.baslangic)).map(iz => {
                  const gun = Math.ceil((new Date(iz.bitis).getTime() - new Date(iz.baslangic).getTime()) / 86400000) + 1
                  return (
                    <tr key={iz.id} className="border-b border-border/30">
                      <td className="px-3 py-1.5 text-zinc-300">{iz.oprAd}</td>
                      <td className="px-3 py-1.5 font-mono text-zinc-500">{iz.baslangic}</td>
                      <td className="px-3 py-1.5 font-mono text-zinc-500">{iz.bitis}</td>
                      <td className="px-3 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${iz.tip === 'mesai' ? 'bg-green/10 text-green' : 'bg-amber/10 text-amber'}`}>{iz.tip}</span></td>
                      <td className="px-3 py-1.5 text-right font-mono">{gun}</td>
                      <td className="px-3 py-1.5 text-right"><button onClick={async () => {
                        const updated = izinler.filter(i => i.id !== iz.id)
                        setIzinler(updated); localStorage.setItem('uys_izinler', JSON.stringify(updated))
                        toast.success('İzin silindi')
                      }} className="text-zinc-500 hover:text-red text-[10px]">Sil</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <div className="p-4 text-center text-zinc-600 text-xs">Henüz izin kaydı yok</div>}
        </div>
      )}

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
