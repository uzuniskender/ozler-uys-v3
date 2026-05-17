import { useAuth } from '@/hooks/useAuth'
import { z } from 'zod'
import { useState, useMemo } from 'react'
import { useWarehouseStore } from '@/store'
import { deleteTedarikci, createTedarikci, updateTedarikci } from '@/services/tedarikciService'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { today } from '@/lib/utils'
import { Search, Plus, Pencil, Trash2, ChevronRight, X, Package, Clock, TrendingDown } from 'lucide-react'

export function Suppliers() {
  const tedarikciler = useWarehouseStore(s => s.tedarikciler)
  const tedarikler = useWarehouseStore(s => s.tedarikler)
  const loadOwn = useWarehouseStore(s => s.loadOwn)
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<typeof tedarikciler[0] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search) return tedarikciler
    const q = search.toLowerCase()
    return tedarikciler.filter(t => (t.kod + t.ad + t.email).toLowerCase().includes(q))
  }, [tedarikciler, search])

  // Per-supplier istatistik hesabı
  const istatistikler = useMemo(() => {
    const map: Record<string, { toplam: number; geciken: number; teslimGunleri: number[] }> = {}
    for (const t of tedarikler) {
      if (!t.tedarikcId) continue
      if (!map[t.tedarikcId]) map[t.tedarikcId] = { toplam: 0, geciken: 0, teslimGunleri: [] }
      const s = map[t.tedarikcId]
      s.toplam++
      if (!t.geldi && t.teslimTarihi && t.teslimTarihi < today()) s.geciken++
      // Ort. teslim: sipariş tarihinden planlı teslim tarihine kadar gün (geldi olanlar için)
      if (t.geldi && t.tarih && t.teslimTarihi) {
        const gun = Math.round((new Date(t.teslimTarihi).getTime() - new Date(t.tarih).getTime()) / 86400000)
        if (gun >= 0) s.teslimGunleri.push(gun)
      }
    }
    return map
  }, [tedarikler])

  // Seçili tedarikçinin son 5 tedariki
  const selectedTed = selectedId ? tedarikciler.find(t => t.id === selectedId) : null
  const sonTedarikler = useMemo(() => {
    if (!selectedId) return []
    return tedarikler
      .filter(t => t.tedarikcId === selectedId)
      .sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
      .slice(0, 5)
  }, [tedarikler, selectedId])

  function toggleSelected(id: string) {
    setSelectedId(prev => prev === id ? null : id)
  }

  async function del(id: string) {
    if (!await showConfirm('Bu tedarikçiyi silmek istediğinize emin misiniz?')) return
    try {
      await deleteTedarikci(id)
      if (selectedId === id) setSelectedId(null)
      loadOwn(); toast.success('Tedarikçi silindi')
    } catch { toast.error('Silinemedi') }
  }

  async function save(data: { kod: string; ad: string; adres: string; tel: string; email: string; not: string }, editId?: string) {
    try {
      if (editId) await updateTedarikci(editId, data)
      else await createTedarikci(data)
      loadOwn(); setShowForm(false); setEditItem(null)
      toast.success(editId ? 'Güncellendi' : 'Eklendi')
    } catch { toast.error('Kaydedilemedi') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Tedarikçiler</h1><p className="text-xs text-zinc-500">{tedarikciler.length} tedarikçi</p></div>
        <div className="flex gap-2">
          <button onClick={() => { import('xlsx').then(XLSX => {
            const rows = tedarikciler.map(t => ({ Kod: t.kod, Ad: t.ad, Adres: t.adres, Tel: t.tel, Email: t.email }))
            const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Tedarikçiler'); XLSX.writeFile(wb, 'tedarikciler.xlsx')
          })}} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
          {can('tedci_add') && <button onClick={async () => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Tedarikçi</button>}
        </div>
      </div>
      <div className="relative max-w-xs mb-4"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>

      <div className="flex gap-4 items-start">
        {/* Ana tablo */}
        <div className="flex-1 min-w-0 bg-bg-2 border border-border rounded-lg overflow-hidden">
          {filtered.length ? (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-zinc-500">
                <th className="text-left px-4 py-2.5">Kod</th>
                <th className="text-left px-4 py-2.5">Firma Adı</th>
                <th className="text-right px-4 py-2.5">Toplam</th>
                <th className="text-right px-4 py-2.5">Ort. Teslim</th>
                <th className="text-right px-4 py-2.5">Gecikme</th>
                <th className="text-left px-4 py-2.5">Telefon</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {filtered.map(t => {
                  const ist = istatistikler[t.id]
                  const toplam = ist?.toplam ?? 0
                  const geciken = ist?.geciken ?? 0
                  const gunler = ist?.teslimGunleri ?? []
                  const ortGun = gunler.length ? Math.round(gunler.reduce((a, b) => a + b, 0) / gunler.length) : null
                  const gecikmeOrani = toplam > 0 ? Math.round(geciken / toplam * 100) : 0
                  const isSelected = selectedId === t.id
                  return (
                    <tr key={t.id}
                      onClick={() => toggleSelected(t.id)}
                      className={`border-b border-border/30 cursor-pointer transition-colors ${isSelected ? 'bg-accent/8 border-l-2 border-l-accent' : 'hover:bg-bg-3/30'}`}>
                      <td className="px-4 py-2.5 font-mono text-accent">{t.kod}</td>
                      <td className="px-4 py-2.5 text-zinc-300 font-medium">{t.ad}</td>
                      <td className="px-4 py-2.5 text-right">
                        {toplam > 0
                          ? <span className="font-mono text-zinc-300">{toplam}</span>
                          : <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {ortGun !== null
                          ? <span className="font-mono text-zinc-400">{ortGun} gün</span>
                          : <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {geciken > 0
                          ? <span className="px-1.5 py-0.5 rounded text-[10px] bg-red/10 text-red font-semibold">{gecikmeOrani}%</span>
                          : toplam > 0
                            ? <span className="text-zinc-600 text-[10px]">0%</span>
                            : <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">{t.tel || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 justify-end items-center">
                          {can('tedci_edit') && <button onClick={e => { e.stopPropagation(); setEditItem(t); setShowForm(true) }} className="p-1 text-zinc-500 hover:text-accent"><Pencil size={12} /></button>}
                          {can('tedci_delete') && <button onClick={e => { e.stopPropagation(); del(t.id) }} className="p-1 text-zinc-500 hover:text-red"><Trash2 size={12} /></button>}
                          <ChevronRight size={12} className={`text-zinc-600 transition-transform ${isSelected ? 'rotate-90 text-accent' : ''}`} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz tedarikçi yok</div>}
        </div>

        {/* Detay paneli */}
        {selectedId && selectedTed && (() => {
          const ist = istatistikler[selectedId]
          const toplam = ist?.toplam ?? 0
          const geciken = ist?.geciken ?? 0
          const gunler = ist?.teslimGunleri ?? []
          const ortGun = gunler.length ? Math.round(gunler.reduce((a, b) => a + b, 0) / gunler.length) : null
          const gecikmeOrani = toplam > 0 ? Math.round(geciken / toplam * 100) : 0
          return (
            <div className="w-72 shrink-0 bg-bg-2 border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-3/30">
                <div>
                  <div className="font-semibold text-sm text-zinc-200">{selectedTed.ad}</div>
                  <div className="text-[10px] text-zinc-600 font-mono">{selectedTed.kod}</div>
                </div>
                <button onClick={() => setSelectedId(null)} className="p-1 text-zinc-500 hover:text-zinc-200"><X size={14} /></button>
              </div>

              {/* İstatistik kartları */}
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                <div className="px-3 py-3 text-center">
                  <Package size={13} className="text-zinc-500 mx-auto mb-1" />
                  <div className="text-base font-semibold font-mono text-zinc-200">{toplam}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">Toplam</div>
                </div>
                <div className="px-3 py-3 text-center">
                  <Clock size={13} className="text-zinc-500 mx-auto mb-1" />
                  <div className="text-base font-semibold font-mono text-zinc-200">{ortGun !== null ? `${ortGun}g` : '—'}</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">Ort. Teslim</div>
                </div>
                <div className="px-3 py-3 text-center">
                  <TrendingDown size={13} className={`mx-auto mb-1 ${geciken > 0 ? 'text-red' : 'text-zinc-500'}`} />
                  <div className={`text-base font-semibold font-mono ${geciken > 0 ? 'text-red' : 'text-zinc-200'}`}>{gecikmeOrani}%</div>
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">Gecikme</div>
                </div>
              </div>

              {/* İletişim bilgisi */}
              {(selectedTed.tel || selectedTed.email) && (
                <div className="px-4 py-2.5 border-b border-border space-y-1">
                  {selectedTed.tel && <div className="text-[11px] text-zinc-400">{selectedTed.tel}</div>}
                  {selectedTed.email && <div className="text-[11px] text-zinc-400">{selectedTed.email}</div>}
                  {selectedTed.adres && <div className="text-[10px] text-zinc-600">{selectedTed.adres}</div>}
                </div>
              )}

              {/* Son 5 tedarik */}
              <div className="px-4 py-2.5">
                <div className="text-[10px] text-zinc-600 uppercase tracking-wide font-semibold mb-2">Son 5 Tedarik</div>
                {sonTedarikler.length ? (
                  <div className="space-y-2">
                    {sonTedarikler.map(t => {
                      const gecikti = !t.geldi && t.teslimTarihi && t.teslimTarihi < today()
                      return (
                        <div key={t.id} className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
                          <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${t.geldi ? 'bg-green' : gecikti ? 'bg-red' : 'bg-amber'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[10px] text-accent truncate">{t.malkod}</div>
                            <div className="text-[10px] text-zinc-500 truncate">{t.malad}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-zinc-700 font-mono">{t.tarih}</span>
                              <span className="text-[9px] font-mono text-zinc-500">{t.miktar} {t.birim}</span>
                            </div>
                          </div>
                          <span className={`text-[9px] shrink-0 px-1 py-0.5 rounded ${t.geldi ? 'bg-green/10 text-green' : gecikti ? 'bg-red/10 text-red' : 'bg-amber/10 text-amber'}`}>
                            {t.geldi ? 'Geldi' : gecikti ? 'Gecikti' : 'Bekliyor'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-600 py-3 text-center">Tedarik kaydı yok</div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {showForm && <SupplierFormModal initial={editItem} onClose={() => { setShowForm(false); setEditItem(null) }} onSave={save} />}
    </div>
  )
}

const tedarikciSchema = z.object({
  kod: z.string().max(20, 'Kod en fazla 20 karakter'),
  ad: z.string().min(1, 'Firma adı zorunludur').max(100, 'Firma adı en fazla 100 karakter'),
  tel: z.string().max(20, 'Telefon en fazla 20 karakter').refine(
    v => !v || /^[0-9\s+\-()]+$/.test(v), 'Geçersiz telefon formatı (sadece rakam ve +-()'
  ),
  email: z.string().max(100, 'Email en fazla 100 karakter').refine(
    v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Geçersiz email adresi'
  ),
  adres: z.string().max(200, 'Adres en fazla 200 karakter'),
  not: z.string().max(500, 'Not en fazla 500 karakter'),
})

function SupplierFormModal({ initial, onClose, onSave }: {
  initial: { id: string; kod: string; ad: string; adres: string; tel: string; email: string; not: string } | null
  onClose: () => void; onSave: (data: { kod: string; ad: string; adres: string; tel: string; email: string; not: string }, editId?: string) => void
}) {
  const [kod, setKod] = useState(initial?.kod || '')
  const [ad, setAd] = useState(initial?.ad || '')
  const [adres, setAdres] = useState(initial?.adres || '')
  const [tel, setTel] = useState(initial?.tel || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [not_, setNot] = useState(initial?.not || '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSave() {
    const result = tedarikciSchema.safeParse({ kod, ad, adres, tel, email, not: not_ })
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.issues.forEach(i => { const k = String(i.path[0]); if (!errs[k]) errs[k] = i.message })
      setErrors(errs)
      return
    }
    setErrors({})
    onSave({ kod, ad, adres, tel, email, not: not_ }, initial?.id)
  }

  const inp = 'w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Kod</label>
              <input value={kod} onChange={e => setKod(e.target.value)} maxLength={20} className={inp} autoFocus />
              {errors.kod && <p className="text-[10px] text-red mt-0.5">{errors.kod}</p>}
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Telefon</label>
              <input value={tel} onChange={e => setTel(e.target.value)} maxLength={20} className={inp} />
              {errors.tel && <p className="text-[10px] text-red mt-0.5">{errors.tel}</p>}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Firma Adı *</label>
            <input value={ad} onChange={e => setAd(e.target.value)} maxLength={100} className={inp} />
            {errors.ad && <p className="text-[10px] text-red mt-0.5">{errors.ad}</p>}
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} maxLength={100} className={inp} />
            {errors.email && <p className="text-[10px] text-red mt-0.5">{errors.email}</p>}
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Adres</label>
            <input value={adres} onChange={e => setAdres(e.target.value)} maxLength={200} className={inp} />
            {errors.adres && <p className="text-[10px] text-red mt-0.5">{errors.adres}</p>}
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
            <input value={not_} onChange={e => setNot(e.target.value)} maxLength={500} className={inp} />
            {errors.not && <p className="text-[10px] text-red mt-0.5">{errors.not}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={handleSave} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
    </div>
  )
}
