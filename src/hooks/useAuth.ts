import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, setGuestMode } from '@/lib/supabase'
import { can as canCheck, type UserRole } from '@/lib/permissions'
import { claimSession, releaseSession, subscribeSessionChanges, generateSessionId, getDeviceLabel, type UserType } from '@/lib/sessionGuard'

interface AuthUser {
  role: UserRole
  username: string
  email?: string
  loginTime: string
  oprId?: string
  dbId?: string           // uys_kullanicilar.id
  sessionId?: string      // v16.36 — Multi-device single-session: bu cihazın claim ettiği UUID
}

const AUTH_KEY = 'uys_v3_auth'
const OPR_KEY = 'uys_v3_opr' // sessionStorage — tab kapanınca silinir
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
    return stored
  })
  const [loading, setLoading] = useState(true)

  // v16.36 — Multi-device single-session: başka cihaz aynı kullanıcıyla giriş yaptığında bu state dolar.
  // App.tsx bunu izler ve 5 sn uyarı modal'ı + auto-logout tetikler.
  const [sessionInvalidated, setSessionInvalidated] = useState<{ deviceLabel: string } | null>(null)

  const unsubRef = useRef<(() => void) | null>(null)

  // v16.36 — Yeni cihaz claim'i. Login akışlarının her birinde çağrılır.
  // 1) sessionId üret, 2) DB'ye yaz, 3) state'e ekle.
  // DB yazımı başarısız olsa bile auth state set edilir (graceful degradation, login engellemez).
  const claimAndAttachSession = useCallback(async (
    base: AuthUser,
    userType: UserType,
    userIdInDb: string,
  ): Promise<AuthUser> => {
    const sessionId = generateSessionId()
    const deviceLabel = getDeviceLabel()
    await claimSession({ userType, userId: userIdInDb, sessionId, deviceLabel })
    return { ...base, sessionId }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email || ''
        if (ADMIN_EMAILS.includes(email)) {
          // v16.24 — Admin login'de operator session'i temizle
          sessionStorage.removeItem(OPR_KEY)
          // v16.36 — admin için uys_kullanicilar.id'yi auth_user_id ile bul
          let dbId: string | undefined
          try {
            const { data: ku } = await supabase.from('uys_kullanicilar')
              .select('id').eq('auth_user_id', session.user.id).limit(1)
            if (ku && ku.length > 0) dbId = ku[0].id
          } catch {}
          let authUser: AuthUser = {
            role: 'admin',
            username: session.user.user_metadata?.full_name || email.split('@')[0],
            email, loginTime: new Date().toISOString(),
            dbId,
          }
          // v16.36 — sadece dbId varsa session claim et (DB satırı varsa)
          if (dbId) {
            authUser = await claimAndAttachSession(authUser, 'kullanici', dbId)
          }
          persistUser(authUser)
          setUser(authUser)
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
          let dbId: string | undefined
          try {
            const { data: ku } = await supabase.from('uys_kullanicilar')
              .select('id').eq('auth_user_id', session.user.id).limit(1)
            if (ku && ku.length > 0) dbId = ku[0].id
          } catch {}
          let authUser: AuthUser = {
            role: 'admin',
            username: session.user.user_metadata?.full_name || email.split('@')[0],
            email, loginTime: new Date().toISOString(),
            dbId,
          }
          if (dbId) {
            authUser = await claimAndAttachSession(authUser, 'kullanici', dbId)
          }
          persistUser(authUser)
          setUser(authUser)
        } else if (email.endsWith('@uys.local')) {
          // v16.22 — Operator Auth session (claim Login.tsx operatorLogin akışında zaten yapılıyor)
          console.info('[v16.22] Operator Auth session aktif:', email)
        } else {
          supabase.auth.signOut()
        }
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [claimAndAttachSession])

  // v16.36 — Realtime subscription: aktif user için DB satırını dinle.
  // user değiştiğinde önceki sub'ı temizleyip yenisini başlat.
  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
    if (!user || !user.sessionId) return
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
    const cleanup = subscribeSessionChanges({
      userType,
      userId,
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
    // 0) Email iceriyorsa Supabase Auth path
    if (username.includes('@')) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: username, password })
      if (error) return { error: error.message }
      if (data?.session) return { error: null }
      return { error: 'Auth basarisiz (session yok)' }
    }

    // 1) Custom auth — uys_kullanicilar (kullanici_ad + sifre)
    try {
      const { data } = await supabase.from('uys_kullanicilar')
        .select('*')
        .eq('kullanici_ad', username)
        .eq('sifre', password)
        .eq('aktif', true)
        .limit(1)
      if (data && data.length > 0) {
        const k = data[0]
        const rol = (k.rol || 'planlama') as UserRole
        let authUser: AuthUser = {
          role: rol,
          username: k.ad || username,
          loginTime: new Date().toISOString(),
          dbId: k.id,
        }
        // v16.36 — session claim
        authUser = await claimAndAttachSession(authUser, 'kullanici', k.id)
        persistUser(authUser)
        setUser(authUser)
        return { error: null }
      }
    } catch { /* tablo yoksa veya hata → reddet */ }

    return { error: 'Hatalı şifre' }
  }

  async function signOut() {
    // v16.36 — release session (eğer hala bizim ise)
    if (user?.sessionId) {
      let userType: UserType | null = null
      let userId: string | null = null
      if (user.role === 'operator' && user.oprId) {
        userType = 'operator'; userId = user.oprId
      } else if (user.dbId) {
        userType = 'kullanici'; userId = user.dbId
      }
      if (userType && userId) {
        await releaseSession({ userType, userId, sessionId: user.sessionId })
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

  async function operatorLogin(oprId: string, oprAd: string) {
    let authUser: AuthUser = { role: 'operator', username: oprAd, loginTime: new Date().toISOString(), oprId }
    // v16.36 — session claim
    authUser = await claimAndAttachSession(authUser, 'operator', oprId)
    // sessionStorage: tab kapanınca silinir
    sessionStorage.setItem(OPR_KEY, JSON.stringify(authUser))
    setUser(authUser)
  }

  const role = (user?.role || 'guest') as UserRole
  const can = useCallback((action: string) => canCheck(role, action), [role])
  const isAdminLevel = role === 'admin' || role === 'uretim_sor' || role === 'planlama' || role === 'depocu'

  return {
    session: user, user, loading, signIn, signInWithGoogle, signOut, guestLogin, operatorLogin,
    isAuthenticated: !!user, isGuest: user?.role === 'guest', isAdmin: user?.role === 'admin',
    isAdminLevel, isOperator: user?.role === 'operator',
    role, can,
    // v16.36 — Multi-device single-session
    sessionInvalidated,
  }
}
