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
  const [tab, setTab] = useState<'isler'|'mesaj'|'ozet'>('isler')

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

  return <OperatorMain oprId={oprId} opr={opr!} tab={tab} setTab={setTab} onLogout={() => { signOut(); window.location.hash = '#/'; window.location.reload() }} />
}

function OperatorMain({ oprId, opr, tab, setTab, onLogout }: {
  oprId: string; opr: { id: string; ad: string; bolum: string }
  tab: string; setTab: (t: 'isler'|'mesaj'|'ozet') => void; onLogout: () => void
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
    <div className="min-h-screen bg-bg-0 px-4 py-3">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-accent/20 to-bg-2 border border-accent/30 rounded-xl p-4">
          <div>
            <div className="text-lg font-bold text-white">{opr.ad}</div>
            <div className="text-xs text-zinc-400">{opr.bolum} · {today()}</div>
          </div>
          <button onClick={onLogout} className="px-4 py-2 bg-red/20 border border-red/30 text-red text-xs rounded-lg hover:bg-red/30 font-semibold">Çıkış</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('isler')} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${tab === 'isler' ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-bg-2 text-zinc-500 border border-border'}`}>
            📋 İşlerim ({acikWOs.length})
          </button>
          <button onClick={() => setTab('mesaj')} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${tab === 'mesaj' ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-bg-2 text-zinc-500 border border-border'}`}>
            💬 Mesajlar
          </button>
          <button onClick={() => setTab('ozet')} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${tab === 'ozet' ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'bg-bg-2 text-zinc-500 border border-border'}`}>
            📊 Özet
          </button>
        </div>

        {tab === 'isler' && (
          <div className="space-y-3">
            {acikWOs.map(w => {
              const prod = wProd(w.id)
              const pct = Math.min(100, Math.round(prod / w.hedef * 100))
              const kalan = Math.max(0, w.hedef - prod)
              return (
                <div key={w.id} onClick={() => setEntryWO(w.id)}
                  className="bg-bg-1 border border-border rounded-xl p-4 cursor-pointer hover:border-accent/50 active:scale-[0.99] transition-all">
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
                  <div className="w-full h-2 bg-bg-3 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-accent'}`} style={{ width: `${Math.max(2, pct)}%` }} />
                  </div>
                </div>
              )
            })}
            {!acikWOs.length && <div className="p-12 text-center text-zinc-600">Açık iş emri yok</div>}
          </div>
        )}

        {tab === 'mesaj' && <MesajForm oprId={oprId} oprAd={opr.ad} onSent={() => toast.success('Mesaj gönderildi')} />}

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
        {entryWO && <OprEntryModal woId={entryWO} oprId={oprId} oprAd={opr.ad} durusKodlari={durusKodlari}
          onClose={() => setEntryWO(null)}
          onSaved={() => { setEntryWO(null); loadAll(); toast.success('Üretim kaydedildi') }} />}
      </div>
    </div>
  )
}

/* Operatör Üretim Kayıt Modal */
function OprEntryModal({ woId, oprId, oprAd, durusKodlari, onClose, onSaved }: {
  woId: string; oprId: string; oprAd: string
  durusKodlari: { id: string; kod: string; ad: string }[]
  onClose: () => void; onSaved: () => void
}) {
  const { workOrders, logs, recipes, stokHareketler, materials } = useStore()
  const w = workOrders.find(x => x.id === woId)
  const now = new Date()
  const nowHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')

  const [qty, setQty] = useState('')
  const [fire, setFire] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [basla, setBasla] = useState(nowHHMM)
  const [bitir, setBitir] = useState(nowHHMM)
  const [saving, setSaving] = useState(false)
  const [duruslar, setDuruslar] = useState<{ kodId: string; kodAd: string; sure: number }[]>([])

  if (!w) return null
  const prod = logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0)
  const kalan = Math.max(0, w.hedef - prod)

  // Reçete → hammadde bilgisi
  const rc = recipes.find(r => r.id === w.receteId)
  const hmSatirlar = (rc?.satirlar || []).filter((s: any) => s.tip === 'Hammadde' || s.tip === 'hammadde')

  // Stok hesapla
  function stokNet(malkod: string) {
    return stokHareketler.filter(h => h.malkod === malkod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
  }

  // Max yapılabilir (stok bazlı)
  function maxYapilabilir() {
    if (!hmSatirlar.length) return kalan
    let maxAdet = kalan
    for (const hm of hmSatirlar) {
      const birAdetIcin = (hm.miktar || 0) * (w.mpm || 1)
      if (birAdetIcin <= 0) continue
      const mevcut = stokNet(hm.malkod || hm.kod)
      const yapilabilir = Math.floor(mevcut / birAdetIcin)
      if (yapilabilir < maxAdet) maxAdet = yapilabilir
    }
    return Math.max(0, maxAdet)
  }

  const maxUretim = maxYapilabilir()

  // Çalışma süresi (dakika)
  function calismaSuresi() {
    if (!basla || !bitir) return 0
    const [bH, bM] = basla.split(':').map(Number)
    const [eH, eM] = bitir.split(':').map(Number)
    return (eH * 60 + eM) - (bH * 60 + bM)
  }

  const toplamDurus = duruslar.reduce((a, d) => a + (d.sure || 0), 0)

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
    const f = parseInt(fire) || 0
    // Validasyonlar
    if (q <= 0) { toast.error('Adet girin'); return }
    if (q > kalan) { toast.error(`Hedeften fazla üretilemez! Kalan: ${kalan}`); return }
    if (maxUretim <= 0 && hmSatirlar.length > 0) { toast.error('Stok yetersiz — üretim yapılamaz'); return }
    if (q > maxUretim && hmSatirlar.length > 0) { toast.error(`Stok yetersiz! En fazla ${maxUretim} adet üretilebilir`); return }
    if (!basla || !bitir) { toast.error('Başlama ve bitiş saati girin'); return }
    if (bitir < basla) { toast.error('Bitiş saati başlamadan önce olamaz'); return }
    const calisma = calismaSuresi()
    if (calisma <= 0) { toast.error('Çalışma süresi 0 olamaz'); return }
    if (toplamDurus > calisma) { toast.error(`Duruş süresi (${toplamDurus}dk) çalışma süresini (${calisma}dk) aşamaz`); return }

    setSaving(true)
    const logId = uid()

    await supabase.from('uys_logs').insert({
      id: logId, wo_id: woId, tarih: today(), qty: q, fire: f,
      operatorlar: [{ id: oprId, ad: oprAd, bas: basla, bit: bitir }],
      not_: aciklama, duruslar: duruslar.filter(d => d.kodId && d.sure > 0),
    })
    // Mamul stok girişi
    await supabase.from('uys_stok_hareketler').insert({
      id: uid(), malkod: w.malkod, malad: w.malad, miktar: q,
      tip: 'giris', kaynak: 'uretim', aciklama: `${w.ieNo} - ${oprAd}`,
      tarih: today(), log_id: logId, wo_id: woId,
    })
    // HM stok çıkışı (reçeteden)
    for (const hm of hmSatirlar) {
      const hmMiktar = (hm.miktar || 0) * (w.mpm || 1) * q
      if (hmMiktar > 0) {
        await supabase.from('uys_stok_hareketler').insert({
          id: uid(), malkod: hm.malkod || hm.kod, malad: hm.malad || hm.ad, miktar: hmMiktar,
          tip: 'cikis', kaynak: 'uretim-hm', aciklama: `${w.ieNo} HM tüketim`,
          tarih: today(), log_id: logId, wo_id: woId,
        })
      }
    }
    // Fire log
    if (f > 0) {
      await supabase.from('uys_fire_logs').insert({
        id: uid(), wo_id: woId, tarih: today(), miktar: f, opertor: oprAd, neden: aciklama || 'Operatör girişi',
      })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-accent/10 border-b border-accent/20 p-4 rounded-t-xl">
          <div className="font-mono text-accent text-xs font-bold">{w.ieNo}</div>
          <div className="text-sm font-semibold text-white mt-0.5">{w.malad}</div>
        </div>

        <div className="p-4 space-y-4">
          {/* Hedef/Yapılan/Kalan */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-bg-2 rounded-lg p-2"><div className="text-[10px] text-zinc-500">Hedef</div><div className="text-sm font-bold">{w.hedef}</div></div>
            <div className="bg-bg-2 rounded-lg p-2"><div className="text-[10px] text-green">Yapılan</div><div className="text-sm font-bold text-green">{prod}</div></div>
            <div className="bg-bg-2 rounded-lg p-2"><div className="text-[10px] text-amber">Kalan</div><div className="text-sm font-bold text-amber">{kalan}</div></div>
          </div>

          {/* Stok durumu */}
          {hmSatirlar.length > 0 && (
            <div className="bg-bg-2 border border-border rounded-lg p-3">
              <div className="text-[10px] text-zinc-500 font-semibold mb-2">HAMMADDE STOK</div>
              {hmSatirlar.map((hm: any, i: number) => {
                const mevcut = Math.round(stokNet(hm.malkod || hm.kod))
                const renk = mevcut <= 0 ? 'text-red' : mevcut < (hm.miktar || 0) * kalan ? 'text-amber' : 'text-green'
                return (
                  <div key={i} className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">{hm.malad || hm.ad}</span>
                    <span className={`font-mono font-bold ${renk}`}>{mevcut}</span>
                  </div>
                )
              })}
              {maxUretim < kalan && <div className="text-[10px] text-amber mt-2 font-semibold">⚠ Stok ile en fazla {maxUretim} adet üretilebilir</div>}
              {maxUretim <= 0 && <div className="text-[10px] text-red mt-2 font-bold">⛔ Stok yetersiz — üretim yapılamaz</div>}
            </div>
          )}

          {/* Başlama / Bitiş Saati */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">Başlama Saati</label>
              <input type="time" value={basla} onChange={e => setBasla(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">Bitiş Saati</label>
              <input type="time" value={bitir} onChange={e => setBitir(e.target.value)}
                className="w-full px-3 py-2.5 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
            </div>
          </div>
          {calismaSuresi() > 0 && <div className="text-[10px] text-zinc-500 text-center -mt-2">Çalışma: {calismaSuresi()} dk {toplamDurus > 0 ? `· Duruş: ${toplamDurus} dk · Net: ${calismaSuresi() - toplamDurus} dk` : ''}</div>}

          {/* Adet / Fire */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">Üretim Adedi *</label>
              <input type="number" value={qty} onChange={e => {
                const v = parseInt(e.target.value) || 0
                if (v > kalan) { setQty(String(kalan)); toast.error('Hedefe ulaşıldı: max ' + kalan) }
                else setQty(e.target.value)
              }} placeholder={String(Math.min(kalan, maxUretim))} max={kalan}
                className="w-full px-3 py-3 bg-bg-2 border border-border rounded-lg text-xl text-center font-bold text-white focus:outline-none focus:border-green" autoFocus />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">Fire</label>
              <input type="number" value={fire} onChange={e => setFire(e.target.value)} placeholder="0"
                className="w-full px-3 py-3 bg-bg-2 border border-border rounded-lg text-xl text-center font-bold text-red focus:outline-none focus:border-red" />
            </div>
          </div>

          {/* Açıklama */}
          <div>
            <label className="text-[10px] text-zinc-500 mb-1 block">Açıklama</label>
            <input value={aciklama} onChange={e => setAciklama(e.target.value)} placeholder="Opsiyonel..."
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none" />
          </div>

          {/* Duruş Kayıtları */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-zinc-500 font-semibold">DURUŞ KAYITLARI</label>
              <button onClick={addDurus} className="text-[10px] text-accent hover:underline font-semibold">+ Duruş Ekle</button>
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
                <button onClick={() => setDuruslar(p => p.filter((_, idx) => idx !== i))} className="text-red text-sm px-1">✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-3 bg-bg-3 text-zinc-400 rounded-lg text-sm font-semibold">İptal</button>
          <button onClick={save} disabled={saving || (maxUretim <= 0 && hmSatirlar.length > 0)}
            className="flex-1 py-3 bg-green hover:bg-green/80 text-black font-bold rounded-lg text-sm disabled:opacity-30">
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
