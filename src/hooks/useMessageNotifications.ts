/**
 * Operatör mesajlarını global olarak izler, yeni gelen mesaj için:
 * - Sesli uyarı (Web Audio API ile programatik beep — dosya gerekmez)
 * - Tarayıcı notification (sayfa gizliyken)
 *
 * Acil mesajlar: 3'lü yüksek beep + requireInteraction notification.
 * Normal mesajlar: Tek alçak beep + standart notification.
 *
 * Sadece admin/planlama/uretim_sor/depocu için çalışır (operatör için değil).
 * İlk yüklemede eski mesajları susar — sadece bundan sonra gelenleri uyarır.
 *
 * Ses açık/kapalı kullanıcı tercihi localStorage'da (uys_msg_sound_enabled).
 */
import { useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { useAuth } from './useAuth'

export const SOUND_PREF_KEY = 'uys_msg_sound_enabled'

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_PREF_KEY) !== 'false' // default: açık
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_PREF_KEY, enabled ? 'true' : 'false')
}

function playBeep(acil: boolean): void {
  if (!isSoundEnabled()) return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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
    if (acil) {
      // 3 kez yüksek beep — dikkat çekici
      beep(880, 0, 0.18, 0.20)
      beep(1100, 0.22, 0.18, 0.20)
      beep(880, 0.44, 0.24, 0.20)
    } else {
      // Tek alçak beep — hafif
      beep(640, 0, 0.15, 0.12)
    }
  } catch (e) {
    console.warn('[notif] beep:', e)
  }
}

function showNotification(title: string, body: string, acil: boolean): void {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  // Sayfa görünürse notification gösterme (kullanıcı zaten burada)
  if (!document.hidden) return
  try {
    const notif = new Notification(title, {
      body,
      icon: import.meta.env.BASE_URL + 'favicon.ico',
      tag: acil ? 'uys-msg-acil' : 'uys-msg',
      requireInteraction: acil,
      silent: false,
    })
    notif.onclick = () => {
      window.focus()
      // Messages sayfasına git (hash router)
      window.location.hash = '/messages'
      notif.close()
    }
  } catch (e) {
    console.warn('[notif] notification:', e)
  }
}

export function useMessageNotifications(): void {
  const { operatorNotes } = useStore()
  const { user } = useAuth()
  const initialLoadRef = useRef(true)
  const seenIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    // Operatör ve guest'te çalışmasın
    if (user.role === 'operator' || user.role === 'guest') return

    // İlk yükleme: mevcut tüm mesajları "görülmüş" say, uyarı çalma
    if (initialLoadRef.current) {
      initialLoadRef.current = false
      seenIdsRef.current = new Set(operatorNotes.map(n => n.id))
      return
    }

    // Yeni mesajları bul
    for (const n of operatorNotes) {
      if (seenIdsRef.current.has(n.id)) continue
      seenIdsRef.current.add(n.id)

      // Yönetim mesajlarını atla (kendi gönderdiğimiz)
      if ((n.opAd || '').includes('Yönetim')) continue

      const acil = n.oncelik === 'Acil'
      const title = acil ? '🚨 ACİL Mesaj' : '💬 Yeni Mesaj'
      const body = `${n.opAd}${n.kategori ? ` [${n.kategori}]` : ''}: ${n.mesaj.slice(0, 120)}`

      playBeep(acil)
      showNotification(title, body, acil)
    }
  }, [operatorNotes, user])
}

// Notification izin helpers (Messages sayfasında butondan çağrılır)
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return await Notification.requestPermission()
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}
