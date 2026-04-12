import { useState } from 'react'

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<{ error: unknown }>
  onGuest?: () => void
}

export function Login({ onLogin, onGuest }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    console.log("📋 Form submit - username:", username, "password length:", password.length)
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await onLogin(username, password)
    if (error) setError('Giriş başarısız. Kullanıcı adı veya şifre hatalı.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-0">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-bg-1 border border-border rounded-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-accent tracking-wide">ÖZLER ÜRETİM</h1>
          <p className="text-xs text-zinc-500 mt-1">Yönetim Sistemi v3</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red/10 border border-red/25 rounded-lg text-xs text-red">{error}</div>
        )}

        <div className="mb-3">
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Kullanıcı Adı"
            className="w-full px-3 py-2.5 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" autoFocus />
        </div>

        <div className="mb-5">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Şifre"
            className="w-full px-3 py-2.5 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>

        <button type="submit" disabled={loading || !username || !password}
          className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-lg text-sm transition-colors">
          {loading ? 'Giriş yapılıyor...' : 'GİRİŞ YAP'}
        </button>

        {onGuest && (
          <button type="button" onClick={onGuest}
            className="w-full mt-3 py-2 bg-bg-2 border border-border text-zinc-400 rounded-lg text-xs hover:text-white hover:border-border-2 transition-colors">
            👁 Misafir Olarak Giriş (Salt Okunur)
          </button>
        )}
      </form>
    </div>
  )
}
