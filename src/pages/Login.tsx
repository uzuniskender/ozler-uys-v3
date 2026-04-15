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
  const [showOpr, setShowOpr] = useState(false)
  const [oprData, setOprData] = useState<{ id: string; ad: string; kod: string; bolum: string; sifre?: string }[]>([])
  const [selBolum, setSelBolum] = useState('')
  const [selOprId, setSelOprId] = useState('')
  const [oprSifre, setOprSifre] = useState('')

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

  function doOprLogin() {
    const opr = oprData.find(o => o.id === selOprId)
    if (opr && opr.sifre && opr.sifre !== oprSifre) { toast.error('Şifre hatalı'); return }
    if (onOperatorLogin) onOperatorLogin(selOprId, opr?.ad || '')
  }

  // ═══ OPERATÖR GİRİŞ EKRANI — tam sayfa ═══
  if (showOpr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-0">
        <Toaster theme="dark" position="bottom-right" richColors />
        <div className="w-full max-w-sm">
          <div className="bg-bg-1 border border-border rounded-2xl p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green/10 border border-green/20 rounded-xl mb-3">
                <span className="text-xl">🏭</span>
              </div>
              <h2 className="text-base font-bold text-green">Operatör Girişi</h2>
              <p className="text-[11px] text-zinc-500 mt-1">Bölüm ve operatör seçerek giriş yapın</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-500 mb-1.5 block font-medium">Bölüm</label>
                <select value={selBolum} onChange={e => { setSelBolum(e.target.value); setSelOprId(''); setOprSifre('') }}
                  className="w-full px-3 py-2.5 bg-bg-2 border border-border rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-green transition-colors">
                  <option value="">— Bölüm seçin —</option>
                  {bolumler.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {selBolum && (
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1.5 block font-medium">Operatör</label>
                  <select value={selOprId} onChange={e => { setSelOprId(e.target.value); setOprSifre('') }}
                    className="w-full px-3 py-2.5 bg-bg-2 border border-border rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-green transition-colors">
                    <option value="">— Operatör seçin —</option>
                    {filteredOprs.sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(o => <option key={o.id} value={o.id}>{o.ad}</option>)}
                  </select>
                </div>
              )}
              {selOprId && (
                <>
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1.5 block font-medium">Şifre</label>
                  <input type="password" value={oprSifre} onChange={e => setOprSifre(e.target.value)} placeholder="••••"
                    className="w-full px-3 py-2.5 bg-bg-2 border border-border rounded-xl text-sm text-zinc-200 text-center tracking-widest focus:outline-none focus:border-green transition-colors"
                    onKeyDown={e => { if (e.key === 'Enter') doOprLogin() }} />
                </div>
                <button onClick={doOprLogin}
                  className="w-full py-3 bg-green hover:bg-green/80 text-black font-bold rounded-xl text-sm transition-colors">
                  Giriş Yap
                </button>
                </>
              )}
            </div>
            <button onClick={() => { setShowOpr(false); setSelBolum(''); setSelOprId(''); setOprSifre('') }}
              className="w-full mt-4 py-2.5 text-zinc-500 text-xs hover:text-white transition-colors border border-border/50 rounded-xl hover:border-border">
              ← Giriş Ekranına Dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ═══ ANA GİRİŞ EKRANI ═══
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-0">
      <Toaster theme="dark" position="bottom-right" richColors />
      <div className="w-full max-w-sm">
        <div className="bg-bg-1 border border-border rounded-2xl p-8">
          {/* Logo / Başlık */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-accent/10 border border-accent/20 rounded-2xl mb-3">
              <span className="text-2xl font-black text-accent tracking-tight">Ö</span>
            </div>
            <h1 className="text-lg font-black text-accent tracking-wide">ÖZLER ÜRETİM</h1>
            <p className="text-[11px] text-zinc-500 mt-1">Yönetim Sistemi v3</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red/10 border border-red/25 rounded-xl text-xs text-red">{error}</div>
          )}

          {/* ── 1. KULLANICI GİRİŞİ — en üstte, her zaman açık ── */}
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="space-y-2.5">
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Kullanıcı Adı"
                className="w-full px-4 py-3 bg-bg-2 border border-border rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent transition-colors" autoFocus />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Şifre"
                className="w-full px-4 py-3 bg-bg-2 border border-border rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent transition-colors" />
              <button type="submit" disabled={loading || !username || !password}
                className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-30 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                {loading ? 'Giriş yapılıyor...' : 'Kullanıcı Girişi'}
              </button>
            </div>
          </form>

          {/* ── 2. OPERATÖR GİRİŞİ ── */}
          <div className="space-y-2.5">
            <button onClick={() => setShowOpr(true)}
              className="w-full py-3 bg-green/10 border border-green/25 text-green rounded-xl text-sm font-bold hover:bg-green/20 transition-colors">
              🏭 Operatör Girişi
            </button>

            {/* ── 3. MİSAFİR GİRİŞİ ── */}
            {onGuest && (
              <button type="button" onClick={onGuest}
                className="w-full py-3 bg-bg-2 border border-border text-zinc-400 rounded-xl text-sm font-bold hover:text-white hover:border-border-2 transition-colors">
                👁 Misafir Girişi
              </button>
            )}
          </div>

          {/* ── 4. ADMİN GİRİŞİ (Google) — en altta, küçük ── */}
          {onGoogleLogin && (
            <div className="mt-5 pt-4 border-t border-border/50">
              <button type="button" onClick={async () => {
                setLoading(true)
                const { error } = await onGoogleLogin()
                if (error) { setError('Google giriş başarısız'); setLoading(false) }
              }} disabled={loading}
                className="w-full py-2.5 bg-bg-2 border border-border text-zinc-500 rounded-xl text-xs hover:text-zinc-300 hover:border-border-2 transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Admin Girişi (Google)
              </button>
            </div>
          )}
        </div>
        <p className="text-center text-[10px] text-zinc-700 mt-4">Özler Kalıp ve İskele Sistemleri A.Ş.</p>
      </div>
    </div>
  )
}
