import { useState, useEffect, useCallback } from 'react'
import { supabase, setGuestMode } from '@/lib/supabase'
import { can as canCheck, type UserRole } from '@/lib/permissions'

interface AuthUser {
  role: UserRole
  username: string
  email?: string
  loginTime: string
  oprId?: string
  dbId?: string           // uys_kullanicilar.id
}

const AUTH_KEY = 'uys_v3_auth'
const OPR_KEY = 'uys_v3_opr' // sessionStorage — tab kapanınca silinir
const ADMIN_EMAILS = ['uzuniskender@gmail.com', 'admin@uys.local']

function getStored(): AuthUser | null {
  try {
    // Önce sessionStorage'dan operatör kontrolü
    const oprS = sessionStorage.getItem(OPR_KEY)
    if (oprS) return JSON.parse(oprS)
    // Sonra localStorage'dan admin/guest
    const s = localStorage.getItem(AUTH_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = getStored()
    if (stored?.role === 'guest') setGuestMode(true)
    return stored
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email || ''
        if (ADMIN_EMAILS.includes(email)) {
          // v16.24 — Admin login'de operator session'i temizle
          // (eger ayni tarayicidan once operator olarak girildiyse, session yoksa
          // sessionStorage OPR_KEY okunmaya devam eder ve admin gorunmez)
          sessionStorage.removeItem(OPR_KEY)
          const authUser: AuthUser = {
            role: 'admin',
            username: session.user.user_metadata?.full_name || email.split('@')[0],
            email, loginTime: new Date().toISOString(),
          }
          localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
          setUser(authUser)
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
          // v16.24 — Admin Auth session'a gecince operator sessionStorage'i temizle
          // Aksi halde getStored() once OPR_KEY'i okur, admin gorunmez
          sessionStorage.removeItem(OPR_KEY)
          const authUser: AuthUser = {
            role: 'admin',
            username: session.user.user_metadata?.full_name || email.split('@')[0],
            email, loginTime: new Date().toISOString(),
          }
          localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
          setUser(authUser)
        } else if (email.endsWith('@uys.local')) {
          // v16.22 — Operator Auth session (Asama 2C pilot, Asama 3 yayilim)
          // sessionStorage'da role=operator zaten yazili (operatorLogin tarafindan)
          // Auth session'i koruyoruz ki RLS auth.uid() doluluk olsun
          console.info('[v16.22] Operator Auth session aktif:', email)
        } else {
          // Bilinmeyen email — guvenlik, signOut
          supabase.auth.signOut()
        }
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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
    // v16.18'de eklenmis, bir noktada kazara silinmis (DataManagement.tsx kazalari gibi
    // patch hijyen ihlali §27.7). v16.27a'da geri eklendi — admin@uys.local + uzuniskender@gmail.com
    // Auth user'lari icin signInWithPassword. useEffect onAuthStateChange ADMIN_EMAILS branch'i
    // state'i set edecek (sessionStorage OPR_KEY temizleme dahil — v16.24).
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
        const authUser: AuthUser = {
          role: rol,
          username: k.ad || username,
          loginTime: new Date().toISOString(),
          dbId: k.id,
        }
        localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
        setUser(authUser)
        return { error: null }
      }
    } catch { /* tablo yoksa veya hata → reddet */ }

    // v16.27a — admin123 hardcoded fallback silindi (guvenlik acigi). Magic Link + admin@uys.local
    // Auth user'i mevcut, geriye uyumluluk gerekmiyor. Eski 'uys_admin_pass' localStorage anahtari
    // da artik kullanilmiyor.

    return { error: 'Hatalı şifre' }
  }

  async function signOut() {
    try { await supabase.auth.signOut() } catch {}
    localStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(OPR_KEY)
    setUser(null)
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
    const authUser: AuthUser = { role: 'operator', username: oprAd, loginTime: new Date().toISOString(), oprId }
    // sessionStorage: tab kapanınca silinir — operatör her açılışta şifre girer
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
  }
}
