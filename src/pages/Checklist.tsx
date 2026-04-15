import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm, showPrompt } from '@/lib/prompt'
import { Plus, Search, Pencil, Trash2, Camera, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown'
import type { ChecklistItem } from '@/types'

const ONCELIK_RENK: Record<string, string> = { dusuk: 'text-zinc-500', normal: 'text-accent', yuksek: 'text-amber', acil: 'text-red' }
const DURUM_RENK: Record<string, string> = { bekliyor: 'bg-zinc-600/20 text-zinc-400', devam: 'bg-accent/20 text-accent', tamamlandi: 'bg-green/20 text-green', iptal: 'bg-red/20 text-red' }
const DURUM_ICON: Record<string, typeof Clock> = { bekliyor: Clock, devam: AlertTriangle, tamamlandi: CheckCircle, iptal: Trash2 }

export function Checklist() {
  const { checklist, loadAll } = useStore()
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [tipFilter, setTipFilter] = useState<Set<string>>(new Set())
  const [durumFilterSet, setDurumFilterSet] = useState<Set<string>>(new Set(['bekliyor', 'devam']))
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<ChecklistItem | null>(null)
  const [detailItem, setDetailItem] = useState<ChecklistItem | null>(null)

  const filtered = useMemo(() => {
    return checklist.filter(c => {
      if (tipFilter.size > 0 && !tipFilter.has(c.tip)) return false
      if (durumFilterSet.size > 0 && !durumFilterSet.has(c.durum)) return false
      if (search) return (c.baslik + c.aciklama + c.atanan + c.kategori).toLowerCase().includes(search.toLowerCase())
      return true
    }).sort((a, b) => {
      const op = { acil: 0, yuksek: 1, normal: 2, dusuk: 3 }
      return (op[a.oncelik] || 2) - (op[b.oncelik] || 2) || (b.tarih || '').localeCompare(a.tarih || '')
    })
  }, [checklist, search, tipFilter, durumFilterSet])

  async function deleteCL(id: string) {
    if (!await showConfirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_checklist').delete().eq('id', id)
    loadAll(); toast.success('Silindi')
  }

  async function toggleDurum(item: ChecklistItem) {
    const next = item.durum === 'bekliyor' ? 'devam' : item.durum === 'devam' ? 'tamamlandi' : 'bekliyor'
    await supabase.from('uys_checklist').update({ durum: next, tamamlanma: next === 'tamamlandi' ? today() : null }).eq('id', item.id)
    loadAll()
  }

  const gorevCount = checklist.filter(c => c.tip === 'gorev' && c.durum !== 'tamamlandi' && c.durum !== 'iptal').length
  const istekCount = checklist.filter(c => c.tip === 'istek' && c.durum !== 'tamamlandi' && c.durum !== 'iptal').length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Checklist / İstekler</h1><p className="text-xs text-zinc-500">{gorevCount} görev · {istekCount} istek açık</p></div>
        <div className="flex gap-2">
          <button onClick={() => { import('xlsx').then(XLSX => {
            const rows = checklist.map(c => ({ Tip: c.tip, Başlık: c.baslik, Kategori: c.kategori, Atanan: c.atanan, Öncelik: c.oncelik, Durum: c.durum, Tarih: c.tarih, Termin: c.termin }))
            const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Checklist'); XLSX.writeFile(wb, 'checklist.xlsx')
          })}} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
          {can('check_add') && <button onClick={async () => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Ekle</button>}
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>
        <MultiCheckDropdown label="Tip" options={[
          { value: 'gorev', label: 'Görevler' },
          { value: 'istek', label: 'İstekler' },
        ]} selected={tipFilter} onChange={setTipFilter} />
        <MultiCheckDropdown label="Durum" options={[
          { value: 'bekliyor', label: 'Bekliyor' },
          { value: 'devam', label: 'Devam Ediyor' },
          { value: 'tamamlandi', label: 'Tamamlanan' },
        ]} selected={durumFilterSet} onChange={setDurumFilterSet} />
      </div>

      <div className="space-y-2">
        {filtered.map(c => {
          const DurumIcon = DURUM_ICON[c.durum] || Clock
          return (
            <div key={c.id} className={`bg-bg-2 border rounded-lg p-3 hover:border-border-2 transition-colors ${c.durum === 'tamamlandi' ? 'border-green/20 opacity-60' : c.oncelik === 'acil' ? 'border-red/30' : 'border-border'}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => toggleDurum(c)} className={`mt-0.5 p-1 rounded ${DURUM_RENK[c.durum]}`} title={c.durum}>
                  <DurumIcon size={14} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.tip === 'istek' ? 'bg-purple-500/20 text-purple-400' : 'bg-accent/20 text-accent'}`}>{c.tip === 'istek' ? 'İSTEK' : 'GÖREV'}</span>
                    <span className={`text-[10px] font-semibold ${ONCELIK_RENK[c.oncelik]}`}>{c.oncelik.toUpperCase()}</span>
                    {c.kategori && <span className="text-[10px] px-1.5 py-0.5 bg-bg-3 rounded text-zinc-500">{c.kategori}</span>}
                    {c.resimler?.length > 0 && <span className="text-[10px] text-zinc-500"><Camera size={10} className="inline" /> {c.resimler.length}</span>}
                  </div>
                  <div className={`text-sm font-medium ${c.durum === 'tamamlandi' ? 'line-through text-zinc-500' : ''}`}>{c.baslik}</div>
                  {c.aciklama && <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{c.aciklama}</div>}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-600">
                    {c.atanan && <span>👤 {c.atanan}</span>}
                    <span>{c.tarih}</span>
                    {c.termin && <span className={c.termin < today() && c.durum !== 'tamamlandi' ? 'text-red font-semibold' : ''}>Termin: {c.termin}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setDetailItem(c)} className="p-1 text-zinc-500 hover:text-accent"><Camera size={13} /></button>
                  {can('check_edit') && <button onClick={async () => { setEditItem(c); setShowForm(true) }} className="p-1 text-zinc-500 hover:text-amber"><Pencil size={13} /></button>}
                  {can('check_delete') && <button onClick={() => deleteCL(c.id)} className="p-1 text-zinc-500 hover:text-red"><Trash2 size={13} /></button>}
                </div>
              </div>
            </div>
          )
        })}
        {!filtered.length && <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-zinc-600 text-sm">Kayıt yok</div>}
      </div>

      {showForm && <CLFormModal initial={editItem} onClose={() => { setShowForm(false); setEditItem(null) }} onSaved={() => { setShowForm(false); setEditItem(null); loadAll(); toast.success(editItem ? 'Güncellendi' : 'Oluşturuldu') }} />}
      {detailItem && <CLDetailModal item={detailItem} onClose={() => setDetailItem(null)} onUpdated={() => { setDetailItem(null); loadAll() }} />}
    </div>
  )
}

function CLFormModal({ initial, onClose, onSaved }: { initial: ChecklistItem | null; onClose: () => void; onSaved: () => void }) {
  const { checklist } = useStore()
  const [tip, setTip] = useState<string>(initial?.tip || 'gorev')
  const [baslik, setBaslik] = useState(initial?.baslik || '')
  const [aciklama, setAciklama] = useState(initial?.aciklama || '')
  const [atanan, setAtanan] = useState(initial?.atanan || '')
  const [oncelik, setOncelik] = useState<string>(initial?.oncelik || 'normal')
  const [termin, setTermin] = useState(initial?.termin || '')
  const [kategori, setKategori] = useState(initial?.kategori || '')

  async function save() {
    if (!baslik.trim()) { toast.error('Başlık zorunlu'); return }
    const row = { tip, baslik: baslik.trim(), aciklama, atanan, oncelik, termin, kategori, tarih: today(), olusturan: 'admin' }
    if (initial?.id) {
      await supabase.from('uys_checklist').update(row).eq('id', initial.id)
    } else {
      await supabase.from('uys_checklist').insert({ id: uid(), ...row, durum: 'bekliyor', resimler: [] })
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Düzenle' : 'Yeni Görev/İstek'}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Tip</label>
            <select value={tip} onChange={e => setTip(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
              <option value="gorev">Görev</option><option value="istek">İstek</option>
            </select></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Öncelik</label>
            <select value={oncelik} onChange={e => setOncelik(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
              <option value="dusuk">Düşük</option><option value="normal">Normal</option><option value="yuksek">Yüksek</option><option value="acil">Acil</option>
            </select></div>
          </div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Başlık *</label>
          <input value={baslik} onChange={e => setBaslik(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Açıklama</label>
          <textarea value={aciklama} onChange={e => setAciklama(e.target.value)} rows={3} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 resize-none focus:outline-none focus:border-accent" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Atanan</label>
            <select value={atanan} onChange={async e => {
              if (e.target.value === '_yeni') {
                const yeni = await showPrompt('Yeni kişi ekle', 'İsim')
                if (yeni) setAtanan(yeni.trim())
              } else setAtanan(e.target.value)
            }} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
              <option value="">— Seçin —</option>
              {[...new Set(checklist.map(c => c.atanan).filter(Boolean))].sort().map(a => <option key={a} value={a}>{a}</option>)}
              <option value="_yeni">+ Yeni kişi...</option>
            </select></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Termin</label>
            <input type="date" value={termin} onChange={e => setTermin(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none" /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Kategori</label>
            <select value={kategori} onChange={e => setKategori(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
              <option value="">— Seçin —</option>
              <option>Üretim</option><option>Kalite</option><option>Bakım</option><option>İSG</option><option>Genel</option>
              {[...new Set(checklist.map(c => c.kategori).filter(k => k && !['Üretim','Kalite','Bakım','İSG','Genel'].includes(k)))].map(k => <option key={k} value={k}>{k}</option>)}
            </select></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
    </div>
  )
}

// Detay + Resim Yükleme Modal
function CLDetailModal({ item, onClose, onUpdated }: { item: ChecklistItem; onClose: () => void; onUpdated: () => void }) {
  const [uploading, setUploading] = useState(false)

  async function uploadImage() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setUploading(true)

      // Resize image if too large (max 800px)
      const resized = await resizeImage(file, 800)
      const fileName = `${item.id}_${Date.now()}.jpg`

      const { error } = await supabase.storage.from('checklist-images').upload(fileName, resized, { contentType: 'image/jpeg' })
      if (error) {
        // Storage yoksa base64 fallback
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = reader.result as string
          const resimler = [...(item.resimler || []), { url: base64, ad: file.name, tarih: today() }]
          await supabase.from('uys_checklist').update({ resimler }).eq('id', item.id)
          setUploading(false); onUpdated(); toast.success('Resim eklendi (base64)')
        }
        reader.readAsDataURL(resized)
        return
      }

      const { data: urlData } = supabase.storage.from('checklist-images').getPublicUrl(fileName)
      const resimler = [...(item.resimler || []), { url: urlData.publicUrl, ad: file.name, tarih: today() }]
      await supabase.from('uys_checklist').update({ resimler }).eq('id', item.id)
      setUploading(false); onUpdated(); toast.success('Resim eklendi')
    }
    input.click()
  }

  async function deleteImage(idx: number) {
    const resimler = (item.resimler || []).filter((_, i) => i !== idx)
    await supabase.from('uys_checklist').update({ resimler }).eq('id', item.id)
    onUpdated(); toast.success('Resim silindi')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.tip === 'istek' ? 'bg-purple-500/20 text-purple-400' : 'bg-accent/20 text-accent'}`}>{item.tip === 'istek' ? 'İSTEK' : 'GÖREV'}</span>
              <span className={`text-[10px] font-semibold ${ONCELIK_RENK[item.oncelik]}`}>{item.oncelik.toUpperCase()}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${DURUM_RENK[item.durum]}`}>{item.durum}</span>
            </div>
            <h2 className="text-lg font-semibold">{item.baslik}</h2>
            {item.aciklama && <p className="text-xs text-zinc-400 mt-1">{item.aciklama}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
          <div className="bg-bg-2 border border-border rounded-lg p-2"><span className="text-zinc-500">Atanan:</span> {item.atanan || '—'}</div>
          <div className="bg-bg-2 border border-border rounded-lg p-2"><span className="text-zinc-500">Tarih:</span> {item.tarih}</div>
          <div className="bg-bg-2 border border-border rounded-lg p-2"><span className="text-zinc-500">Termin:</span> {item.termin || '—'}</div>
        </div>

        {/* Resimler */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Resimler ({item.resimler?.length || 0})</h3>
            <button onClick={uploadImage} disabled={uploading} className="flex items-center gap-1 px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
              <Camera size={12} /> {uploading ? 'Yükleniyor...' : 'Resim Ekle'}
            </button>
          </div>
          {item.resimler?.length ? (
            <div className="grid grid-cols-3 gap-2">
              {item.resimler.map((r, i) => (
                <div key={i} className="relative group">
                  <img src={r.url} alt={r.ad} className="w-full h-32 object-cover rounded-lg border border-border" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-lg px-2 py-1 text-[9px] text-zinc-300">{r.tarih}</div>
                  <button onClick={() => deleteImage(i)} className="absolute top-1 right-1 p-1 bg-black/60 rounded text-red opacity-0 group-hover:opacity-100"><Trash2 size={10} /></button>
                </div>
              ))}
            </div>
          ) : <div className="p-4 text-center text-zinc-600 text-xs border border-dashed border-border rounded-lg">Henüz resim yok — yukarıdaki butona tıkla</div>}
        </div>

        {item.notlar && (
          <div className="bg-bg-2 border border-border rounded-lg p-3 text-xs text-zinc-400"><span className="text-zinc-500 font-semibold">Notlar:</span> {item.notlar}</div>
        )}
      </div>
    </div>
  )
}

// Resim boyutlandırma
function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let w = img.width, h = img.height
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize }
        else { w = Math.round(w * maxSize / h); h = maxSize }
      }
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.8)
    }
    img.src = URL.createObjectURL(file)
  })
}
