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
  sessionId?: string      // v16.37 — Multi-device single-session: bu cihazın claim ettiği UUID (sync üretilir)
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

  // v16.37 — Multi-device single-session: başka cihazdan giriş yapılınca state dolar.
  // App.tsx 5 sn countdown modal + auto-logout tetikler.
  const [sessionInvalidated, setSessionInvalidated] = useState<{ deviceLabel: string } | null>(null)

  const unsubRef = useRef<(() => void) | null>(null)

  // v16.37 — admin için arka planda dbId lookup. Login akışını ASLA bloklamaz.
  // claimSession+subscribe ayrı useEffect'te, dbId set olduktan sonra çalışır.
  const enrichAdminDbIdInBackground = useCallback((authUserId: string, base: AuthUser) => {
    // Fire-and-forget: hata olsa, network down olsa, RLS reject etse — auth state etkilenmez
    supabase.from('uys_kullanicilar')
      .select('id').eq('auth_user_id', authUserId).limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // dbId bulundu — state'i güncelle (sub useEffect'i yeniden tetiklenir)
          setUser(curr => {
            if (!curr) return curr
            // Sadece bizim user hala aktifse güncelle (race önleme)
            if (curr.loginTime !== base.loginTime) return curr
            const updated = { ...curr, dbId: data[0].id }
            persistUser(updated)
            return updated
          })
        }
      })
      .catch((e: any) => console.warn('[v16.37] admin dbId lookup failed:', e?.message))
  }, [])

  useEffect(() => {
    // v16.37 — getSession SYNC path: hızlı setLoading(false), DB ihtiyaç yok
    supabase.auth.getSession().then(({ data: { session } }) => {
      try {
        if (session?.user) {
          const email = session.user.email || ''
          if (ADMIN_EMAILS.includes(email)) {
            sessionStorage.removeItem(OPR_KEY)
            const sessionId = generateSessionId()
            const authUser: AuthUser = {
              role: 'admin',
              username: session.user.user_metadata?.full_name || email.split('@')[0],
              email, loginTime: new Date().toISOString(),
              sessionId,
            }
            persistUser(authUser)
            setUser(authUser)
            // dbId arka planda gelir
            enrichAdminDbIdInBackground(session.user.id, authUser)
          }
        }
      } catch (e: any) {
        console.warn('[v16.37] getSession handler exception:', e?.message)
      } finally {
        setLoading(false)
      }
    }).catch((e: any) => {
      // getSession promise reject olursa loading'de takılmamak için
      console.warn('[v16.37] getSession failed:', e?.message)
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
            const sessionId = generateSessionId()
            const authUser: AuthUser = {
              role: 'admin',
              username: session.user.user_metadata?.full_name || email.split('@')[0],
              email, loginTime: new Date().toISOString(),
              sessionId,
            }
            persistUser(authUser)
            setUser(authUser)
            enrichAdminDbIdInBackground(session.user.id, authUser)
          } else if (email.endsWith('@uys.local')) {
            console.info('[v16.22] Operator Auth session aktif:', email)
          } else {
            supabase.auth.signOut()
          }
        }
      } catch (e: any) {
        console.warn('[v16.37] onAuthStateChange exception:', e?.message)
      } finally {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [enrichAdminDbIdInBackground])

  // v16.37 — DB session claim + Realtime subscription. Tamamen fire-and-forget.
  // user.sessionId varsa, dbId/oprId varsa: arka planda DB'ye yaz + subscribe başlat.
  // Hata olursa tek-oturum koruması yok ama auth çalışmaya devam eder.
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
    if (!userType || !userId) return  // henüz dbId yok (admin için arka plan lookup bekleniyor)

    // 1) Fire-and-forget claim
    claimSession({
      userType, userId,
      sessionId: user.sessionId,
      deviceLabel: getDeviceLabel(),
    }).catch((e: any) => console.warn('[v16.37] claim failed (auth devam):', e?.message))

    // 2) Subscription başlat
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
    // 0) Email iceriyorsa Supabase Auth path (state'i onAuthStateChange handler'ı set eder)
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
        // v16.37 — sessionId sync üretilir, DB yazımı arka plan useEffect'inde
        const authUser: AuthUser = {
          role: rol,
          username: k.ad || username,
          loginTime: new Date().toISOString(),
          dbId: k.id,
          sessionId: generateSessionId(),
        }
        persistUser(authUser)
        setUser(authUser)
        return { error: null }
      }
    } catch { /* tablo yoksa veya hata → reddet */ }

    return { error: 'Hatalı şifre' }
  }

  async function signOut() {
    // v16.37 — release session (fire-and-forget, logout'u bloklamaz)
    if (user?.sessionId) {
      let userType: UserType | null = null
      let userId: string | null = null
      if (user.role === 'operator' && user.oprId) {
        userType = 'operator'; userId = user.oprId
      } else if (user.dbId) {
        userType = 'kullanici'; userId = user.dbId
      }
      if (userType && userId) {
        // Await etmiyoruz — logout her durumda devam eder
        releaseSession({ userType, userId, sessionId: user.sessionId })
          .catch((e: any) => console.warn('[v16.37] release exception:', e?.message))
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
    // v16.37 — sessionId sync üretilir, DB yazımı arka plan useEffect'inde
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

  const role = (user?.role || 'guest') as UserRole
  const can = useCallback((action: string) => canCheck(role, action), [role])
  const isAdminLevel = role === 'admin' || role === 'uretim_sor' || role === 'planlama' || role === 'depocu'

  return {
    session: user, user, loading, signIn, signInWithGoogle, signOut, guestLogin, operatorLogin,
    isAuthenticated: !!user, isGuest: user?.role === 'guest', isAdmin: user?.role === 'admin',
    isAdminLevel, isOperator: user?.role === 'operator',
    role, can,
    sessionInvalidated,
  }
}
