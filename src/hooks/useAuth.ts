import { useState, useEffect } from 'react'
import { supabase, setGuestMode } from '@/lib/supabase'

interface AuthUser {
  role: 'admin' | 'guest' | 'operator'
  username: string
  email?: string
  loginTime: string
  oprId?: string
}

const AUTH_KEY = 'uys_v3_auth'
const ADMIN_EMAILS = ['uzuniskender@gmail.com']

function getStored(): AuthUser | null {
  try {
    const s = localStorage.getItem(AUTH_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = getStored()
    if (stored?.role === 'guest') setGuestMode(true)
    // Operatör oturumu kalıcı değil — her açılışta şifre sorulsun
    if (stored?.role === 'operator') {
      localStorage.removeItem(AUTH_KEY)
      return null
    }
    return stored
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const email = session.user.email || ''
        if (ADMIN_EMAILS.includes(email)) {
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
        setUser(null)
        setLoading(false)
        return
      }
      if (session?.user) {
        const email = session.user.email || ''
        if (ADMIN_EMAILS.includes(email)) {
          const authUser: AuthUser = {
            role: 'admin',
            username: session.user.user_metadata?.full_name || email.split('@')[0],
            email, loginTime: new Date().toISOString(),
          }
          localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
          setUser(authUser)
        } else {
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
    const ADMIN_PASS = 'admin123'
    const customPass = localStorage.getItem('uys_admin_pass')
    if (password === ADMIN_PASS || (customPass && password === customPass)) {
      const authUser: AuthUser = { role: 'admin', username: username || 'admin', loginTime: new Date().toISOString() }
      localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
      setUser(authUser)
      return { error: null }
    }
    return { error: 'Hatalı şifre' }
  }

  async function signOut() {
    try { await supabase.auth.signOut() } catch {}
    localStorage.removeItem(AUTH_KEY)
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
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
    setUser(authUser)
  }

  return {
    session: user, user, loading, signIn, signInWithGoogle, signOut, guestLogin, operatorLogin,
    isAuthenticated: !!user, isGuest: user?.role === 'guest', isAdmin: user?.role === 'admin', isOperator: user?.role === 'operator',
  }
}
