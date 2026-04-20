/**
 * ÖzlerMsg için global bildirim sistemi — v15.17 (@mention desteği).
 *
 * - Unread count'u Zustand store'da tutar; Topbar + Sidebar aynı kaynaktan okur.
 * - Realtime subscription: Yeni mesaj → count++ + beep + browser notification.
 * - Sadece başka kullanıcıdan gelen mesajlar uyarı tetikler (kendi mesajın sessiz).
 * - 15 sn periyodik polling: markChannelRead sonrası DB'deki azalmayı senkronize eder.
 * - Ses tercihi useMessageNotifications.ts ile paylaşılır (uys_msg_sound_enabled).
 * - Chat sayfası açıkken (hash #/chat) notification gösterilmez.
 * - v15.17: @mention için ayrı counter, 3'lü beep, başlıkta "@" prefix.
 *
 * KRİTİK: Bu hook uygulamada **tek bir yerde** çağrılmalıdır (Topbar).
 * İki farklı component'te çağrılırsa iki subscription kurulur, çift beep/notif gelir.
 */
import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { useAuth } from './useAuth'
import { useChatUser } from '@/features/chat/useChatUser'
import {
  getTotalUnreadCount,
  getUnreadMentionCount,
  subscribeToAllUserMessages,
  subscribeToUserMentions,
} from '@/features/chat/chatService'
import { isSoundEnabled } from './useMessageNotifications'

// ---- Store ------------------------------------------------------------------

interface ChatNotifState {
  unreadCount: number
  unreadMentionCount: number
  setUnreadCount: (n: number) => void
  setUnreadMentionCount: (n: number) => void
  incrementUnread: () => void
  incrementMention: () => void
}

export const useChatNotifStore = create<ChatNotifState>((set) => ({
  unreadCount: 0,
  unreadMentionCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
  setUnreadMentionCount: (n) => set({ unreadMentionCount: n }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  incrementMention: () => set((s) => ({ unreadMentionCount: s.unreadMentionCount + 1 })),
}))

// ---- Yardımcılar ------------------------------------------------------------

type BeepKind = 'message' | 'mention'

function playChatBeep(kind: BeepKind = 'message'): void {
  if (!isSoundEnabled()) return
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const beep = (freq: number, start: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const t0 = ctx.currentTime + start
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(volume, t0 + 0.01)
      gain.gain.linearRampToValueAtTime(0, t0 + duration)
      osc.start(t0)
      osc.stop(t0 + duration)
    }
    if (kind === 'mention') {
      // Mention: daha yüksek frekanslı 3'lü beep — ayırt edici, aciliyet hissi
      beep(660, 0, 0.08, 0.12)
      beep(880, 0.10, 0.08, 0.14)
      beep(1040, 0.20, 0.14, 0.14)
    } else {
      // Normal chat mesajı: çift beep (operatör mesajından farklı)
      beep(520, 0, 0.1, 0.1)
      beep(720, 0.12, 0.14, 0.12)
    }
  } catch (e) {
    console.warn('[chat-notif] beep:', e)
  }
}

function showChatNotification(body: string, isMention: boolean = false): void {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  // Kullanıcı chat sayfasındaysa ve sekme görünürse gösterme
  if (!document.hidden && window.location.hash.includes('/chat')) return
  try {
    const title = isMention ? '@ Sizi bahsettiler' : '💬 Yeni mesaj'
    const notif = new Notification(title, {
      body: (body || '').slice(0, 140) || (isMention ? '(Mention)' : '(Yeni mesaj)'),
      icon: import.meta.env.BASE_URL + 'favicon.ico',
      tag: isMention ? 'uys-chat-mention' : 'uys-chat',
      silent: false,
      requireInteraction: isMention, // mention'larda kullanıcı kapatana kadar durur
    })
    notif.onclick = () => {
      window.focus()
      window.location.hash = '/chat'
      notif.close()
    }
  } catch (e) {
    console.warn('[chat-notif] notification:', e)
  }
}

// ---- Hook -------------------------------------------------------------------

export function useChatNotifications(): void {
  const { user } = useAuth()
  const { chatUser } = useChatUser()
  const setUnreadCount = useChatNotifStore((s) => s.setUnreadCount)
  const setUnreadMentionCount = useChatNotifStore((s) => s.setUnreadMentionCount)
  const incrementUnread = useChatNotifStore((s) => s.incrementUnread)
  const incrementMention = useChatNotifStore((s) => s.incrementMention)
  const setupRef = useRef(false)
  // Yeni mesajın mention olup olmadığını tespit edebilmek için kısa tampon
  const recentMentionsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user || !chatUser) return
    if (user.role === 'operator' || user.role === 'guest') return
    if (setupRef.current) return
    setupRef.current = true

    let cancelled = false

    const refresh = () => {
      getTotalUnreadCount(chatUser.id)
        .then((n) => {
          if (!cancelled) setUnreadCount(n)
        })
        .catch((e) => console.warn('[chat-notif] refresh:', e))

      getUnreadMentionCount(chatUser.id)
        .then((n) => {
          if (!cancelled) setUnreadMentionCount(n)
        })
        .catch((e) => console.warn('[chat-notif] mention refresh:', e))
    }

    // İlk yükleme
    refresh()

    // Periyodik sync
    const interval = setInterval(refresh, 15000)

    // Realtime: yeni mention (ÖNCE subscribe, mesaj callback'ten önce gelsin)
    const subMention = subscribeToUserMentions(chatUser.id, (mention) => {
      try {
        // Mention geldi — mesajla ilişkilendirmek için id'yi tampona koy
        recentMentionsRef.current.add(mention.message_id)
        // 5 sn sonra temizle (realtime sıralaması yakın olur)
        setTimeout(() => {
          recentMentionsRef.current.delete(mention.message_id)
        }, 5000)
        incrementMention()
      } catch (e) {
        console.warn('[chat-notif] mention callback:', e)
      }
    })

    // Realtime: yeni mesaj
    const subMsg = subscribeToAllUserMessages(chatUser.id, (msg: any) => {
      try {
        const msgUserId = msg?.user_id
        const msgId = msg?.id
        const msgBody = msg?.body
        if (msgUserId === chatUser.id) return // kendi gönderdiğim
        incrementUnread()

        // Mention mi? — kısa süre sonra mention insert'i de gelmiş olabilir.
        // İki yönlü kontrol: 100ms bekle, tampona bak.
        setTimeout(() => {
          const isMention = recentMentionsRef.current.has(msgId)
          playChatBeep(isMention ? 'mention' : 'message')
          showChatNotification(msgBody || '', isMention)
        }, 150)
      } catch (e) {
        console.warn('[chat-notif] message callback:', e)
      }
    })

    return () => {
      cancelled = true
      setupRef.current = false
      clearInterval(interval)
      const cleanup = (s: unknown) => {
        try {
          if (typeof s === 'function') (s as () => void)()
          else if (s && typeof (s as { unsubscribe?: () => void }).unsubscribe === 'function')
            (s as { unsubscribe: () => void }).unsubscribe()
        } catch {
          /* ignore */
        }
      }
      cleanup(subMention)
      cleanup(subMsg)
    }
  }, [user, chatUser, setUnreadCount, setUnreadMentionCount, incrementUnread, incrementMention])
}

// ---- Chat sayfası için harici helperlar -------------------------------------

/**
 * Chat sayfasında kanal okunduktan sonra çağrılabilir — count'u anında senkronize eder.
 * (Polling zaten 15 sn'de bir çalışıyor, bu sadece hızlandırır.)
 */
export async function refreshChatUnreadCount(userId: string): Promise<void> {
  try {
    const n = await getTotalUnreadCount(userId)
    useChatNotifStore.getState().setUnreadCount(n)
  } catch (e) {
    console.warn('[chat-notif] manual refresh:', e)
  }
}

/**
 * Mention counter'ı zorla yenile (kanal açılıp mention'lar okundu işaretlenince).
 */
export async function refreshChatMentionCount(userId: string): Promise<void> {
  try {
    const n = await getUnreadMentionCount(userId)
    useChatNotifStore.getState().setUnreadMentionCount(n)
  } catch (e) {
    console.warn('[chat-notif] manual mention refresh:', e)
  }
}
