import { useState } from 'react'

interface AuthUser {
  role: 'admin' | 'guest' | 'operator'
  username: string
  loginTime: string
  oprId?: string
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

  async function signIn(username: string, password: string) {
    const customPass = localStorage.getItem('uys_admin_pass')
    if (password === ADMIN_PASS || (customPass && password === customPass)) {
      const authUser: AuthUser = { role: 'admin', username: username || 'admin', loginTime: new Date().toISOString() }
      localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
      setUser(authUser)
      return { error: null }
    }
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
  }

  function operatorLogin(oprId: string, oprAd: string) {
    const authUser: AuthUser = { role: 'operator', username: oprAd, loginTime: new Date().toISOString(), oprId }
    localStorage.setItem(AUTH_KEY, JSON.stringify(authUser))
    setUser(authUser)
  }

  return {
    session: user, user, loading, signIn, signOut, guestLogin, operatorLogin,
    isAuthenticated: !!user, isGuest: user?.role === 'guest', isAdmin: user?.role === 'admin', isOperator: user?.role === 'operator',
  }
}
