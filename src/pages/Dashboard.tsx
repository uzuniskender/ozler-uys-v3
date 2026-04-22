import { useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { showConfirm } from '@/lib/prompt'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store'
import { uid, today } from '@/lib/utils'
import { AlertTriangle, Clock, Package, MessageSquare, Truck, Cpu, Tag, CalendarX2, Bell, Database, ChevronRight } from 'lucide-react'
import { InactiveOperatorsCard } from '@/components/InactiveOperatorsCard'

/* ═══════════════════════════════════════════════════════════════
   IFS-style LIGHT Dashboard — v15.30 (F rewrite)
   Layout mantığı: app shell (topbar, sidebar) dark kalır;
   sadece bu sayfa light "ada" — kendi bg-gray-50 konteyneri içinde.
   Veri hesaplamaları eskiyle birebir aynı; sadece görsel yenilendi.
   ═══════════════════════════════════════════════════════════════ */

/* ── KPI tile ── */
function Kpi({ icon, label, value, sub, tone = 'neutral', onClick }: {
  icon: string; label: string; value: number | string; sub?: string
  tone?: 'neutral' | 'alert' | 'warn'
  onClick?: () => void
}) {
  const toneCls =
    tone === 'alert' ? 'border-red-200 bg-red-50 hover:border-red-300' :
    tone === 'warn' ? 'border-amber-200 bg-amber-50 hover:border-amber-300' :
    'border-gray-200 bg-white hover:border-gray-400'
  const valueCls =
    tone === 'alert' ? 'text-red-700' :
    tone === 'warn' ? 'text-amber-700' :
    'text-gray-900'
  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg border p-4 transition-all ${toneCls} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className="absolute top-3 right-3 text-sm opacity-50">{icon}</span>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">{label}</div>
      <div className={`text-2xl font-semibold font-mono tracking-tight ${valueCls}`}>{value}</div>
      {sub && <div className="text-[11px] mt-1 text-gray-500">{sub}</div>}
    </div>
  )
}

/* ── Panel (bölüm konteyneri) ── */
function Panel({ title, count, children, onTitleClick }: {
  title: React.ReactNode; count?: React.ReactNode
  children: React.ReactNode
  onTitleClick?: () => void
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div
        className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-100 ${onTitleClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
        onClick={onTitleClick}
      >
        <div className="text-[13px] font-semibold text-gray-700 tracking-tight">{title}</div>
        {count !== undefined && <div className="text-[11px] text-gray-500 font-mono">{count}</div>}
      </div>
      {children}
    </div>
  )
}

/* ── Workflow step ── */
function FlowStep({ icon, label, count, warn, onClick }: {
  icon: string; label: string; count: number; warn?: boolean; onClick: () => void
}) {
  const cls = warn
    ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
    : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-400'
  const valueCls = warn ? 'text-amber-700' : 'text-gray-900'
  return (
    <button onClick={onClick} className={`relative flex-1 min-w-0 rounded-md border p-2.5 text-left transition-all ${cls}`}>
      {warn && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">!</span>
      )}
      <div className="text-sm">{icon}</div>
      <div className="text-[10px] text-gray-600 font-medium mt-0.5 truncate">{label}</div>
      <div className={`text-base font-semibold font-mono ${valueCls}`}>{count}</div>
    </button>
  )
}

/* ── Alert item ── */
function AlertItem({ tone, children, action, onAction }: {
  tone: 'red' | 'amber'; children: React.ReactNode
  action?: string; onAction?: () => void
}) {
  const bg = tone === 'red' ? 'bg-red-50 border-l-red-500' : 'bg-amber-50 border-l-amber-500'
  const dotBg = tone === 'red' ? 'bg-red-500' : 'bg-amber-500'
  const actCls = tone === 'red' ? 'text-red-700 hover:text-red-900' : 'text-amber-700 hover:text-amber-900'
  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-md border-l-[3px] ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${dotBg}`} />
      <div className="flex-1 text-[12px] text-gray-700">{children}</div>
      {action && (
        <button onClick={onAction} className={`text-[11px] font-semibold whitespace-nowrap flex items-center gap-0.5 ${actCls}`}>
          {action} <ChevronRight size={11} />
        </button>
      )}
    </div>
  )
}

/* ── List row ── */
function ListRow({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2 text-[12px] border-b border-gray-100 last:border-b-0 ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
    >
      {children}
    </div>
  )
}

/* ── Section title ── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="block w-1 h-3 bg-blue-600 rounded-sm" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{children}</span>
    </div>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const {
    orders, workOrders, logs, operatorNotes, activeWork, operators,
    fireLogs, materials, stokHareketler, tedarikler, cuttingPlans,
    operations, sevkler, izinler, recipes, bomTrees, loadAll,
  } = useStore()
  const { isGuest, role } = useAuth()
  const todayStr = today()

  // ═══ Canlı sayaç — 30 sn'de bir süre güncellensin ═══
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // ═══ TEMEL HESAPLAMALAR (eskiyle birebir aynı) ═══
  const aktifOrders = orders.filter(o => {
    if (o.durum === 'iptal' || o.durum === 'tamamlandi') return false
    const wos = workOrders.filter(w => w.orderId === o.id)
    const totalProd = wos.reduce((s, w) => {
      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
      return s + (w.hedef > 0 ? Math.min(100, prod / w.hedef * 100) : 0)
    }, 0)
    const avgPct = wos.length ? totalProd / wos.length : 0
    return avgPct < 100
  })

  const terminGecen = aktifOrders.filter(o => o.termin && o.termin < todayStr)
  const acikWOs = workOrders.filter(w => {
    if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false
    const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    return w.hedef > 0 && prod < w.hedef
  })

  const bugunFire = fireLogs.filter(f => f.tarih === todayStr)
  const toplamFire = bugunFire.reduce((a, f) => a + f.qty, 0)
  const bekleyenTelafi = fireLogs.filter(f => !f.telafiWoId)
  const bekleyenTelafiAdet = bekleyenTelafi.reduce((a, f) => a + f.qty, 0)
  const okunmamis = operatorNotes.filter(n => !n.okundu && !(n.opAd || '').includes('Yönetim'))

  const gercekAktif = activeWork.filter(a => {
    const wo = workOrders.find(w => w.id === a.woId)
    if (!wo || wo.hedef <= 0) return false
    const prod = logs.filter(l => l.woId === a.woId).reduce((s, l) => s + l.qty, 0)
    return prod < wo.hedef
  })

  const mrpYapilmamis = useMemo(() => {
    return aktifOrders.filter(o =>
      o.receteId &&
      workOrders.some(w => w.orderId === o.id) &&
      (!o.mrpDurum || o.mrpDurum === 'bekliyor')
    ).length
  }, [aktifOrders, workOrders])

  const bugunIzinli = izinler.filter(iz =>
    iz.durum === 'onaylandi' && iz.baslangic <= todayStr && iz.bitis >= todayStr
  )
  const bekleyenIzinler = izinler.filter(iz => iz.durum === 'bekliyor')

  const durusIstSet = new Set<string>()
  const durusDetay: { istAd: string; durusAd: string; woAd: string }[] = []
  logs.filter(l => l.tarih === todayStr && Array.isArray(l.duruslar) && l.duruslar.length > 0).forEach(l => {
    const wo = workOrders.find(w => w.id === l.woId)
    if (wo?.istId) {
      durusIstSet.add(wo.istId)
      l.duruslar.forEach((d: { ad?: string; kod?: string }) => {
        durusDetay.push({ istAd: wo.istAd || wo.istKod || '—', durusAd: d.ad || d.kod || 'Duruş', woAd: wo.malad || wo.opAd || '—' })
      })
    }
  })

  const bekleyenTed = tedarikler.filter(t => !t.geldi)

  const nowDate = new Date()
  const dow = nowDate.getDay() || 7
  const mon = new Date(nowDate); mon.setDate(nowDate.getDate() - (dow - 1))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const monStr = mon.toISOString().slice(0, 10)
  const sunStr = sun.toISOString().slice(0, 10)
  const buHaftaSevk = sevkler.filter(s => s.tarih >= monStr && s.tarih <= sunStr)

  const bolumsuzOp = operations.filter(o => !o.bolum || o.bolum.trim() === '')
  const bolumsuzOpr = operators.filter(o => o.aktif !== false && (!o.bolum || o.bolum.trim() === ''))

  const kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH']
  const planliWoIds = new Set(cuttingPlans.flatMap(p => (p.satirlar || []).flatMap((s: { kesimler?: { woId?: string }[] }) => (s.kesimler || []).map((k) => k.woId))))
  const kesimEksik = workOrders.filter(w => {
    if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false
    const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    if (prod >= w.hedef) return false
    if (planliWoIds.has(w.id)) return false
    return kesimOps.some(k => (w.opAd || '').toUpperCase().includes(k))
  }).length
  const bekleyenKP = cuttingPlans.filter(p => p.durum !== 'tamamlandi').length

  const minStokUyari = materials.filter(m => {
    if (!m.minStok || m.minStok <= 0) return false
    const stok = stokHareketler.filter(h => h.malkod === m.kod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
    return stok < m.minStok
  })

  const lastBackup = typeof localStorage !== 'undefined' ? localStorage.getItem('uys_last_backup') : null
  const backupDays = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000) : -1
  const backupWarn = !lastBackup || backupDays >= 7

  const siparisCount = aktifOrders.length
  const recetesizCount = orders.filter(o => !o.receteId && aktifOrders.some(a => a.id === o.id)).length
  const ieBekleyenCount = orders.filter(o => o.receteId && !workOrders.some(w => w.orderId === o.id) && aktifOrders.some(a => a.id === o.id)).length
  const uretimCount = gercekAktif.length
  const sevkBekleyenCount = buHaftaSevk.length

  const chartData = useMemo(() => {
    const gunMap: Record<string, { gun: string; uretim: number; fire: number }> = {}
    logs.forEach(l => {
      if (!l.tarih) return
      if (!gunMap[l.tarih]) gunMap[l.tarih] = { gun: l.tarih.slice(5), uretim: 0, fire: 0 }
      gunMap[l.tarih].uretim += l.qty
      gunMap[l.tarih].fire += l.fire || 0
    })
    return Object.values(gunMap).sort((a, b) => a.gun.localeCompare(b.gun)).slice(-7)
  }, [logs])

  const aktifKartlar = useMemo(() => {
    return gercekAktif.map(a => {
      const wo = workOrders.find(w => w.id === a.woId)
      const prod = wo ? logs.filter(l => l.woId === wo.id).reduce((s, l) => s + l.qty, 0) : 0
      const hedef = wo?.hedef || 0
      const pct = hedef > 0 ? Math.min(100, Math.round(prod / hedef * 100)) : 0
      let dk = 0
      if (a.baslangic && a.tarih) {
        const bas = new Date(a.tarih + 'T' + a.baslangic + ':00').getTime()
        if (bas > 0) dk = Math.max(0, Math.floor((nowTick - bas) / 60000))
      }
      const saat = Math.floor(dk / 60)
      const mins = dk % 60
      const sureLabel = saat > 0 ? `${saat}s ${mins}dk` : `${mins}dk`
      const oprLogs = logs.filter(l => l.woId === a.woId)
      let sonLogDk = -1
      for (const l of oprLogs) {
        for (const o of (l.operatorlar || [])) {
          if (o.bit && l.tarih) {
            const t = new Date(l.tarih + 'T' + o.bit + ':00').getTime()
            if (t > 0) {
              const fark = Math.max(0, Math.floor((nowTick - t) / 60000))
              if (sonLogDk === -1 || fark < sonLogDk) sonLogDk = fark
            }
          }
        }
      }
      const uzunAcik = dk > 480
      const durgun = !uzunAcik && sonLogDk > 180 && dk > 60
      return { a, wo, prod, hedef, pct, dk, sureLabel, uzunAcik, durgun, sonLogDk }
    }).sort((a, b) => b.dk - a.dk)
  }, [gercekAktif, workOrders, logs, nowTick])

  const uzunSayi = aktifKartlar.filter(k => k.uzunAcik).length
  const durgunSayi = aktifKartlar.filter(k => k.durgun).length

  const alertCount = terminGecen.length + minStokUyari.length +
    (kesimEksik > 0 ? 1 : 0) + (mrpYapilmamis > 0 ? 1 : 0) +
    (bekleyenTed.length > 0 && mrpYapilmamis === 0 ? 1 : 0) +
    (bekleyenIzinler.length > 0 ? 1 : 0) + (backupWarn ? 1 : 0)

  const quickCards = useMemo(() => {
    const cards: { icon: string; label: string; sub: string; link: string; tone?: 'alert' | 'warn' | 'neutral' }[] = []
    if (role === 'admin' || role === 'planlama') {
      cards.push({ icon: '📋', label: 'Siparişler', sub: terminGecen.length > 0 ? `${terminGecen.length} termin geçmiş` : `${aktifOrders.length} aktif`, link: '/orders', tone: terminGecen.length > 0 ? 'alert' : 'neutral' })
      cards.push({ icon: '📊', label: 'MRP', sub: mrpYapilmamis > 0 ? `${mrpYapilmamis} bekliyor` : 'Güncel', link: '/mrp', tone: mrpYapilmamis > 0 ? 'warn' : 'neutral' })
      cards.push({ icon: '✂️', label: 'Kesim Planı', sub: kesimEksik > 0 ? `${kesimEksik} planlanmadı` : bekleyenKP > 0 ? `${bekleyenKP} plan aktif` : 'Tamam', link: '/cutting', tone: kesimEksik > 0 ? 'warn' : 'neutral' })
      cards.push({ icon: '🌳', label: 'Ürün Ağacı', sub: `${bomTrees.length} ağaç`, link: '/bom' })
      cards.push({ icon: '📑', label: 'Reçeteler', sub: `${recipes.length}`, link: '/recipes' })
    }
    if (role === 'admin' || role === 'uretim_sor') {
      cards.push({ icon: '⚙', label: 'İş Emirleri', sub: ieBekleyenCount > 0 ? `${ieBekleyenCount} oluşmadı` : `${acikWOs.length} açık`, link: '/work-orders', tone: ieBekleyenCount > 0 ? 'warn' : 'neutral' })
      cards.push({ icon: '🔧', label: 'Üretim', sub: `${uretimCount} aktif`, link: '/production' })
      cards.push({ icon: '📈', label: 'Raporlar', sub: 'Analiz', link: '/reports' })
    }
    if (role === 'admin' || role === 'depocu') {
      cards.push({ icon: '📦', label: 'Stok / Depo', sub: minStokUyari.length > 0 ? `⚠ ${minStokUyari.length} min altı` : `${materials.length} malzeme`, link: '/warehouse', tone: minStokUyari.length > 0 ? 'alert' : 'neutral' })
      cards.push({ icon: '🚚', label: 'Tedarik', sub: bekleyenTed.length > 0 ? `${bekleyenTed.length} bekliyor` : 'Tamam', link: '/procurement', tone: bekleyenTed.length > 0 ? 'warn' : 'neutral' })
      cards.push({ icon: '📋', label: 'Malzemeler', sub: 'Katalog', link: '/materials' })
      cards.push({ icon: '🚢', label: 'Sevkiyat', sub: `${sevkBekleyenCount} bu hafta`, link: '/shipment' })
    }
    if (role === 'admin') {
      cards.push({ icon: '⚙️', label: 'Veri Yönetimi', sub: 'Ayarlar', link: '/data' })
    }
    return cards.filter((c, i, arr) => arr.findIndex(x => x.link === c.link) === i).slice(0, 12)
  }, [role, terminGecen.length, aktifOrders.length, mrpYapilmamis, kesimEksik, bekleyenKP, bomTrees.length, recipes.length, ieBekleyenCount, acikWOs.length, uretimCount, minStokUyari.length, materials.length, bekleyenTed.length, sevkBekleyenCount])

  async function tedarikOlustur() {
    if (!await showConfirm(`${minStokUyari.length} malzeme için tedarik önerisi oluşturulsun mu?`)) return
    let count = 0
    for (const m of minStokUyari) {
      const stok = stokHareketler.filter(h => h.malkod === m.kod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
      const eksik = Math.max(0, m.minStok - stok)
      if (eksik <= 0) continue
      await supabase.from('uys_tedarikler').insert({
        id: uid(), malkod: m.kod, malad: m.ad, miktar: Math.ceil(eksik),
        birim: m.birim || 'Adet', tarih: today(), durum: 'bekliyor', geldi: false,
        not_: 'Min stok önerisi', siparis_no: '',
      })
      count++
    }
    loadAll(); toast.success(count + ' tedarik önerisi oluşturuldu')
  }

  return (
    <div className="bg-gray-50 text-gray-900 -m-4 lg:-m-6 p-4 lg:p-6 min-h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Genel Durum</h1>
          <div className="text-[12px] text-gray-500 font-mono mt-0.5">
            {todayStr} · {aktifOrders.length} aktif sipariş · {acikWOs.length} açık İE
          </div>
        </div>
        <div className="flex gap-2">
          {terminGecen.length > 0 && (
            <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-md text-[12px] text-red-700 font-semibold flex items-center gap-1.5">
              <AlertTriangle size={12} /> {terminGecen.length} termin geçmiş
            </div>
          )}
          {okunmamis.length > 0 && (
            <button onClick={() => navigate('/messages')} className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-[12px] text-amber-700 font-semibold flex items-center gap-1.5 hover:bg-amber-100 transition">
              <MessageSquare size={12} /> {okunmamis.length} yeni mesaj
            </button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <SectionTitle>Anahtar Göstergeler</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Kpi icon="📋" label="Aktif Sipariş" value={aktifOrders.length} sub={`${acikWOs.length} açık İE`} onClick={() => navigate('/orders')} />
        <Kpi icon="⚙" label="Açık İş Emri" value={acikWOs.length} sub={ieBekleyenCount > 0 ? `${ieBekleyenCount} oluşturulmadı` : 'tüm sipariş İE\'li'} tone={ieBekleyenCount > 0 ? 'warn' : 'neutral'} onClick={() => navigate('/work-orders')} />
        <Kpi icon="🔧" label="Aktif Çalışma" value={uretimCount} sub={uretimCount > 0 ? 'canlı · 30sn' : 'bekliyor'} onClick={() => navigate('/production')} />
        <Kpi icon="🔥" label="Bugün Fire" value={toplamFire || '—'} sub={bekleyenTelafiAdet > 0 ? `${bekleyenTelafiAdet} telafi bekliyor` : 'temiz'} tone={toplamFire > 0 ? 'warn' : 'neutral'} onClick={() => navigate('/reports')} />
        <Kpi icon="📦" label="Min Stok Altı" value={minStokUyari.length || '—'} sub={minStokUyari.length > 0 ? 'tedarik oluştur →' : 'temiz'} tone={minStokUyari.length > 0 ? 'alert' : 'neutral'} onClick={() => navigate('/warehouse')} />
        <Kpi icon="🚚" label="Bu Hafta Sevk" value={sevkBekleyenCount || '—'} sub={`${monStr.slice(5)}–${sunStr.slice(5)}`} onClick={() => navigate('/shipment')} />
      </div>

      {/* Workflow + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <Panel title="Üretim Akışı" count="hat durumu">
            <div className="p-3">
              <div className="grid grid-cols-7 gap-1.5">
                <FlowStep icon="📋" label="Sipariş" count={siparisCount} warn={recetesizCount > 0} onClick={() => navigate('/orders')} />
                <FlowStep icon="📑" label="Reçete" count={recipes.length} warn={recetesizCount > 0} onClick={() => navigate('/recipes')} />
                <FlowStep icon="⚙" label="İş Emri" count={acikWOs.length} warn={ieBekleyenCount > 0} onClick={() => navigate('/work-orders')} />
                <FlowStep icon="✂️" label="Kesim" count={kesimEksik > 0 ? kesimEksik : bekleyenKP} warn={kesimEksik > 0} onClick={() => navigate('/cutting')} />
                <FlowStep icon="📊" label="MRP" count={mrpYapilmamis} warn={mrpYapilmamis > 0} onClick={() => navigate('/mrp')} />
                <FlowStep icon="🔧" label="Üretim" count={uretimCount} onClick={() => navigate('/production')} />
                <FlowStep icon="🚚" label="Sevk" count={sevkBekleyenCount} onClick={() => navigate('/shipment')} />
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Uyarılar" count={alertCount > 0 ? `${alertCount} aktif` : 'temiz'}>
          <div className="p-3 space-y-2">
            {alertCount === 0 ? (
              <div className="text-[12px] text-gray-500 text-center py-6">✓ Tüm sistem temiz</div>
            ) : (
              <>
                {terminGecen.length > 0 && (
                  <AlertItem tone="red" action="Git" onAction={() => navigate('/orders')}>
                    <strong>{terminGecen.length} sipariş</strong> termin geçmiş
                  </AlertItem>
                )}
                {minStokUyari.length > 0 && (
                  <AlertItem tone="red" action="Tedarik" onAction={tedarikOlustur}>
                    <strong>{minStokUyari.length} malzeme</strong> min stok altında
                  </AlertItem>
                )}
                {kesimEksik > 0 && (
                  <AlertItem tone="amber" action="Planla" onAction={() => navigate('/cutting')}>
                    <strong>{kesimEksik} İE</strong> kesim planına dahil edilmemiş
                  </AlertItem>
                )}
                {mrpYapilmamis > 0 && (
                  <AlertItem tone="amber" action="Hesapla" onAction={() => navigate('/mrp')}>
                    <strong>{mrpYapilmamis} sipariş</strong> MRP yapılmadı
                  </AlertItem>
                )}
                {bekleyenTed.length > 0 && mrpYapilmamis === 0 && (
                  <AlertItem tone="amber" action="Takip" onAction={() => navigate('/procurement')}>
                    <strong>{bekleyenTed.length} tedarik</strong> bekliyor
                  </AlertItem>
                )}
                {bekleyenIzinler.length > 0 && (
                  <AlertItem tone="amber" action="İncele" onAction={() => navigate('/operators')}>
                    <strong>{bekleyenIzinler.length} izin</strong> onay bekliyor
                  </AlertItem>
                )}
                {backupWarn && (
                  <AlertItem tone="amber" action="Yedek" onAction={() => navigate('/data')}>
                    {lastBackup ? <>Son yedek <strong>{backupDays} gün</strong> önce</> : <>Henüz yedek alınmamış</>}
                  </AlertItem>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* Chart + Sevkler */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Panel title="Son 7 Gün Üretim" count={
          <span className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-sm" />üretim</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm" />fire</span>
          </span>
        }>
          <div className="p-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <XAxis dataKey="gun" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} width={32} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }} cursor={{ fill: '#f3f4f6' }} />
                  <Bar dataKey="uretim" fill="#10b981" radius={[3, 3, 0, 0]} name="Üretim" />
                  <Bar dataKey="fire" fill="#ef4444" radius={[3, 3, 0, 0]} name="Fire" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-[12px] text-gray-500 py-10">Henüz üretim kaydı yok</div>
            )}
          </div>
        </Panel>

        <Panel title="Bu Haftanın Sevkleri" count={`${buHaftaSevk.length} sevk · ${monStr.slice(5)}–${sunStr.slice(5)}`} onTitleClick={() => navigate('/shipment')}>
          {buHaftaSevk.length > 0 ? (
            <div>
              {buHaftaSevk.slice(0, 6).map(s => (
                <ListRow key={s.id} onClick={() => navigate('/shipment')}>
                  <Truck size={12} className="text-blue-500" />
                  <span className="text-blue-600 font-mono text-[11px]">{s.tarih?.slice(5) || '—'}</span>
                  <span className="text-blue-600 font-mono">{s.siparisNo}</span>
                  <span className="text-gray-700 flex-1 truncate">{s.musteri || '—'}</span>
                  <span className="text-gray-500 text-[11px]">{(s.kalemler || []).length} kalem</span>
                </ListRow>
              ))}
              {buHaftaSevk.length > 6 && (
                <div className="px-4 py-2 text-[11px] text-gray-500 border-t border-gray-100">+{buHaftaSevk.length - 6} daha</div>
              )}
            </div>
          ) : (
            <div className="text-center text-[12px] text-gray-500 py-10">Bu hafta planlanmış sevk yok</div>
          )}
        </Panel>
      </div>

      {/* Aktif Çalışmalar */}
      {gercekAktif.length > 0 && (
        <div className="mb-6">
          <Panel title={
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Aktif Çalışmalar — Canlı ({gercekAktif.length})</span>
              {uzunSayi > 0 && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-mono">⏰ {uzunSayi} uzun</span>}
              {durgunSayi > 0 && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-mono">⌛ {durgunSayi} durgun</span>}
            </span>
          } count="her 30sn güncellenir">
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {aktifKartlar.map(({ a, wo, prod, hedef, pct, sureLabel, uzunAcik, durgun, sonLogDk }) => {
                const cardCls = uzunAcik ? 'border-red-300 bg-red-50' : durgun ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
                const barCls = uzunAcik ? 'bg-red-500' : durgun ? 'bg-amber-500' : pct >= 50 ? 'bg-blue-600' : 'bg-gray-400'
                const sureCls = uzunAcik ? 'text-red-700 font-semibold' : durgun ? 'text-amber-700 font-semibold' : 'text-gray-700'
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate('/operator?oprId=' + a.opId)}
                    className={`p-3 rounded-md border cursor-pointer transition hover:shadow-sm ${cardCls}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-gray-900 truncate flex-1">{a.opAd}</span>
                      {wo?.istAd && <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] text-gray-600 whitespace-nowrap">{wo.istAd}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mb-1 text-[11px]">
                      <span className="font-mono text-blue-600">{wo?.ieNo || '—'}</span>
                      {wo?.opAd && <span className="text-gray-500">· {wo.opAd}</span>}
                    </div>
                    <div className="text-[11px] text-gray-600 truncate mb-2" title={a.woAd}>{a.woAd}</div>
                    {hedef > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-[10px] font-mono mb-1">
                          <span className="text-gray-500">{prod} / {hedef}</span>
                          <span className={pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-blue-600' : 'text-gray-500'}>%{pct}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barCls}`} style={{ width: pct + '%' }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] font-mono pt-1.5 border-t border-gray-200">
                      <Clock size={10} className={uzunAcik ? 'text-red-600' : durgun ? 'text-amber-600' : 'text-gray-500'} />
                      <span className={sureCls}>{sureLabel}</span>
                      <span className="text-gray-400">· {a.baslangic}</span>
                      {sonLogDk >= 0 && durgun && (
                        <span className="ml-auto text-amber-700 text-[10px]">giriş yok: {Math.floor(sonLogDk / 60)}s+</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* Personnel + Duruş + InactiveOps */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <Panel title="Bugün İzinli / Raporlu" count={bugunIzinli.length || '—'} onTitleClick={() => navigate('/operators')}>
          {bugunIzinli.length > 0 ? (
            <div>
              {bugunIzinli.map(iz => {
                const tagCls = iz.tip === 'rapor' ? 'bg-red-100 text-red-700' : iz.tip === 'mesai' ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-700'
                return (
                  <ListRow key={iz.id}>
                    <CalendarX2 size={12} className="text-gray-400" />
                    <span className="text-gray-900 font-medium">{iz.opAd}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${tagCls}`}>{iz.tip}</span>
                    <span className="ml-auto font-mono text-gray-500 text-[11px]">
                      {iz.saatBaslangic && iz.saatBitis ? `${iz.saatBaslangic}–${iz.saatBitis}` : `${iz.baslangic}–${iz.bitis}`}
                    </span>
                  </ListRow>
                )
              })}
            </div>
          ) : (
            <div className="text-center text-[12px] text-gray-500 py-6">Bugün izinli kimse yok</div>
          )}
        </Panel>

        <Panel title="Bugün Duruşlu İstasyonlar" count={durusIstSet.size || '—'} onTitleClick={() => navigate('/stations')}>
          {durusDetay.length > 0 ? (
            <div>
              {durusDetay.slice(0, 6).map((d, i) => (
                <ListRow key={i}>
                  <Cpu size={12} className="text-gray-400" />
                  <span className="text-gray-900 font-semibold">{d.istAd}</span>
                  <span className="text-red-600 text-[11px]">{d.durusAd}</span>
                  <span className="text-gray-500 truncate ml-auto text-[11px]">{d.woAd}</span>
                </ListRow>
              ))}
              {durusDetay.length > 6 && <div className="px-4 py-1.5 text-[11px] text-gray-500 border-t border-gray-100">+{durusDetay.length - 6} daha</div>}
            </div>
          ) : (
            <div className="text-center text-[12px] text-gray-500 py-6">Duruş kaydı yok</div>
          )}
        </Panel>

        <InactiveOperatorsCard />
      </div>

      {/* Bekleyen İzin Talepleri */}
      {bekleyenIzinler.length > 0 && (
        <div className="mb-6">
          <Panel title="Onay Bekleyen İzin Talepleri" count={bekleyenIzinler.length} onTitleClick={() => navigate('/operators')}>
            <div>
              {bekleyenIzinler.map(iz => (
                <ListRow key={iz.id} onClick={() => navigate('/operators')}>
                  <Bell size={12} className="text-amber-500" />
                  <span className="text-gray-900 font-medium">{iz.opAd}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">{iz.tip}</span>
                  <span className="font-mono text-gray-500 text-[11px]">{iz.baslangic} — {iz.bitis}</span>
                  <span className="ml-auto text-[11px] text-amber-700 font-semibold">⏳ Onay Bekliyor</span>
                </ListRow>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Termin Geçmiş detay */}
      {terminGecen.length > 0 && (
        <div className="mb-6">
          <Panel title="🚨 Termini Geçmiş Siparişler" count={terminGecen.length}>
            <div>
              {terminGecen.map(o => (
                <ListRow key={o.id} onClick={() => navigate('/orders')}>
                  <AlertTriangle size={12} className="text-red-500" />
                  <span className="font-mono text-blue-600">{o.siparisNo}</span>
                  <span className="text-gray-700 flex-1">{o.musteri || '—'}</span>
                  <span className="font-mono text-red-600 text-[11px]">{o.termin}</span>
                </ListRow>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Min Stok detay */}
      {minStokUyari.length > 0 && (
        <div className="mb-6">
          <Panel
            title="⚠ Minimum Stok Altı Malzemeler"
            count={
              <button onClick={tedarikOlustur} className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-semibold">
                Toplu Tedarik Oluştur
              </button>
            }
          >
            <div>
              {minStokUyari.slice(0, 8).map(m => (
                <ListRow key={m.id} onClick={() => navigate('/materials')}>
                  <Package size={12} className="text-amber-500" />
                  <span className="font-mono text-blue-600">{m.kod}</span>
                  <span className="text-gray-700 flex-1">{m.ad}</span>
                  <span className="font-mono text-red-600 text-[11px]">Min: {m.minStok}</span>
                </ListRow>
              ))}
              {minStokUyari.length > 8 && <div className="px-4 py-1.5 text-[11px] text-gray-500 border-t border-gray-100">+{minStokUyari.length - 8} daha</div>}
            </div>
          </Panel>
        </div>
      )}

      {/* Bölüm Tanımlanmamış */}
      {(bolumsuzOpr.length > 0 || bolumsuzOp.length > 0) && (
        <div className="mb-6">
          <Panel title="Bölüm Tanımlanmamış" count={bolumsuzOp.length + bolumsuzOpr.length}>
            <div className="p-3 space-y-3">
              {bolumsuzOp.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-1.5 font-semibold uppercase tracking-wider">Operasyonlar ({bolumsuzOp.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {bolumsuzOp.slice(0, 10).map(o => (
                      <span key={o.id} className="text-[11px] px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700 cursor-pointer hover:bg-amber-100" onClick={() => navigate('/operations')}>
                        <Tag size={9} className="inline mr-1" />{o.kod} — {o.ad}
                      </span>
                    ))}
                    {bolumsuzOp.length > 10 && <span className="text-[11px] text-gray-500">+{bolumsuzOp.length - 10}</span>}
                  </div>
                </div>
              )}
              {bolumsuzOpr.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-1.5 font-semibold uppercase tracking-wider">Operatörler ({bolumsuzOpr.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {bolumsuzOpr.slice(0, 10).map(o => (
                      <span key={o.id} className="text-[11px] px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700 cursor-pointer hover:bg-amber-100" onClick={() => navigate('/operators')}>
                        {o.ad}
                      </span>
                    ))}
                    {bolumsuzOpr.length > 10 && <span className="text-[11px] text-gray-500">+{bolumsuzOpr.length - 10}</span>}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Okunmamış Mesajlar */}
      {okunmamis.length > 0 && (
        <div className="mb-6">
          <Panel title="Okunmamış Operatör Mesajları" count={okunmamis.length} onTitleClick={() => navigate('/messages')}>
            <div className="p-3 space-y-2">
              {okunmamis.slice(0, 5).map(n => (
                <div key={n.id} className="bg-gray-50 border border-gray-200 rounded-md p-3 text-[12px]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={12} className="text-amber-500" />
                      <span className="font-semibold text-gray-900">{n.opAd}</span>
                      <span className="text-[10px] text-gray-500">{n.tarih}</span>
                    </div>
                    <button onClick={() => navigate('/messages')} className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold">Cevapla →</button>
                  </div>
                  <div className="text-gray-700">{n.mesaj}</div>
                </div>
              ))}
              {okunmamis.length > 5 && <div className="text-[11px] text-gray-500 text-center">+{okunmamis.length - 5} mesaj daha</div>}
            </div>
          </Panel>
        </div>
      )}

      {/* Quick Access */}
      {role !== 'guest' && role !== 'operator' && quickCards.length > 0 && (
        <div className="mb-2">
          <SectionTitle>{`Hızlı Erişim${role !== 'admin' ? ` — ${role === 'uretim_sor' ? 'Üretim Sorumlusu' : role === 'planlama' ? 'Planlama' : 'Depocu'}` : ''}`}</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickCards.map(c => {
              const cls =
                c.tone === 'alert' ? 'border-red-200 bg-red-50 hover:border-red-300' :
                c.tone === 'warn' ? 'border-amber-200 bg-amber-50 hover:border-amber-300' :
                'border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50'
              const sublabelCls =
                c.tone === 'alert' ? 'text-red-700' :
                c.tone === 'warn' ? 'text-amber-700' :
                'text-gray-500'
              return (
                <button
                  key={c.link}
                  onClick={() => navigate(c.link)}
                  className={`rounded-lg border p-3 text-left transition-all ${cls}`}
                >
                  <div className="text-lg mb-1">{c.icon}</div>
                  <div className="text-[12px] font-semibold text-gray-900">{c.label}</div>
                  <div className={`text-[10px] mt-0.5 truncate ${sublabelCls}`}>{c.sub}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Guest notice */}
      {isGuest && (
        <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md text-[12px] text-blue-800 flex items-center gap-2">
          <Database size={14} />
          Misafir modundasınız — okuma erişimi aktif, yazma erişimi kapalı.
        </div>
      )}

    </div>
  )
}
