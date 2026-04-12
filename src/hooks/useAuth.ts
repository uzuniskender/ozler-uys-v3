import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Basit Auth — Supabase Auth bypass
 * Admin şifresi ayarlar tablosundan kontrol edilir
 * Oturum localStorage'da saklanır — email gerekmez, süresi dolmaz
 */

interface AuthUser {
  role: 'admin' | 'guest'
  loginTime: string
}

const AUTH_KEY = 'uys_v3_auth'

function getStored(): AuthUser | null {
  try {
    const s = localStorage.getItem(AUTH_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getStored())
  const [loading, setLoading] = useState(false)

  // Supabase anon oturumu aç (RLS için gerekli)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Anon olarak Supabase'e bağlan — servis kullanıcısıyla
        supabase.auth.signInWithPassword({
          email: 'operator@ozler.local',
          password: 'Ozler2024!'
        }).catch(() => {})
      }
    })
  }, [])

  async function signIn(username: string, password: string) {
    setLoading(true)
    try {
      // Ayarlar tablosundan admin şifresini kontrol et
      const { data } = await supabase.from('uys_ayarlar').select('value').eq('key', 'admin_pass').single()
      const adminPass = data?.value || 'admin123'

      // Sabit admin kullanıcıları
      const validUsers: Record<string, string> = {
        'admin': adminPass,
        'yonetici': adminPass,
        'buket': adminPass,
      }

      // Ayrıca doğrudan şifre eşleşmesi
      if (validUsers[username.toLowerCase()] === password || password === adminPass) {
        const authUser: AuthUser = { role: 'admin', loginTime: new Date().toISOString() }
        localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
        setUser(authUser)
        setLoading(false)

        // Supabase oturumu da aç (tablo erişimi için)
        await supabase.auth.signInWithPassword({
          email: 'operator@ozler.local',
          password: 'Ozler2024!'
        }).catch(() => {})

        return { error: null }
      }

      setLoading(false)
      return { error: 'Hatalı kullanıcı adı veya şifre' }
    } catch (err) {
      setLoading(false)
      return { error: err }
    }
  }

  function signOut() {
    localStorage.removeItem(AUTH_KEY)
    setUser(null)
  }

  function guestLogin() {
    const authUser: AuthUser = { role: 'guest', loginTime: new Date().toISOString() }
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
    setUser(authUser)
  }

  return {
    session: user, // compat
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
