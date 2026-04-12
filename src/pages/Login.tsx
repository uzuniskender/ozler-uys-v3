import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<{ error: unknown }>
  onGuest?: () => void
  onOperatorLogin?: (oprId: string, oprAd: string) => void
}

export function Login({ onLogin, onGuest, onOperatorLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Operatör girişi
  const [showOpr, setShowOpr] = useState(false)
  const [oprData, setOprData] = useState<{ id: string; ad: string; kod: string; bolum: string }[]>([])
  const [selBolum, setSelBolum] = useState('')
  const [selOprId, setSelOprId] = useState('')

  useEffect(() => {
    if (showOpr && oprData.length === 0) {
      supabase.from('uys_operators').select('*').then(({ data }) => {
        if (data) setOprData(data.filter((o: any) => o.aktif !== false).map((o: any) => ({ id: o.id, ad: o.ad, kod: o.kod, bolum: o.bolum || '' })))
      })
    }
  }, [showOpr])

  const bolumler = [...new Set(oprData.map(o => o.bolum).filter(Boolean))].sort()
  const filteredOprs = selBolum ? oprData.filter(o => o.bolum === selBolum) : oprData

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
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="bg-bg-1 border border-border rounded-xl p-8">
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

        {/* Operatör Girişi */}
        <div className="mt-4 bg-bg-1 border border-border rounded-xl p-4">
          {!showOpr ? (
            <button onClick={() => setShowOpr(true)} className="w-full py-2.5 bg-green/10 border border-green/25 text-green rounded-lg text-sm font-semibold hover:bg-green/20 transition-colors">
              🏭 Operatör Girişi
            </button>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-green text-center">🏭 Operatör Girişi</div>
              <div>
                <label className="text-[10px] text-zinc-500 mb-1 block">Bölüm</label>
                <select value={selBolum} onChange={e => { setSelBolum(e.target.value); setSelOprId('') }}
                  className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
                  <option value="">— Bölüm seçin —</option>
                  {bolumler.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {selBolum && (
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block">Operatör</label>
                  <select value={selOprId} onChange={e => setSelOprId(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
                    <option value="">— Operatör seçin —</option>
                    {filteredOprs.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(o => <option key={o.id} value={o.id}>{o.ad}</option>)}
                  </select>
                </div>
              )}
              {selOprId && (
                <button onClick={() => { if (onOperatorLogin) { const opr = oprData.find(o => o.id === selOprId); onOperatorLogin(selOprId, opr?.ad || '') } }}
                  className="w-full py-2.5 bg-green hover:bg-green/80 text-black font-semibold rounded-lg text-sm transition-colors">
                  Giriş Yap →
                </button>
              )}
              <button onClick={() => { setShowOpr(false); setSelBolum(''); setSelOprId('') }}
                className="w-full py-1.5 text-zinc-500 text-xs hover:text-white">İptal</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
