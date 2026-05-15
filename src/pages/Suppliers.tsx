import { useAuth } from '@/hooks/useAuth'
import { z } from 'zod'
import { useState, useMemo } from 'react'
import { useWarehouseStore } from '@/store'
import { deleteTedarikci, createTedarikci, updateTedarikci } from '@/services/tedarikciService'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'

export function Suppliers() {
  const tedarikciler = useWarehouseStore(s => s.tedarikciler)
  const loadOwn = useWarehouseStore(s => s.loadOwn)
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<typeof tedarikciler[0] | null>(null)

  const filtered = useMemo(() => {
    if (!search) return tedarikciler
    const q = search.toLowerCase()
    return tedarikciler.filter(t => (t.kod + t.ad + t.email).toLowerCase().includes(q))
  }, [tedarikciler, search])

  async function del(id: string) {
    if (!await showConfirm('Bu tedarikçiyi silmek istediğinize emin misiniz?')) return
    try {
      await deleteTedarikci(id)
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
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {filtered.length ? (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Firma Adı</th><th className="text-left px-4 py-2.5">Telefon</th><th className="text-left px-4 py-2.5">Email</th><th className="text-left px-4 py-2.5">Not</th><th className="px-4 py-2.5"></th></tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-2 font-mono text-accent">{t.kod}</td>
                  <td className="px-4 py-2 text-zinc-300">{t.ad}</td>
                  <td className="px-4 py-2 text-zinc-500">{t.tel || '—'}</td>
                  <td className="px-4 py-2 text-zinc-500">{t.email || '—'}</td>
                  <td className="px-4 py-2 text-zinc-600 max-w-[150px] truncate">{t.not || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {can('tedci_edit') && <button onClick={async () => { setEditItem(t); setShowForm(true) }} className="p-1 text-zinc-500 hover:text-accent"><Pencil size={12} /></button>}
                    {can('tedci_delete') && <button onClick={() => del(t.id)} className="p-1 text-zinc-500 hover:text-red"><Trash2 size={12} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz tedarikçi yok</div>}
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
