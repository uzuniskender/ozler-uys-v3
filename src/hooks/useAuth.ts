import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, setGuestMode } from '@/lib/supabase'
import { can as canCheck, type UserRole } from '@/lib/permissions'
import { claimSession, releaseSession, subscribeSessionChanges, generateSessionId, getDeviceLabel, type UserType } from '@/lib/sessionGuard'
import { useAuthStore } from '@/store/useAuthStore'

interface AuthUser {
  role: UserRole
  username: string
  email?: string
  loginTime: string
  oprId?: string
  dbId?: string           // uys_kullanicilar.id
  sessionId?: string      // v16.38 — Multi-device single-session
  authUserId?: string     // v16.38 — Supabase Auth user.id (admin için dbId lookup'ında kullanılır)
}

const AUTH_KEY = 'uys_v3_auth'
const OPR_KEY = 'uys_v3_opr'
const ADMIN_EMAILS = ['uzuniskender@gmail.com', 'admin@uys.local']

function getStored(): AuthUser | null {
  try {
    const oprS = sessionStorage.getItem(OPR_KEY)
    if (oprS) return JSON.parse(oprS)
    const s = localStorage.getItem(AUTH_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function persistUser(u: AuthUser) {
  if (u.role === 'operator') {
    sessionStorage.setItem(OPR_KEY, JSON.stringify(u))
  } else {
    localStorage.setItem(AUTH_KEY, JSON.stringify(u))
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = getStored()
    if (stored?.role === 'guest') setGuestMode(true)
    // v16.38 — Migrate: stored user'da sessionId yoksa otomatik üret (eski state'i ele al)
    if (stored && !stored.sessionId && stored.role !== 'guest') {
      stored.sessionId = generateSessionId()
      persistUser(stored)
    }
    return stored
  })
  const [loading, setLoading] = useState(true)

  const [sessionInvalidated, setSessionInvalidated] = useState<{ deviceLabel: string } | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // v16.43 — Test ortamında (vite --mode test) Supabase Auth getSession ve onAuthStateChange
    // bypass edilir. Test helper'ı (Playwright loginAs) localStorage'a hem
    // sb-{ref}-auth-token (RLS için) hem uys_v3_auth (rol için) yazar.
    // ADMIN_EMAILS dışı email'ler için signOut tetiklenmesin → useState initial
    // (getStored) ile gelen kullanıcı korunur.
    if (import.meta.env.MODE === 'test') {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      try {
        if (session?.user) {
          const email = session.user.email || ''
          if (ADMIN_EMAILS.includes(email)) {
            sessionStorage.removeItem(OPR_KEY)
            // v16.38 — Mevcut sessionId'yi koru (varsa) yoksa yeni üret
            const existing = getStored()
            const sessionId = (existing?.sessionId && existing.email === email) ? existing.sessionId : generateSessionId()
            const authUser: AuthUser = {
              role: 'admin',
              username: session.user.user_metadata?.full_name || email.split('@')[0],
              email,
              loginTime: existing?.email === email ? existing!.loginTime : new Date().toISOString(),
              sessionId,
              authUserId: session.user.id,
              dbId: existing?.dbId,  // mevcut dbId'yi koru, sonra useEffect lookup ile doldurur
            }
            persistUser(authUser)
            setUser(authUser)
          }
        }
      } catch (e: any) {
        console.warn('[v16.38] getSession handler exception:', e?.message)
      } finally {
        setLoading(false)
      }
    }).catch((e: any) => {
      console.warn('[v16.38] getSession failed:', e?.message)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem(AUTH_KEY)
          sessionStorage.removeItem(OPR_KEY)
          setUser(null)
          setLoading(false)
          return
        }
        if (session?.user) {
          const email = session.user.email || ''
          if (ADMIN_EMAILS.includes(email)) {
            sessionStorage.removeItem(OPR_KEY)
            const existing = getStored()
            const sessionId = (existing?.sessionId && existing.email === email) ? existing.sessionId : generateSessionId()
            const authUser: AuthUser = {
              role: 'admin',
              username: session.user.user_metadata?.full_name || email.split('@')[0],
              email,
              loginTime: existing?.email === email ? existing!.loginTime : new Date().toISOString(),
              sessionId,
              authUserId: session.user.id,
              dbId: existing?.dbId,
            }
            persistUser(authUser)
            setUser(authUser)
          } else if (email.endsWith('@uys.local')) {
            // Operator Auth session — log üretmeden bırak
          } else {
            supabase.auth.signOut()
          }
        }
      } catch (e: any) {
        console.warn('[v16.38] onAuthStateChange exception:', e?.message)
      } finally {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // v16.38 — Admin için dbId lookup. authUserId varsa ve dbId yoksa uys_kullanicilar'da ara.
  // Race önleme: cancelled flag, sadece role==='admin' && !dbId koşulunda update.
  useEffect(() => {
    if (!user) return
    if (user.role !== 'admin') return
    if (user.dbId) return
    if (!user.authUserId) return
    let cancelled = false
    supabase.from('uys_kullanicilar')
      .select('id').eq('auth_user_id', user.authUserId).limit(1)
      .then(({ data }) => {
        if (cancelled) return
        if (data && data.length > 0) {
          const newDbId = data[0].id as string
          setUser(curr => {
            if (!curr || curr.role !== 'admin' || curr.dbId) return curr
            const updated = { ...curr, dbId: newDbId }
            persistUser(updated)
            return updated
          })
        } else {
          console.warn('[v16.38] admin için uys_kullanicilar kaydı bulunamadı (auth_user_id:', user.authUserId, ') — tek-oturum koruması inaktif')
        }
      })
      .catch((e: any) => console.warn('[v16.38] dbId lookup failed:', e?.message))
    return () => { cancelled = true }
  }, [user?.role, user?.dbId, user?.authUserId])

// Module-level: tüm useAuth instance'ları arasında subscription tek yerde çalışır
let _sgOwner: string | null = null

  // v16.38 — Session claim + Realtime/polling subscription. Fire-and-forget.
  useEffect(() => {
    if (!user || !user.sessionId) {
      _sgOwner = null  // Logout: yeni girişte fresh subscription
      return
    }

    let userType: UserType | null = null
    let userId: string | null = null
    if (user.role === 'operator' && user.oprId) {
      userType = 'operator'
      userId = user.oprId
    } else if (user.dbId) {
      userType = 'kullanici'
      userId = user.dbId
    }
    if (!userType || !userId) return

    claimSession({
      userType, userId,
      sessionId: user.sessionId,
      deviceLabel: getDeviceLabel(),
    }).catch((e: any) => console.warn('[v16.38] claim failed:', e?.message))

    const cleanup = subscribeSessionChanges({
      userType, userId,
      currentSessionId: user.sessionId,
      onMismatch: (deviceLabel) => {
        setSessionInvalidated({ deviceLabel })
      },
    })
    unsubRef.current = cleanup
    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [user?.sessionId, user?.role, user?.oprId, user?.dbId])

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signIn(username: string, password: string) {
    if (username.includes('@')) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: username, password })
      if (error) return { error: error.message }
      if (data?.session) return { error: null }
      return { error: 'Auth basarisiz (session yok)' }
    }

    // v16.87 — Non-admin: önce Supabase Auth dene (username@uys.local).
    // Başarılı olursa authenticated JWT alınır → RLS politikaları current_user_role()
    // ile kullanıcı rolünü DB'den okuyabilir.
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: `${username}@uys.local`,
      password,
    })
    if (!authError && authData?.session) {
      // Rolü uys_kullanicilar'dan oku (authenticated JWT ile)
      const { data: kRows } = await supabase.from('uys_kullanicilar')
        .select('id, ad, rol')
        .eq('auth_user_id', authData.session.user.id)
        .eq('aktif', true)
        .limit(1)
      if (kRows && kRows.length > 0) {
        const k = kRows[0]
        const existing = getStored()
        const authUser: AuthUser = {
          role: ((k.rol as string) || 'planlama') as UserRole,
          username: (k.ad as string) || username,
          loginTime: new Date().toISOString(),
          dbId: k.id as string,
          sessionId: (existing?.dbId === k.id && existing?.sessionId) ? existing.sessionId : generateSessionId(),
          authUserId: authData.session.user.id,
        }
        persistUser(authUser)
        setUser(authUser)
        return { error: null }
      }
      // Auth başarılı ama uys_kullanicilar kaydı yok
      await supabase.auth.signOut()
      return { error: 'Kullanıcı kaydı bulunamadı' }
    }

    // Fallback: doğrudan DB sorgusu (henüz Supabase Auth hesabı açılmamış kullanıcılar).
    // Not: uys_kullanicilar'da authenticated_select politikası varsa bu yol
    // anon erişimini engelleyebilir; kullanıcıların @uys.local hesabı olması gerekir.
    try {
      const { data } = await supabase.from('uys_kullanicilar')
        .select('*')
        .eq('kullanici_ad', username)
        .eq('sifre', password)
        .eq('aktif', true)
        .limit(1)
      if (data && data.length > 0) {
        const k = data[0]
        const authUser: AuthUser = {
          role: ((k.rol as string) || 'planlama') as UserRole,
          username: (k.ad as string) || username,
          loginTime: new Date().toISOString(),
          dbId: k.id as string,
          sessionId: generateSessionId(),
        }
        persistUser(authUser)
        setUser(authUser)
        return { error: null }
      }
    } catch { /* RLS veya bağlantı hatası */ }

    return { error: 'Hatalı şifre' }
  }

  async function signOut() {
    if (user?.sessionId) {
      let userType: UserType | null = null
      let userId: string | null = null
      if (user.role === 'operator' && user.oprId) {
        userType = 'operator'; userId = user.oprId
      } else if (user.dbId) {
        userType = 'kullanici'; userId = user.dbId
      }
      if (userType && userId) {
        releaseSession({ userType, userId, sessionId: user.sessionId })
          .catch((e: any) => console.warn('[v16.38] release exception:', e?.message))
      }
    }
    try { await supabase.auth.signOut() } catch {}
    localStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(OPR_KEY)
    setUser(null)
    setSessionInvalidated(null)
    setGuestMode(false)
    window.location.reload()
  }

  function guestLogin() {
    const authUser: AuthUser = { role: 'guest', username: 'misafir', loginTime: new Date().toISOString() }
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
    setUser(authUser)
    setGuestMode(true)
  }

  function operatorLogin(oprId: string, oprAd: string) {
    const authUser: AuthUser = {
      role: 'operator',
      username: oprAd,
      loginTime: new Date().toISOString(),
      oprId,
      sessionId: generateSessionId(),
    }
    sessionStorage.setItem(OPR_KEY, JSON.stringify(authUser))
    setUser(authUser)
  }

  const yetkiMap = useAuthStore(s => s.yetkiMap)
  const role = (user?.role || 'guest') as UserRole
  const can = useCallback((action: string) => canCheck(role, action), [role, yetkiMap])
  const isAdminLevel = role === 'admin' || role === 'uretim_sor' || role === 'planlama' || role === 'depocu'

  return {
    session: user, user, loading, signIn, signInWithGoogle, signOut, guestLogin, operatorLogin,
    isAuthenticated: !!user, isGuest: user?.role === 'guest', isAdmin: user?.role === 'admin',
    isAdminLevel, isOperator: user?.role === 'operator',
    role, can,
    sessionInvalidated,
  }
}
