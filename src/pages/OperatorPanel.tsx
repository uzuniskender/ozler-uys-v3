import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today, pctColor } from '@/lib/utils'
import { toast } from 'sonner'
import { LogOut, Play, Square, Send, CheckCircle } from 'lucide-react'

export function OperatorPanel() {
  const { operators } = useStore()
  const [oprId, setOprId] = useState('')
  const [sifre, setSifre] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [tab, setTab] = useState<'isler'|'mesaj'>('isler')

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

  return <OperatorMain oprId={oprId} opr={opr!} tab={tab} setTab={setTab} onLogout={() => { setLoggedIn(false); setOprId(''); setSifre('') }} />
}

function OperatorMain({ oprId, opr, tab, setTab, onLogout }: {
  oprId: string; opr: { id: string; ad: string; bolum: string }
  tab: string; setTab: (t: 'isler'|'mesaj') => void; onLogout: () => void
}) {
  const { workOrders, logs, activeWork, operations, loadAll } = useStore()

  // Bölüme göre açık iş emirleri — sadece operatörün bölümündeki operasyonlar
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

  // İş başlat
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

  // İş bitir + üretim girişi
  async function finishWork() {
    if (!myActive) return
    await supabase.from('uys_active_work').delete().eq('id', myActive.id)
    loadAll()
    toast.success('İş durduruldu')
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-bg-2 border border-border rounded-lg p-3">
        <div>
          <div className="text-sm font-semibold">{opr.ad}</div>
          <div className="text-[11px] text-zinc-500">{opr.bolum} · {today()}</div>
        </div>
        <button onClick={onLogout} className="p-2 text-zinc-500 hover:text-red"><LogOut size={16} /></button>
      </div>

      {/* Aktif İş */}
      {myActive && (
        <div className="mb-4 p-4 bg-green/5 border border-green/20 rounded-lg">
          <div className="text-[10px] text-green font-semibold mb-1">🔧 AKTİF ÇALIŞMA</div>
          <div className="text-sm font-medium">{myActive.woAd}</div>
          <div className="text-xs text-zinc-500 font-mono">Başlangıç: {myActive.baslangic}</div>
          <div className="flex gap-2 mt-3">
            <QuickEntry woId={myActive.woId} oprId={oprId} oprAd={opr.ad} onDone={() => { loadAll(); toast.success('Üretim kaydedildi') }} />
            <button onClick={finishWork} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red/10 border border-red/25 text-red rounded-lg text-xs font-semibold"><Square size={13} /> Durdur</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <select value={tab} onChange={e => setTab(e.target.value as 'isler'|'mesaj')} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="isler">İşlerim</option>
          <option value="mesaj">Mesajlar</option>
        </select>
      </div>

      {tab === 'isler' && (
        <div className="space-y-2">
          {acikWOs.map(w => {
            const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
            const pct = Math.min(100, Math.round(prod / w.hedef * 100))
            const kalan = Math.max(0, w.hedef - prod)
            const isActive = myActive?.woId === w.id
            return (
              <div key={w.id} className={`bg-bg-2 border rounded-lg p-3 ${isActive ? 'border-green/40' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-accent text-xs">{w.ieNo}</span>
                  <span className={`font-mono text-xs ${pctColor(pct)}`}>{pct}%</span>
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
                {!myActive && (
                  <button onClick={() => startWork(w.id)} className="w-full flex items-center justify-center gap-1.5 py-2 bg-accent/10 text-accent rounded-lg text-xs font-medium hover:bg-accent/20">
                    <Play size={13} /> Başlat
                  </button>
                )}
              </div>
            )
          })}
          {!acikWOs.length && <div className="p-8 text-center text-zinc-600 text-sm">Açık iş emri yok</div>}
        </div>
      )}

      {tab === 'mesaj' && <MesajForm oprId={oprId} oprAd={opr.ad} onSent={() => toast.success('Mesaj gönderildi')} />}
    </div>
  )
}

function QuickEntry({ woId, oprId, oprAd, onDone }: { woId: string; oprId: string; oprAd: string; onDone: () => void }) {
  const [qty, setQty] = useState('')
  const [fire, setFire] = useState('')
  const [saving, setSaving] = useState(false)

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
      duruslar: [], operator_id: oprId,
    })

    if (f > 0) {
      await supabase.from('uys_fire_logs').insert({
        id: uid(), log_id: logId, wo_id: woId, tarih: today(),
        qty: f, operatorlar: [{ id: oprId, ad: oprAd }],
      })
    }
    setSaving(false); setQty(''); setFire(''); onDone()
  }

  return (
    <div className="flex-[2] flex gap-1.5">
      <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="Adet" className="flex-1 px-2 py-2 bg-bg-2 border border-border rounded-lg text-xs text-center focus:outline-none focus:border-accent" />
      <input type="number" value={fire} onChange={e => setFire(e.target.value)} placeholder="Fire" className="w-14 px-2 py-2 bg-bg-2 border border-border rounded-lg text-xs text-center focus:outline-none" />
      <button onClick={save} disabled={saving} className="px-3 py-2 bg-green hover:bg-green/80 text-white rounded-lg text-xs font-semibold"><CheckCircle size={14} /></button>
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
