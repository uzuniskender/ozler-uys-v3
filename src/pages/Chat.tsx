// src/pages/Chat.tsx
// ÖzlerMsg v1 — Kurumsal Mesajlaşma (ana sayfa)
// Slack/Discord tarzı: sol kanal listesi, sağ mesaj alanı.

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  Plus, Send, X, Users, User, Search, MessageCircle, Trash2, Pencil, Check, Bell, AtSign, Paperclip, Download, FileText, Image as ImageIcon, Loader2,
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
  extractMentionHandles,
  resolveMentionUserIds,
  markChannelMentionsRead,
  searchMessages,
  type SearchResultRow,
  uploadAttachment,
  getMessageAttachments,
  deleteAttachment,
  isImageMime,
  formatFileSize,
  type ChatAttachmentView,
} from '@/features/chat/chatService'
import {
  getUserDisplayName,
  type ChatSidebarItem,
  type ChatMessage,
  type ChatUserLite,
} from '@/features/chat/types'
import {
  requestNotificationPermission,
  getNotificationPermission,
} from '@/hooks/useMessageNotifications'

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
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('default')
  // v15.17 — Mention autocomplete
  const [allUsers, setAllUsers] = useState<ChatUserLite[]>([])
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // v15.18 — Mesaj arama
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResultRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null)
  // v15.19 — Dosya eklentisi
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<Record<string, ChatAttachmentView[]>>({})
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Notification izni durumunu oku (mount'ta)
  useEffect(() => {
    setNotifPerm(getNotificationPermission())
  }, [])

  // v15.17 — Tüm aktif kullanıcıları mention autocomplete için yükle
  useEffect(() => {
    if (!chatUser?.id) return
    getAllActiveUsers(chatUser.id)
      .then((users) => setAllUsers(users))
      .catch((e) => console.warn('Mention için kullanıcı listesi yüklenemedi:', e))
  }, [chatUser?.id])

  // v15.18 — Arama debounce (250ms)
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }
    if (!chatUser?.id) return
    setSearchLoading(true)
    const handle = setTimeout(() => {
      searchMessages(chatUser.id, q, 50)
        .then((rows) => setSearchResults(rows))
        .catch((e) => {
          console.warn('Arama hatası:', e)
          setSearchResults([])
        })
        .finally(() => setSearchLoading(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [searchQuery, chatUser?.id])

  // v15.18 — Arama sonucuna tıklanınca kanala geç + highlight
  const handleSelectSearchResult = (row: SearchResultRow) => {
    setHighlightMessageId(row.message_id)
    setSelectedChannelId(row.channel_id)
    setSearchQuery('') // Aramayı kapat
    // 4 sn sonra highlight'ı kaldır
    setTimeout(() => setHighlightMessageId(null), 4000)
  }

  async function handleGrantNotif() {
    const result = await requestNotificationPermission()
    setNotifPerm(result)
  }

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
        // v15.17 — kanaldaki mention'lar da okundu
        markChannelMentionsRead(chatUser.id, selectedChannelId).catch(console.warn)
        // v15.19 — mesajların eklerini çek
        const ids = msgs.map((m) => m.id)
        if (ids.length > 0) {
          getMessageAttachments(ids)
            .then((map) => {
              if (!cancelled) setAttachments(map)
            })
            .catch((e) => console.warn('Attachment yükleme hatası:', e))
        } else {
          setAttachments({})
        }
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
    if (highlightMessageId) return // highlight modundayken otomatik en alta kaydırma
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, highlightMessageId])

  // v15.18 — Highlight'li mesaja scroll (mesajlar yüklendikten sonra)
  useEffect(() => {
    if (!highlightMessageId) return
    if (loadingMsgs) return
    // Render tamamlansın diye küçük gecikme
    const t = setTimeout(() => {
      const el = document.getElementById(`chat-msg-${highlightMessageId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
    return () => clearTimeout(t)
  }, [highlightMessageId, loadingMsgs, messages])

  // Mesaj gönder
  const handleSend = async () => {
    // v15.19 — boş mesaj + ek yoksa gönderme, ama ek varsa mesaj boş olabilir
    const hasText = !!input.trim()
    const hasFiles = pendingFiles.length > 0
    if (!hasText && !hasFiles) return
    if (!selectedChannelId || !chatUser || sending) return
    setSending(true)
    try {
      // v15.17 — mention'ları çözümle
      const body = hasText ? input.trim() : ''
      const handles = extractMentionHandles(body)
      let mentionUserIds: string[] = []
      if (handles.length > 0) {
        const resolved = await resolveMentionUserIds(handles)
        mentionUserIds = resolved
          .map((u) => u.id)
          .filter((id) => id !== chatUser.id)
      }
      const msg = await sendMessage(chatUser.id, {
        channel_id: selectedChannelId,
        body: body || '📎', // Boş gövde yerine clip işareti — DB constraint varsa bozulmasın
        mentions: mentionUserIds.length > 0 ? mentionUserIds : undefined,
      })

      // v15.19 — Dosyaları yükle
      if (hasFiles) {
        setUploading(true)
        const uploads: ChatAttachmentView[] = []
        for (const f of pendingFiles) {
          try {
            const uploaded = await uploadAttachment(selectedChannelId, msg.id, f)
            uploads.push(uploaded)
          } catch (e: any) {
            alert(`"${f.name}" yüklenemedi: ${e?.message ?? 'bilinmeyen'}`)
          }
        }
        if (uploads.length > 0) {
          setAttachments((prev) => ({
            ...prev,
            [msg.id]: [...(prev[msg.id] || []), ...uploads],
          }))
        }
        setUploading(false)
      }

      setInput('')
      setPendingFiles([])
      setMentionOpen(false)
      reloadSidebar()
    } catch (e: any) {
      alert('Gönderim hatası: ' + (e?.message ?? 'bilinmeyen'))
    } finally {
      setSending(false)
    }
  }

  // v15.19 — Dosya seçimi / drag-drop handler'ları
  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files)
    const valid: File[] = []
    for (const f of arr) {
      if (f.size > 10 * 1024 * 1024) {
        alert(`"${f.name}" 10 MB'tan büyük — eklenmedi.`)
        continue
      }
      valid.push(f)
    }
    if (valid.length > 0) {
      setPendingFiles((prev) => [...prev, ...valid].slice(0, 10)) // Max 10 dosya/mesaj
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = '' // Aynı dosya tekrar seçilebilsin
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention picker açıkken navigasyon
    if (mentionOpen) {
      const filtered = getFilteredMentionCandidates()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % Math.max(filtered.length, 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1))
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionOpen(false)
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && filtered.length > 0) {
        e.preventDefault()
        selectMention(filtered[mentionIndex])
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // v15.17 — Input değiştiğinde @ algıla
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

    // Cursor'dan geriye bakıp @ ara
    const cursorPos = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursorPos)
    const match = before.match(/@([\p{L}0-9._]*)$/u)
    if (match) {
      setMentionOpen(true)
      setMentionQuery(match[1].toLowerCase())
      setMentionIndex(0)
    } else {
      setMentionOpen(false)
    }
  }

  // v15.17 — Mention aday filtresi
  const getFilteredMentionCandidates = (): ChatUserLite[] => {
    if (!mentionOpen) return []
    const q = mentionQuery
    if (!q) return allUsers.slice(0, 8)
    return allUsers
      .filter((u) => {
        const ka = u.kullanici_ad.toLocaleLowerCase('tr')
        const ad = (u.ad ?? '').toLocaleLowerCase('tr')
        return ka.includes(q) || ad.includes(q)
      })
      .slice(0, 8)
  }

  // v15.17 — Aday seçince input'a yaz
  const selectMention = (u: ChatUserLite) => {
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart ?? input.length
    const before = input.slice(0, cursor)
    const after = input.slice(cursor)
    const replaced = before.replace(/@([\p{L}0-9._]*)$/u, `@${u.kullanici_ad} `)
    const newVal = replaced + after
    setInput(newVal)
    setMentionOpen(false)
    // Cursor'u yeni pozisyona taşı
    setTimeout(() => {
      const newCursor = replaced.length
      el.focus()
      el.setSelectionRange(newCursor, newCursor)
    }, 0)
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

        {/* Bildirim izni banner — sadece izin istenmemişse görünür */}
        {notifPerm === 'default' && (
          <div className="px-3 py-2 border-b border-border bg-amber/10">
            <button
              onClick={handleGrantNotif}
              className="w-full text-xs text-amber hover:text-amber/80 flex items-center justify-center gap-1.5 py-1"
              title="Yeni mesaj geldiğinde masaüstünde bildirim al"
            >
              <Bell size={12} />
              Bildirimleri aç
            </button>
          </div>
        )}

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

        {/* v15.18 — Mesaj arama */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mesajlarda ara…"
              className="w-full pl-7 pr-7 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                title="Temizle"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* v15.18 — Arama modu: sonuçları göster, kanal listesini gizle */}
          {searchQuery.trim().length >= 2 ? (
            <div>
              <div className="px-3 py-1.5 text-[10px] text-zinc-500 bg-bg-2/50 border-b border-border/50">
                {searchLoading ? 'Aranıyor…' :
                 searchResults.length === 0 ? 'Sonuç bulunamadı' :
                 `${searchResults.length} sonuç`}
              </div>
              {searchResults.map((row) => (
                <button
                  key={row.message_id}
                  onClick={() => handleSelectSearchResult(row)}
                  className="w-full px-3 py-2 text-left border-b border-border/40 hover:bg-bg-2 last:border-0"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {row.channel_type === 'dm' ? (
                      <User size={10} className="text-zinc-500" />
                    ) : (
                      <Users size={10} className="text-zinc-500" />
                    )}
                    <span className="text-[10px] text-zinc-400 truncate flex-1">
                      {row.channel_name}
                    </span>
                    <span className="text-[9px] text-zinc-600 font-mono">
                      {new Date(row.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 line-clamp-2 leading-snug">
                    <span className="text-zinc-500">{row.sender_name}: </span>
                    <SearchHighlight text={row.body} query={searchQuery.trim()} />
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.trim().length === 1 ? (
            <div className="p-4 text-[11px] text-zinc-500 text-center">
              En az 2 karakter yazın
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </aside>

      {/* ─────────── Sağ: Mesaj alanı ─────────── */}
      <main
        className={cn(
          'flex-1 flex flex-col bg-bg-0 relative',
          dragOver && 'ring-2 ring-accent ring-inset'
        )}
        onDragOver={(e) => {
          if (selectedChannelId) {
            e.preventDefault()
            setDragOver(true)
          }
        }}
        onDragLeave={(e) => {
          // Sadece gerçekten main'den çıkarsak kapat
          if (e.currentTarget === e.target) setDragOver(false)
        }}
        onDrop={handleDrop}
      >
        {dragOver && selectedChannelId && (
          <div className="absolute inset-0 z-30 bg-accent/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Paperclip size={40} className="mx-auto mb-2 text-accent" />
              <div className="text-sm font-semibold text-accent">Dosyaları bırakın</div>
              <div className="text-xs text-zinc-400 mt-1">Max 10 MB · 10 dosya/mesaj</div>
            </div>
          </div>
        )}
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
                    isHighlighted={msg.id === highlightMessageId}
                    msgAttachments={attachments[msg.id] || []}
                  />
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-3 relative">
              {/* v15.19 — Pending dosya listesi (gönderilmeden önce) */}
              {pendingFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 bg-bg-2 border border-border rounded px-2 py-1 text-xs"
                    >
                      {f.type.startsWith('image/') ? (
                        <ImageIcon size={12} className="text-accent" />
                      ) : (
                        <FileText size={12} className="text-zinc-400" />
                      )}
                      <span className="max-w-[160px] truncate text-zinc-300">{f.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatFileSize(f.size)}
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-zinc-500 hover:text-red ml-0.5"
                        title="Kaldır"
                        disabled={uploading}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* v15.17 — Mention autocomplete dropdown */}
              {mentionOpen && (() => {
                const candidates = getFilteredMentionCandidates()
                if (candidates.length === 0) return null
                return (
                  <div className="absolute bottom-full left-3 right-3 mb-1 bg-bg-1 border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto z-20">
                    <div className="px-2 py-1 text-[10px] text-zinc-500 border-b border-border/40">
                      @bahsetmek için kişi seçin (↑↓ Tab Enter · Esc iptal)
                    </div>
                    {candidates.map((u, i) => (
                      <button
                        key={u.id}
                        onClick={() => selectMention(u)}
                        onMouseEnter={() => setMentionIndex(i)}
                        className={cn(
                          'w-full px-2 py-1.5 flex items-center gap-2 text-left border-b border-border/30 last:border-0',
                          i === mentionIndex ? 'bg-accent/15' : 'hover:bg-bg-2'
                        )}
                      >
                        <div className="w-6 h-6 rounded-full bg-bg-3 flex items-center justify-center text-[10px] font-semibold">
                          {getUserDisplayName(u).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-zinc-200 truncate">{getUserDisplayName(u)}</div>
                          <div className="text-[10px] text-zinc-500 truncate">@{u.kullanici_ad}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              })()}
              <div className="flex gap-2 items-end">
                {/* v15.19 — Dosya ekle butonu */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-2 text-zinc-400 hover:text-accent hover:bg-bg-2 rounded transition-colors"
                  title="Dosya ekle (veya sürükle-bırak)"
                  disabled={sending || uploading}
                >
                  <Paperclip size={16} />
                </button>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Mesaj yaz... (@ ile bahset · 📎 dosya ekle · Enter gönder · Shift+Enter yeni satır)"
                  rows={1}
                  className="flex-1 resize-none bg-bg-1 border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent max-h-32"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && pendingFiles.length === 0) || sending}
                  className="px-3 py-2 bg-accent text-bg-0 rounded hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-sm font-medium"
                >
                  {uploading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  {uploading ? 'Yükleniyor…' : 'Gönder'}
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
// EK DOSYA GÖSTERİMİ (v15.19)
// ═══════════════════════════════════════════════════════════════════
function AttachmentView({ att }: { att: ChatAttachmentView }) {
  const isImg = isImageMime(att.mime_type)
  const name = att.file_name || 'dosya'

  if (isImg) {
    return (
      <div className="max-w-xs">
        <a href={att.public_url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={att.public_url}
            alt={name}
            className="rounded border border-border max-h-64 max-w-full object-contain bg-bg-2 hover:opacity-90 transition-opacity cursor-zoom-in"
          />
        </a>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500">
          <span className="truncate flex-1">{name}</span>
          <span className="font-mono">{formatFileSize(att.size_bytes)}</span>
        </div>
      </div>
    )
  }

  return (
    <a
      href={att.public_url}
      target="_blank"
      rel="noopener noreferrer"
      download={name}
      className="flex items-center gap-2 bg-bg-2 hover:bg-bg-3 border border-border rounded px-3 py-2 max-w-xs transition-colors"
      title={`İndir: ${name}`}
    >
      <FileText size={18} className="text-accent flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-200 truncate">{name}</div>
        <div className="text-[10px] text-zinc-500 font-mono">
          {formatFileSize(att.size_bytes)}
          {att.mime_type && ` · ${att.mime_type.split('/')[1] || att.mime_type}`}
        </div>
      </div>
      <Download size={14} className="text-zinc-500 flex-shrink-0" />
    </a>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ARAMA VURGULAMA (v15.18)
// ═══════════════════════════════════════════════════════════════════
function SearchHighlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const q = query.toLocaleLowerCase('tr')
  const textLower = text.toLocaleLowerCase('tr')
  const parts: Array<{ type: 'text' | 'match'; value: string }> = []
  let i = 0
  while (i < text.length) {
    const found = textLower.indexOf(q, i)
    if (found === -1) {
      parts.push({ type: 'text', value: text.slice(i) })
      break
    }
    if (found > i) parts.push({ type: 'text', value: text.slice(i, found) })
    parts.push({ type: 'match', value: text.slice(found, found + q.length) })
    i = found + q.length
  }
  return (
    <>
      {parts.map((p, idx) =>
        p.type === 'match' ? (
          <mark key={idx} className="bg-amber/40 text-amber px-0.5 rounded">{p.value}</mark>
        ) : (
          <span key={idx}>{p.value}</span>
        )
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MENTION VURGULAMA (v15.17)
// ═══════════════════════════════════════════════════════════════════
function MentionHighlightedBody({ body }: { body: string }) {
  // @handle pattern'leri parçala, geri kalan metin olarak render
  const parts: Array<{ type: 'text' | 'mention'; value: string }> = []
  const re = /@([\p{L}0-9._]+)/gu
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIdx) {
      parts.push({ type: 'text', value: body.slice(lastIdx, m.index) })
    }
    parts.push({ type: 'mention', value: m[1] })
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < body.length) {
    parts.push({ type: 'text', value: body.slice(lastIdx) })
  }
  if (parts.length === 0) return <>{body}</>
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'mention' ? (
          <span
            key={i}
            className="text-accent bg-accent/15 px-1 rounded font-medium"
          >
            @{p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </>
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
  isHighlighted,
  msgAttachments = [],
}: {
  msg: ChatMessage
  sender: ChatUserLite | undefined
  isMe: boolean
  showHeader: boolean
  isHighlighted?: boolean
  msgAttachments?: ChatAttachmentView[]
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
    <div
      id={`chat-msg-${msg.id}`}
      className={cn(
        'group flex gap-2 transition-colors rounded px-1 -mx-1',
        isMe && 'flex-row-reverse',
        isHighlighted && 'bg-amber/10 ring-2 ring-amber/40'
      )}
    >
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
              <MentionHighlightedBody body={msg.body} />
              {isEdited && <span className="text-[10px] text-zinc-500 ml-2">(düzenlendi)</span>}
            </>
          )}
        </div>
        {/* v15.19 — Ekler */}
        {msgAttachments.length > 0 && (
          <div className={cn('mt-1 flex flex-col gap-1', isMe && 'items-end')}>
            {msgAttachments.map((a) => (
              <AttachmentView key={a.id} att={a} />
            ))}
          </div>
        )}
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
