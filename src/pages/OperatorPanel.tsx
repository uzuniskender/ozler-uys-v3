import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { uid, today, pctColor } from '@/lib/utils'
import { toast } from 'sonner'
import { LogOut, Play, Square, Send, CheckCircle } from 'lucide-react'

export function OperatorPanel() {
  const { operators } = useStore()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [oprId, setOprId] = useState('')
  const [sifre, setSifre] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [tab, setTab] = useState<'isler'|'mesaj'>('isler')

  // Auth'dan gelen operatör otomatik girişi
  useEffect(() => {
    if (user?.role === 'operator' && user.oprId && !loggedIn) {
      setOprId(user.oprId)
      setLoggedIn(true)
    }
  }, [user])

  const opr = operators.find(o => o.id === oprId)

  function login() {
    const found = operators.find(o => o.kod === oprId || o.id === oprId || o.ad.toLowerCase() === oprId.toLowerCase())
    if (found && found.sifre === sifre) {
      setOprId(found.id); setLoggedIn(true); toast.success('Hoş geldin ' + found.ad)
    } else { toast.error('Hatalı sicil no veya şifre') }
  }

  if (!loggedIn) {
    return (
      <div className="max-w-sm mx-auto mt-12 p-6 bg-bg-1 border border-border rounded-xl">
        <h1 className="text-xl font-bold text-accent text-center mb-1">OPERATÖR GİRİŞİ</h1>
        <p className="text-xs text-zinc-500 text-center mb-6">Sicil no ve şifre ile giriş yapın</p>
        <div className="space-y-3">
          <input value={oprId} onChange={e => setOprId(e.target.value)} placeholder="Sicil No / İsim"
            className="w-full px-4 py-3 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent text-center" autoFocus />
          <input type="password" value={sifre} onChange={e => setSifre(e.target.value)} placeholder="Şifre"
            className="w-full px-4 py-3 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent text-center"
            onKeyDown={e => e.key === 'Enter' && login()} />
          <button onClick={login} className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-sm">GİRİŞ</button>
        </div>
      </div>
    )
  }

  return <OperatorMain oprId={oprId} opr={opr!} tab={tab} setTab={setTab} onLogout={() => { signOut(); navigate('/') }} />
}

function OperatorMain({ oprId, opr, tab, setTab, onLogout }: {
  oprId: string; opr: { id: string; ad: string; bolum: string }
  tab: string; setTab: (t: 'isler'|'mesaj') => void; onLogout: () => void
}) {
  const { workOrders, logs, activeWork, operations, durusKodlari, loadAll } = useStore()
  const [entryWO, setEntryWO] = useState<string | null>(null)

  const acikWOs = useMemo(() => {
    const bolumUpper = (opr.bolum || '').toUpperCase()
    const bolumOpIds = new Set(operations.filter(o => (o.bolum || '').toUpperCase() === bolumUpper).map(o => o.id))
    return workOrders.filter(w => {
      if (w.hedef <= 0) return false
      if (!bolumOpIds.has(w.opId) && (w.opAd || '').toUpperCase() !== bolumUpper) return false
      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
      return prod < w.hedef && w.durum !== 'iptal' && w.durum !== 'tamamlandi' && w.durum !== 'beklemede'
    })
  }, [workOrders, logs, operations, opr.bolum])

  const myActive = activeWork.find(a => a.opId === oprId)

  async function startWork(woId: string) {
    const w = workOrders.find(x => x.id === woId)
    if (!w) return
    const now = new Date()
    const saat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    await supabase.from('uys_active_work').upsert({
      id: oprId, op_id: oprId, op_ad: opr.ad, wo_id: woId,
      wo_ad: w.malad, baslangic: saat, tarih: today(),
    }, { onConflict: 'id' })
    loadAll(); toast.success('İş başlatıldı: ' + w.ieNo)
  }

  async function stopWork() {
    if (!myActive) return
    await supabase.from('uys_active_work').delete().eq('id', myActive.id)
    loadAll(); toast.success('İş durduruldu')
  }

  function wProd(woId: string) { return logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0) }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-bg-2 border border-border rounded-lg p-3">
        <div>
          <div className="text-sm font-semibold">{opr.ad}</div>
          <div className="text-[11px] text-zinc-500">{opr.bolum} · {today()}</div>
        </div>
        <button onClick={onLogout} className="px-3 py-1.5 bg-red/10 border border-red/25 text-red text-xs rounded-lg hover:bg-red/20">Çıkış</button>
      </div>

      {/* Aktif İş Banner */}
      {myActive && (() => {
        const w = workOrders.find(x => x.id === myActive.woId)
        const now = new Date()
        const saat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
        const basDk = myActive.baslangic ? (parseInt(saat.split(':')[0]) * 60 + parseInt(saat.split(':')[1])) - (parseInt(myActive.baslangic.split(':')[0]) * 60 + parseInt(myActive.baslangic.split(':')[1])) : 0
        return (
          <div className="mb-4 p-4 bg-green/5 border-2 border-green/30 rounded-lg">
            <div className="text-[10px] text-green font-bold uppercase tracking-wider mb-1">🔧 Aktif Çalışma</div>
            <div className="text-sm font-semibold text-white mb-0.5">{myActive.woAd}</div>
            <div className="text-xs text-zinc-400 font-mono mb-3">Başlangıç: {myActive.baslangic} → ({basDk > 0 ? basDk + 'dk' : 'şimdi'})</div>
            <div className="flex gap-2">
              <button onClick={() => setEntryWO(myActive.woId)}
                className="flex-1 py-3 bg-green text-black font-bold rounded-lg text-sm hover:bg-green/80">
                ✅ Üretim Kaydet
              </button>
              <button onClick={stopWork}
                className="px-4 py-3 bg-red/20 border border-red/30 text-red rounded-lg text-sm font-semibold hover:bg-red/30">
                ⏹ Durdur
              </button>
            </div>
          </div>
        )
      })()}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button onClick={() => setTab('isler')} className={`flex-1 py-2 text-xs font-semibold rounded-lg ${tab === 'isler' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400'}`}>
          📋 İşlerim ({acikWOs.length})
        </button>
        <button onClick={() => setTab('mesaj')} className={`flex-1 py-2 text-xs font-semibold rounded-lg ${tab === 'mesaj' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400'}`}>
          💬 Mesajlar
        </button>
      </div>

      {tab === 'isler' && (
        <div className="space-y-2">
          {acikWOs.map(w => {
            const prod = wProd(w.id)
            const pct = Math.min(100, Math.round(prod / w.hedef * 100))
            const kalan = Math.max(0, w.hedef - prod)
            const isActive = myActive?.woId === w.id
            return (
              <div key={w.id} className={`bg-bg-2 border rounded-lg p-3 ${isActive ? 'border-green/40 bg-green/5' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-accent text-xs">{w.ieNo}</span>
                  <span className={`font-mono text-xs font-bold ${pctColor(pct)}`}>{pct}%</span>
                </div>
                <div className="text-sm font-medium mb-1">{w.malad}</div>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500 mb-2">
                  <span>Hedef: {w.hedef}</span>
                  <span className="text-green">Yapılan: {prod}</span>
                  <span className="text-amber">Kalan: {kalan}</span>
                </div>
                <div className="w-full h-1.5 bg-bg-3 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${pct}%` }} />
                </div>
                {!myActive ? (
                  <button onClick={() => startWork(w.id)} className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover">
                    ▶ Başlat
                  </button>
                ) : isActive ? (
                  <button onClick={() => setEntryWO(w.id)} className="w-full py-2.5 bg-green text-black rounded-lg text-sm font-semibold hover:bg-green/80">
                    ✅ Üretim Kaydet
                  </button>
                ) : null}
              </div>
            )
          })}
          {!acikWOs.length && <div className="p-8 text-center text-zinc-600 text-sm">Açık iş emri yok</div>}
        </div>
      )}

      {tab === 'mesaj' && <MesajForm oprId={oprId} oprAd={opr.ad} onSent={() => toast.success('Mesaj gönderildi')} />}

      {/* Üretim Kayıt Modal */}
      {entryWO && <OprEntryModal woId={entryWO} oprId={oprId} oprAd={opr.ad} durusKodlari={durusKodlari}
        onClose={() => setEntryWO(null)}
        onSaved={() => { setEntryWO(null); loadAll(); toast.success('Üretim kaydedildi') }} />}
    </div>
  )
}

/* Operatör Üretim Kayıt Modal */
function OprEntryModal({ woId, oprId, oprAd, durusKodlari, onClose, onSaved }: {
  woId: string; oprId: string; oprAd: string
  durusKodlari: { id: string; kod: string; ad: string }[]
  onClose: () => void; onSaved: () => void
}) {
  const { workOrders, logs } = useStore()
  const w = workOrders.find(x => x.id === woId)
  const [qty, setQty] = useState('')
  const [fire, setFire] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [saving, setSaving] = useState(false)
  const [duruslar, setDuruslar] = useState<{ kodId: string; kodAd: string; sure: number }[]>([])

  if (!w) return null
  const prod = logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0)
  const kalan = Math.max(0, w.hedef - prod)

  function addDurus() { setDuruslar(p => [...p, { kodId: '', kodAd: '', sure: 0 }]) }
  function updateDurus(i: number, field: string, val: string) {
    setDuruslar(p => p.map((d, idx) => {
      if (idx !== i) return d
      if (field === 'kodId') { const dk = durusKodlari.find(k => k.id === val); return { ...d, kodId: val, kodAd: dk?.ad || '' } }
      if (field === 'sure') return { ...d, sure: parseInt(val) || 0 }
      return d
    }))
  }

  async function save() {
    const q = parseInt(qty) || 0
    if (q <= 0) { toast.error('Miktar girin'); return }
    setSaving(true)
    const f = parseInt(fire) || 0
    const logId = uid()
    const now = new Date()
    const saat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')

    await supabase.from('uys_logs').insert({
      id: logId, wo_id: woId, tarih: today(), qty: q, fire: f,
      operatorlar: [{ id: oprId, ad: oprAd, bas: saat, bit: saat }],
      not_: aciklama, duruslar: duruslar.filter(d => d.kodId && d.sure > 0),
    })
    // Mamul stok girişi
    await supabase.from('uys_stok_hareketler').insert({
      id: uid(), malkod: w.malkod, malad: w.malad, miktar: q,
      tip: 'giris', kaynak: 'uretim', aciklama: `${w.ieNo} - ${oprAd}`,
      tarih: today(), log_id: logId, wo_id: woId,
    })
    // Fire log
    if (f > 0) {
      await supabase.from('uys_fire_logs').insert({
        id: uid(), wo_id: woId, tarih: today(), miktar: f, opertor: oprAd, neden: aciklama || 'Operatör girişi',
      })
    }
    // Aktif işi temizle
    await supabase.from('uys_active_work').delete().eq('id', oprId)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-1">Üretim Kaydet</h2>
        <div className="text-xs text-zinc-500 mb-4">{w.ieNo} — {w.malad}</div>

        <div className="bg-bg-2 border border-border rounded-lg p-3 mb-4">
          <div className="flex justify-between text-xs">
            <span>Hedef: <b>{w.hedef}</b></span>
            <span className="text-green">Yapılan: <b>{prod}</b></span>
            <span className="text-amber">Kalan: <b>{kalan}</b></span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Adet *</label>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder={String(kalan)}
                className="w-full px-3 py-3 bg-bg-2 border border-border rounded-lg text-lg text-center font-bold text-zinc-200 focus:outline-none focus:border-accent" autoFocus />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Fire</label>
              <input type="number" value={fire} onChange={e => setFire(e.target.value)} placeholder="0"
                className="w-full px-3 py-3 bg-bg-2 border border-border rounded-lg text-lg text-center font-bold text-red focus:outline-none focus:border-red" />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Açıklama</label>
            <input value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="Opsiyonel..."
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>

          {/* Duruş Kayıtları */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-zinc-500 font-semibold">Duruş Kayıtları</label>
              <button onClick={addDurus} className="text-[10px] text-accent hover:underline">+ Duruş Ekle</button>
            </div>
            {duruslar.map((d, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select value={d.kodId} onChange={e => updateDurus(i, 'kodId', e.target.value)}
                  className="flex-1 px-2 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200">
                  <option value="">— Duruş kodu —</option>
                  {durusKodlari.map(k => <option key={k.id} value={k.id}>{k.kod} - {k.ad}</option>)}
                </select>
                <input type="number" value={d.sure || ''} onChange={e => updateDurus(i, 'sure', e.target.value)} placeholder="dk"
                  className="w-16 px-2 py-2 bg-bg-2 border border-border rounded-lg text-xs text-center text-zinc-200" />
                <button onClick={() => setDuruslar(p => p.filter((_, idx) => idx !== i))} className="text-red text-xs px-1">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-3 bg-bg-3 text-zinc-400 rounded-lg text-sm">İptal</button>
          <button onClick={save} disabled={saving} className="flex-1 py-3 bg-green hover:bg-green/80 text-black font-bold rounded-lg text-sm disabled:opacity-40">
            {saving ? 'Kaydediliyor...' : '✅ Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MesajForm({ oprId, oprAd, onSent }: { oprId: string; oprAd: string; onSent: () => void }) {
  const { operatorNotes, loadAll } = useStore()
  const [mesaj, setMesaj] = useState('')

  // Bu operatörün mesajları
  const myNotes = operatorNotes.filter(n => n.opId === oprId).sort((a, b) => (b.tarih + b.saat).localeCompare(a.tarih + a.saat))

  async function send() {
    if (!mesaj.trim()) return
    const now = new Date()
    const saat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    await supabase.from('uys_operator_notes').insert({
      id: uid(), op_id: oprId, op_ad: oprAd, tarih: today(), saat,
      mesaj: mesaj.trim(), okundu: false,
    })
    setMesaj(''); loadAll(); onSent()
  }

  return (
    <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-border text-sm font-semibold">💬 Mesajlar</div>

      {/* Mesaj geçmişi */}
      <div className="max-h-[300px] overflow-y-auto p-3 space-y-3">
        {myNotes.length === 0 && <div className="text-xs text-zinc-600 text-center py-4">Henüz mesaj yok</div>}
        {myNotes.map(n => (
          <div key={n.id}>
            {/* Operatör mesajı */}
            <div className="flex items-end gap-2">
              <div className="flex-1 bg-accent/10 rounded-lg rounded-bl-none px-3 py-2 text-xs text-zinc-200">
                <div className="text-[10px] text-zinc-500 mb-0.5">{n.tarih} {n.saat}</div>
                {n.mesaj}
              </div>
            </div>
            {/* Yönetim cevabı */}
            {n.cevap && (
              <div className="flex items-end gap-2 mt-1.5 pl-6">
                <div className="flex-1 bg-green/10 rounded-lg rounded-br-none px-3 py-2 text-xs text-zinc-200">
                  <div className="text-[10px] text-green mb-0.5">{n.cevaplayan || 'Yönetim'} · {n.cevapTarih}</div>
                  {n.cevap}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Yeni mesaj */}
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
