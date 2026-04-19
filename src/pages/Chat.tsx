// src/pages/Chat.tsx
// ÖzlerMsg v1 — Kurumsal Mesajlaşma (ana sayfa)
// Slack/Discord tarzı: sol kanal listesi, sağ mesaj alanı.

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  Plus, Send, X, Users, User, Search, MessageCircle, Trash2, Pencil, Check,
} from 'lucide-react'
import { useChatUser } from '@/features/chat/useChatUser'
import {
  getSidebarChannels,
  getMessagesWithSenders,
  sendMessage,
  markChannelRead,
  subscribeToChannelMessages,
  getOrCreateDm,
  createGroup,
  getAllActiveUsers,
  updateMessage,
  deleteMessage,
} from '@/features/chat/chatService'
import {
  getUserDisplayName,
  type ChatSidebarItem,
  type ChatMessage,
  type ChatUserLite,
} from '@/features/chat/types'

// ═══════════════════════════════════════════════════════════════════
// ANA SAYFA
// ═══════════════════════════════════════════════════════════════════
export default function Chat() {
  const { chatUser, loading: userLoading, error: userError } = useChatUser()
  const [sidebar, setSidebar] = useState<ChatSidebarItem[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [senders, setSenders] = useState<Record<string, ChatUserLite>>({})
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [showNewDm, setShowNewDm] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Sidebar yükle
  const reloadSidebar = async () => {
    if (!chatUser) return
    try {
      const items = await getSidebarChannels(chatUser.id)
      setSidebar(items)
    } catch (e) {
      console.error('Sidebar yükleme hatası:', e)
    }
  }

  useEffect(() => {
    if (!chatUser?.id) return
    reloadSidebar()
    const interval = setInterval(reloadSidebar, 15000) // 15sn polling
    return () => clearInterval(interval)
  }, [chatUser?.id])

  // Seçilen kanalın mesajlarını yükle + realtime
  useEffect(() => {
    if (!selectedChannelId || !chatUser) return
    let cancelled = false

    setLoadingMsgs(true)
    getMessagesWithSenders(selectedChannelId, 50)
      .then(({ messages: msgs, senders: sndrs }) => {
        if (cancelled) return
        setMessages(msgs)
        setSenders(sndrs)
        setLoadingMsgs(false)
        markChannelRead(chatUser.id, selectedChannelId).catch(console.warn)
      })
      .catch((e) => {
        console.error(e)
        setLoadingMsgs(false)
      })

    // Realtime
    const unsub = subscribeToChannelMessages(
      selectedChannelId,
      (newMsg) => {
        if (cancelled) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        // Sender yoksa çek
        if (newMsg.user_id && !senders[newMsg.user_id]) {
          supabase
            .from('uys_kullanicilar')
            .select('id, ad, kullanici_ad, rol')
            .eq('id', newMsg.user_id)
            .limit(1)
            .then(({ data }) => {
              if (data && data[0]) setSenders((prev) => ({ ...prev, [data[0].id]: data[0] }))
            })
        }
        // Kendi mesajım değilse okundu işaretle (kanal açıksa)
        if (newMsg.user_id !== chatUser.id) {
          markChannelRead(chatUser.id, selectedChannelId).catch(() => {})
        }
      },
      (updatedMsg) => {
        if (cancelled) return
        setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)))
      }
    )

    return () => {
      cancelled = true
      unsub()
    }
  }, [selectedChannelId, chatUser?.id])

  // Yeni mesaj geldiğinde aşağı kaydır
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Mesaj gönder
  const handleSend = async () => {
    if (!input.trim() || !selectedChannelId || !chatUser || sending) return
    setSending(true)
    try {
      await sendMessage(chatUser.id, { channel_id: selectedChannelId, body: input.trim() })
      setInput('')
      reloadSidebar() // sidebar'da son mesaj güncellensin
    } catch (e: any) {
      alert('Gönderim hatası: ' + (e?.message ?? 'bilinmeyen'))
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Yeni DM başlat
  const handleStartDm = async (otherUserId: string) => {
    if (!chatUser) return
    try {
      const ch = await getOrCreateDm(chatUser.id, otherUserId)
      setShowNewDm(false)
      setSelectedChannelId(ch.id)
      reloadSidebar()
    } catch (e: any) {
      alert('DM başlatma hatası: ' + (e?.message ?? ''))
    }
  }

  // Yeni grup
  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    if (!chatUser) return
    try {
      const ch = await createGroup(chatUser.id, { name, member_user_ids: memberIds })
      setShowNewGroup(false)
      setSelectedChannelId(ch.id)
      reloadSidebar()
    } catch (e: any) {
      alert('Grup oluşturma hatası: ' + (e?.message ?? ''))
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  if (userLoading) {
    return <div className="p-6 text-zinc-400">Yükleniyor…</div>
  }
  if (userError || !chatUser) {
    return (
      <div className="p-6 text-red-400 space-y-2">
        <div>Chat profili hazır değil.</div>
        <div className="text-xs text-zinc-500">{userError ?? 'uys_kullanicilar tablosunda kaydınız bulunamadı.'}</div>
      </div>
    )
  }

  const selectedItem = sidebar.find((s) => s.id === selectedChannelId)

  return (
    <div className="flex h-full min-h-[500px] bg-bg-0">
      {/* ─────────── Sol Sidebar (kanal listesi) ─────────── */}
      <aside className="w-64 border-r border-border bg-bg-1 flex flex-col">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <MessageCircle size={16} className="text-accent" />
          <div className="text-sm font-semibold flex-1">Ekip Sohbet</div>
        </div>

        <div className="p-2 flex gap-2 border-b border-border">
          <button
            onClick={() => setShowNewDm(true)}
            className="flex-1 text-xs px-2 py-1.5 bg-bg-2 hover:bg-bg-3 border border-border rounded flex items-center justify-center gap-1"
            title="Yeni DM"
          >
            <User size={12} /> DM
          </button>
          <button
            onClick={() => setShowNewGroup(true)}
            className="flex-1 text-xs px-2 py-1.5 bg-bg-2 hover:bg-bg-3 border border-border rounded flex items-center justify-center gap-1"
            title="Yeni Grup"
          >
            <Users size={12} /> Grup
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sidebar.length === 0 && (
            <div className="p-4 text-xs text-zinc-500 text-center">
              Henüz sohbet yok.<br />DM veya Grup başlat.
            </div>
          )}
          {sidebar.map((item) => {
            const active = item.id === selectedChannelId
            return (
              <button
                key={item.id}
                onClick={() => setSelectedChannelId(item.id)}
                className={cn(
                  'w-full px-3 py-2 flex items-start gap-2 border-b border-border/50 text-left transition-colors',
                  active ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-bg-2'
                )}
              >
                <div className="mt-0.5">
                  {item.type === 'dm' ? (
                    <User size={14} className="text-zinc-400" />
                  ) : (
                    <Users size={14} className="text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <div className={cn('text-[13px] truncate flex-1', active ? 'text-accent font-medium' : 'text-zinc-200')}>
                      {item.name}
                    </div>
                    {item.unread_count > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red/20 text-red">
                        {item.unread_count}
                      </span>
                    )}
                  </div>
                  {item.last_message_preview && (
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {item.last_message_preview}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* ─────────── Sağ: Mesaj alanı ─────────── */}
      <main className="flex-1 flex flex-col bg-bg-0">
        {selectedChannelId && selectedItem ? (
          <>
            <header className="h-12 px-4 border-b border-border flex items-center gap-2">
              {selectedItem.type === 'dm' ? <User size={16} /> : <Users size={16} />}
              <div className="text-sm font-semibold">{selectedItem.name}</div>
              <div className="text-xs text-zinc-500 ml-2">
                {selectedItem.type === 'dm' ? 'Direkt Mesaj' : 'Grup'}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingMsgs && <div className="text-zinc-500 text-sm">Mesajlar yükleniyor…</div>}
              {!loadingMsgs && messages.length === 0 && (
                <div className="text-zinc-500 text-sm text-center py-8">
                  Henüz mesaj yok. İlk mesajı gönderin.
                </div>
              )}
              {messages.map((msg, idx) => {
                const prev = idx > 0 ? messages[idx - 1] : null
                const showHeader = !prev || prev.user_id !== msg.user_id ||
                  (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000)
                return (
                  <MessageRow
                    key={msg.id}
                    msg={msg}
                    sender={senders[msg.user_id]}
                    isMe={msg.user_id === chatUser.id}
                    showHeader={showHeader}
                  />
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-3">
              <div className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Mesaj yaz... (Enter ile gönder, Shift+Enter ile yeni satır)"
                  rows={1}
                  className="flex-1 resize-none bg-bg-1 border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent max-h-32"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="px-3 py-2 bg-accent text-bg-0 rounded hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-sm font-medium"
                >
                  <Send size={14} />
                  Gönder
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-40" />
              <div className="text-sm">Sohbet seçin veya yeni başlatın</div>
            </div>
          </div>
        )}
      </main>

      {/* Modaller */}
      {showNewDm && (
        <NewDmModal
          currentUserId={chatUser.id}
          onClose={() => setShowNewDm(false)}
          onSelect={handleStartDm}
        />
      )}
      {showNewGroup && (
        <NewGroupModal
          currentUserId={chatUser.id}
          onClose={() => setShowNewGroup(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MESAJ SATIRI
// ═══════════════════════════════════════════════════════════════════
function MessageRow({
  msg,
  sender,
  isMe,
  showHeader,
}: {
  msg: ChatMessage
  sender: ChatUserLite | undefined
  isMe: boolean
  showHeader: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(msg.body)
  const [saving, setSaving] = useState(false)
  const name = getUserDisplayName(sender)
  const time = new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const date = new Date(msg.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  const isDeleted = !!msg.deleted_at
  const isEdited = !!msg.edited_at

  const handleSaveEdit = async () => {
    if (!editBody.trim() || saving) return
    setSaving(true)
    try {
      await updateMessage({ message_id: msg.id, body: editBody.trim() })
      setEditing(false)
    } catch (e: any) {
      alert('Düzenleme hatası: ' + (e?.message ?? ''))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Mesajı silmek istiyor musunuz?')) return
    try {
      await deleteMessage(msg.id)
    } catch (e: any) {
      alert('Silme hatası: ' + (e?.message ?? ''))
    }
  }

  if (isDeleted) {
    return (
      <div className="text-xs text-zinc-600 italic pl-4 py-0.5">
        [bu mesaj silindi]
      </div>
    )
  }

  return (
    <div className={cn('group flex gap-2', isMe && 'flex-row-reverse')}>
      {showHeader && (
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0',
          isMe ? 'bg-accent/20 text-accent' : 'bg-bg-3 text-zinc-300'
        )}>
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      {!showHeader && <div className="w-8 flex-shrink-0" />}
      <div className={cn('flex-1 min-w-0 max-w-[70%]', isMe && 'flex flex-col items-end')}>
        {showHeader && (
          <div className={cn('flex items-center gap-2 mb-0.5 text-xs', isMe && 'flex-row-reverse')}>
            <span className="font-medium text-zinc-300">{isMe ? 'Siz' : name}</span>
            <span className="text-zinc-500">{date} {time}</span>
          </div>
        )}
        <div className={cn(
          'inline-block px-3 py-1.5 rounded-lg text-sm whitespace-pre-wrap break-words',
          isMe ? 'bg-accent/20 text-zinc-100' : 'bg-bg-2 text-zinc-200'
        )}>
          {editing ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={2}
                className="bg-bg-1 border border-border rounded px-2 py-1 text-sm outline-none focus:border-accent resize-none"
                autoFocus
              />
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => { setEditing(false); setEditBody(msg.body) }}
                  className="text-xs px-2 py-0.5 hover:bg-bg-3 rounded"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="text-xs px-2 py-0.5 bg-accent text-bg-0 rounded hover:bg-accent/90 flex items-center gap-1"
                >
                  <Check size={10} /> Kaydet
                </button>
              </div>
            </div>
          ) : (
            <>
              {msg.body}
              {isEdited && <span className="text-[10px] text-zinc-500 ml-2">(düzenlendi)</span>}
            </>
          )}
        </div>
        {isMe && !editing && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mt-0.5">
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5"
              title="Düzenle"
            >
              <Pencil size={10} /> Düzenle
            </button>
            <button
              onClick={handleDelete}
              className="text-[10px] text-zinc-500 hover:text-red flex items-center gap-0.5"
              title="Sil"
            >
              <Trash2 size={10} /> Sil
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// YENİ DM MODALI
// ═══════════════════════════════════════════════════════════════════
function NewDmModal({
  currentUserId,
  onClose,
  onSelect,
}: {
  currentUserId: string
  onClose: () => void
  onSelect: (userId: string) => void
}) {
  const [users, setUsers] = useState<ChatUserLite[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    getAllActiveUsers(currentUserId)
      .then(setUsers)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }, [currentUserId])

  const filtered = users.filter((u) => {
    const q = filter.toLocaleLowerCase('tr')
    return (
      (u.ad ?? '').toLocaleLowerCase('tr').includes(q) ||
      u.kullanici_ad.toLocaleLowerCase('tr').includes(q)
    )
  })

  return (
    <ModalShell title="Yeni Direkt Mesaj" onClose={onClose}>
      <div className="p-3 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Kişi ara…"
            className="w-full pl-8 pr-3 py-2 bg-bg-1 border border-border rounded text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="max-h-80 overflow-y-auto border border-border rounded">
          {loading && <div className="p-4 text-zinc-500 text-sm">Yükleniyor…</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-4 text-zinc-500 text-sm text-center">Kullanıcı bulunamadı</div>
          )}
          {filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => onSelect(u.id)}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-bg-2 text-left border-b border-border/40 last:border-0"
            >
              <div className="w-7 h-7 rounded-full bg-bg-3 flex items-center justify-center text-[11px] font-semibold">
                {getUserDisplayName(u).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 truncate">{getUserDisplayName(u)}</div>
                <div className="text-[11px] text-zinc-500 truncate">
                  @{u.kullanici_ad}{u.rol ? ` · ${u.rol}` : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  )
}

// ═══════════════════════════════════════════════════════════════════
// YENİ GRUP MODALI
// ═══════════════════════════════════════════════════════════════════
function NewGroupModal({
  currentUserId,
  onClose,
  onCreate,
}: {
  currentUserId: string
  onClose: () => void
  onCreate: (name: string, memberIds: string[]) => void
}) {
  const [users, setUsers] = useState<ChatUserLite[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    getAllActiveUsers(currentUserId)
      .then(setUsers)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }, [currentUserId])

  const filtered = users.filter((u) => {
    const q = filter.toLocaleLowerCase('tr')
    return (
      (u.ad ?? '').toLocaleLowerCase('tr').includes(q) ||
      u.kullanici_ad.toLocaleLowerCase('tr').includes(q)
    )
  })

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const canCreate = name.trim().length > 0 && selectedIds.size > 0

  return (
    <ModalShell title="Yeni Grup Oluştur" onClose={onClose}>
      <div className="p-3 space-y-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Grup adı (örn. Planlama Ekibi)"
          className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm outline-none focus:border-accent"
        />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Üye ara…"
            className="w-full pl-8 pr-3 py-2 bg-bg-1 border border-border rounded text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="text-[11px] text-zinc-500">
          {selectedIds.size} üye seçildi {selectedIds.size > 0 && '(+ siz)'}
        </div>
        <div className="max-h-64 overflow-y-auto border border-border rounded">
          {loading && <div className="p-4 text-zinc-500 text-sm">Yükleniyor…</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-4 text-zinc-500 text-sm text-center">Kullanıcı bulunamadı</div>
          )}
          {filtered.map((u) => {
            const checked = selectedIds.has(u.id)
            return (
              <label
                key={u.id}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-bg-2 cursor-pointer border-b border-border/40 last:border-0"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(u.id)}
                  className="accent-accent"
                />
                <div className="w-7 h-7 rounded-full bg-bg-3 flex items-center justify-center text-[11px] font-semibold">
                  {getUserDisplayName(u).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 truncate">{getUserDisplayName(u)}</div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    @{u.kullanici_ad}{u.rol ? ` · ${u.rol}` : ''}
                  </div>
                </div>
              </label>
            )
          })}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm hover:bg-bg-2 rounded"
          >
            İptal
          </button>
          <button
            onClick={() => onCreate(name.trim(), Array.from(selectedIds))}
            disabled={!canCreate}
            className="px-3 py-1.5 text-sm bg-accent text-bg-0 rounded hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Oluştur
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MODAL KABUK
// ═══════════════════════════════════════════════════════════════════
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg-0 border border-border rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-11 px-4 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
