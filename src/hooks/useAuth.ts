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
    if (s) { console.log('📦 Kayıtlı oturum bulundu'); return JSON.parse(s) }
    return null
  } catch { return null }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getStored())
  const [loading] = useState(false)

  useEffect(() => {
    console.log('🔐 Auth durumu:', user ? user.username + ' (' + user.role + ')' : 'giriş yok')
    if (user) {
      supabase.auth.signInWithPassword({
        email: 'operator@ozler.local',
        password: 'Ozler2024!'
      }).then(r => {
        if (r.error) console.warn('⚠ Supabase auth:', r.error.message)
        else console.log('✅ Supabase oturum açıldı')
      })
    }
  }, [user])

  async function signIn(username: string, password: string) {
    console.log('🔑 Giriş denemesi:', username, '/ şifre uzunluğu:', password.length)

    if (password === ADMIN_PASS) {
      console.log('✅ Şifre doğru — giriş yapılıyor')
      const authUser: AuthUser = { role: 'admin', username: username || 'admin', loginTime: new Date().toISOString() }
      localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
      setUser(authUser)

      await supabase.auth.signInWithPassword({
        email: 'operator@ozler.local',
        password: 'Ozler2024!'
      }).catch(e => console.warn('Supabase auth hata:', e))

      return { error: null }
    }

    console.log('❌ Şifre yanlış — beklenen:', ADMIN_PASS, 'gelen:', password)
    return { error: 'Hatalı şifre' }
  }

  function signOut() {
    console.log('🚪 Çıkış yapılıyor')
    localStorage.removeItem(AUTH_KEY)
    setUser(null)
  }

  function guestLogin() {
    console.log('👁 Misafir girişi')
    const authUser: AuthUser = { role: 'guest', username: 'misafir', loginTime: new Date().toISOString() }
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
    setUser(authUser)
    supabase.auth.signInWithPassword({ email: 'operator@ozler.local', password: 'Ozler2024!' }).catch(() => {})
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
