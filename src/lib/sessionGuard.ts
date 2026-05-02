// src/lib/sessionGuard.ts
//
// Tek-oturum (single-session) altyapısı — Multi-device single-session enforcement.
// Slice 1 (DB): uys_kullanicilar + uys_operators tablolarına aktif_oturum_id (uuid) +
//               aktif_oturum_cihaz (text) + aktif_oturum_son (timestamptz) eklendi.
// Slice 2 (bu dosya): session id üret, DB'ye yaz, Realtime ile dinle.
// Slice 3 (useAuth.ts): login akışlarına entegre.
// Slice 4 (App.tsx): mismatch durumunda 5 sn uyarı modal + auto-logout.

import { supabase } from '@/lib/supabase'

export type UserType = 'kullanici' | 'operator'

const TABLE_BY_TYPE: Record<UserType, string> = {
  kullanici: 'uys_kullanicilar',
  operator: 'uys_operators',
}

// ───────────────────────────────────────────────────────────────────
// Yardımcılar

/** Kriptografik UUID üret. crypto.randomUUID modern tarayıcılarda var (iOS 15.4+, Chrome 92+). */
export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback (eski tarayıcılar — RFC4122 v4 manuel)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** "iPad — Safari", "Windows — Chrome" gibi okunabilir cihaz etiketi. */
export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Bilinmeyen cihaz'
  const ua = navigator.userAgent || ''
  const platform = (navigator as any).platform || ''

  // OS tespiti
  let os = 'Bilinmeyen'
  if (/iPad/.test(ua)) os = 'iPad'
  else if (/iPhone/.test(ua)) os = 'iPhone'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Mac/.test(platform) || /Macintosh/.test(ua)) os = 'Mac'
  else if (/Win/.test(platform) || /Windows/.test(ua)) os = 'Windows'
  else if (/Linux/.test(platform)) os = 'Linux'

  // Tarayıcı tespiti
  let browser = ''
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari'
  else browser = 'Tarayıcı'

  return `${os} — ${browser}`
}

// ───────────────────────────────────────────────────────────────────
// DB işlemleri

interface ClaimArgs {
  userType: UserType
  userId: string
  sessionId: string
  deviceLabel: string
}

/**
 * Bu cihazı yeni aktif oturum olarak ilan eder.
 * Önceki aktif_oturum_id ne ise üzerine yazılır (REPLACE) — Realtime ile diğer cihazlar bunu fark eder.
 * Sessizce başarısız olur (login engelleme amaç değil; sadece guard mekanizması).
 */
export async function claimSession({ userType, userId, sessionId, deviceLabel }: ClaimArgs): Promise<{ ok: boolean; error?: string }> {
  const table = TABLE_BY_TYPE[userType]
  try {
    const { error } = await supabase
      .from(table)
      .update({
        aktif_oturum_id: sessionId,
        aktif_oturum_cihaz: deviceLabel,
        aktif_oturum_son: new Date().toISOString(),
      })
      .eq('id', userId)
    if (error) {
      console.warn('[sessionGuard] claim failed:', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e: any) {
    console.warn('[sessionGuard] claim exception:', e?.message)
    return { ok: false, error: e?.message }
  }
}

/**
 * Bu cihaz logout olurken aktif_oturum_id'yi NULL'a çeker.
 * NOT: Eğer bu cihazın session_id'si DB'dekiyle artık eşleşmiyorsa (zaten başka cihaz claim etmiş)
 * yine de NULL'a çekmeye çalışmamalı — ".eq('aktif_oturum_id', sessionId)" filter ile koruyoruz.
 */
export async function releaseSession(args: { userType: UserType; userId: string; sessionId: string }): Promise<void> {
  const { userType, userId, sessionId } = args
  const table = TABLE_BY_TYPE[userType]
  try {
    await supabase
      .from(table)
      .update({
        aktif_oturum_id: null,
        aktif_oturum_cihaz: null,
        aktif_oturum_son: null,
      })
      .eq('id', userId)
      .eq('aktif_oturum_id', sessionId)  // Sadece kendi oturumumuz hala aktifse temizle
  } catch (e: any) {
    console.warn('[sessionGuard] release exception:', e?.message)
    // Sessizce yut — logout her durumda devam etmeli
  }
}

// ───────────────────────────────────────────────────────────────────
// Realtime subscription

interface SubscribeArgs {
  userType: UserType
  userId: string
  currentSessionId: string
  onMismatch: (newDeviceLabel: string) => void
}

/**
 * Kendi DB satırının değişikliklerini dinler.
 * aktif_oturum_id değişip de bizim sessionId'miz değilse → "başka cihaz" demektir → callback tetiklenir.
 *
 * Returns: cleanup fonksiyonu (unsubscribe).
 */
export function subscribeSessionChanges({ userType, userId, currentSessionId, onMismatch }: SubscribeArgs): () => void {
  const table = TABLE_BY_TYPE[userType]
  const channelName = `session_guard_${userType}_${userId}`

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table,
        filter: `id=eq.${userId}`,
      },
      (payload: any) => {
        try {
          const newRow = payload?.new
          if (!newRow) return
          const newSessionId: string | null = newRow.aktif_oturum_id ?? null
          // newSessionId değiştiyse VE bizimkiyle eşleşmiyorsa → başka cihaz
          if (newSessionId && newSessionId !== currentSessionId) {
            const deviceLabel: string = newRow.aktif_oturum_cihaz || 'Başka bir cihaz'
            onMismatch(deviceLabel)
          }
          // newSessionId === null veya === currentSessionId → bizim claim'imiz, sessiz geç
        } catch (e: any) {
          console.warn('[sessionGuard] subscribe payload parse:', e?.message)
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.info('[sessionGuard] subscribed:', channelName)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[sessionGuard] subscription status:', status)
      }
    })

  return () => {
    try {
      supabase.removeChannel(channel)
    } catch (e: any) {
      console.warn('[sessionGuard] unsubscribe exception:', e?.message)
    }
  }
}
