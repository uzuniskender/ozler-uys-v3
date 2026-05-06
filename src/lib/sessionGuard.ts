// src/lib/sessionGuard.ts
//
// Tek-oturum (single-session) altyapısı.
// v16.39: Channel name çakışması fix + tüm subscribe try-catch içinde + polling tek başına garantili.

import { supabase } from '@/lib/supabase'

export type UserType = 'kullanici' | 'operator'

const TABLE_BY_TYPE: Record<UserType, string> = {
  kullanici: 'uys_kullanicilar',
  operator: 'uys_operators',
}

const POLL_INTERVAL_MS = 10000

export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Bilinmeyen cihaz'
  const ua = navigator.userAgent || ''
  const platform = (navigator as any).platform || ''

  let os = 'Bilinmeyen'
  if (/iPad/.test(ua)) os = 'iPad'
  else if (/iPhone/.test(ua)) os = 'iPhone'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Mac/.test(platform) || /Macintosh/.test(ua)) os = 'Mac'
  else if (/Win/.test(platform) || /Windows/.test(ua)) os = 'Windows'
  else if (/Linux/.test(platform)) os = 'Linux'

  let browser = ''
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari'
  else browser = 'Tarayıcı'

  return `${os} — ${browser}`
}

interface ClaimArgs {
  userType: UserType
  userId: string
  sessionId: string
  deviceLabel: string
}

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
    console.info('[sessionGuard] claim OK:', userType, userId, sessionId.slice(0, 8))
    return { ok: true }
  } catch (e: any) {
    console.warn('[sessionGuard] claim exception:', e?.message)
    return { ok: false, error: e?.message }
  }
}

export async function releaseSession(args: { userType: UserType; userId: string; sessionId: string }): Promise<void> {
  const { userType, userId, sessionId } = args
  const table = TABLE_BY_TYPE[userType]
  try {
    await supabase
      .from(table)
      .update({ aktif_oturum_id: null, aktif_oturum_cihaz: null, aktif_oturum_son: null })
      .eq('id', userId)
      .eq('aktif_oturum_id', sessionId)
  } catch (e: any) {
    console.warn('[sessionGuard] release exception:', e?.message)
  }
}

async function pollOnce(userType: UserType, userId: string): Promise<{ aktif_oturum_id: string | null; aktif_oturum_cihaz: string | null }> {
  const table = TABLE_BY_TYPE[userType]
  try {
    const { data, error } = await supabase
      .from(table)
      .select('aktif_oturum_id, aktif_oturum_cihaz')
      .eq('id', userId)
      .limit(1)
      .single()
    if (error) {
      // Sessizce yut — single() row yoksa hata fırlatır, normal durum
      return { aktif_oturum_id: null, aktif_oturum_cihaz: null }
    }
    return {
      aktif_oturum_id: data?.aktif_oturum_id || null,
      aktif_oturum_cihaz: data?.aktif_oturum_cihaz || null,
    }
  } catch (e: any) {
    return { aktif_oturum_id: null, aktif_oturum_cihaz: null }
  }
}

interface SubscribeArgs {
  userType: UserType
  userId: string
  currentSessionId: string
  onMismatch: (newDeviceLabel: string) => void
}

// v16.50 — Singleton: aynı anda sadece 1 subscription. Birden fazla component useAuth çağırsa bile çakışma yok.
let _sgChannel: any = null
let _sgPollTimer: any = null
let _sgInitTimer: any = null
let _sgUserId: string | null = null

/**
 * v16.50 — Singleton subscription: her çağrıda önce eskiyi kapat, sonra yenisini aç.
 * Böylece birden fazla React component aynı hook'u kullansa bile tek kanal açık kalır.
 */
export function subscribeSessionChanges({ userType, userId, currentSessionId, onMismatch }: SubscribeArgs): () => void {
  const table = TABLE_BY_TYPE[userType]
  // Aynı user için zaten subscription varsa: kesinlikle no-op
  if (_sgChannel && _sgUserId === userId) {
    return () => {}
  }
  // Farklı user veya kanal yok: eskiyi kapat, yeni aç
  if (_sgChannel) { try { supabase.removeChannel(_sgChannel) } catch {} _sgChannel = null }
  if (_sgPollTimer) { clearInterval(_sgPollTimer); _sgPollTimer = null }
  if (_sgInitTimer) { clearTimeout(_sgInitTimer); _sgInitTimer = null }
  _sgUserId = userId
  const channelName = `session_guard_${userType}_${userId}`
  let triggered = false

  function trigger(deviceLabel: string) {
    if (triggered) return
    triggered = true
    console.warn('[sessionGuard] MISMATCH detected:', deviceLabel)
    onMismatch(deviceLabel || 'Başka bir cihaz')
  }

  // 1) Realtime subscription — tüm kurulum try-catch içinde, hata olursa polling devam eder
  let channel: any = null
  try {
    channel = supabase
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
            if (newSessionId && newSessionId !== currentSessionId) {
              const deviceLabel: string = newRow.aktif_oturum_cihaz || 'Başka bir cihaz'
              trigger(deviceLabel)
            }
          } catch (e: any) {
            console.warn('[sessionGuard] payload parse:', e?.message)
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.info('[sessionGuard] subscribed:', channelName)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[sessionGuard] subscription status:', status, '(polling devam)')
        }
      })
  } catch (e: any) {
    console.warn('[sessionGuard] subscribe setup failed (polling devam):', e?.message)
    channel = null
  }

  // 2) Polling fallback — Realtime başarısız olsa bile çalışır
  console.info('[sessionGuard] polling started (10 sn)')
  _sgPollTimer = setInterval(async () => {
    if (triggered) return
    const result = await pollOnce(userType, userId)
    if (result.aktif_oturum_id && result.aktif_oturum_id !== currentSessionId) {
      trigger(result.aktif_oturum_cihaz || 'Başka bir cihaz')
    }
  }, POLL_INTERVAL_MS)

  // İlk yüklemede 1.5 sn sonra bir kez hızlı poll
  _sgInitTimer = setTimeout(async () => {
    if (triggered) return
    const result = await pollOnce(userType, userId)
    if (result.aktif_oturum_id && result.aktif_oturum_id !== currentSessionId) {
      trigger(result.aktif_oturum_cihaz || 'Başka bir cihaz')
    }
  }, 1500)
  _sgChannel = channel

  return () => {
    if (_sgPollTimer) { clearInterval(_sgPollTimer); _sgPollTimer = null }
    if (_sgInitTimer) { clearTimeout(_sgInitTimer); _sgInitTimer = null }
    if (_sgChannel) {
      try {
        supabase.removeChannel(channel)
      } catch (e: any) {
        console.warn('[sessionGuard] unsubscribe exception (yutuldu):', e?.message)
      }
    }
  }
}
