import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { getHelpFor } from '@/lib/helpContent'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { HelpCircle, StickyNote, X, Trash2, Edit3, Check, Plus } from 'lucide-react'

interface Note {
  id: string
  sayfa: string
  baslik: string
  icerik: string
  yazan: string
  etiketler: string[]
  tarih: string
  saat: string
}

export function HelpNotesButtons({ username }: { username: string }) {
  const [mode, setMode] = useState<null | 'help' | 'notes'>(null)

  return (
    <>
      <button onClick={() => setMode('help')}
        title="Sayfa yardımı"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-3 text-zinc-400 hover:text-accent">
        <HelpCircle size={16} />
      </button>
      <button onClick={() => setMode('notes')}
        title="Ekip notları"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-3 text-zinc-400 hover:text-amber">
        <StickyNote size={16} />
      </button>
      {mode === 'help' && <HelpModal onClose={() => setMode(null)} />}
      {mode === 'notes' && <NotesModal onClose={() => setMode(null)} username={username} />}
    </>
  )
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const location = useLocation()
  const help = getHelpFor(location.pathname)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle size={20} className="text-accent" />
            <h2 className="text-lg font-semibold">{help ? help.title : 'Yardım'}</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        {help ? (
          <>
            <p className="text-sm text-zinc-400 mb-5 leading-relaxed">{help.ozet}</p>
            <div className="space-y-4">
              {help.bolumler.map((b, i) => (
                <div key={i} className="bg-bg-2/50 border border-border/50 rounded-lg p-3">
                  <div className="text-sm font-semibold text-accent mb-1.5">{b.baslik}</div>
                  <div className="text-xs text-zinc-300 leading-relaxed">{b.icerik}</div>
                </div>
              ))}
            </div>
            {help.ipuclari && help.ipuclari.length > 0 && (
              <div className="mt-5 p-3 bg-amber/5 border border-amber/20 rounded-lg">
                <div className="text-xs font-semibold text-amber mb-2">💡 İpuçları</div>
                <ul className="text-xs text-zinc-300 space-y-1">
                  {help.ipuclari.map((t, i) => <li key={i}>• {t}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-zinc-500 py-8 text-center">
            Bu sayfa için yardım içeriği henüz hazırlanmadı.
          </div>
        )}
      </div>
    </div>
  )
}

function NotesModal({ onClose, username }: { onClose: () => void; username: string }) {
  const location = useLocation()
  const sayfa = location.pathname.split('?')[0] || '/'
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'sayfa' | 'all'>('sayfa')
  const [editId, setEditId] = useState<string | null>(null)
  const [editBaslik, setEditBaslik] = useState('')
  const [editIcerik, setEditIcerik] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')

  async function loadNotes() {
    setLoading(true)
    const { data } = await supabase.from('uys_notes').select('*').order('tarih', { ascending: false })
    setNotes((data || []).map(n => ({
      id: n.id, sayfa: n.sayfa, baslik: n.baslik || '', icerik: n.icerik || '',
      yazan: n.yazan || '', etiketler: n.etiketler || [], tarih: n.tarih, saat: n.saat || '',
    })))
    setLoading(false)
  }

  useEffect(() => { loadNotes() }, [])

  const filtered = useMemo(() => {
    let list = notes
    if (filter === 'sayfa') list = list.filter(n => n.sayfa === sayfa)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(n => (n.baslik + ' ' + n.icerik + ' ' + n.yazan).toLowerCase().includes(q))
    }
    return list
  }, [notes, filter, sayfa, search])

  async function saveNote() {
    if (!editIcerik.trim()) { toast.error('İçerik boş olamaz'); return }
    const now = new Date()
    const saat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    if (editId) {
      await supabase.from('uys_notes').update({
        baslik: editBaslik.trim(), icerik: editIcerik.trim(),
      }).eq('id', editId)
      toast.success('Not güncellendi')
    } else {
      await supabase.from('uys_notes').insert({
        id: uid(), sayfa, baslik: editBaslik.trim(), icerik: editIcerik.trim(),
        yazan: username, tarih: today(), saat, etiketler: [],
      })
      toast.success('Not eklendi')
    }
    setEditId(null); setShowNew(false); setEditBaslik(''); setEditIcerik('')
    loadNotes()
  }

  async function deleteNote(id: string) {
    if (!await showConfirm('Bu notu silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_notes').delete().eq('id', id)
    toast.success('Not silindi')
    loadNotes()
  }

  function startEdit(n: Note) {
    setEditId(n.id); setEditBaslik(n.baslik); setEditIcerik(n.icerik); setShowNew(false)
  }

  function startNew() {
    setEditId(null); setShowNew(true); setEditBaslik(''); setEditIcerik('')
  }

  const isEditing = editId !== null || showNew

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StickyNote size={20} className="text-amber" />
            <h2 className="text-lg font-semibold">Ekip Notları</h2>
            <span className="text-[10px] text-zinc-500 font-mono">({notes.length} toplam)</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        {/* Filtre + arama + yeni */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex rounded-lg overflow-hidden border border-border text-[11px]">
            <button onClick={() => setFilter('sayfa')} className={`px-3 py-1.5 ${filter === 'sayfa' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400 hover:text-zinc-200'}`}>
              Bu Sayfa ({notes.filter(n => n.sayfa === sayfa).length})
            </button>
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 ${filter === 'all' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400 hover:text-zinc-200'}`}>
              Tümü
            </button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..."
            className="flex-1 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
          {!isEditing && (
            <button onClick={startNew} className="px-3 py-1.5 bg-amber/20 border border-amber/30 text-amber rounded-lg text-xs hover:bg-amber/30 flex items-center gap-1">
              <Plus size={12} /> Yeni Not
            </button>
          )}
        </div>

        {/* Düzenleme formu */}
        {isEditing && (
          <div className="mb-3 p-3 bg-amber/5 border border-amber/25 rounded-lg">
            <input value={editBaslik} onChange={e => setEditBaslik(e.target.value)}
              placeholder="Başlık (opsiyonel)" autoFocus
              className="w-full px-2 py-1.5 mb-2 bg-bg-2 border border-border rounded text-sm text-zinc-200 focus:outline-none focus:border-accent" />
            <MarkdownTextarea value={editIcerik} onChange={setEditIcerik} />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setEditId(null); setShowNew(false); setEditBaslik(''); setEditIcerik('') }}
                className="px-3 py-1.5 bg-bg-3 text-zinc-400 rounded text-xs hover:text-white">İptal</button>
              <button onClick={saveNote}
                className="px-3 py-1.5 bg-amber hover:bg-amber/80 text-bg-1 rounded text-xs font-semibold flex items-center gap-1">
                <Check size={12} /> {editId ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        )}

        {/* Notlar listesi */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center text-zinc-500 py-8">Yükleniyor...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-zinc-600 py-8 text-sm">
              {filter === 'sayfa' ? 'Bu sayfa için not yok. Yeni not ekleyin.' : 'Henüz not yok.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(n => (
                <div key={n.id} className="p-3 bg-bg-2/50 border border-border/50 rounded-lg hover:border-border">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      {n.baslik && <div className="text-sm font-semibold text-zinc-200 mb-0.5">{n.baslik}</div>}
                      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                        <span className="font-mono">{n.tarih}{n.saat ? ' ' + n.saat : ''}</span>
                        <span>•</span>
                        <span>{n.yazan || 'anonim'}</span>
                        {filter === 'all' && <>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 bg-bg-3 rounded font-mono">{n.sayfa}</span>
                        </>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(n)} className="p-1 text-zinc-500 hover:text-amber" title="Düzenle"><Edit3 size={12} /></button>
                      <button onClick={() => deleteNote(n.id)} className="p-1 text-zinc-500 hover:text-red" title="Sil"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <MarkdownRender text={n.icerik} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Markdown textarea — bold/italic/başlık shortcut'ları
function MarkdownTextarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function insertAround(before: string, after: string = before) {
    const ta = document.getElementById('note-textarea') as HTMLTextAreaElement
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const sel = value.substring(start, end)
    const newVal = value.substring(0, start) + before + sel + after + value.substring(end)
    onChange(newVal)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  return (
    <>
      <div className="flex gap-1 mb-1.5">
        <button onClick={() => insertAround('**')} title="Bold"
          className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white font-bold">B</button>
        <button onClick={() => insertAround('*')} title="İtalik"
          className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white italic">I</button>
        <button onClick={() => insertAround('`')} title="Kod"
          className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white font-mono">{'<>'}</button>
        <button onClick={() => insertAround('\n# ', '')} title="Başlık"
          className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">H</button>
        <button onClick={() => insertAround('\n- ', '')} title="Liste"
          className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">•</button>
      </div>
      <textarea id="note-textarea" value={value} onChange={e => onChange(e.target.value)}
        placeholder="Not içeriği... (Bold: **x**, İtalik: *x*, Kod: `x`, Başlık: # x, Liste: - x)"
        rows={6}
        className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent font-mono resize-y" />
    </>
  )
}

// Basit markdown render — bold, italic, code, başlık, liste, link
function MarkdownRender({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split('\n')
  const rendered: React.ReactNode[] = []
  let listBuf: string[] = []

  function flushList() {
    if (listBuf.length > 0) {
      rendered.push(
        <ul key={'list-' + rendered.length} className="list-disc ml-5 my-1 text-xs text-zinc-300">
          {listBuf.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>
      )
      listBuf = []
    }
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listBuf.push(trimmed.slice(2))
      return
    }
    flushList()
    if (trimmed.startsWith('# ')) {
      rendered.push(<div key={i} className="text-sm font-bold text-accent mt-2 mb-1">{renderInline(trimmed.slice(2))}</div>)
    } else if (trimmed.startsWith('## ')) {
      rendered.push(<div key={i} className="text-xs font-bold text-accent/80 mt-2 mb-1">{renderInline(trimmed.slice(3))}</div>)
    } else if (trimmed === '') {
      rendered.push(<div key={i} className="h-1" />)
    } else {
      rendered.push(<div key={i} className="text-xs text-zinc-300 leading-relaxed">{renderInline(line)}</div>)
    }
  })
  flushList()

  return <div className="space-y-0.5">{rendered}</div>
}

function renderInline(text: string): React.ReactNode {
  // Order: code > bold > italic > link
  const parts: React.ReactNode[] = []
  let rest = text
  let key = 0
  const patterns = [
    { regex: /`([^`]+)`/, wrap: (m: string) => <code key={key++} className="px-1 py-0.5 bg-bg-3 rounded text-[10px] font-mono text-amber">{m}</code> },
    { regex: /\*\*([^*]+)\*\*/, wrap: (m: string) => <strong key={key++} className="font-bold text-zinc-100">{m}</strong> },
    { regex: /\*([^*]+)\*/, wrap: (m: string) => <em key={key++} className="italic">{m}</em> },
  ]
  while (rest.length > 0) {
    let earliest: { start: number; end: number; content: string; wrap: (m: string) => React.ReactNode } | null = null
    for (const p of patterns) {
      const match = p.regex.exec(rest)
      if (match && (earliest === null || match.index < earliest.start)) {
        earliest = { start: match.index, end: match.index + match[0].length, content: match[1], wrap: p.wrap }
      }
    }
    if (!earliest) {
      parts.push(rest)
      break
    }
    if (earliest.start > 0) parts.push(rest.slice(0, earliest.start))
    parts.push(earliest.wrap(earliest.content))
    rest = rest.slice(earliest.end)
  }
  return <>{parts}</>
}
