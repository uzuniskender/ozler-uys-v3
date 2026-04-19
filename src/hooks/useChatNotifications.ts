/**
 * ÖzlerMsg için global bildirim sistemi.
 *
 * - Unread count'u Zustand store'da tutar; Topbar + Sidebar aynı kaynaktan okur.
 * - Realtime subscription: Yeni mesaj → count++ + beep + browser notification.
 * - Sadece başka kullanıcıdan gelen mesajlar uyarı tetikler (kendi mesajın sessiz).
 * - 15 sn periyodik polling: markChannelRead sonrası DB'deki azalmayı senkronize eder.
 * - Ses tercihi useMessageNotifications.ts ile paylaşılır (uys_msg_sound_enabled).
 * - Chat sayfası açıkken (hash #/chat) notification gösterilmez.
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
  subscribeToAllUserMessages,
} from '@/features/chat/chatService'
import { isSoundEnabled } from './useMessageNotifications'

// ---- Store ------------------------------------------------------------------

interface ChatNotifState {
  unreadCount: number
  setUnreadCount: (n: number) => void
  incrementUnread: () => void
}

export const useChatNotifStore = create<ChatNotifState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (n) => set({ unreadCount: n }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
}))

// ---- Yardımcılar ------------------------------------------------------------

function playChatBeep(): void {
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
    // Chat için ayırt edici çift beep (operatör mesajından farklı)
    beep(520, 0, 0.1, 0.1)
    beep(720, 0.12, 0.14, 0.12)
  } catch (e) {
    console.warn('[chat-notif] beep:', e)
  }
}

function showChatNotification(body: string): void {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  // Kullanıcı chat sayfasındaysa ve sekme görünürse gösterme
  if (!document.hidden && window.location.hash.includes('/chat')) return
  try {
    const notif = new Notification('💬 Yeni mesaj', {
      body: (body || '').slice(0, 140) || '(Yeni mesaj)',
      icon: import.meta.env.BASE_URL + 'favicon.ico',
      tag: 'uys-chat',
      silent: false,
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
  const incrementUnread = useChatNotifStore((s) => s.incrementUnread)
  const setupRef = useRef(false)

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
    }

    // İlk yükleme
    refresh()

    // Periyodik sync (markChannelRead sonrası DB azalmasını yakalar)
    const interval = setInterval(refresh, 15000)

    // Realtime: yeni mesaj
    const sub = subscribeToAllUserMessages(chatUser.id, (msg: any) => {
      try {
        const msgUserId = msg?.user_id
        const msgBody = msg?.body
        if (msgUserId === chatUser.id) return // kendi gönderdiğim
        incrementUnread()
        playChatBeep()
        showChatNotification(msgBody || '')
      } catch (e) {
        console.warn('[chat-notif] callback:', e)
      }
    })

    return () => {
      cancelled = true
      setupRef.current = false
      clearInterval(interval)
      try {
        if (typeof sub === 'function') (sub as any)()
        else if (sub && typeof (sub as any).unsubscribe === 'function')
          (sub as any).unsubscribe()
      } catch {
        /* ignore */
      }
    }
  }, [user, chatUser, setUnreadCount, incrementUnread])
}

// ---- Chat sayfası için harici helper ---------------------------------------

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
