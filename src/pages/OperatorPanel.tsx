import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { uid, today, pctColor } from '@/lib/utils'
import { toast } from 'sonner'
import { LogOut, Play, Square, Send, CheckCircle } from 'lucide-react'

export function OperatorPanel() {
  const { operators, operations, loadAll, loading } = useStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, signOut } = useAuth()
  const [step, setStep] = useState<'bolum'|'operator'|'sifre'>('bolum')
  const [bolum, setBolum] = useState('')
  const [oprId, setOprId] = useState('')
  const [sifre, setSifre] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [tab, setTab] = useState<'isler'|'mesaj'|'ozet'|'izin'>('isler')

  // Veri yükle
  useEffect(() => { loadAll() }, [])

  // Auth'dan gelen operatör otomatik girişi
  useEffect(() => {
    if (user?.role === 'operator' && user.oprId && !loggedIn) {
      setOprId(user.oprId)
      setLoggedIn(true)
    }
  }, [user])

  // Dashboard'dan oprId ile gelince auto-login
  useEffect(() => {
    const urlOprId = searchParams.get('oprId')
    if (urlOprId && !loggedIn && operators.length > 0) {
      const op = operators.find(o => o.id === urlOprId)
      if (op) {
        setOprId(urlOprId)
        setBolum(op.bolum || '')
        setSifre(op.sifre || '')
        setLoggedIn(true)
      }
    }
  }, [searchParams, operators, loggedIn])

  const isAdmin = user?.role === 'admin' || user?.email

  // Admin uzaktan çıkış sinyali dinle
  useEffect(() => {
    if (!loggedIn || isAdmin) return
    const ch = supabase.channel('uys-force-logout')
    ch.on('broadcast', { event: 'logout' }, () => {
      toast.error('Yönetici tarafından oturumunuz kapatıldı')
      setTimeout(() => { signOut(); window.location.hash = '#/'; window.location.reload() }, 1500)
    }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loggedIn, isAdmin])

  // Bölüm listesi — operasyonlardan ve operatörlerden
  const bolumler = [...new Set([
    ...operations.map(o => o.bolum).filter(Boolean),
    ...operators.map(o => o.bolum).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b, 'tr'))

  // Seçili bölümdeki operatörler
  const bolumOperatorleri = operators.filter(o => {
    if (!bolum) return true
    return (o.bolum || '').toUpperCase() === bolum.toUpperCase() || !o.bolum
  }).filter(o => o.aktif !== false).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))

  const opr = operators.find(o => o.id === oprId)

  function selectBolum(b: string) { setBolum(b); setStep('operator') }
  function selectOperator(id: string) {
    setOprId(id)
    // Admin ise şifreyi otomatik doldur ve giriş yap
    if (isAdmin) {
      const op = operators.find(o => o.id === id)
      if (op) { setSifre(op.sifre || ''); setStep('sifre') }
    } else {
      setStep('sifre')
    }
  }
  function login() {
    const found = operators.find(o => o.id === oprId)
    if (found && found.sifre === sifre) {
      setLoggedIn(true); toast.success('Hoş geldin ' + found.ad)
    } else { toast.error('Hatalı şifre') }
  }

  if (!loggedIn) {
    return (
      <div className="max-w-sm mx-auto mt-12 p-6 bg-bg-1 border border-border rounded-xl">
        {isAdmin && (
          <button onClick={() => navigate('/')} className="mb-3 text-xs text-accent hover:text-white flex items-center gap-1">← Yönetime Dön</button>
        )}
        <h1 className="text-xl font-bold text-accent text-center mb-1">OPERATÖR GİRİŞİ</h1>
        <div className="flex gap-1 justify-center mb-6">
          {['bolum', 'operator', 'sifre'].map((s, i) => (
            <div key={s} className={`flex items-center gap-1 text-[10px] ${step === s ? 'text-accent font-bold' : i < ['bolum','operator','sifre'].indexOf(step) ? 'text-green' : 'text-zinc-600'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${step === s ? 'border-accent bg-accent/20' : i < ['bolum','operator','sifre'].indexOf(step) ? 'border-green bg-green/20' : 'border-border'}`}>{i + 1}</span>
              {s === 'bolum' ? 'Bölüm' : s === 'operator' ? 'Operatör' : 'Şifre'}
              {i < 2 && <span className="text-zinc-700 mx-1">→</span>}
            </div>
          ))}
        </div>

        {step === 'bolum' && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 text-center mb-3">Bölümünüzü seçin</p>
            {bolumler.map(b => (
              <button key={b} onClick={() => selectBolum(b)}
                className="w-full py-3 px-4 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 hover:border-accent/50 hover:bg-accent/5 text-left transition-colors">
                {b}
              </button>
            ))}
            <button onClick={() => selectBolum('')} className="w-full py-2 text-xs text-zinc-500 hover:text-accent">Tüm bölümler</button>
          </div>
        )}

        {step === 'operator' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setStep('bolum')} className="text-xs text-zinc-500 hover:text-accent">← Geri</button>
              <span className="text-xs text-zinc-500">{bolum || 'Tüm bölümler'}</span>
            </div>
            {bolumOperatorleri.map(o => (
              <button key={o.id} onClick={() => selectOperator(o.id)}
                className="w-full py-3 px-4 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 hover:border-accent/50 hover:bg-accent/5 text-left transition-colors flex justify-between">
                <span className="font-semibold">{o.ad}</span>
                <span className="text-zinc-500 text-xs">{o.kod}</span>
              </button>
            ))}
            {!bolumOperatorleri.length && <div className="text-xs text-zinc-600 text-center py-4">Bu bölümde operatör yok</div>}
          </div>
        )}

        {step === 'sifre' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setStep('operator')} className="text-xs text-zinc-500 hover:text-accent">← Geri</button>
              <span className="text-xs text-zinc-400 font-semibold">{opr?.ad}</span>
            </div>
            <input type="password" value={sifre} onChange={e => setSifre(e.target.value)} placeholder="Şifre"
              className="w-full px-4 py-3 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent text-center"
              onKeyDown={e => e.key === 'Enter' && login()} autoFocus />
            {isAdmin && <div className="text-[10px] text-green text-center">Admin girişi — şifre otomatik dolduruldu</div>}
            <button onClick={login} className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-sm">GİRİŞ</button>
          </div>
        )}
      </div>
    )
  }

  // Veri henüz yüklenmediyse
  if (!opr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-0">
        <div className="text-center">
          <div className="text-zinc-500 text-sm mb-2">Veriler yükleniyor...</div>
          <div className="text-zinc-600 text-xs">Lütfen bekleyin</div>
        </div>
      </div>
    )
  }

  return <OperatorMain oprId={oprId} opr={opr} tab={tab} setTab={setTab} isAdmin={!!isAdmin} onLogout={() => { signOut(); window.location.hash = '#/'; window.location.reload() }} onBack={() => navigate('/')} />
}

function OperatorMain({ oprId, opr, tab, setTab, isAdmin, onLogout, onBack }: {
  oprId: string; opr: { id: string; ad: string; bolum: string }
  tab: string; setTab: (t: 'isler'|'mesaj'|'ozet'|'izin') => void; isAdmin: boolean; onLogout: () => void; onBack: () => void
}) {
  const { workOrders, logs, activeWork, operations, operators, durusKodlari, izinler, loadAll } = useStore()
  const [entryWO, setEntryWO] = useState<{ woId: string; logId?: string } | null>(null)

  const acikWOs = useMemo(() => {
    const bolumUpper = (opr.bolum || '').trim().toUpperCase()
    if (!bolumUpper) {
      // Bölüm yoksa tüm açık İE'leri göster
      return workOrders.filter(w => {
        if (w.hedef <= 0) return false
        const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
        return prod < w.hedef && w.durum !== 'iptal' && w.durum !== 'tamamlandi' && w.durum !== 'beklemede'
      })
    }

    // v2 mantığı: operasyonların BÖLÜM alanı ile eşleştir
    const myOpIds: string[] = []
    operations.forEach(o => {
      const oBolum = (o.bolum || '').trim().toUpperCase()
      const oAd = (o.ad || '').trim().toUpperCase()
      // Bölüm eşleşmesi VEYA operasyon adı içeriyor VEYA bölüm adı operasyonda geçiyor
      if ((oBolum && oBolum === bolumUpper) || oAd === bolumUpper || oAd.includes(bolumUpper) || bolumUpper.includes(oAd)) {
        if (!myOpIds.includes(o.id)) myOpIds.push(o.id)
      }
    })

    if (!myOpIds.length) {
      // Eşleşme bulunamadı — opAd içerik araması yap (fallback)
      workOrders.forEach(w => {
        const opAd = (w.opAd || '').trim().toUpperCase()
        if (opAd === bolumUpper || opAd.includes(bolumUpper) || bolumUpper.includes(opAd)) {
          if (w.opId && !myOpIds.includes(w.opId)) myOpIds.push(w.opId)
        }
      })
    }

    return workOrders.filter(w => {
      if (w.hedef <= 0) return false
      if (!myOpIds.includes(w.opId)) return false
      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
      return prod < w.hedef && w.durum !== 'iptal' && w.durum !== 'tamamlandi' && w.durum !== 'beklemede'
    })
  }, [workOrders, logs, operations, opr.bolum])

  const myActiveList = activeWork.filter(a => a.opId === oprId)

  // ═══ İZİN KONTROLÜ ═══
  const todayStr = today()
  const nowTime = (() => { const n = new Date(); return String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0') })()
  const myOnayliIzinler = izinler.filter(iz => iz.opId === oprId && iz.durum === 'onaylandi' && iz.baslangic <= todayStr && iz.bitis >= todayStr)
  const izinEngel = (() => {
    for (const iz of myOnayliIzinler) {
      if (iz.saatBaslangic && iz.saatBitis) {
        // Saatlik izin — sadece o saat aralığında engel
        if (nowTime >= iz.saatBaslangic && nowTime <= iz.saatBitis) {
          return { engel: true, mesaj: `${iz.saatBaslangic}–${iz.saatBitis} arası ${iz.tip} izniniz var. Bu saatlerde işe başlayamazsınız.`, saatlik: true, iz }
        }
      } else {
        // Tam gün izin — tüm gün engel
        return { engel: true, mesaj: `Bugün ${iz.tip} izniniz var (${iz.baslangic}${iz.bitis !== iz.baslangic ? ' → ' + iz.bitis : ''}). İşe başlayamazsınız.`, saatlik: false, iz }
      }
    }
    return { engel: false, mesaj: '', saatlik: false, iz: null }
  })()

  async function startWork(woId: string) {
    if (izinEngel.engel) { toast.error(izinEngel.mesaj); return }
    const w = workOrders.find(x => x.id === woId)
    if (!w) return
    if (myActiveList.some(a => a.woId === woId)) { toast.error('Bu işte zaten çalışıyorsun'); return }
    const now = new Date()
    const currentSaat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    let saat = currentSaat
    // Zaten aktif işi varsa → şu anki saat
    // Aktif işi yoksa ama bugün bir iş bitirdiyse → bitiş saati default
    if (myActiveList.length === 0) {
      try {
        const raw = localStorage.getItem('uys_lastStop_' + oprId)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed.tarih === today() && parsed.saat) {
            saat = parsed.saat
            toast.info('Başlangıç saati önceki işin bitişinden alındı: ' + saat)
          }
        }
      } catch {}
    }
    const { error } = await supabase.from('uys_active_work').insert({
      id: uid(), op_id: oprId, op_ad: opr.ad, wo_id: woId,
      wo_ad: w.malad, baslangic: saat, tarih: today(),
    })
    if (error) { toast.error('İşe başlatılamadı: ' + error.message); return }
    loadAll(); toast.success('İş başlatıldı: ' + w.ieNo + ' (' + saat + ')')
  }

  async function stopWork(activeId?: string) {
    const target = activeId ? myActiveList.find(a => a.id === activeId) : myActiveList[0]
    if (!target) return
    // Bitiş saatini kaydet — sonraki işin başlangıcı olacak
    const now = new Date()
    const stopSaat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    try { localStorage.setItem('uys_lastStop_' + oprId, JSON.stringify({ tarih: today(), saat: stopSaat })) } catch {}
    await supabase.from('uys_active_work').delete().eq('id', target.id)
    loadAll(); toast.success('İş durduruldu')
  }

  function wProd(woId: string) { return logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0) }

  return (
    <div className="min-h-screen bg-bg-0 px-4 py-3">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-accent/20 to-bg-2 border border-accent/30 rounded-xl p-4">
          <div>
            <div className="text-lg font-bold text-white">{opr.ad}</div>
            <div className="text-xs text-zinc-400">{opr.bolum} · {today()}</div>
          </div>
          <div className="flex gap-2">
            {isAdmin && <button onClick={onBack} className="px-4 py-2 bg-accent/20 border border-accent/30 text-accent text-xs rounded-lg hover:bg-accent/30 font-semibold">← Yönetime Dön</button>}
            <button onClick={onLogout} className="px-4 py-2 bg-red/20 border border-red/30 text-red text-xs rounded-lg hover:bg-red/30 font-semibold">Çıkış</button>
          </div>
        </div>

        {/* İzin Uyarı Banner */}
        {izinEngel.engel && (
          <div className="mb-3 p-3 bg-red/10 border border-red/30 rounded-xl text-xs text-red font-semibold flex items-center gap-2">
            <span className="text-lg">🚫</span>
            <span>{izinEngel.mesaj}</span>
          </div>
        )}
        {myOnayliIzinler.length > 0 && !izinEngel.engel && (
          <div className="mb-3 p-2.5 bg-amber/10 border border-amber/20 rounded-xl text-[11px] text-amber flex items-center gap-2">
            <span>📅</span>
            <span>Bugün {myOnayliIzinler.map(iz => iz.saatBaslangic ? `${iz.saatBaslangic}–${iz.saatBitis} ${iz.tip}` : iz.tip).join(', ')} izniniz var</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('isler')} className={`flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-colors ${tab === 'isler' ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-bg-2 text-zinc-500 border border-border'}`}>
            📋 İşlerim
          </button>
          <button onClick={() => setTab('mesaj')} className={`flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-colors ${tab === 'mesaj' ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-bg-2 text-zinc-500 border border-border'}`}>
            💬 Mesajlar
          </button>
          <button onClick={() => setTab('izin')} className={`flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-colors ${tab === 'izin' ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-bg-2 text-zinc-500 border border-border'}`}>
            📅 İzin
          </button>
          <button onClick={() => setTab('ozet')} className={`flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-colors ${tab === 'ozet' ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-bg-2 text-zinc-500 border border-border'}`}>
            📊 Özet
          </button>
        </div>

        {tab === 'isler' && (
          <div className="space-y-3">
            {/* Aktif İşler */}
            {myActiveList.length > 0 && (
              <div className="bg-green/5 border border-green/20 rounded-xl p-3 mb-2">
                <div className="text-[10px] text-green font-bold uppercase tracking-wider mb-2">▶ AKTİF İŞLER ({myActiveList.length})</div>
                {myActiveList.map(a => {
                  const aw = workOrders.find(x => x.id === a.woId)
                  return (
                    <div key={a.id} className="flex items-center justify-between bg-bg-1 rounded-lg p-2.5 mb-1.5 border border-green/20">
                      <div>
                        <span className="font-mono text-accent text-xs font-bold">{aw?.ieNo || '—'}</span>
                        <div className="text-xs text-zinc-300">{a.woAd?.slice(0, 35)}</div>
                        <div className="text-[10px] text-zinc-500">Başlangıç: {a.baslangic}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => aw && setEntryWO({ woId: aw.id })} className="px-3 py-1.5 bg-accent/20 text-accent rounded-lg text-[11px] font-semibold hover:bg-accent/30">
                          <CheckCircle size={12} className="inline mr-1" />Kayıt
                        </button>
                        <button onClick={() => stopWork(a.id)} className="px-3 py-1.5 bg-red/20 text-red rounded-lg text-[11px] font-semibold hover:bg-red/30">
                          <Square size={12} className="inline mr-1" />Dur
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {acikWOs.filter(w => !myActiveList.some(a => a.woId === w.id)).map(w => {
              const prod = wProd(w.id)
              const pct = Math.min(100, Math.round(prod / w.hedef * 100))
              const kalan = Math.max(0, w.hedef - prod)
              const othersWorking = activeWork.filter(a => a.woId === w.id && a.opId !== oprId)
              return (
                <div key={w.id} className={`bg-bg-1 border rounded-xl p-4 transition-all ${othersWorking.length > 0 ? 'border-cyan-500/30' : 'border-border hover:border-accent/50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-accent text-xs font-bold">{w.ieNo}</span>
                    <span className={`text-sm font-bold ${pct >= 100 ? 'text-green' : pct > 0 ? 'text-amber' : 'text-red'}`}>{pct}%</span>
                  </div>
                  <div className="text-[15px] font-semibold text-white mb-2">{w.malad}</div>
                  <div className="flex items-center gap-4 text-xs mb-3">
                    <span className="text-zinc-400">Hedef: <b className="text-white">{w.hedef}</b></span>
                    <span className="text-green">Yapılan: <b>{prod}</b></span>
                    <span className="text-amber">Kalan: <b>{kalan}</b></span>
                  </div>
                  {othersWorking.length > 0 && (
                    <div className="mb-2 px-2 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-[10px] text-cyan-400">
                      🟢 {othersWorking.map(a => a.opAd).join(', ')} {othersWorking[0].baslangic}'den beri çalışıyor
                    </div>
                  )}
                  <div className="w-full h-2 bg-bg-3 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-accent'}`} style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                  <div className="flex gap-2">
                    <button disabled={izinEngel.engel} onClick={() => startWork(w.id)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${
                      izinEngel.engel ? 'bg-zinc-800 border border-zinc-700 text-zinc-600 cursor-not-allowed' :
                      othersWorking.length > 0
                        ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20'
                        : 'bg-green/10 border border-green/20 text-green hover:bg-green/20'
                    }`}>
                      <Play size={12} className="inline mr-1" />{izinEngel.engel ? '🚫 İzinli' : othersWorking.length > 0 ? 'İşe Katıl' : 'İşe Başla'}
                    </button>
                    <button disabled={izinEngel.engel && !izinEngel.saatlik} onClick={() => setEntryWO({ woId: w.id })} className={`flex-1 py-2 rounded-lg text-xs font-bold ${
                      izinEngel.engel && !izinEngel.saatlik ? 'bg-zinc-800 border border-zinc-700 text-zinc-600 cursor-not-allowed' : 'bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20'
                    }`}>
                      <CheckCircle size={12} className="inline mr-1" />Üretim Kaydı
                    </button>
                  </div>
                </div>
              )
            })}
            {!acikWOs.length && (
              <div className="p-6 text-center">
                <div className="text-zinc-500 mb-2">"{opr.bolum}" bölümünde açık iş emri yok</div>
                <div className="text-[10px] text-zinc-600 mb-3">
                  Operasyonlar sayfasında "{opr.bolum}" bölümüne atanmış operasyon var mı kontrol edin.
                </div>
                <div className="text-[10px] text-zinc-700 bg-bg-2 rounded-lg p-3 text-left font-mono">
                  Operatör bölüm: "{opr.bolum}"<br/>
                  Eşleşen operasyonlar: {operations.filter(o => (o.bolum || '').trim().toUpperCase() === (opr.bolum || '').trim().toUpperCase() || (o.ad || '').toUpperCase().includes((opr.bolum || '').toUpperCase())).map(o => o.ad).join(', ') || 'YOK'}<br/>
                  Toplam açık İE: {workOrders.filter(w => w.hedef > 0 && logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0) < w.hedef && w.durum !== 'iptal' && w.durum !== 'tamamlandi').length}<br/>
                  İE operasyonları: {[...new Set(workOrders.filter(w => w.hedef > 0).map(w => w.opAd))].join(', ')}
                </div>
              </div>
            )}

            {/* Son Kayıtlarım — düzenlenebilir */}
            {(() => {
              const sonKayitlar = logs.filter(l => l.tarih === today() && (Array.isArray(l.operatorlar) ? l.operatorlar : []).some((o: any) => o.id === oprId)).slice(0, 5)
              if (!sonKayitlar.length) return null
              return (
                <div className="mt-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-border text-[11px] font-semibold text-zinc-400">📝 Bugünkü Kayıtlarım</div>
                  {sonKayitlar.map(l => {
                    const wo = workOrders.find(w => w.id === l.woId)
                    const duruslar = (l.duruslar || []) as any[]
                    return (
                      <div key={l.id} className="px-3 py-2 border-b border-border/30 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="font-mono text-accent text-[10px]">{wo?.ieNo || '—'}</span>
                            <span className="text-zinc-400 text-[10px] ml-2">{wo?.malad?.slice(0, 25)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-green text-xs font-bold">+{l.qty}</span>
                            {l.fire > 0 && <span className="text-red text-[10px]">🔥{l.fire}</span>}
                            <button onClick={() => wo && setEntryWO({ woId: wo.id, logId: l.id })} className="text-[10px] text-accent hover:text-white px-1.5 py-0.5 bg-accent/10 rounded">Düzenle</button>
                          </div>
                        </div>
                        {duruslar.length > 0 && (
                          <div className="flex flex-wrap gap-1">{duruslar.map((d: any, i: number) => <span key={i} className="text-[9px] px-1.5 py-0.5 bg-red/10 text-red rounded">⏸ {d.kodAd} {d.sure}dk</span>)}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {tab === 'mesaj' && <MesajForm oprId={oprId} oprAd={opr.ad} onSent={() => toast.success('Mesaj gönderildi')} />}

        {tab === 'izin' && (() => {
          const myIzinler = izinler.filter(iz => iz.opId === oprId).sort((a, b) => b.baslangic.localeCompare(a.baslangic))
          const adminOlusturan = myIzinler.filter(iz => iz.olusturan === 'admin' && iz.durum === 'bekliyor')
          const duzenlenenler = myIzinler.filter(iz => iz.durum === 'duzenlendi')
          return (
            <div className="space-y-3">
              {/* İzin Talep Formu */}
              <IzinTalepForm oprId={oprId} oprAd={opr.ad} onSaved={() => { loadAll(); toast.success('İzin talebi gönderildi — onay bekleniyor') }} />

              {/* Admin tarafından oluşturulan — operatör onayı bekleyen */}
              {adminOlusturan.length > 0 && (
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                  <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-2">🏢 Yönetim Tarafından Oluşturulan İzinler</div>
                  {adminOlusturan.map(iz => (
                    <div key={iz.id} className="bg-bg-1 rounded-lg p-2.5 mb-1.5 border border-cyan-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-amber/10 text-amber text-[10px]">{iz.tip}</span>
                        <span className="text-amber text-[10px] font-semibold">⏳ Onayınız Bekleniyor</span>
                      </div>
                      <div className="font-mono text-zinc-400 text-xs mb-2">
                        {iz.baslangic}{iz.bitis !== iz.baslangic ? ' — ' + iz.bitis : ''}
                        {iz.saatBaslangic && iz.saatBitis ? ` (${iz.saatBaslangic}–${iz.saatBitis})` : ''}
                      </div>
                      {iz.not && <div className="text-[10px] text-zinc-500 mb-2">Not: {iz.not}</div>}
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          await supabase.from('uys_izinler').update({ durum: 'onaylandi', onaylayan: opr.ad, onay_tarihi: today() }).eq('id', iz.id)
                          loadAll(); toast.success('İzin onaylandı')
                        }} className="flex-1 py-1.5 bg-green/10 border border-green/20 text-green rounded-lg text-[11px] font-bold">✓ Onayla</button>
                        <button onClick={async () => {
                          await supabase.from('uys_izinler').update({ durum: 'reddedildi', onaylayan: opr.ad, onay_tarihi: today() }).eq('id', iz.id)
                          loadAll(); toast.success('İzin reddedildi')
                        }} className="flex-1 py-1.5 bg-red/10 border border-red/20 text-red rounded-lg text-[11px] font-bold">✕ Reddet</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Düzenlenen talepler — operatör tekrar onaylamalı */}
              {duzenlenenler.length > 0 && (
                <div className="bg-amber/5 border border-amber/20 rounded-xl p-3">
                  <div className="text-[10px] text-amber font-bold uppercase tracking-wider mb-2">✏ Talebiniz Düzenlendi — Tekrar Onaylayın</div>
                  {duzenlenenler.map(iz => (
                    <div key={iz.id} className="bg-bg-1 rounded-lg p-2.5 mb-1.5 border border-amber/20">
                      <div className="font-mono text-zinc-400 text-xs mb-2">
                        {iz.tip} · {iz.baslangic}{iz.bitis !== iz.baslangic ? ' — ' + iz.bitis : ''}
                        {iz.saatBaslangic && iz.saatBitis ? ` (${iz.saatBaslangic}–${iz.saatBitis})` : ''}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          await supabase.from('uys_izinler').update({ durum: 'onaylandi', onaylayan: opr.ad, onay_tarihi: today() }).eq('id', iz.id)
                          loadAll(); toast.success('Düzenlenen izin onaylandı')
                        }} className="flex-1 py-1.5 bg-green/10 border border-green/20 text-green rounded-lg text-[11px] font-bold">✓ Onayla</button>
                        <button onClick={async () => {
                          await supabase.from('uys_izinler').update({ durum: 'reddedildi', onaylayan: opr.ad, onay_tarihi: today() }).eq('id', iz.id)
                          loadAll(); toast.success('Düzenlenen izin reddedildi')
                        }} className="flex-1 py-1.5 bg-red/10 border border-red/20 text-red rounded-lg text-[11px] font-bold">✕ Reddet</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* İzin Geçmişim */}
              {myIzinler.length > 0 && (
                <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-border text-[11px] font-semibold text-zinc-400">📅 İzin Geçmişim</div>
                  <div className="divide-y divide-border/30">
                    {myIzinler.slice(0, 15).map(iz => {
                      const durumColor = iz.durum === 'onaylandi' ? 'text-green' : iz.durum === 'reddedildi' ? 'text-red' : iz.durum === 'duzenlendi' ? 'text-cyan-400' : 'text-amber'
                      const durumIcon = iz.durum === 'onaylandi' ? '✅' : iz.durum === 'reddedildi' ? '❌' : iz.durum === 'duzenlendi' ? '✏️' : '⏳'
                      const canEdit = iz.olusturan === 'operator' && iz.durum === 'bekliyor'
                      const isApproved = iz.durum === 'onaylandi'
                      return (
                        <div key={iz.id} className="px-3 py-2 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="px-1.5 py-0.5 rounded bg-amber/10 text-amber text-[10px]">{iz.tip}</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${durumColor}`}>{durumIcon} {iz.durum}</span>
                              {isApproved && (
                                <button onClick={() => toast.info('Onaylanan izin düzenlenemez. İptal için kullanıcı yanına gidiniz.')} className="text-[9px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">🔒</button>
                              )}
                            </div>
                          </div>
                          <div className="font-mono text-zinc-500">
                            {iz.baslangic}{iz.bitis !== iz.baslangic ? ' — ' + iz.bitis : ''}
                            {iz.saatBaslangic && iz.saatBitis ? ` (${iz.saatBaslangic}–${iz.saatBitis})` : ''}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-[10px] text-zinc-600">
                              {iz.olusturan === 'admin' ? '🏢 Yönetim oluşturdu' : '👷 Kendi talebim'}
                              {iz.onaylayan ? ` · Onay: ${iz.onaylayan}` : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {!myIzinler.length && <div className="p-4 text-center text-zinc-600 text-xs">Henüz izin kaydınız yok</div>}
            </div>
          )
        })()}

        {tab === 'ozet' && (() => {
          const bugunLogs = logs.filter(l => l.tarih === today() && l.operatorlar?.some((o: any) => o.id === oprId))
          const toplamUretim = bugunLogs.reduce((a, l) => a + l.qty, 0)
          const toplamFire = bugunLogs.reduce((a, l) => a + (l.fire || 0), 0)
          const isEmriSayisi = new Set(bugunLogs.map(l => l.woId)).size
          const toplamDurusDk = bugunLogs.reduce((a, l) => a + ((l.duruslar || []) as any[]).reduce((s: number, d: any) => s + (d.sure || 0), 0), 0)
          return (
            <div className="space-y-3">
              <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2">Bugünkü Performans</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-1 border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green">{toplamUretim}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">Toplam Üretim</div>
                </div>
                <div className="bg-bg-1 border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red">{toplamFire}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">Toplam Fire</div>
                </div>
                <div className="bg-bg-1 border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-accent">{isEmriSayisi}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">İş Emri</div>
                </div>
                <div className="bg-bg-1 border border-border rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber">{toplamDurusDk}<span className="text-sm">dk</span></div>
                  <div className="text-[10px] text-zinc-500 mt-1">Toplam Duruş</div>
                </div>
              </div>
              {bugunLogs.length > 0 && (
                <div className="bg-bg-1 border border-border rounded-xl p-3">
                  <div className="text-[10px] text-zinc-500 font-semibold mb-2">KAYITLAR</div>
                  {bugunLogs.map(l => {
                    const w2 = workOrders.find(x => x.id === l.woId)
                    const opers = l.operatorlar as any[] || []
                    const saat = opers.find((o: any) => o.id === oprId)
                    return (
                      <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <div>
                          <div className="text-xs font-medium">{w2?.malad?.slice(0, 40) || '—'}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{saat?.bas || ''} → {saat?.bit || ''}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-green">+{l.qty}</div>
                          {l.fire > 0 && <div className="text-[10px] text-red">Fire: {l.fire}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {!bugunLogs.length && <div className="p-8 text-center text-zinc-600 text-sm">Bugün henüz kayıt yok</div>}
            </div>
          )
        })()}

        {/* Üretim Kayıt Modal */}
        {entryWO && <OprEntryModal woId={entryWO.woId} editLogId={entryWO.logId} oprId={oprId} oprAd={opr.ad} allOperators={operators} durusKodlari={durusKodlari}
          onClose={() => setEntryWO(null)}
          onSaved={() => { setEntryWO(null); loadAll(); toast.success('Üretim kaydedildi') }} />}
      </div>
    </div>
  )
}

/* Operatör Üretim Kayıt Modal — admin'den de kullanılır */
/* Operatör Üretim Kayıt Modal — admin'den de kullanılır */
export function OprEntryModal({ woId, oprId, oprAd, allOperators, durusKodlari, editLogId, onClose, onSaved }: {
  woId: string; oprId: string; oprAd: string
  allOperators: { id: string; ad: string; kod: string; bolum: string; aktif?: boolean }[]
  durusKodlari: { id: string; kod: string; ad: string }[]
  editLogId?: string
  onClose: () => void; onSaved: () => void
}) {
  const { workOrders, logs, recipes, stokHareketler, activeWork } = useStore()
  const w = workOrders.find(x => x.id === woId)
  const now = new Date()
  const nowHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')

  // Mevcut log (düzenleme modu)
  const editLog = editLogId ? logs.find(l => l.id === editLogId) : null

  // Bu İE'de aktif çalışan diğer operatörler — otomatik ekle
  const othersOnThisIE = activeWork.filter(a => a.woId === woId && a.opId !== oprId)

  // ═══ İŞE BAŞLAMA SAATİ: active_work'ten al ═══
  const myAW = activeWork.find(a => a.woId === woId && a.opId === oprId)
  const basSaat = myAW?.baslangic || nowHHMM

  // ═══ TASLAK: localStorage'dan geri yükle ═══
  const draftKey = `uys_draft_${oprId}_${woId}`
  function loadDraft(): { qty?: string; fire?: string; aciklama?: string; duruslar?: any[]; oprList?: any[] } | null {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return null
      return JSON.parse(raw)
    } catch { return null }
  }
  const draft = editLog ? null : loadDraft()

  const [qty, setQty] = useState(editLog ? String(editLog.qty) : draft?.qty || '')
  const [fire, setFire] = useState(editLog ? String(editLog.fire || 0) : draft?.fire || '')
  const [aciklama, setAciklama] = useState(editLog?.not || draft?.aciklama || '')
  const [saving, setSaving] = useState(false)
  const [duruslar, setDuruslar] = useState<{ kodId: string; kodAd: string; sure: number; bas: string; bit: string }[]>(
    editLog?.duruslar
      ? (editLog.duruslar as any[]).map(d => ({ kodId: d.kodId || '', kodAd: d.kodAd || '', sure: d.sure || 0, bas: d.bas || '', bit: d.bit || '' }))
      : draft?.duruslar?.length
        ? draft.duruslar
        : []
  )
  const [oprList, setOprList] = useState<{ id: string; ad: string; bas: string; bit: string }[]>(
    editLog?.operatorlar
      ? (editLog.operatorlar as any[]).map(o => ({ id: o.id, ad: o.ad, bas: o.bas || basSaat, bit: o.bit || nowHHMM }))
      : draft?.oprList?.length
        ? draft.oprList.map(o => ({ ...o, bit: nowHHMM }))
        : [
            { id: oprId, ad: oprAd, bas: basSaat, bit: nowHHMM },
            ...othersOnThisIE.map(a => ({ id: a.opId, ad: a.opAd, bas: a.baslangic || basSaat, bit: nowHHMM })),
          ]
  )
  const [addOprId, setAddOprId] = useState('')

  // ═══ TASLAK OTOMATIK KAYDET: her değişiklikte localStorage'a yaz ═══
  useEffect(() => {
    if (editLog) return
    const hasSomething = qty || fire || aciklama || duruslar.some(d => d.kodId) || oprList.length > 1
    if (hasSomething) {
      localStorage.setItem(draftKey, JSON.stringify({ qty, fire, aciklama, duruslar, oprList }))
    }
  }, [qty, fire, aciklama, duruslar, oprList, editLog, draftKey])

  function clearDraft() {
    localStorage.removeItem(draftKey)
  }

  function handleClose() {
    const hasSomething = qty || fire || aciklama || duruslar.some(d => d.kodId) || oprList.length > 1
    if (hasSomething && !editLog) {
      toast.info('Taslak kaydedildi — tekrar açtığınızda veriler gelecek', { duration: 2000 })
    }
    onClose()
  }

  if (!w) return null
  const prod = logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0)
  const editQtyDelta = editLog ? (parseInt(qty) || 0) - editLog.qty : 0
  const kalan = Math.max(0, w.hedef - prod + (editLog?.qty || 0)) // Düzenlemede mevcut qty'yi geri ekle
  const rc = recipes.find(r => r.id === w.receteId) || recipes.find(r => r.mamulKod === w.malkod)
  const hmSatirlar = (rc?.satirlar || []).filter((s: any) =>
    (s.tip === 'Hammadde' || s.tip === 'hammadde' || s.tip === 'YarıMamul') &&
    (s.malkod || s.kod) !== w.malkod && (s.malkod || s.kod) !== w.mamulKod
  )

  function stokNet(malkod: string) {
    return stokHareketler.filter(h => h.malkod === malkod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
  }
  function maxYapilabilir() {
    if (!hmSatirlar.length) return kalan
    let maxAdet = kalan
    for (const hm of hmSatirlar) {
      const birAdetIcin = (hm.miktar || 0) * (w.mpm || 1)
      if (birAdetIcin <= 0) continue
      const mevcut = stokNet(hm.malkod || hm.kod)
      if (Math.floor(mevcut / birAdetIcin) < maxAdet) maxAdet = Math.floor(mevcut / birAdetIcin)
    }
    return Math.max(0, maxAdet)
  }
  const maxUretim = maxYapilabilir()

  function addOpr() {
    if (!addOprId) { toast.error('Operatör seçin'); return }
    if (oprList.some(o => o.id === addOprId)) { toast.error('Bu operatör zaten ekli'); return }
    const op = allOperators.find(o => o.id === addOprId)
    if (!op) return
    setOprList(p => [...p, { id: op.id, ad: op.ad, bas: nowHHMM, bit: nowHHMM }])
    setAddOprId('')
  }
  function updateOpr(i: number, field: 'bas' | 'bit', val: string) {
    setOprList(p => p.map((o, idx) => idx === i ? { ...o, [field]: val } : o))
  }
  function removeOpr(i: number) {
    if (oprList.length <= 1) { toast.error('En az bir operatör olmalı'); return }
    setOprList(p => p.filter((_, idx) => idx !== i))
  }
  function addDurus() { setDuruslar(p => [...p, { kodId: '', kodAd: '', sure: 0, bas: nowHHMM, bit: nowHHMM }]) }
  function updateDurus(i: number, field: string, val: string) {
    setDuruslar(p => p.map((d, idx) => {
      if (idx !== i) return d
      if (field === 'kodId') { const dk = durusKodlari.find(k => k.id === val); return { ...d, kodId: val, kodAd: dk?.ad || '' } }
      if (field === 'sure') return { ...d, sure: parseInt(val) || 0 }
      if (field === 'bas') {
        const yeni = { ...d, bas: val }
        // Bitiş varsa süreyi otomatik hesapla
        if (yeni.bit && val) {
          const [bH, bM] = val.split(':').map(Number); const [eH, eM] = yeni.bit.split(':').map(Number)
          const dk = (eH * 60 + eM) - (bH * 60 + bM); if (dk > 0) yeni.sure = dk
        }
        return yeni
      }
      if (field === 'bit') {
        const yeni = { ...d, bit: val }
        if (yeni.bas && val) {
          const [bH, bM] = yeni.bas.split(':').map(Number); const [eH, eM] = val.split(':').map(Number)
          const dk = (eH * 60 + eM) - (bH * 60 + bM); if (dk > 0) yeni.sure = dk
        }
        return yeni
      }
      return d
    }))
  }

  async function save() {
    const q = parseInt(qty) || 0; const f = parseInt(fire) || 0
    const hasDurus = duruslar.some(d => d.kodId && d.sure > 0)
    if (q <= 0 && !hasDurus) { toast.error('Adet veya duruş girin'); return }
    // Güncel üretimi Supabase'den çek (stale data / eşzamanlı giriş koruması)
    const { data: freshLogs } = await supabase.from('uys_logs').select('qty').eq('wo_id', woId)
    const freshProd = (freshLogs || []).reduce((a: number, l: any) => a + (l.qty || 0), 0)
    const freshKalan = Math.max(0, w.hedef - freshProd + (editLog?.qty || 0))
    if (q > freshKalan) { toast.error('Hedeften fazla üretilemez! Kalan: ' + freshKalan); return }
    if (q > 0 && maxUretim <= 0 && hmSatirlar.length > 0) { toast.error('Stok yetersiz — üretim yapılamaz'); return }
    if (q > 0 && q > maxUretim && hmSatirlar.length > 0) { toast.error('Stok yetersiz! En fazla ' + maxUretim + ' adet'); return }
    if (!oprList.length) { toast.error('En az bir operatör eklenmeli'); return }
    for (const o of oprList) {
      if (o.bas && o.bit && o.bit < o.bas) { toast.error(o.ad + ': Bitiş başlamadan önce olamaz'); return }
    }
    // Duruş saatleri validasyonu
    for (let di = 0; di < duruslar.length; di++) {
      const d = duruslar[di]
      if (!d.kodId) continue
      if (d.bas && d.bit && d.bit <= d.bas) { toast.error(`Duruş #${di + 1}: Bitiş başlangıçtan önce olamaz`); return }
      // Duruş saatleri çalışma saatleri içinde mi?
      if (d.bas && oprList[0]?.bas && d.bas < oprList[0].bas) { toast.error(`Duruş #${di + 1}: Başlangıç (${d.bas}) çalışma başlangıcından (${oprList[0].bas}) önce olamaz`); return }
      if (d.bit && oprList[0]?.bit && d.bit > oprList[0].bit) { toast.error(`Duruş #${di + 1}: Bitiş (${d.bit}) çalışma bitişinden (${oprList[0].bit}) sonra olamaz`); return }
    }
    const toplamDurusDk = duruslar.reduce((a, d) => a + (d.sure || 0), 0)
    const toplamCalisma = oprList.reduce((a, o) => {
      if (!o.bas || !o.bit) return a
      return a + Math.max(0, (parseInt(o.bit.split(':')[0]) * 60 + parseInt(o.bit.split(':')[1])) - (parseInt(o.bas.split(':')[0]) * 60 + parseInt(o.bas.split(':')[1])))
    }, 0)
    if (toplamCalisma > 0 && toplamDurusDk > toplamCalisma) { toast.error('Duruş (' + toplamDurusDk + 'dk) çalışmayı (' + toplamCalisma + 'dk) aşamaz'); return }

    setSaving(true)
    if (editLog && editLogId) {
      // DÜZENLEME MODU — mevcut logu güncelle
      await supabase.from('uys_logs').update({
        qty: q, fire: f, not_: aciklama,
        operatorlar: oprList.map(o => ({ id: o.id, ad: o.ad, bas: o.bas, bit: o.bit })),
        duruslar: duruslar.filter(d => d.kodId && d.sure > 0).map(d => ({ kodId: d.kodId, kodAd: d.kodAd, sure: d.sure, bas: d.bas, bit: d.bit })),
      }).eq('id', editLogId)
      // Stok hareketlerini yeniden oluştur
      await supabase.from('uys_stok_hareketler').delete().eq('log_id', editLogId)
      if (q > 0) {
        await supabase.from('uys_stok_hareketler').insert({
          id: uid(), malkod: w.malkod, malad: w.malad, miktar: q,
          tip: 'giris', kaynak: 'uretim', aciklama: w.ieNo + ' - ' + oprList.map(o => o.ad).join(', '),
          tarih: today(), log_id: editLogId, wo_id: woId,
        })
        for (const hm of hmSatirlar) {
          const hmMiktar = (hm.miktar || 0) * (w.mpm || 1) * q
          if (hmMiktar > 0) {
            await supabase.from('uys_stok_hareketler').insert({
              id: uid(), malkod: hm.malkod || hm.kod, malad: hm.malad || hm.ad, miktar: hmMiktar,
              tip: 'cikis', kaynak: 'uretim-hm', aciklama: w.ieNo + ' HM tüketim (düzenlendi)',
              tarih: today(), log_id: editLogId, wo_id: woId,
            })
          }
        }
      }
    } else {
      // YENİ KAYIT MODU
      const logId = uid()
      await supabase.from('uys_logs').insert({
        id: logId, wo_id: woId, tarih: today(), qty: q, fire: f,
        operatorlar: oprList.map(o => ({ id: o.id, ad: o.ad, bas: o.bas, bit: o.bit })),
        not_: aciklama, duruslar: duruslar.filter(d => d.kodId && d.sure > 0).map(d => ({ kodId: d.kodId, kodAd: d.kodAd, sure: d.sure, bas: d.bas, bit: d.bit })),
      })
      if (q > 0) {
        await supabase.from('uys_stok_hareketler').insert({
          id: uid(), malkod: w.malkod, malad: w.malad, miktar: q,
          tip: 'giris', kaynak: 'uretim', aciklama: w.ieNo + ' - ' + oprList.map(o => o.ad).join(', '),
          tarih: today(), log_id: logId, wo_id: woId,
        })
        for (const hm of hmSatirlar) {
          const hmMiktar = (hm.miktar || 0) * (w.mpm || 1) * q
          if (hmMiktar > 0) {
            await supabase.from('uys_stok_hareketler').insert({
              id: uid(), malkod: hm.malkod || hm.kod, malad: hm.malad || hm.ad, miktar: hmMiktar,
              tip: 'cikis', kaynak: 'uretim-hm', aciklama: w.ieNo + ' HM tüketim',
              tarih: today(), log_id: logId, wo_id: woId,
            })
          }
        }
      }
    }
    if (f > 0 && !editLog) {
      await supabase.from('uys_fire_logs').insert({
        id: uid(), wo_id: woId, tarih: today(), miktar: f, opertor: oprList.map(o => o.ad).join(', '), neden: aciklama || '',
      })
    }
    // ═══ AUTO-CLOSE: İE tamamlandı mı? ═══
    const q_ = parseInt(qty) || 0
    const yeniToplam = prod - (editLog?.qty || 0) + q_
    if (yeniToplam >= w.hedef && w.hedef > 0) {
      // Bu İE'ye ait tüm active_work kayıtlarını otomatik kapat
      await supabase.from('uys_active_work').delete().eq('wo_id', woId)
      // Her operatörün bitiş saatini kaydet (sonraki iş için akıllı saat)
      const stopNow = new Date()
      const stopSaat = String(stopNow.getHours()).padStart(2, '0') + ':' + String(stopNow.getMinutes()).padStart(2, '0')
      oprList.forEach(o => {
        try { localStorage.setItem('uys_lastStop_' + o.id, JSON.stringify({ tarih: today(), saat: stopSaat })) } catch {}
      })
      toast.success(w.ieNo + ' tamamlandı ✓ Aktif çalışma otomatik kapatıldı', { duration: 4000 })
    }
    setSaving(false); clearDraft(); onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={handleClose}>
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className={`${editLog ? 'bg-amber/10 border-b border-amber/20' : 'bg-accent/10 border-b border-accent/20'} p-4 rounded-t-xl`}>
          <div className="flex items-center justify-between">
            <div className="font-mono text-accent text-xs font-bold">{w.ieNo}</div>
            {editLog && <span className="text-[10px] px-2 py-0.5 bg-amber/20 text-amber rounded font-semibold">✏ Düzenleme Modu</span>}
            {draft && !editLog && (
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 bg-accent/20 text-accent rounded font-semibold">📋 Önceki kayıtlar yüklendi</span>
                <button onClick={() => { clearDraft(); setQty(''); setFire(''); setAciklama(''); setDuruslar([]); setOprList([{ id: oprId, ad: oprAd, bas: basSaat, bit: nowHHMM }]) }} className="text-[9px] text-zinc-500 hover:text-red underline">Temizle</button>
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-white mt-0.5">{w.malad}</div>
          <div className="text-[11px] text-zinc-400 mt-1">Operasyon: <b>{w.opAd}</b> · Kalan: <b className="text-amber">{kalan}</b></div>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-bg-2 rounded-lg p-2"><div className="text-[10px] text-zinc-500">Hedef</div><div className="text-sm font-bold">{w.hedef}</div></div>
            <div className="bg-bg-2 rounded-lg p-2"><div className="text-[10px] text-green">Yapılan</div><div className="text-sm font-bold text-green">{prod}</div></div>
            <div className="bg-bg-2 rounded-lg p-2"><div className="text-[10px] text-amber">Kalan</div><div className="text-sm font-bold text-amber">{kalan}</div></div>
          </div>

          {hmSatirlar.length > 0 && (
            <div className={`border rounded-lg p-3 ${maxUretim <= 0 ? 'bg-red/5 border-red/30' : maxUretim < kalan ? 'bg-amber/5 border-amber/30' : 'bg-green/5 border-green/30'}`}>
              <div className="text-[10px] font-bold mb-2 uppercase tracking-wider">{maxUretim <= 0 ? '⛔ STOK YOK' : maxUretim < kalan ? '⚠ STOK KISMI' : '✓ STOK YETERLİ'}</div>
              <table className="w-full text-[10px]">
                <thead><tr className="text-zinc-500"><td className="py-1 pr-2">Kod</td><td className="py-1 pr-2">Malzeme</td><td className="py-1 text-right pr-2">Mevcut</td><td className="py-1 text-right pr-2">Gereken</td><td className="py-1">Durum</td></tr></thead>
                <tbody>{hmSatirlar.map((hm: any, i: number) => {
                  const mevcut = Math.round(stokNet(hm.malkod || hm.kod))
                  const gereken = Math.ceil((hm.miktar || 0) * (w.mpm || 1) * kalan)
                  const durum = mevcut <= 0 ? 'YOK' : mevcut < gereken ? 'KISMI' : 'YETERLİ'
                  const renk = durum === 'YOK' ? 'text-red' : durum === 'KISMI' ? 'text-amber' : 'text-green'
                  return (<tr key={i} className="border-t border-border/20">
                    <td className="py-1 pr-2 font-mono text-accent">{hm.malkod || hm.kod}</td>
                    <td className="py-1 pr-2 text-zinc-300">{(hm.malad || hm.ad || '').slice(0, 25)}</td>
                    <td className={`py-1 text-right pr-2 font-bold ${renk}`}>{mevcut}</td>
                    <td className="py-1 text-right pr-2">{gereken}</td>
                    <td className={`py-1 font-bold ${renk}`}>{durum}</td>
                  </tr>)
                })}</tbody>
              </table>
              {maxUretim > 0 && maxUretim < kalan && <div className="text-[10px] text-amber mt-2 font-semibold">En fazla {maxUretim} adet üretilebilir</div>}
            </div>
          )}

          <div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">OPERATÖRLER</div>
            {oprList.map((o, i) => (
              <div key={i} className="flex items-center gap-2 bg-bg-2 rounded-lg p-2 mb-1.5">
                <span className="flex-1 text-xs font-semibold">{o.ad}</span>
                <input type="time" value={o.bas} onChange={e => updateOpr(i, 'bas', e.target.value)} className="w-[85px] px-1.5 py-1 bg-bg-3 border border-border rounded text-[11px] text-zinc-200" />
                <span className="text-[10px] text-zinc-600">—</span>
                <input type="time" value={o.bit} onChange={e => updateOpr(i, 'bit', e.target.value)} className="w-[85px] px-1.5 py-1 bg-bg-3 border border-border rounded text-[11px] text-zinc-200" />
                <button onClick={() => removeOpr(i)} className="text-red text-sm px-1 opacity-60 hover:opacity-100">✕</button>
              </div>
            ))}
            <div className="flex items-center gap-2 p-2 border border-dashed border-border/50 rounded-lg opacity-70 hover:opacity-100">
              <select value={addOprId} onChange={e => setAddOprId(e.target.value)} className="flex-1 px-2 py-1.5 bg-bg-2 border border-border rounded text-[11px] text-zinc-300">
                <option value="">— Operatör ekle —</option>
                {allOperators.filter(o => o.aktif !== false && !oprList.some(x => x.id === o.id)).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(o => (
                  <option key={o.id} value={o.id}>{o.ad} ({o.kod})</option>
                ))}
              </select>
              <button onClick={addOpr} className="px-3 py-1.5 bg-accent/20 text-accent rounded text-[11px] font-semibold hover:bg-accent/30">+ Ekle</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">Üretim Adedi *</label>
              <input type="number" value={qty} onChange={e => {
                const v = parseInt(e.target.value) || 0
                const mx = hmSatirlar.length > 0 ? Math.min(kalan, maxUretim) : kalan
                if (v > mx) { setQty(String(mx)); toast.error('Max: ' + mx) } else setQty(e.target.value)
              }} placeholder={String(Math.min(kalan, maxUretim))} className="w-full px-3 py-3 bg-bg-2 border border-border rounded-lg text-xl text-center font-bold text-white focus:outline-none focus:border-green" autoFocus />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">Fire</label>
              <input type="number" value={fire} onChange={e => setFire(e.target.value)} placeholder="0" className="w-full px-3 py-3 bg-bg-2 border border-border rounded-lg text-xl text-center font-bold text-red focus:outline-none focus:border-red" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Açıklama</label>
            <input value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="Opsiyonel..." className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">DURUŞLAR</span>
              <button onClick={addDurus} className="text-[10px] text-accent hover:underline font-semibold">+ Duruş Ekle</button>
            </div>
            {duruslar.map((d, i) => (
              <div key={i} className="bg-bg-2 rounded-lg p-2 mb-2">
                <div className="flex gap-2 mb-1.5">
                  <select value={d.kodId} onChange={e => updateDurus(i, 'kodId', e.target.value)} className="flex-1 px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200">
                    <option value="">— Duruş kodu —</option>
                    {durusKodlari.map(k => <option key={k.id} value={k.id}>{k.kod} - {k.ad}</option>)}
                  </select>
                  <button onClick={() => setDuruslar(p => p.filter((_, idx) => idx !== i))} className="text-red text-sm px-1">✕</button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="time" value={d.bas} onChange={e => updateDurus(i, 'bas', e.target.value)} className="w-[85px] px-1.5 py-1 bg-bg-3 border border-border rounded text-[11px] text-zinc-200" />
                  <span className="text-[10px] text-zinc-600">→</span>
                  <input type="time" value={d.bit} onChange={e => updateDurus(i, 'bit', e.target.value)} className="w-[85px] px-1.5 py-1 bg-bg-3 border border-border rounded text-[11px] text-zinc-200" />
                  <span className="text-[10px] text-zinc-500">=</span>
                  <input type="number" value={d.sure || ''} onChange={e => updateDurus(i, 'sure', e.target.value)} placeholder="dk" className="w-14 px-2 py-1 bg-bg-3 border border-border rounded text-[11px] text-center text-zinc-200" />
                  <span className="text-[10px] text-zinc-600">dk</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-border">
          <button onClick={handleClose} className="flex-1 py-3 bg-bg-3 text-zinc-400 rounded-lg text-sm font-semibold">Kapat</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 bg-green hover:bg-green/80 text-black font-bold rounded-lg text-sm disabled:opacity-30">
            {saving ? 'Kaydediliyor...' : editLog ? '✏ Güncelle' : '✅ Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MesajForm({ oprId, oprAd, onSent }: { oprId: string; oprAd: string; onSent: () => void }) {
  const { operatorNotes, loadAll } = useStore()
  const [mesaj, setMesaj] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  // Bu operatöre ait TÜM mesajlar (operatör + admin)
  const myNotes = operatorNotes.filter(n => n.opId === oprId).sort((a, b) => (a.tarih + a.saat).localeCompare(b.tarih + b.saat))

  const isAdmin = (n: typeof myNotes[0]) => (n.opAd || '').includes('Yönetim')

  async function send() {
    if (!mesaj.trim()) return
    const now = new Date()
    const saat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    const { error } = await supabase.from('uys_operator_notes').insert({
      id: uid(), op_id: oprId, op_ad: oprAd, tarih: today(), saat,
      mesaj: mesaj.trim(), okundu: false,
    })
    if (error) { toast.error('Mesaj gönderilemedi: ' + error.message); return }
    setMesaj(''); loadAll(); onSent()
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return
    await supabase.from('uys_operator_notes').update({ mesaj: editText.trim() }).eq('id', id)
    setEditId(null); setEditText(''); loadAll(); toast.success('Mesaj güncellendi')
  }

  async function deleteMsg(id: string) {
    await supabase.from('uys_operator_notes').delete().eq('id', id)
    loadAll(); toast.success('Mesaj silindi')
  }

  return (
    <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-border text-sm font-semibold">💬 Mesajlar</div>

      <div className="max-h-[400px] overflow-y-auto p-3 space-y-2">
        {myNotes.length === 0 && <div className="text-xs text-zinc-600 text-center py-4">Henüz mesaj yok</div>}
        {myNotes.map(n => {
          const fromAdmin = isAdmin(n)
          return (
            <div key={n.id} className={`flex ${fromAdmin ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 ${fromAdmin ? 'bg-green/10 border border-green/15 rounded-tl-none' : 'bg-accent/10 border border-accent/10 rounded-tr-none'}`}>
                <div className="flex items-center justify-between gap-3 mb-0.5">
                  <span className={`text-[10px] font-semibold ${fromAdmin ? 'text-green' : 'text-accent'}`}>{fromAdmin ? '📋 Yönetim' : oprAd}</span>
                  <span className="text-[10px] text-zinc-600">{n.tarih} {n.saat}</span>
                </div>
                {editId === n.id ? (
                  <div className="flex gap-1.5 mt-1">
                    <input value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit(n.id)}
                      className="flex-1 px-2 py-1 bg-bg-3 border border-accent/30 rounded text-xs text-zinc-200 focus:outline-none" autoFocus />
                    <button onClick={() => saveEdit(n.id)} className="px-2 py-1 bg-accent text-white rounded text-[10px]">✓</button>
                    <button onClick={() => setEditId(null)} className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px]">✕</button>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-200">{n.mesaj}</div>
                )}
                {!fromAdmin && editId !== n.id && (
                  <div className="flex gap-1 mt-1 justify-end">
                    <button onClick={() => { setEditId(n.id); setEditText(n.mesaj) }} className="text-[9px] text-zinc-600 hover:text-accent">✏</button>
                    <button onClick={() => deleteMsg(n.id)} className="text-[9px] text-zinc-600 hover:text-red">✕</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <input value={mesaj} onChange={e => setMesaj(e.target.value)} placeholder="Mesaj yazın..."
          onKeyDown={e => e.key === 'Enter' && send()}
          className="flex-1 px-3 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
        <button onClick={send} disabled={!mesaj.trim()} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}

/* İzin Talep Formu — Operatör Paneli */
function IzinTalepForm({ oprId, oprAd, onSaved }: { oprId: string; oprAd: string; onSaved: () => void }) {
  const [baslangic, setBaslangic] = useState(today())
  const [bitis, setBitis] = useState(today())
  const [tip, setTip] = useState('yıllık')
  const [saatlik, setSaatlik] = useState(false)
  const [saatBas, setSaatBas] = useState('')
  const [saatBit, setSaatBit] = useState('')
  const [not_, setNot] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div className="bg-bg-2 border border-accent/20 rounded-xl p-4">
      <div className="text-sm font-semibold text-accent mb-3">📝 İzin Talep Et</div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Başlangıç</label>
            <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)}
              className="w-full px-2 py-1.5 bg-bg-1 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 mb-0.5 block">Bitiş</label>
            <input type="date" value={bitis} onChange={e => setBitis(e.target.value)}
              className="w-full px-2 py-1.5 bg-bg-1 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={saatlik} onChange={e => setSaatlik(e.target.checked)} id="st" className="rounded" />
          <label htmlFor="st" className="text-[10px] text-zinc-400">Saatlik izin</label>
        </div>
        {saatlik && (
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={saatBas} onChange={e => setSaatBas(e.target.value)} placeholder="Başlangıç"
              className="w-full px-2 py-1.5 bg-bg-1 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
            <input type="time" value={saatBit} onChange={e => setSaatBit(e.target.value)} placeholder="Bitiş"
              className="w-full px-2 py-1.5 bg-bg-1 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
        )}
        <select value={tip} onChange={e => setTip(e.target.value)}
          className="w-full px-2 py-1.5 bg-bg-1 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent">
          <option value="yıllık">Yıllık İzin</option>
          <option value="mazeret">Mazeret İzni</option>
          <option value="rapor">Rapor</option>
          <option value="ücretsiz">Ücretsiz İzin</option>
        </select>
        <input value={not_} onChange={e => setNot(e.target.value)} placeholder="Açıklama (opsiyonel)"
          className="w-full px-2 py-1.5 bg-bg-1 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
        <button
          disabled={saving}
          onClick={async () => {
            if (!baslangic) { toast.error('Başlangıç tarihi girilmeli'); return }
            setSaving(true)
            await supabase.from('uys_izinler').insert({
              id: uid(), op_id: oprId, op_ad: oprAd,
              baslangic, bitis: bitis || baslangic, tip,
              durum: 'bekliyor', olusturan: 'operator',
              saat_baslangic: saatlik ? saatBas : '', saat_bitis: saatlik ? saatBit : '',
              onaylayan: '', onay_tarihi: '', not_: not_,
            })
            setSaving(false)
            setNot(''); onSaved()
          }}
          className="w-full py-2 bg-accent/20 border border-accent/30 text-accent rounded-lg text-xs font-bold hover:bg-accent/30">
          {saving ? 'Gönderiliyor...' : '📤 Talep Gönder (Onay Bekleyecek)'}
        </button>
      </div>
    </div>
  )
}
