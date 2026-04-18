import { useState, useMemo, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { Search, Send, Trash2, Check, CheckCheck, AlertTriangle, Volume2, VolumeX, Bell, BellOff } from 'lucide-react'
import type { OperatorNote, OperatorNoteKategori, OperatorNoteOncelik } from '@/types'
import { OPERATOR_NOTE_KATEGORILER } from '@/types'
import {
  isSoundEnabled, setSoundEnabled,
  requestNotificationPermission, getNotificationPermission,
} from '@/hooks/useMessageNotifications'

const isAdmin = (n: OperatorNote) => (n.opAd || '').includes('Yönetim')

export function Messages() {
  const { operatorNotes, operators, loadAll } = useStore()
  const { can } = useAuth()
  const [selectedOprId, setSelectedOprId] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [filterKategori, setFilterKategori] = useState<OperatorNoteKategori | ''>('')
  const [filterOncelik, setFilterOncelik] = useState<OperatorNoteOncelik | ''>('')
  // Admin cevap gönderirken kategori/öncelik (opsiyonel)
  const [replyKategori, setReplyKategori] = useState<OperatorNoteKategori | ''>('')
  const [replyOncelik, setReplyOncelik] = useState<OperatorNoteOncelik>('Normal')
  const [soundOn, setSoundOn] = useState<boolean>(isSoundEnabled())
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(getNotificationPermission())
  const scrollRef = useRef<HTMLDivElement>(null)

  const canSend = can('opr_mesaj')

  // Konuşma özetleri — her operatör için
  const conversations = useMemo(() => {
    const byOpId = new Map<string, {
      opId: string; opAd: string
      lastMsg: OperatorNote | null
      unreadCount: number
      unreadAcilCount: number
      msgCount: number
      hasAcil: boolean
    }>()

    // Önce aktif operatörleri ekle (henüz mesajı olmayanlar için de giriş noktası olsun)
    operators.filter(o => o.aktif !== false).forEach(o => {
      byOpId.set(o.id, { opId: o.id, opAd: o.ad, lastMsg: null, unreadCount: 0, unreadAcilCount: 0, msgCount: 0, hasAcil: false })
    })

    // Mesajlardan güncelle
    for (const n of operatorNotes) {
      if (!byOpId.has(n.opId)) {
        const firstOpMsg = operatorNotes.find(x => x.opId === n.opId && !isAdmin(x))
        const opAd = firstOpMsg?.opAd || operators.find(o => o.id === n.opId)?.ad || 'Bilinmeyen Operatör'
        byOpId.set(n.opId, { opId: n.opId, opAd, lastMsg: null, unreadCount: 0, unreadAcilCount: 0, msgCount: 0, hasAcil: false })
      }
      const c = byOpId.get(n.opId)!
      c.msgCount++
      if (!isAdmin(n) && !n.okundu) {
        c.unreadCount++
        if (n.oncelik === 'Acil') c.unreadAcilCount++
      }
      if (!isAdmin(n) && n.oncelik === 'Acil' && !n.okundu) c.hasAcil = true
      if (!c.lastMsg || (n.tarih + n.saat) > (c.lastMsg.tarih + c.lastMsg.saat)) c.lastMsg = n
    }

    return [...byOpId.values()].sort((a, b) => {
      // 1. Okunmamış acil olan en üstte
      if (a.hasAcil !== b.hasAcil) return a.hasAcil ? -1 : 1
      // 2. Sonra okunmamışlar
      if ((a.unreadCount > 0) !== (b.unreadCount > 0)) return a.unreadCount > 0 ? -1 : 1
      // 3. Sonra son mesaj zamanı (yeni üstte)
      const aT = a.lastMsg ? a.lastMsg.tarih + a.lastMsg.saat : ''
      const bT = b.lastMsg ? b.lastMsg.tarih + b.lastMsg.saat : ''
      if (aT !== bT) return bT.localeCompare(aT)
      // Mesajı olmayan en altta
      return a.opAd.localeCompare(b.opAd, 'tr')
    })
  }, [operatorNotes, operators])

  // Arama / filtre (kategori + öncelik)
  const filteredConv = conversations.filter(c => {
    if (search && !c.opAd.toLowerCase().includes(search.toLowerCase())) return false
    if (onlyUnread && c.unreadCount === 0) return false
    // Kategori/öncelik filtresi: operatörün mesajlarında eşleşme varsa göster
    if (filterKategori || filterOncelik) {
      const opMessages = operatorNotes.filter(n => n.opId === c.opId && !isAdmin(n))
      const hasMatch = opMessages.some(n =>
        (!filterKategori || n.kategori === filterKategori) &&
        (!filterOncelik || n.oncelik === filterOncelik)
      )
      if (!hasMatch) return false
    }
    return true
  })

  // Seçili operatör yoksa ilk unread'ı seç
  useEffect(() => {
    if (!selectedOprId && filteredConv.length > 0) {
      const firstUnread = filteredConv.find(c => c.unreadCount > 0)
      setSelectedOprId((firstUnread || filteredConv[0]).opId)
    }
  }, [filteredConv, selectedOprId])

  const selectedConv = conversations.find(c => c.opId === selectedOprId) || null
  const selectedMessages = useMemo(() => {
    if (!selectedOprId) return []
    return operatorNotes
      .filter(n => n.opId === selectedOprId)
      .sort((a, b) => (a.tarih + a.saat).localeCompare(b.tarih + b.saat))
  }, [operatorNotes, selectedOprId])

  // Seçili operatör değişince altına scroll + okundu işaretle
  useEffect(() => {
    if (!selectedOprId) return
    // Scroll en alta
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, 50)
    // Okunmamışları işaretle
    const unread = operatorNotes.filter(n => n.opId === selectedOprId && !isAdmin(n) && !n.okundu)
    if (unread.length > 0) {
      Promise.all(unread.map(n => supabase.from('uys_operator_notes').update({ okundu: true }).eq('id', n.id)))
        .then(() => loadAll())
    }
  }, [selectedOprId, operatorNotes, loadAll])

  async function send() {
    if (!mesaj.trim() || !selectedOprId || sending) return
    setSending(true)
    const now = new Date()
    const saat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    const { error } = await supabase.from('uys_operator_notes').insert({
      id: uid(), op_id: selectedOprId, op_ad: '📋 Yönetim',
      tarih: today(), saat, mesaj: mesaj.trim(), okundu: false,
      kategori: replyKategori || null, oncelik: replyOncelik,
    })
    setSending(false)
    if (error) { toast.error('Gönderilemedi: ' + error.message); return }
    setMesaj(''); setReplyKategori(''); setReplyOncelik('Normal')
    loadAll()
  }

  async function deleteMsg(id: string) {
    await supabase.from('uys_operator_notes').delete().eq('id', id)
    loadAll()
  }

  async function markAllRead() {
    const unread = operatorNotes.filter(n => !isAdmin(n) && !n.okundu)
    if (!unread.length) { toast.info('Tüm mesajlar okunmuş'); return }
    for (const n of unread) {
      await supabase.from('uys_operator_notes').update({ okundu: true }).eq('id', n.id)
    }
    loadAll(); toast.success(`${unread.length} mesaj okundu işaretlendi`)
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)
  const totalUnreadAcil = conversations.reduce((s, c) => s + c.unreadAcilCount, 0)

  // Tarih etiketi (bugün, dün, tarih)
  function formatGun(tarih: string): string {
    const t = today()
    if (tarih === t) return 'Bugün'
    const y = new Date(t); y.setDate(y.getDate() - 1)
    if (tarih === y.toISOString().slice(0, 10)) return 'Dün'
    return tarih
  }

  // Mesajları gün gruplarına böl
  const groupedMessages = useMemo(() => {
    const gruplar: { tarih: string; mesajlar: OperatorNote[] }[] = []
    for (const m of selectedMessages) {
      const last = gruplar[gruplar.length - 1]
      if (last && last.tarih === m.tarih) last.mesajlar.push(m)
      else gruplar.push({ tarih: m.tarih, mesajlar: [m] })
    }
    return gruplar
  }, [selectedMessages])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Mesajlar</h1>
          <p className="text-xs text-zinc-500">
            {conversations.length} operatör · {operatorNotes.length} mesaj
            {totalUnread > 0 && <span className="ml-2 px-1.5 py-0.5 bg-red text-white rounded text-[10px] font-mono">{totalUnread} okunmamış</span>}
            {totalUnreadAcil > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-red text-white rounded text-[10px] font-mono inline-flex items-center gap-0.5 animate-pulse">
                <AlertTriangle size={9} /> {totalUnreadAcil} ACİL
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Ses toggle */}
          <button
            onClick={() => { setSoundOn(!soundOn); setSoundEnabled(!soundOn); toast.success(!soundOn ? 'Ses açıldı' : 'Ses kapatıldı') }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"
            title={soundOn ? 'Sesli uyarı açık (tıklayarak kapat)' : 'Sesli uyarı kapalı (tıklayarak aç)'}
          >
            {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} className="text-zinc-600" />}
          </button>
          {/* Notification izin */}
          {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
            <button
              onClick={async () => {
                const result = await requestNotificationPermission()
                setNotifPerm(result)
                if (result === 'granted') toast.success('Tarayıcı bildirimleri aktif')
                else if (result === 'denied') toast.error('İzin reddedildi. Tarayıcı ayarlarından değiştirebilirsin.')
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/10 border border-accent/25 rounded-lg text-xs text-accent hover:bg-accent/15"
              title="Sayfa arka plandayken bildirim almak için izin ver"
            >
              <BellOff size={13} /> Bildirimleri Aç
            </button>
          )}
          {notifPerm === 'granted' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green/10 border border-green/20 rounded-lg text-xs text-green" title="Bildirimler aktif">
              <Bell size={13} />
            </div>
          )}
          {totalUnread > 0 && canSend && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">
              <CheckCheck size={13} /> Tümünü Okundu Yap
            </button>
          )}
        </div>
      </div>

      <div className="bg-bg-2 border border-border rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr] h-[calc(100vh-180px)] min-h-[500px]">
        {/* ═══ SOL: Operatör listesi ═══ */}
        <div className="border-r border-border flex flex-col min-h-0">
          <div className="p-2 border-b border-border space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Operatör ara..."
                className="w-full pl-7 pr-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={() => setOnlyUnread(!onlyUnread)}
              className={`w-full px-2 py-1 rounded text-[10px] transition ${onlyUnread ? 'bg-accent/15 text-accent border border-accent/25' : 'bg-bg-3 text-zinc-500 border border-border hover:text-zinc-300'}`}
            >
              {onlyUnread ? '✓ Sadece Okunmamışlar' : '○ Tümü'}
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={filterKategori}
                onChange={e => setFilterKategori(e.target.value as OperatorNoteKategori | '')}
                className="px-1.5 py-1 bg-bg-3 border border-border rounded text-[10px] text-zinc-300 focus:outline-none focus:border-accent"
              >
                <option value="">Tüm kategoriler</option>
                {OPERATOR_NOTE_KATEGORILER.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <select
                value={filterOncelik}
                onChange={e => setFilterOncelik(e.target.value as OperatorNoteOncelik | '')}
                className={`px-1.5 py-1 bg-bg-3 border rounded text-[10px] focus:outline-none focus:border-accent ${
                  filterOncelik === 'Acil' ? 'border-red/50 text-red' : 'border-border text-zinc-300'
                }`}
              >
                <option value="">Tüm öncelikler</option>
                <option value="Acil">🚨 Acil</option>
                <option value="Normal">Normal</option>
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredConv.length === 0 && (
              <div className="p-4 text-center text-xs text-zinc-600">
                {onlyUnread ? 'Okunmamış mesaj yok' : 'Operatör bulunamadı'}
              </div>
            )}
            {filteredConv.map(c => {
              const isSelected = c.opId === selectedOprId
              return (
                <div
                  key={c.opId}
                  onClick={() => setSelectedOprId(c.opId)}
                  className={`px-3 py-2 border-b border-border/30 cursor-pointer transition ${
                    isSelected
                      ? 'bg-accent/10 border-l-2 border-l-accent'
                      : c.hasAcil
                        ? 'bg-red/5 border-l-2 border-l-red hover:bg-red/10'
                        : 'hover:bg-bg-3/50 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm truncate flex-1 ${c.unreadCount > 0 ? 'font-semibold text-white' : 'text-zinc-300'}`}>{c.opAd}</span>
                    {c.unreadAcilCount > 0 && (
                      <span className="bg-red text-white text-[9px] px-1.5 py-0.5 rounded-full font-mono min-w-[18px] text-center inline-flex items-center gap-0.5 animate-pulse">
                        <AlertTriangle size={8} /> {c.unreadAcilCount}
                      </span>
                    )}
                    {c.unreadCount > 0 && c.unreadCount > c.unreadAcilCount && (
                      <span className="bg-accent text-white text-[9px] px-1.5 py-0.5 rounded-full font-mono min-w-[18px] text-center">{c.unreadCount - c.unreadAcilCount}</span>
                    )}
                  </div>
                  {c.lastMsg ? (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className={`truncate flex-1 ${isAdmin(c.lastMsg) ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {isAdmin(c.lastMsg) && <span className="text-accent">→ </span>}
                        {c.lastMsg.kategori && <span className="text-zinc-600">[{c.lastMsg.kategori}] </span>}
                        {c.lastMsg.mesaj}
                      </span>
                      <span className="text-zinc-600 text-[10px] shrink-0 font-mono">{c.lastMsg.saat}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-600 italic">henüz mesaj yok</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══ SAĞ: Chat ═══ */}
        <div className="flex flex-col min-h-0">
          {!selectedConv ? (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
              💬 Konuşma seçin
            </div>
          ) : (
            <>
              {/* Başlık */}
              <div className="px-4 py-2 border-b border-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-sm font-semibold text-accent">
                  {selectedConv.opAd.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{selectedConv.opAd}</div>
                  <div className="text-[10px] text-zinc-500">{selectedConv.msgCount} mesaj</div>
                </div>
              </div>

              {/* Mesajlar */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-bg-1/30">
                {groupedMessages.length === 0 && (
                  <div className="text-center text-xs text-zinc-600 py-8">
                    Henüz mesaj yok. Aşağıdan ilk mesajı gönder.
                  </div>
                )}
                {groupedMessages.map((grup) => (
                  <div key={grup.tarih}>
                    {/* Tarih ayracı */}
                    <div className="flex items-center justify-center my-3">
                      <span className="px-2.5 py-0.5 bg-bg-3/70 border border-border/50 rounded-full text-[10px] text-zinc-500">
                        {formatGun(grup.tarih)}
                      </span>
                    </div>
                    {/* Mesajlar */}
                    <div className="space-y-2">
                      {grup.mesajlar.map(n => {
                        const fromAdmin = isAdmin(n)
                        const isAcil = n.oncelik === 'Acil'
                        return (
                          <div key={n.id} className={`flex group ${fromAdmin ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-lg px-3 py-2 relative ${
                              isAcil
                                ? 'bg-red/15 border-2 border-red/50 ' + (fromAdmin ? 'rounded-tr-none' : 'rounded-tl-none')
                                : fromAdmin
                                  ? 'bg-accent/15 border border-accent/25 rounded-tr-none'
                                  : 'bg-bg-3 border border-border rounded-tl-none'
                            }`}>
                              {(isAcil || n.kategori) && (
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  {isAcil && (
                                    <span className="px-1.5 py-0.5 bg-red text-white text-[9px] font-bold rounded flex items-center gap-0.5">
                                      <AlertTriangle size={8} /> ACİL
                                    </span>
                                  )}
                                  {n.kategori && (
                                    <span className="px-1.5 py-0.5 bg-bg-1 border border-border text-[9px] text-zinc-300 rounded font-mono">
                                      {n.kategori}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="text-xs text-zinc-200 whitespace-pre-wrap break-words">{n.mesaj}</div>
                              <div className="flex items-center gap-1 mt-1 text-[9px] font-mono">
                                <span className="text-zinc-500">{n.saat}</span>
                                {fromAdmin && (
                                  n.okundu
                                    ? <CheckCheck size={11} className="text-accent" />
                                    : <Check size={11} className="text-zinc-600" />
                                )}
                              </div>
                              {canSend && (
                                <button
                                  onClick={() => deleteMsg(n.id)}
                                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red/80 text-white text-[10px] opacity-0 group-hover:opacity-100 transition hover:bg-red flex items-center justify-center"
                                  title="Sil"
                                >
                                  <Trash2 size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mesaj gönderme */}
              {canSend ? (
                <div className="p-3 border-t border-border space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={replyKategori}
                      onChange={e => setReplyKategori(e.target.value as OperatorNoteKategori | '')}
                      className="px-2 py-1 bg-bg-3 border border-border rounded text-[11px] text-zinc-200 focus:outline-none focus:border-accent"
                    >
                      <option value="">Kategori (opsiyonel)</option>
                      {OPERATOR_NOTE_KATEGORILER.map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setReplyOncelik(replyOncelik === 'Acil' ? 'Normal' : 'Acil')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1 ${
                        replyOncelik === 'Acil'
                          ? 'bg-red text-white border border-red'
                          : 'bg-bg-3 text-zinc-400 border border-border hover:text-zinc-200'
                      }`}
                      title={replyOncelik === 'Acil' ? 'Acil — tıklayarak Normal yap' : 'Normal — tıklayarak Acil yap'}
                    >
                      {replyOncelik === 'Acil' ? <><AlertTriangle size={11} /> ACİL</> : 'Normal'}
                    </button>
                  </div>
                  <div className="flex items-end gap-2">
                    <textarea
                      value={mesaj}
                      onChange={e => setMesaj(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          send()
                        }
                      }}
                      placeholder="Mesaj yaz... (Enter = gönder, Shift+Enter = yeni satır)"
                      rows={2}
                      className="flex-1 px-3 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent resize-none"
                    />
                    <button
                      onClick={send}
                      disabled={!mesaj.trim() || sending}
                      className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Send size={13} /> Gönder
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 border-t border-border text-center text-[11px] text-zinc-600">
                  Mesaj gönderme yetkiniz yok
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
