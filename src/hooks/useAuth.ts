import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface AuthUser {
  role: 'admin' | 'guest'
  username: string
  loginTime: string
}

const AUTH_KEY = 'uys_v3_auth'
const ADMIN_PASS = 'admin123'

function getStored(): AuthUser | null {
  try {
    const s = localStorage.getItem(AUTH_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getStored())
  const [loading] = useState(false)

  // Supabase anon oturumu — tablo erişimi için
  useEffect(() => {
    if (user) {
      supabase.auth.signInWithPassword({
        email: 'operator@ozler.local',
        password: 'Ozler2024!'
      }).catch(() => {})
    }
  }, [user])

  async function signIn(username: string, password: string) {
    // Önce sabit şifre kontrolü
    if (password === ADMIN_PASS) {
      const authUser: AuthUser = { role: 'admin', username: username || 'admin', loginTime: new Date().toISOString() }
      localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
      setUser(authUser)

      // Supabase oturumu aç
      await supabase.auth.signInWithPassword({
        email: 'operator@ozler.local',
        password: 'Ozler2024!'
      }).catch(() => {})

      return { error: null }
    }

    // Ayarlar tablosundan şifre kontrolü (opsiyonel)
    try {
      const { data } = await supabase.from('uys_ayarlar').select('value').eq('key', 'admin_pass').single()
      if (data?.value && password === data.value) {
        const authUser: AuthUser = { role: 'admin', username: username || 'admin', loginTime: new Date().toISOString() }
        localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
        setUser(authUser)
        return { error: null }
      }
    } catch {}

    return { error: 'Hatalı şifre' }
  }

  function signOut() {
    localStorage.removeItem(AUTH_KEY)
    setUser(null)
  }

  function guestLogin() {
    const authUser: AuthUser = { role: 'guest', username: 'misafir', loginTime: new Date().toISOString() }
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
    setUser(authUser)

    // Supabase oturumu aç
    supabase.auth.signInWithPassword({
      email: 'operator@ozler.local',
      password: 'Ozler2024!'
    }).catch(() => {})
  }

  return {
    session: user,
    user,
    loading,
    signIn,
    signOut,
    guestLogin,
    isAuthenticated: !!user,
    isGuest: user?.role === 'guest',
    isAdmin: user?.role === 'admin',
  }
}
