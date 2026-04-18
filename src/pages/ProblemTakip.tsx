import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { CLIENT_ID } from '@/hooks/useRealtime'
import { Search, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react'
import type { Problem } from '@/types'

const DURUM_OPTIONS = ['Açık', 'Devam', 'Kapandı']

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const parts = iso.slice(0, 10).split('-')
  if (parts.length !== 3) return iso
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function fmtDT(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`
}

function isOverdue(p: Problem): boolean {
  if (p.durum === 'Kapandı' || !p.termin) return false
  return p.termin < today()
}

function durumBadge(d: string) {
  const m: Record<string, string> = {
    'Açık': 'bg-red/15 text-red border-red/30',
    'Devam': 'bg-amber/15 text-amber border-amber/30',
    'Kapandı': 'bg-green/15 text-green border-green/30',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${m[d] || 'bg-bg-3 text-zinc-400 border-border'}`}>
      {d}
    </span>
  )
}

export function ProblemTakip() {
  const { problemler, reloadTables } = useStore()
  const { can, user } = useAuth()
  const [search, setSearch] = useState('')
  const [filterDurum, setFilterDurum] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Problem | null>(null)

  const filtered = useMemo(() => {
    let items = [...problemler]
    if (filterDurum) items = items.filter(p => p.durum === filterDurum)
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(p =>
        (p.problem + ' ' + p.sorumlu + ' ' + p.yapilanlar + ' ' + p.notlar)
          .toLowerCase().includes(q))
    }
    // Sıralama: geciken üstte, sonra durum öncelik (Açık → Devam → Kapandı), sonra termin
    return items.sort((a, b) => {
      const aOver = isOverdue(a), bOver = isOverdue(b)
      if (aOver !== bOver) return aOver ? -1 : 1
      const order: Record<string, number> = { 'Açık': 0, 'Devam': 1, 'Kapandı': 2 }
      const ao = order[a.durum] ?? 9, bo = order[b.durum] ?? 9
      if (ao !== bo) return ao - bo
      // aynı durumda olanlar: termin yakın olan üstte, termini yoksa alta
      if (!a.termin && !b.termin) return 0
      if (!a.termin) return 1
      if (!b.termin) return -1
      return a.termin.localeCompare(b.termin)
    })
  }, [problemler, search, filterDurum])

  const kpi = useMemo(() => ({
    total: problemler.length,
    acik: problemler.filter(p => p.durum !== 'Kapandı').length,
    geciken: problemler.filter(p => isOverdue(p)).length,
  }), [problemler])

  const lastChange = useMemo(() => {
    const sorted = problemler
      .filter(p => p.sonDegistirme)
      .sort((a, b) => b.sonDegistirme.localeCompare(a.sonDegistirme))
    return sorted[0]
  }, [problemler])

  async function del(id: string) {
    if (!await showConfirm('Bu problemi silmek istediğinize emin misiniz?')) return
    const res = await supabase.from('pt_problemler').delete().eq('id', id)
    if (res.error) { toast.error('Silinemedi: ' + res.error.message); return }
    reloadTables(['pt_problemler'])
    toast.success('Problem silindi')
  }

  async function save(data: Partial<Problem>, editId?: string) {
    const now = new Date().toISOString()
    const username = user?.username || 'Bilinmiyor'

    const row: Record<string, unknown> = {
      problem: data.problem,
      termin: data.termin || null,
      sorumlu: data.sorumlu || '',
      durum: data.durum,
      yapilanlar: data.yapilanlar || '',
      notlar: data.notlar || '',
      son_degistiren: username,
      son_degistirme: now,
      __client: CLIENT_ID,
    }

    // Durum='Kapandı' + henüz kapatma tarihi yoksa bugünü set et
    if (data.durum === 'Kapandı') {
      const prevKapatma = editItem?.kapatmaTarihi
      row.kapatma_tarihi = prevKapatma || today()
    } else {
      row.kapatma_tarihi = null
    }

    if (editId) {
      const res = await supabase.from('pt_problemler').update(row).eq('id', editId)
      if (res.error) { toast.error('Güncellenemedi: ' + res.error.message); return }
      toast.success('Güncellendi')
    } else {
      row.id = uid()
      row.olusturan = username
      row.olusturma = now
      const res = await supabase.from('pt_problemler').insert(row)
      if (res.error) { toast.error('Eklenemedi: ' + res.error.message); return }
      toast.success('Eklendi')
    }
    reloadTables(['pt_problemler'])
    setShowForm(false)
    setEditItem(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Problem Takip</h1>
          <p className="text-xs text-zinc-500">{problemler.length} kayıt</p>
        </div>
        {can('pt_add') && (
          <button
            onClick={() => { setEditItem(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"
          >
            <Plus size={13} /> Yeni Problem
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-bg-2 border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Toplam</div>
          <div className="text-2xl font-bold font-mono">{kpi.total}</div>
        </div>
        <div className="bg-bg-2 border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Açık / Devam</div>
          <div className={`text-2xl font-bold font-mono ${kpi.acik > 0 ? 'text-amber' : 'text-zinc-500'}`}>
            {kpi.acik}
          </div>
        </div>
        <div className="bg-bg-2 border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Geciken</div>
          <div className={`text-2xl font-bold font-mono ${kpi.geciken > 0 ? 'text-red' : 'text-zinc-500'}`}>
            {kpi.geciken}
          </div>
        </div>
      </div>

      {/* Son değişiklik barı */}
      {lastChange && (
        <div className="bg-accent/5 border border-accent/20 rounded-lg px-3 py-2 mb-4 text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
          <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
          <span>Son değişiklik:</span>
          <span className="text-accent font-semibold">{lastChange.sonDegistiren}</span>
          <span className="text-zinc-500">—</span>
          <span className="truncate max-w-md text-zinc-300">{lastChange.problem}</span>
          <span className="text-zinc-500 ml-auto font-mono">{fmtDT(lastChange.sonDegistirme)}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Problem, sorumlu, yapılanlar..."
            className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={filterDurum}
          onChange={e => setFilterDurum(e.target.value)}
          className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs focus:outline-none focus:border-accent"
        >
          <option value="">Tüm durumlar</option>
          {DURUM_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="ml-auto text-xs text-zinc-500">
          Gösterilen: <span className="text-accent">{filtered.length}</span> / {problemler.length}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-zinc-500">
                  <th className="text-left px-3 py-2.5 w-10">#</th>
                  <th className="text-left px-3 py-2.5">Problem</th>
                  <th className="text-left px-3 py-2.5 w-24">Termin</th>
                  <th className="text-left px-3 py-2.5 w-28">Sorumlu</th>
                  <th className="text-left px-3 py-2.5 w-20">Durum</th>
                  <th className="text-left px-3 py-2.5 w-40">Son Değişiklik</th>
                  <th className="px-3 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const overdue = isOverdue(p)
                  const clickable = can('pt_edit')
                  return (
                    <tr
                      key={p.id}
                      onClick={() => { if (clickable) { setEditItem(p); setShowForm(true) } }}
                      className={`border-b border-border/30 hover:bg-bg-3/30 ${clickable ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-3 py-2 font-mono text-zinc-500">{i + 1}</td>
                      <td className="px-3 py-2 text-zinc-200 max-w-[500px]">
                        <div className="line-clamp-2">{p.problem}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {p.termin ? (
                          <span className={overdue ? 'text-red font-semibold' : 'text-zinc-400'}>
                            {fmtDate(p.termin)} {overdue && <AlertCircle size={10} className="inline ml-0.5 -mt-0.5" />}
                          </span>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-3 py-2 text-zinc-300">{p.sorumlu || '—'}</td>
                      <td className="px-3 py-2">{durumBadge(p.durum)}</td>
                      <td className="px-3 py-2 text-[11px] text-zinc-500 font-mono">
                        {p.sonDegistiren ? (
                          <>
                            <div className="text-zinc-400">{p.sonDegistiren}</div>
                            <div className="text-zinc-600">{fmtDT(p.sonDegistirme)}</div>
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {can('pt_edit') && (
                          <button
                            onClick={() => { setEditItem(p); setShowForm(true) }}
                            className="p-1 text-zinc-500 hover:text-accent"
                            title="Düzenle"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {can('pt_delete') && (
                          <button
                            onClick={() => del(p.id)}
                            className="p-1 text-zinc-500 hover:text-red"
                            title="Sil"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-600 text-sm">
            {search || filterDurum ? 'Filtreye uyan kayıt yok' : 'Henüz problem yok'}
          </div>
        )}
      </div>

      {showForm && (
        <ProblemFormModal
          initial={editItem}
          currentUser={user?.username || ''}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onSave={save}
        />
      )}
    </div>
  )
}

// ═══ MODAL ═══
function ProblemFormModal({
  initial, currentUser, onClose, onSave,
}: {
  initial: Problem | null
  currentUser: string
  onClose: () => void
  onSave: (data: Partial<Problem>, editId?: string) => void
}) {
  const [problem, setProblem] = useState(initial?.problem || '')
  const [termin, setTermin] = useState(initial?.termin?.slice(0, 10) || '')
  const [sorumlu, setSorumlu] = useState(initial?.sorumlu || '')
  const [durum, setDurum] = useState(initial?.durum || 'Açık')
  const [yapilanlar, setYapilanlar] = useState(initial?.yapilanlar || '')
  const [notlar, setNotlar] = useState(initial?.notlar || '')

  function eklYeniAksiyon() {
    const t = new Date()
    const dd = String(t.getDate()).padStart(2, '0')
    const mm = String(t.getMonth() + 1).padStart(2, '0')
    const hh = String(t.getHours()).padStart(2, '0')
    const mi = String(t.getMinutes()).padStart(2, '0')
    const stamp = `— ${dd}.${mm}.${t.getFullYear()} ${hh}:${mi} / ${currentUser || '?'}: `
    const sep = yapilanlar.trim() ? '\n\n' : ''
    const yeniVal = yapilanlar + sep + stamp
    setYapilanlar(yeniVal)
    setTimeout(() => {
      const ta = document.getElementById('pt-yapilanlar') as HTMLTextAreaElement | null
      if (ta) {
        ta.focus()
        ta.setSelectionRange(yeniVal.length, yeniVal.length)
        ta.scrollTop = ta.scrollHeight
      }
    }, 10)
  }

  function submit() {
    if (!problem.trim()) {
      toast.error('Problem tanımı zorunlu')
      return
    }
    onSave({
      problem: problem.trim(),
      termin,
      sorumlu: sorumlu.trim(),
      durum,
      yapilanlar,
      notlar,
    }, initial?.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="bg-bg-1 border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-bg-1 z-10">
          <h2 className="text-base font-semibold">
            {initial ? `Problemi Düzenle` : 'Yeni Problem Ekle'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Problem Tanımı *</label>
            <textarea
              value={problem}
              onChange={e => setProblem(e.target.value)}
              autoFocus
              rows={3}
              placeholder="Problemi açıklayın..."
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent resize-y"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Termin</label>
              <input
                type="date"
                value={termin}
                onChange={e => setTermin(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Sorumlu</label>
              <input
                value={sorumlu}
                onChange={e => setSorumlu(e.target.value)}
                placeholder="Ad Soyad"
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Durum</label>
              <select
                value={durum}
                onChange={e => setDurum(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              >
                {DURUM_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-zinc-500">Yapılanlar / Aksiyon Tarihçesi</label>
              <button
                type="button"
                onClick={eklYeniAksiyon}
                className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent hover:bg-accent/20 rounded border border-accent/30"
              >
                + Yeni Aksiyon Ekle
              </button>
            </div>
            <textarea
              id="pt-yapilanlar"
              value={yapilanlar}
              onChange={e => setYapilanlar(e.target.value)}
              rows={7}
              placeholder='Butona basın: otomatik olarak "— tarih-saat / isim:" damgası eklenir, yanına yazdığınız metin tarihçeye birikir.'
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent resize-y font-mono text-[12px] leading-relaxed"
            />
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Notlar (opsiyonel)</label>
            <textarea
              value={notlar}
              onChange={e => setNotlar(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent resize-y"
            />
          </div>

          {initial && (
            <div className="text-[10px] text-zinc-600 font-mono border-t border-border pt-3 space-y-0.5">
              <div>
                Oluşturan: <span className="text-zinc-500">{initial.olusturan || '—'}</span>
                {initial.olusturma && <> · <span className="text-zinc-500">{fmtDT(initial.olusturma)}</span></>}
              </div>
              {initial.sonDegistiren && (
                <div>
                  Son değiştiren: <span className="text-zinc-500">{initial.sonDegistiren}</span>
                  <> · <span className="text-zinc-500">{fmtDT(initial.sonDegistirme)}</span></>
                </div>
              )}
              {initial.kapatmaTarihi && (
                <div>
                  Kapatma tarihi: <span className="text-green">{fmtDate(initial.kapatmaTarihi)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-bg-1">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white"
          >
            İptal
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"
          >
            {initial ? 'Güncelle' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}
