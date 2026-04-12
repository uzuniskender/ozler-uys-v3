import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast, Toaster } from 'sonner'

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<{ error: unknown }>
  onGoogleLogin?: () => Promise<{ error: unknown }>
  onGuest?: () => void
  onOperatorLogin?: (oprId: string, oprAd: string) => void
}

export function Login({ onLogin, onGoogleLogin, onGuest, onOperatorLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Operatör girişi
  const [showOpr, setShowOpr] = useState(false)
  const [oprData, setOprData] = useState<{ id: string; ad: string; kod: string; bolum: string; sifre?: string }[]>([])
  const [selBolum, setSelBolum] = useState('')
  const [selOprId, setSelOprId] = useState('')
  const [oprSifre, setOprSifre] = useState('')

  // Şifre ile giriş alanını göster/gizle
  const [showPassLogin, setShowPassLogin] = useState(false)

  useEffect(() => {
    if (showOpr && oprData.length === 0) {
      supabase.from('uys_operators').select('*').then(({ data }) => {
        if (data) setOprData(data.filter((o: any) => o.aktif !== false).map((o: any) => ({ id: o.id, ad: o.ad, kod: o.kod, bolum: o.bolum || '', sifre: o.sifre || '' })))
      })
    }
  }, [showOpr])

  const bolumler = [...new Set(oprData.map(o => o.bolum).filter(Boolean))].sort()
  const filteredOprs = selBolum ? oprData.filter(o => o.bolum === selBolum) : oprData

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await onLogin(username, password)
    if (error) setError('Giriş başarısız. Kullanıcı adı veya şifre hatalı.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-0">
      <Toaster theme="dark" position="bottom-right" richColors />
      <div className="w-full max-w-sm">
        <div className="bg-bg-1 border border-border rounded-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-accent tracking-wide">ÖZLER ÜRETİM</h1>
            <p className="text-xs text-zinc-500 mt-1">Yönetim Sistemi v3</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red/10 border border-red/25 rounded-lg text-xs text-red">{error}</div>
          )}

          {/* Google ile Admin Giriş */}
          {onGoogleLogin && (
            <button type="button" onClick={async () => {
              setLoading(true)
              const { error } = await onGoogleLogin()
              if (error) { setError('Google giriş başarısız'); setLoading(false) }
            }} disabled={loading}
              className="w-full py-2.5 bg-white hover:bg-zinc-100 text-zinc-800 font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 mb-3 disabled:opacity-40">
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {loading ? 'Yönlendiriliyor...' : 'Google ile Giriş Yap'}
            </button>
          )}

          {onGuest && (
            <button type="button" onClick={onGuest}
              className="w-full py-2 bg-bg-2 border border-border text-zinc-400 rounded-lg text-xs hover:text-white hover:border-border-2 transition-colors">
              👁 Misafir Olarak Giriş (Salt Okunur)
            </button>
          )}

          {/* Şifre ile giriş — gizli, tıklayınca açılır */}
          <div className="mt-3 text-center">
            <button type="button" onClick={() => setShowPassLogin(!showPassLogin)} className="text-[10px] text-zinc-600 hover:text-zinc-400">
              {showPassLogin ? 'Şifre girişini gizle' : 'Şifre ile giriş →'}
            </button>
          </div>

          {showPassLogin && (
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Kullanıcı Adı"
                className="w-full px-3 py-2.5 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" autoFocus />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Şifre"
                className="w-full px-3 py-2.5 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
              <button type="submit" disabled={loading || !username || !password}
                className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-lg text-sm transition-colors">
                {loading ? 'Giriş yapılıyor...' : 'GİRİŞ YAP'}
              </button>
            </form>
          )}
        </div>

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
                <>
                <div>
                  <label className="text-[10px] text-zinc-500 mb-1 block">Şifre</label>
                  <input type="password" value={oprSifre} onChange={e => setOprSifre(e.target.value)} placeholder="Operatör şifresi"
                    className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 text-center focus:outline-none focus:border-green"
                    onKeyDown={e => { if (e.key === 'Enter') { const opr = oprData.find(o => o.id === selOprId); if (opr && opr.sifre && opr.sifre !== oprSifre) { toast.error('Şifre hatalı'); return }; if (onOperatorLogin) onOperatorLogin(selOprId, opr?.ad || '') }}} />
                </div>
                <button onClick={() => {
                  const opr = oprData.find(o => o.id === selOprId)
                  if (opr && opr.sifre && opr.sifre !== oprSifre) { toast.error('Şifre hatalı'); return }
                  if (onOperatorLogin) onOperatorLogin(selOprId, opr?.ad || '')
                }}
                  className="w-full py-2.5 bg-green hover:bg-green/80 text-black font-semibold rounded-lg text-sm transition-colors">
                  Giriş Yap →
                </button>
                </>
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
