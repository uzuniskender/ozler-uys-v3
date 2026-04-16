import { useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { showConfirm, showPrompt } from '@/lib/prompt'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store'
import { uid, today, pctColor } from '@/lib/utils'
import { AlertTriangle, Clock, Package, Flame, MessageSquare, Wrench, CheckCircle, XCircle, ArrowRight, Truck, UserX, Cpu, Tag, CalendarX2, Bell } from 'lucide-react'

/* ── Akış Kartı ── */
const FLOW_COLORS: Record<string, { text: string; border: string; borderHover: string; bg: string; ring: string }> = {
  accent:      { text: 'text-accent',      border: 'border-accent/20',      borderHover: 'hover:border-accent/50',      bg: 'bg-accent/20',      ring: 'border-accent/50 ring-accent/30' },
  cyan:        { text: 'text-cyan',        border: 'border-cyan/20',        borderHover: 'hover:border-cyan/50',        bg: 'bg-cyan/20',        ring: 'border-cyan/50 ring-cyan/30' },
  amber:       { text: 'text-amber',       border: 'border-amber/20',       borderHover: 'hover:border-amber/50',       bg: 'bg-amber/20',       ring: 'border-amber/50 ring-amber/30' },
  green:       { text: 'text-green',       border: 'border-green/20',       borderHover: 'hover:border-green/50',       bg: 'bg-green/20',       ring: 'border-green/50 ring-green/30' },
  red:         { text: 'text-red',         border: 'border-red/20',         borderHover: 'hover:border-red/50',         bg: 'bg-red/20',         ring: 'border-red/50 ring-red/30' },
  'zinc-300':  { text: 'text-zinc-300',    border: 'border-zinc-600/30',    borderHover: 'hover:border-zinc-500/50',    bg: 'bg-zinc-600/20',    ring: 'border-zinc-500/50 ring-zinc-500/30' },
  'zinc-500':  { text: 'text-zinc-500',    border: 'border-zinc-700/30',    borderHover: 'hover:border-zinc-600/50',    bg: 'bg-zinc-700/20',    ring: 'border-zinc-600/50 ring-zinc-600/30' },
  'blue-400':  { text: 'text-blue-400',    border: 'border-blue-400/20',    borderHover: 'hover:border-blue-400/50',    bg: 'bg-blue-400/20',    ring: 'border-blue-400/50 ring-blue-400/30' },
  'cyan-400':  { text: 'text-cyan-400',    border: 'border-cyan-400/20',    borderHover: 'hover:border-cyan-400/50',    bg: 'bg-cyan-400/20',    ring: 'border-cyan-400/50 ring-cyan-400/30' },
  'purple-400':{ text: 'text-purple-400',  border: 'border-purple-400/20',  borderHover: 'hover:border-purple-400/50',  bg: 'bg-purple-400/20',  ring: 'border-purple-400/50 ring-purple-400/30' },
}
function flowColor(c: string) { return FLOW_COLORS[c] || FLOW_COLORS.accent }

function FlowCard({ icon, label, count, sublabel, warning, color, onClick }: {
  icon: string; label: string; count: number; sublabel: string; warning?: boolean; color: string; onClick: () => void
}) {
  const c = flowColor(color)
  return (
    <button
      onClick={onClick}
      className={`relative bg-bg-2 border rounded-lg p-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
        warning ? `${c.ring} ring-1` : `${c.border} ${c.borderHover}`
      }`}
      style={warning ? { animation: 'wfPulse 1.5s ease-in-out infinite' } : undefined}
    >
      <div className="flex items-start justify-between mb-1">
        <span className="text-2xl leading-none">{icon}</span>
        {warning && <span className={`text-[9px] ${c.bg} ${c.text} px-1.5 py-0.5 rounded font-bold`}>!</span>}
      </div>
      <div className={`text-xl font-bold font-mono ${c.text} mt-1`}>{count}</div>
      <div className={`text-[11px] font-semibold ${c.text}`}>{label}</div>
      <div className="text-[9px] text-zinc-500 truncate mt-0.5">{sublabel}</div>
    </button>
  )
}

/* ── Akış Oku ── */
function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-zinc-600">
      <ArrowRight size={20} />
    </div>
  )
}

/* ── Hızlı Erişim Kartı ── */
function QuickCard({ icon, label, sub, color, onClick }: { icon: string; label: string; sub: string; color: string; onClick: () => void }) {
  const c = flowColor(color)
  return (
    <button onClick={onClick} className={`bg-bg-2 border ${c.border} ${c.borderHover} rounded-xl p-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-xs font-bold ${c.text} mb-0.5`}>{label}</div>
      <div className="text-[10px] text-zinc-500 truncate">{sub}</div>
    </button>
  )
}

/* ── #2: Tıklanabilir Stat Card ── */
function StatCard({ value, label, color, icon: Icon, onClick }: {
  value: number | string; label: string; color: string; icon: React.ElementType; onClick?: () => void
}) {
  const isZero = value === 0 || value === '—'
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-bg-1 border border-border rounded-xl p-4 hover:border-${color}/40 transition-all group ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}
    >
      <div className={`absolute top-0 right-0 w-16 h-16 bg-${color}/8 rounded-bl-[40px] group-hover:bg-${color}/15 transition-colors`} />
      <Icon size={16} className={`text-${color} mb-2`} />
      <div className={`text-2xl font-bold font-mono ${isZero ? 'text-zinc-500' : 'text-white'}`}>{value}</div>
      <div className={`text-[11px] font-semibold mt-0.5 ${isZero ? 'text-zinc-600' : `text-${color}`}`}>{label}</div>
    </div>
  )
}

/* ── #8: Workflow Adım Butonu (yanıp sönen) ── */
function WorkflowBtn({ icon, label, count, color, pulse, onClick }: {
  icon: string; label: string; count: number; color: string; pulse: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'bg-bg-2 border rounded-lg p-3 text-left transition-all',
        pulse
          ? `border-${color}/50 ring-1 ring-${color}/30`
          : `border-${color}/20 hover:bg-${color}/5`,
      ].join(' ')}
      style={pulse ? { animation: 'wfPulse 1.5s ease-in-out infinite' } : undefined}
    >
      <div className={`text-[10px] text-${color} mb-1 flex items-center gap-1`}>
        <span>{icon}</span>
        <span className="font-semibold">{label}</span>
        {pulse && <span className={`ml-auto text-[9px] bg-${color}/20 px-1.5 py-px rounded font-bold tracking-wide`}>YAPILMALI</span>}
      </div>
      <div className={`text-lg font-mono text-${color}`}>{count}</div>
    </button>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const {
    orders, workOrders, logs, operatorNotes, activeWork, operators,
    fireLogs, materials, stokHareketler, tedarikler, cuttingPlans,
    operations, stations, sevkler, izinler, recipes, bomTrees, loadAll,
  } = useStore()
  const { can, isGuest, role } = useAuth()
  const todayStr = today()

  // ═══ Canlı sayaç — 30 sn'de bir süre güncellensin ═══
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // ═══ TEMEL HESAPLAMALAR ═══
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
  const okunmamis = operatorNotes.filter(n => !n.okundu && !(n.opAd || '').includes('Yönetim'))

  // Tamamlanmış İE'lerin aktif çalışma hayaletlerini filtrele
  const gercekAktif = activeWork.filter(a => {
    const wo = workOrders.find(w => w.id === a.woId)
    if (!wo || wo.hedef <= 0) return false
    const prod = logs.filter(l => l.woId === a.woId).reduce((s, l) => s + l.qty, 0)
    return prod < wo.hedef
  })

  // ═══ #1: MRP yapılmamış siparişler ═══
  // Koşul: reçetesi bağlı + aktif + İE var + mrpDurum boş/bekliyor
  const mrpYapilmamis = useMemo(() => {
    return aktifOrders.filter(o =>
      o.receteId &&
      workOrders.some(w => w.orderId === o.id) &&
      (!o.mrpDurum || o.mrpDurum === 'bekliyor')
    ).length
  }, [aktifOrders, workOrders])

  // ═══ #3: Giriş yapmayan operatörler ═══
  const bugunLogOprIds = new Set(
    logs.filter(l => l.tarih === todayStr).flatMap(l =>
      (Array.isArray(l.operatorlar) ? l.operatorlar : []).map((o: any) => o.id)
    )
  )
  const aktifOps = operators.filter(o => o.aktif !== false)
  // Bugün izinli/raporlu operatörler (onaylanmış)
  const bugunIzinli = izinler.filter(iz =>
    iz.durum === 'onaylandi' && iz.baslangic <= todayStr && iz.bitis >= todayStr
  )
  const izinliIds = new Set(bugunIzinli.map(iz => iz.opId))
  const girmeyenler = aktifOps.filter(o => !bugunLogOprIds.has(o.id) && !izinliIds.has(o.id))
  // Onay bekleyen izin talepleri
  const bekleyenIzinler = izinler.filter(iz => iz.durum === 'bekliyor')

  // ═══ #4: Bugün duruş yaşayan istasyonlar ═══
  const durusIstSet = new Set<string>()
  const durusDetay: { istAd: string; durusAd: string; woAd: string }[] = []
  logs.filter(l => l.tarih === todayStr && Array.isArray(l.duruslar) && l.duruslar.length > 0).forEach(l => {
    const wo = workOrders.find(w => w.id === l.woId)
    if (wo?.istId) {
      durusIstSet.add(wo.istId)
      l.duruslar.forEach((d: any) => {
        durusDetay.push({ istAd: wo.istAd || wo.istKod || '—', durusAd: d.ad || d.kod || 'Duruş', woAd: wo.malad || wo.opAd || '—' })
      })
    }
  })

  // ═══ #5: Tedarik bekleyen ═══
  const bekleyenTed = tedarikler.filter(t => !t.geldi)

  // ═══ #6: Bu haftanın sevkleri ═══
  const nowDate = new Date()
  const dow = nowDate.getDay() || 7
  const mon = new Date(nowDate); mon.setDate(nowDate.getDate() - (dow - 1))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const monStr = mon.toISOString().slice(0, 10)
  const sunStr = sun.toISOString().slice(0, 10)
  const buHaftaSevk = sevkler.filter(s => s.tarih >= monStr && s.tarih <= sunStr)

  // ═══ #7: Bölüm tanımlanmamış ═══
  const bolumsuzOp = operations.filter(o => !o.bolum || o.bolum.trim() === '')
  const bolumsuzOpr = operators.filter(o => o.aktif !== false && (!o.bolum || o.bolum.trim() === ''))

  // ═══ #8: Akıllı workflow ═══
  const kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH']
  const planliWoIds = new Set(cuttingPlans.flatMap(p => (p.satirlar || []).flatMap((s: any) => (s.kesimler || []).map((k: any) => k.woId))))
  const kesimEksik = workOrders.filter(w => {
    if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false
    const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    if (prod >= w.hedef) return false
    if (planliWoIds.has(w.id)) return false
    return kesimOps.some(k => (w.opAd || '').toUpperCase().includes(k))
  }).length
  const bekleyenKP = cuttingPlans.filter(p => p.durum !== 'tamamlandi').length

  const pulseKesim = kesimEksik > 0
  const pulseMRP = mrpYapilmamis > 0
  const pulseTedarik = bekleyenTed.length > 0 && mrpYapilmamis === 0

  // Min stok
  const minStokUyari = materials.filter(m => {
    if (!m.minStok || m.minStok <= 0) return false
    const stok = stokHareketler.filter(h => h.malkod === m.kod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
    return stok < m.minStok
  })

  // ═══ Üretim Akış Şeması verileri ═══
  const siparisCount = aktifOrders.length
  const recetesizCount = orders.filter(o => !o.receteId && aktifOrders.some(a => a.id === o.id)).length
  const ieBekleyenCount = orders.filter(o => o.receteId && !workOrders.some(w => w.orderId === o.id) && aktifOrders.some(a => a.id === o.id)).length
  const uretimCount = gercekAktif.length
  const sevkBekleyenCount = buHaftaSevk.length
  const tamamlananIE = workOrders.filter(w => {
    const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    return w.hedef > 0 && prod >= w.hedef && w.durum !== 'iptal'
  }).length

  return (
    <div>
      <style>{`@keyframes wfPulse { 0%,100% { opacity:1; box-shadow:0 0 4px rgba(250,204,21,0.1) } 50% { opacity:.82; box-shadow:0 0 20px rgba(250,204,21,0.25) } }`}</style>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Genel Durum</h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">{todayStr} · {aktifOrders.length} aktif sipariş · {acikWOs.length} açık İE</p>
        </div>
        <div className="flex gap-2">
          {terminGecen.length > 0 && <div className="px-3 py-1.5 bg-red/10 border border-red/20 rounded-lg text-[11px] text-red font-semibold animate-pulse">⚠ {terminGecen.length} termin geçmiş</div>}
          {okunmamis.length > 0 && <div className="px-3 py-1.5 bg-amber/10 border border-amber/20 rounded-lg text-[11px] text-amber font-semibold">💬 {okunmamis.length} yeni mesaj</div>}
        </div>
      </div>

      {/* ═══ ÜRETİM AKIŞ ŞEMASI ═══ */}
      <div className="mb-6">
        <div className="text-[10px] text-zinc-500 font-semibold mb-3 uppercase tracking-wider flex items-center gap-2">
          <ArrowRight size={10} /> Üretim Akışı
        </div>
        <div className="bg-bg-1 border border-border rounded-xl p-4">
          {/* İlk Satır: Sipariş → Reçete → İş Emri → Kesim Planı */}
          <div className="grid grid-cols-7 gap-2 items-stretch">
            <FlowCard
              icon="📋" label="Sipariş" count={siparisCount}
              sublabel={recetesizCount > 0 ? `${recetesizCount} reçetesiz` : 'Hepsi hazır'}
              warning={recetesizCount > 0}
              color="accent"
              onClick={() => navigate('/orders')}
            />
            <FlowArrow />
            <FlowCard
              icon="📑" label="Reçete" count={recipes.length}
              sublabel={recetesizCount > 0 ? `${recetesizCount} bağlanmadı` : 'Tamam'}
              warning={recetesizCount > 0}
              color="purple-400"
              onClick={() => navigate('/recipes')}
            />
            <FlowArrow />
            <FlowCard
              icon="⚙" label="İş Emri" count={acikWOs.length}
              sublabel={ieBekleyenCount > 0 ? `${ieBekleyenCount} oluşmadı` : `${tamamlananIE} tamamlandı`}
              warning={ieBekleyenCount > 0}
              color="zinc-300"
              onClick={() => navigate('/work-orders')}
            />
            <FlowArrow />
            <FlowCard
              icon="✂️" label="Kesim Planı" count={kesimEksik > 0 ? kesimEksik : bekleyenKP}
              sublabel={kesimEksik > 0 ? `${kesimEksik} planlanmadı` : bekleyenKP > 0 ? `${bekleyenKP} plan aktif` : 'Tamam'}
              warning={kesimEksik > 0}
              color={kesimEksik > 0 ? 'amber' : bekleyenKP > 0 ? 'green' : 'zinc-500'}
              onClick={() => navigate('/cutting')}
            />
          </div>
          {/* İkinci Satır: MRP → Üretim → Sevk */}
          <div className="grid grid-cols-5 gap-2 items-stretch mt-2">
            <FlowCard
              icon="📊" label="MRP" count={mrpYapilmamis}
              sublabel={mrpYapilmamis > 0 ? 'Kesim sonrası hesapla' : 'Güncel'}
              warning={mrpYapilmamis > 0}
              color="cyan"
              onClick={() => navigate('/mrp')}
            />
            <FlowArrow />
            <FlowCard
              icon="🔧" label="Üretim" count={uretimCount}
              sublabel={uretimCount > 0 ? 'Aktif çalışma' : 'Bekliyor'}
              color={uretimCount > 0 ? 'green' : 'zinc-500'}
              onClick={() => navigate('/production')}
            />
            <FlowArrow />
            <FlowCard
              icon="🚚" label="Sevk" count={sevkBekleyenCount}
              sublabel="Bu hafta"
              color="blue-400"
              onClick={() => navigate('/shipment')}
            />
          </div>
        </div>
      </div>

      {/* ═══ ROL BAZLI HIZLI ERİŞİM ═══ */}
      {role !== 'guest' && role !== 'operator' && (
        <div className="mb-6">
          <div className="text-[10px] text-zinc-500 font-semibold mb-3 uppercase tracking-wider flex items-center gap-2">
            <ArrowRight size={10} /> Hızlı Erişim {role !== 'admin' && `— ${role === 'uretim_sor' ? 'Üretim Sorumlusu' : role === 'planlama' ? 'Planlama' : 'Depocu'}`}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(() => {
              const cards: { icon: string; label: string; sub: string; link: string; color: string }[] = []
              if (role === 'admin' || role === 'planlama') {
                cards.push({
                  icon: '📋', label: 'Siparişler',
                  sub: terminGecen.length > 0 ? `${terminGecen.length} termin geçmiş` : `${aktifOrders.length} aktif`,
                  link: '/orders',
                  color: terminGecen.length > 0 ? 'red' : 'accent',
                })
                cards.push({
                  icon: '📊', label: 'MRP',
                  sub: mrpYapilmamis > 0 ? `${mrpYapilmamis} bekliyor` : 'Güncel',
                  link: '/mrp',
                  color: mrpYapilmamis > 0 ? 'amber' : 'cyan',
                })
                cards.push({
                  icon: '✂️', label: 'Kesim Planı',
                  sub: kesimEksik > 0 ? `${kesimEksik} planlanmadı` : bekleyenKP > 0 ? `${bekleyenKP} plan aktif` : 'Tamam',
                  link: '/cutting',
                  color: kesimEksik > 0 ? 'amber' : bekleyenKP > 0 ? 'green' : 'zinc-500',
                })
                cards.push({ icon: '🌳', label: 'Ürün Ağacı', sub: `${bomTrees.length} ağaç`, link: '/bom', color: 'green' })
                cards.push({ icon: '📑', label: 'Reçeteler', sub: `${recipes.length}`, link: '/recipes', color: 'purple-400' })
              }
              if (role === 'admin' || role === 'uretim_sor') {
                cards.push({
                  icon: '⚙', label: 'İş Emirleri',
                  sub: ieBekleyenCount > 0 ? `${ieBekleyenCount} oluşmadı` : `${acikWOs.length} açık`,
                  link: '/work-orders',
                  color: ieBekleyenCount > 0 ? 'amber' : 'zinc-300',
                })
                cards.push({
                  icon: '🔧', label: 'Üretim',
                  sub: `${uretimCount} aktif`,
                  link: '/production',
                  color: uretimCount > 0 ? 'green' : 'zinc-500',
                })
                cards.push({ icon: '📈', label: 'Raporlar', sub: 'Analiz', link: '/reports', color: 'blue-400' })
              }
              if (role === 'admin' || role === 'depocu') {
                cards.push({
                  icon: '📦', label: 'Stok / Depo',
                  sub: minStokUyari.length > 0 ? `⚠ ${minStokUyari.length} min altı` : `${materials.length} malzeme`,
                  link: '/warehouse',
                  color: minStokUyari.length > 0 ? 'red' : 'amber',
                })
                cards.push({
                  icon: '🚚', label: 'Tedarik',
                  sub: bekleyenTed.length > 0 ? `${bekleyenTed.length} bekliyor` : 'Tamam',
                  link: '/procurement',
                  color: bekleyenTed.length > 0 ? 'amber' : 'purple-400',
                })
                cards.push({ icon: '📋', label: 'Malzemeler', sub: 'Katalog', link: '/materials', color: 'accent' })
                cards.push({
                  icon: '🚢', label: 'Sevkiyat',
                  sub: `${sevkBekleyenCount} bu hafta`,
                  link: '/shipment',
                  color: sevkBekleyenCount > 0 ? 'blue-400' : 'zinc-500',
                })
              }
              if (role === 'admin') {
                cards.push({ icon: '✅', label: 'Checklist', sub: 'Görev/İstek', link: '/checklist', color: 'purple-400' })
                cards.push({ icon: '⚙️', label: 'Veri Yönetimi', sub: 'Ayarlar', link: '/data', color: 'zinc-300' })
              }
              const uniq = cards.filter((c, i, arr) => arr.findIndex(x => x.link === c.link) === i)
              return uniq.slice(0, 12).map(c => (<QuickCard key={c.link} {...c} onClick={() => navigate(c.link)} />))
            })()}
          </div>
        </div>
      )}


      {/* ═══ #2: Tıklanabilir Stat Kartları ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard value={aktifOrders.length} label="Aktif Sipariş" color="accent" icon={Package} onClick={() => navigate('/orders')} />
        <StatCard value={terminGecen.length} label="Termin Geçmiş" color="red" icon={AlertTriangle} onClick={() => navigate('/orders')} />
        <StatCard value={acikWOs.length} label="Açık İş Emri" color="zinc-300" icon={Clock} onClick={() => navigate('/work-orders')} />
        <StatCard value={toplamFire || '—'} label="Bugün Fire" color={toplamFire > 0 ? 'red' : 'zinc-500'} icon={Flame} onClick={() => navigate('/reports')} />
        <StatCard value={okunmamis.length} label="Yeni Mesaj" color={okunmamis.length > 0 ? 'amber' : 'zinc-500'} icon={MessageSquare} />
        <StatCard value={gercekAktif.length} label="Aktif Çalışma" color={gercekAktif.length > 0 ? 'green' : 'zinc-500'} icon={Wrench} onClick={() => navigate('/production')} />
      </div>

      {/* ═══ #8: Akıllı Workflow — Yanıp Sönen Butonlar ═══ */}
      {(kesimEksik > 0 || mrpYapilmamis > 0 || bekleyenKP > 0 || bekleyenTed.length > 0) && (
        <div className="mb-5">
          <div className="text-[10px] text-zinc-500 font-semibold mb-2 uppercase tracking-wider flex items-center gap-2">
            <ArrowRight size={10} /> Üretim Akışı — Sonraki Adımlar
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kesimEksik > 0 && (
              <WorkflowBtn icon="✂️" label="Kesim Planla" count={kesimEksik} color="amber" pulse={pulseKesim} onClick={() => navigate('/cutting')} />
            )}
            {mrpYapilmamis > 0 && (
              <WorkflowBtn icon="📊" label="MRP Hesapla" count={mrpYapilmamis} color="cyan-400" pulse={pulseMRP} onClick={() => navigate('/mrp')} />
            )}
            {bekleyenKP > 0 && (
              <WorkflowBtn icon="🔪" label="Kesim Bekliyor" count={bekleyenKP} color="green" pulse={false} onClick={() => navigate('/cutting')} />
            )}
            {bekleyenTed.length > 0 && (
              <WorkflowBtn icon="📦" label="Tedarik Takip Et" count={bekleyenTed.length} color="purple-400" pulse={pulseTedarik} onClick={() => navigate('/procurement')} />
            )}
          </div>
        </div>
      )}

      {/* Termin Geçmiş */}
      {terminGecen.length > 0 && (
        <div className="mb-4 p-3 bg-red/5 border border-red/20 rounded-lg">
          <div className="text-sm font-semibold text-red mb-2">🚨 {terminGecen.length} siparişin termini geçmiş!</div>
          <div className="space-y-1">
            {terminGecen.map(o => (
              <div key={o.id} className="flex items-center gap-3 text-xs cursor-pointer hover:bg-red/5 rounded px-1 -mx-1" onClick={() => navigate('/orders')}>
                <span className="font-mono text-accent">{o.siparisNo}</span>
                <span className="text-zinc-400">{o.musteri || '—'}</span>
                <span className="font-mono text-red ml-auto">{o.termin}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yedek Uyarısı */}
      {(() => {
        const lastBackup = localStorage.getItem('uys_last_backup')
        if (!lastBackup) return (
          <div className="mb-4 p-3 bg-amber/5 border border-amber/20 rounded-lg text-xs text-amber">
            ⚠ Henüz yedek alınmamış — <button onClick={() => navigate('/data')} className="underline hover:text-white">Veri Yönetimi</button> sayfasından JSON yedek alın.
          </div>
        )
        const days = Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
        if (days >= 7) return (
          <div className="mb-4 p-3 bg-amber/5 border border-amber/20 rounded-lg text-xs text-amber">
            ⚠ Son yedek {days} gün önce ({lastBackup}) — <button onClick={() => navigate('/data')} className="underline hover:text-white">yedek alın</button>
          </div>
        )
        return null
      })()}

      {/* Min Stok Uyarı */}
      {minStokUyari.length > 0 && (
        <div className="mb-4 p-3 bg-amber/5 border border-amber/20 rounded-lg">
          <div className="text-sm font-semibold text-amber mb-2 flex items-center justify-between">
            <span>⚠ {minStokUyari.length} malzeme minimum stok altında</span>
            <button onClick={async () => {
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
            }} className="px-2 py-1 bg-amber/20 text-amber rounded text-[10px] hover:bg-amber/30">Tedarik Oluştur</button>
          </div>
          <div className="space-y-1">
            {minStokUyari.slice(0, 5).map(m => (
              <div key={m.id} className="flex items-center gap-3 text-xs cursor-pointer hover:bg-amber/5 rounded px-1 -mx-1" onClick={() => navigate('/materials')}>
                <span className="font-mono text-accent">{m.kod}</span>
                <span className="text-zinc-400">{m.ad}</span>
                <span className="font-mono text-red ml-auto">Min: {m.minStok}</span>
              </div>
            ))}
            {minStokUyari.length > 5 && <div className="text-[11px] text-zinc-600">+{minStokUyari.length - 5} daha</div>}
          </div>
        </div>
      )}

      {/* ═══ #6: Bu Haftanın Sevkleri ═══ */}
      <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-sm font-semibold text-zinc-400 flex items-center gap-2 cursor-pointer" onClick={() => navigate('/shipment')}>
          <Truck size={14} className="text-blue-400" />
          Bu Haftanın Sevkleri
          <span className="text-[10px] font-mono text-zinc-600 ml-1">({monStr} — {sunStr})</span>
          <span className="ml-auto text-xs font-mono text-blue-400">{buHaftaSevk.length}</span>
        </div>
        {buHaftaSevk.length > 0 ? (
          <div className="divide-y divide-border/30">
            {buHaftaSevk.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-xs cursor-pointer hover:bg-bg-3/30" onClick={() => navigate('/shipment')}>
                <span className="font-mono text-blue-400">{s.tarih}</span>
                <span className="font-mono text-accent">{s.siparisNo}</span>
                <span className="text-zinc-300 flex-1 truncate">{s.musteri || '—'}</span>
                <span className="text-zinc-500">{(s.kalemler || []).length} kalem</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-zinc-600">Bu hafta planlanmış sevk yok</div>
        )}
      </div>

      {/* Günlük Üretim Grafiği */}
      {(() => {
        const gunMap: Record<string, { gun: string; uretim: number; fire: number }> = {}
        logs.forEach(l => {
          if (!l.tarih) return
          if (!gunMap[l.tarih]) gunMap[l.tarih] = { gun: l.tarih.slice(5), uretim: 0, fire: 0 }
          gunMap[l.tarih].uretim += l.qty
          gunMap[l.tarih].fire += l.fire || 0
        })
        const data = Object.values(gunMap).sort((a, b) => a.gun.localeCompare(b.gun)).slice(-7)
        return (
          <div className="mb-4 bg-bg-2 border border-border rounded-xl overflow-hidden p-4">
            <div className="text-xs font-semibold text-zinc-400 mb-3 flex items-center gap-2">📊 Son 7 Gün Üretim</div>
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data}>
                  <XAxis dataKey="gun" tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#555' }} width={35} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="uretim" fill="#22c55e" radius={[4, 4, 0, 0]} name="Üretim" />
                  <Bar dataKey="fire" fill="#ef4444" radius={[4, 4, 0, 0]} name="Fire" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-xs text-zinc-600 text-center py-8 bg-bg-3/30 rounded-lg">Henüz üretim kaydı yok — operatör panelinden kayıt girildiğinde grafik burada görünecek</div>}
          </div>
        )
      })()}

      {/* Aktif Çalışmalar */}
      {gercekAktif.length > 0 && (() => {
        // Süre hesapla, diğer İE bilgileri + progress + durum renklendirmesi
        const now = nowTick  // eslint bağımlılık farkında olsun
        const kartlar = gercekAktif.map(a => {
          const wo = workOrders.find(w => w.id === a.woId)
          const prod = wo ? logs.filter(l => l.woId === wo.id).reduce((s, l) => s + l.qty, 0) : 0
          const hedef = wo?.hedef || 0
          const pct = hedef > 0 ? Math.min(100, Math.round(prod / hedef * 100)) : 0
          // Süre (dakika cinsinden)
          let dk = 0
          if (a.baslangic && a.tarih) {
            const bas = new Date(a.tarih + 'T' + a.baslangic + ':00').getTime()
            if (bas > 0) dk = Math.max(0, Math.floor((now - bas) / 60000))
          }
          const saat = Math.floor(dk / 60)
          const mins = dk % 60
          const sureLabel = saat > 0 ? `${saat}s ${mins}dk` : `${mins}dk`
          // Son log zamanı (durgunluk göstergesi) — operatorlar[].bit'ten
          const oprLogs = logs.filter(l => l.woId === a.woId)
          let sonLogDk = -1
          for (const l of oprLogs) {
            for (const o of (l.operatorlar || [])) {
              if (o.bit && l.tarih) {
                const t = new Date(l.tarih + 'T' + o.bit + ':00').getTime()
                if (t > 0) {
                  const fark = Math.max(0, Math.floor((now - t) / 60000))
                  if (sonLogDk === -1 || fark < sonLogDk) sonLogDk = fark
                }
              }
            }
          }
          // Uyarı seviyesi: uzun açık (480dk+=8s) = red, durgun (180dk+ log yok) = amber
          const uzunAcik = dk > 480
          const durgun = !uzunAcik && sonLogDk > 180 && dk > 60
          return { a, wo, prod, hedef, pct, dk, sureLabel, uzunAcik, durgun, sonLogDk }
        }).sort((a, b) => b.dk - a.dk)  // Uzun süredir açık olanlar üstte

        const uzunSayi = kartlar.filter(k => k.uzunAcik).length
        const durgunSayi = kartlar.filter(k => k.durgun).length

        return (
          <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-border text-sm font-semibold flex items-center gap-2 flex-wrap">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green"></span></span>
              <Wrench size={14} className="text-green" /> Aktif Çalışmalar — Canlı ({gercekAktif.length})
              {uzunSayi > 0 && <span className="px-1.5 py-0.5 bg-red/15 text-red rounded text-[10px] font-mono">⏰ {uzunSayi} uzun</span>}
              {durgunSayi > 0 && <span className="px-1.5 py-0.5 bg-amber/15 text-amber rounded text-[10px] font-mono">⌛ {durgunSayi} durgun</span>}
              <span className="ml-auto text-[10px] text-zinc-600">her 30 sn günceller</span>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {kartlar.map(({ a, wo, prod, hedef, pct, sureLabel, uzunAcik, durgun, sonLogDk }) => {
                const borderCls = uzunAcik ? 'border-red/40 bg-red/5' : durgun ? 'border-amber/40 bg-amber/5' : 'border-border hover:border-green/30'
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate('/operator?oprId=' + a.opId)}
                    className={`p-3 bg-bg-3/40 border ${borderCls} rounded-lg cursor-pointer transition`}
                  >
                    {/* Başlık: Operatör + İstasyon */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-zinc-200 truncate flex-1">{a.opAd}</span>
                      {wo?.istAd && <span className="px-1.5 py-0.5 bg-bg-2 border border-border/50 rounded text-[10px] text-zinc-400 whitespace-nowrap">{wo.istAd}</span>}
                    </div>
                    {/* İE no + operasyon */}
                    <div className="flex items-center gap-2 mb-1 text-[11px]">
                      <span className="font-mono text-accent">{wo?.ieNo || '—'}</span>
                      {wo?.opAd && <span className="text-zinc-500">· {wo.opAd}</span>}
                    </div>
                    {/* Ürün adı */}
                    <div className="text-[11px] text-zinc-400 truncate mb-2" title={a.woAd}>{a.woAd}</div>
                    {/* Progress bar */}
                    {hedef > 0 && (
                      <div className="mb-2">
                        <div className="flex justify-between text-[10px] font-mono mb-1">
                          <span className="text-zinc-400">{prod} / {hedef}</span>
                          <span className={pct >= 100 ? 'text-green' : pct >= 50 ? 'text-accent' : 'text-zinc-500'}>%{pct}</span>
                        </div>
                        <div className="h-1.5 bg-bg-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-accent' : 'bg-zinc-600'}`} style={{ width: pct + '%' }} />
                        </div>
                      </div>
                    )}
                    {/* Alt satır: süre + başlangıç + durgunluk */}
                    <div className="flex items-center gap-2 text-[10px] font-mono pt-1 border-t border-border/30">
                      <Clock size={10} className={uzunAcik ? 'text-red' : durgun ? 'text-amber' : 'text-zinc-500'} />
                      <span className={uzunAcik ? 'text-red font-bold' : durgun ? 'text-amber font-bold' : 'text-zinc-300'}>{sureLabel}</span>
                      <span className="text-zinc-600">· {a.baslangic}</span>
                      {sonLogDk >= 0 && durgun && (
                        <span className="ml-auto text-amber text-[10px]">giriş yok: {Math.floor(sonLogDk / 60)}s+</span>
                      )}
                      {uzunAcik && (
                        <span className="ml-auto text-red text-[10px]">⚠ 8s+</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Operatör Mesajları */}
      {operatorNotes.length > 0 && (
        <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold flex items-center gap-2">
            {okunmamis.length > 0 ? '📩' : '📬'} Operatör Mesajları
            {okunmamis.length > 0 && (
              <>
              <span className="bg-red text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono">{okunmamis.length} yeni</span>
              <button onClick={async () => {
                for (const n of okunmamis) { await supabase.from('uys_operator_notes').update({ okundu: true }).eq('id', n.id) }
                loadAll()
              }} className="ml-auto text-[10px] text-zinc-500 hover:text-accent">Tümünü Okundu Yap</button>
              </>
            )}
          </div>
          <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
            {operatorNotes.sort((a, b) => (b.tarih + b.saat).localeCompare(a.tarih + a.saat)).slice(0, 20).map(n => (
              <div key={n.id} className={`px-4 py-2 text-xs ${!n.okundu ? 'bg-accent/5' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-medium ${!n.okundu ? 'text-white' : 'text-zinc-400'}`}>{n.opAd}</span>
                  <span className="font-mono text-zinc-600 text-[10px]">{n.tarih} {n.saat}</span>
                  <span className="flex-1" />
                  {!n.okundu && (
                    <button onClick={async () => { await supabase.from('uys_operator_notes').update({ okundu: true }).eq('id', n.id); loadAll() }}
                      className="px-2 py-0.5 bg-accent/10 text-accent rounded text-[10px] hover:bg-accent/20">✓</button>
                  )}
                  <button onClick={async () => {
                    const cevap = await showPrompt('Cevap yaz — ' + n.opAd, 'Cevabınız...')
                    if (!cevap) return
                    const now = new Date()
                    const saat = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')
                    await supabase.from('uys_operator_notes').insert({
                      id: uid(), op_id: n.opId, op_ad: '📋 Yönetim', tarih: today(), saat,
                      mesaj: cevap.trim(), okundu: false,
                    })
                    if (!n.okundu) await supabase.from('uys_operator_notes').update({ okundu: true }).eq('id', n.id)
                    loadAll(); toast.success('Cevap gönderildi — operatör görecek')
                  }} className="px-2 py-0.5 bg-green/10 text-green rounded text-[10px] hover:bg-green/20">💬 Cevapla</button>
                  <button onClick={async () => { if (!await showConfirm('Mesajı silmek istediğinize emin misiniz?')) return; await supabase.from('uys_operator_notes').delete().eq('id', n.id); loadAll() }} className="text-zinc-600 hover:text-red text-[10px]">✕</button>
                </div>
                <div className="bg-bg-3/50 rounded-lg px-3 py-2 text-zinc-300 mb-1">{n.mesaj}</div>
                {n.cevap && (
                  <div className="ml-6 bg-accent/5 border-l-2 border-accent/30 rounded-r-lg px-3 py-2 text-zinc-300">
                    <span className="text-accent text-[10px] font-medium">{n.cevaplayan || 'Yönetim'}</span>
                    <span className="text-zinc-600 text-[10px] ml-2">{n.cevapTarih}</span>
                    <div className="mt-0.5">{n.cevap}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ İzinli / Raporlu Personel ═══ */}
      {bugunIzinli.length > 0 && (
        <div className="mb-4 bg-bg-2 border border-green/20 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold text-green flex items-center gap-2 cursor-pointer" onClick={() => navigate('/operators')}>
            <CalendarX2 size={14} />
            Bugün İzinli / Raporlu
            <span className="text-xs font-mono ml-1">{bugunIzinli.length}</span>
          </div>
          <div className="divide-y divide-border/30">
            {bugunIzinli.map(iz => {
              const tipColor = iz.tip === 'rapor' ? 'bg-red/10 text-red' : iz.tip === 'mesai' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-amber/10 text-amber'
              return (
                <div key={iz.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                  <span className="text-zinc-200 font-medium">{iz.opAd}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${tipColor}`}>{iz.tip}</span>
                  {iz.saatBaslangic && iz.saatBitis ? (
                    <span className="font-mono text-zinc-500">{iz.saatBaslangic}–{iz.saatBitis}</span>
                  ) : (
                    <span className="font-mono text-zinc-500">{iz.baslangic} — {iz.bitis}</span>
                  )}
                  <span className="ml-auto text-[10px] text-zinc-600">Onay: {iz.onaylayan || '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bekleyen İzin Talepleri */}
      {bekleyenIzinler.length > 0 && (
        <div className="mb-4 bg-bg-2 border border-amber/20 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold text-amber flex items-center gap-2 cursor-pointer" onClick={() => navigate('/operators')}>
            <Bell size={14} />
            Onay Bekleyen İzin Talepleri
            <span className="text-xs font-mono ml-1 bg-amber/20 px-1.5 rounded">{bekleyenIzinler.length}</span>
          </div>
          <div className="divide-y divide-border/30">
            {bekleyenIzinler.map(iz => (
              <div key={iz.id} className="flex items-center gap-3 px-4 py-2 text-xs cursor-pointer hover:bg-bg-3/30" onClick={() => navigate('/operators')}>
                <span className="text-zinc-200 font-medium">{iz.opAd}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber/10 text-amber">{iz.tip}</span>
                <span className="font-mono text-zinc-500">{iz.baslangic} — {iz.bitis}</span>
                <span className="ml-auto text-[10px] text-amber font-semibold">⏳ Onay Bekliyor</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ #3: Giriş Yapmayan Operatörler ═══ */}
      {girmeyenler.length > 0 && (
        <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold text-zinc-400 flex items-center gap-2 cursor-pointer" onClick={() => navigate('/operators')}>
            <UserX size={14} className="text-orange-400" />
            Bugün Giriş Yapmayan Operatörler
            <span className="text-xs font-mono text-orange-400 ml-1">{girmeyenler.length}/{aktifOps.length - bugunIzinli.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 p-3">
            {girmeyenler.slice(0, 30).map(o => (
              <span key={o.id} className="text-[11px] px-2 py-0.5 bg-bg-3 rounded text-zinc-400 flex items-center gap-1">
                {o.ad}
                {o.bolum && <span className="text-[9px] text-zinc-600">({o.bolum})</span>}
              </span>
            ))}
            {girmeyenler.length > 30 && <span className="text-[11px] text-zinc-600">+{girmeyenler.length - 30} daha</span>}
          </div>
        </div>
      )}

      {/* ═══ #4: Duruşlu İstasyonlar ═══ */}
      {durusDetay.length > 0 && (
        <div className="mb-4 bg-bg-2 border border-red/20 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold text-red flex items-center gap-2 cursor-pointer" onClick={() => navigate('/stations')}>
            <Cpu size={14} /> Bugün Duruş Yaşayan İstasyonlar
            <span className="text-xs font-mono ml-1">{durusIstSet.size} istasyon</span>
          </div>
          <div className="divide-y divide-border/30">
            {durusDetay.slice(0, 8).map((d, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs">
                <span className="text-zinc-300 font-semibold">{d.istAd}</span>
                <span className="text-red">{d.durusAd}</span>
                <span className="text-zinc-500 truncate ml-auto">{d.woAd}</span>
              </div>
            ))}
            {durusDetay.length > 8 && <div className="px-4 py-1.5 text-[11px] text-zinc-600">+{durusDetay.length - 8} daha</div>}
          </div>
        </div>
      )}

      {/* ═══ #7: Bölüm Tanımlanmamış ═══ */}
      {(bolumsuzOpr.length > 0 || bolumsuzOp.length > 0) && (
        <div className="mb-4 bg-bg-2 border border-amber/20 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold text-amber flex items-center gap-2">
            <Tag size={14} /> Bölüm Tanımlanmamış
          </div>
          <div className="p-3 space-y-2">
            {bolumsuzOp.length > 0 && (
              <div>
                <div className="text-[10px] text-zinc-500 mb-1 font-semibold">Operasyonlar ({bolumsuzOp.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {bolumsuzOp.slice(0, 10).map(o => (
                    <span key={o.id} className="text-[11px] px-2 py-0.5 bg-amber/10 border border-amber/20 rounded text-amber cursor-pointer hover:bg-amber/20" onClick={() => navigate('/operations')}>
                      {o.kod} — {o.ad}
                    </span>
                  ))}
                  {bolumsuzOp.length > 10 && <span className="text-[11px] text-zinc-600">+{bolumsuzOp.length - 10}</span>}
                </div>
              </div>
            )}
            {bolumsuzOpr.length > 0 && (
              <div>
                <div className="text-[10px] text-zinc-500 mb-1 font-semibold">Operatörler ({bolumsuzOpr.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {bolumsuzOpr.slice(0, 10).map(o => (
                    <span key={o.id} className="text-[11px] px-2 py-0.5 bg-amber/10 border border-amber/20 rounded text-amber cursor-pointer hover:bg-amber/20" onClick={() => navigate('/operators')}>
                      {o.ad}
                    </span>
                  ))}
                  {bolumsuzOpr.length > 10 && <span className="text-[11px] text-zinc-600">+{bolumsuzOpr.length - 10}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aktif Siparişler */}
      <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-sm font-semibold cursor-pointer hover:text-accent" onClick={() => navigate('/orders')}>Aktif Siparişler</div>
        {aktifOrders.length ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500">
                <th className="text-left px-4 py-2">Sipariş No</th>
                <th className="text-left px-4 py-2">Müşteri</th>
                <th className="text-left px-4 py-2">Termin</th>
                <th className="text-right px-4 py-2">İlerleme</th>
              </tr>
            </thead>
            <tbody>
              {aktifOrders.slice(0, 15).map(o => {
                const wos = workOrders.filter(w => w.orderId === o.id)
                const totalPct = wos.length
                  ? wos.reduce((s, w) => {
                      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
                      return s + (w.hedef > 0 ? Math.min(100, prod / w.hedef * 100) : 0)
                    }, 0) / wos.length
                  : 0
                const pct = Math.round(totalPct)
                const terminColor = o.termin && o.termin < todayStr ? 'text-red' : o.termin && o.termin <= todayStr ? 'text-amber' : 'text-zinc-500'
                return (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-bg-3/50 cursor-pointer" onClick={() => navigate('/orders')}>
                    <td className="px-4 py-2 font-mono text-accent">{o.siparisNo}</td>
                    <td className="px-4 py-2 text-zinc-300">{o.musteri || '—'}</td>
                    <td className={`px-4 py-2 font-mono ${terminColor}`}>{o.termin || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`font-mono text-[11px] ${pctColor(pct)}`}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-zinc-600 text-sm">Aktif sipariş yok</div>
        )}
      </div>

      {/* Yapılması Gerekenler */}
      {(() => {
        const adimlar: { icon: string; mesaj: string; link: string }[] = []
        const recetesiz = orders.filter(o => !o.receteId && aktifOrders.some(a => a.id === o.id))
        if (recetesiz.length) adimlar.push({ icon: '📋', mesaj: `${recetesiz.length} siparişin reçetesi bağlı değil`, link: '/orders' })
        const ieSiz = orders.filter(o => o.receteId && !workOrders.some(w => w.orderId === o.id) && aktifOrders.some(a => a.id === o.id))
        if (ieSiz.length) adimlar.push({ icon: '⚙', mesaj: `${ieSiz.length} sipariş için İE oluşturulmamış`, link: '/orders' })
        if (mrpYapilmamis) adimlar.push({ icon: '📊', mesaj: `${mrpYapilmamis} siparişin MRP hesabı yapılmadı`, link: '/mrp' })
        if (kesimEksik) adimlar.push({ icon: '✂', mesaj: `${kesimEksik} İE kesim planlanmamış`, link: '/cutting' })
        if (bekleyenTed.length) adimlar.push({ icon: '📦', mesaj: `${bekleyenTed.length} tedarik bekliyor`, link: '/procurement' })
        if (bolumsuzOp.length) adimlar.push({ icon: '🏷', mesaj: `${bolumsuzOp.length} operasyonun bölümü tanımlı değil`, link: '/operations' })
        if (bolumsuzOpr.length) adimlar.push({ icon: '👤', mesaj: `${bolumsuzOpr.length} operatörün bölümü tanımlı değil`, link: '/operators' })
        // YarıMamul reçetesiz kontrolü
        const ymRecetesiz = materials.filter(m => m.tip === 'YarıMamul' && !recipes.some(r => r.mamulKod === m.kod))
        if (ymRecetesiz.length) adimlar.push({ icon: '⚠', mesaj: `${ymRecetesiz.length} yarı mamulün reçetesi tanımlı değil`, link: '/materials' })
        if (!adimlar.length) return (
          <div className="mb-4 p-4 bg-green/5 border border-green/20 rounded-lg flex items-center gap-3">
            <CheckCircle size={18} className="text-green" />
            <div><div className="text-sm font-semibold text-green">Tüm Süreçler Güncel</div><div className="text-[11px] text-zinc-500">Bekleyen adım yok</div></div>
          </div>
        )
        return (
          <div className="mb-4 bg-bg-2 border border-amber/20 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-border text-sm font-semibold text-amber flex items-center gap-2">
              <AlertTriangle size={14} /> Yapılması Gerekenler ({adimlar.length})
            </div>
            <div className="divide-y divide-border/30">
              {adimlar.map((a, i) => (
                <button key={i} onClick={() => navigate(a.link)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-3/30">
                  <span className="text-lg">{a.icon}</span>
                  <span className="flex-1 text-xs text-zinc-300">{a.mesaj}</span>
                  <ArrowRight size={14} className="text-amber" />
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Operasyon Bazlı Dağılım */}
      {(() => {
        const deptMap: Record<string, number> = {}
        logs.forEach(l => {
          const wo = workOrders.find(w => w.id === l.woId)
          const dept = wo?.opAd?.split(' ')[0] || 'Diğer'
          deptMap[dept] = (deptMap[dept] || 0) + l.qty
        })
        const data = Object.entries(deptMap).map(([name, value]) => ({ name: name.slice(0, 12), value })).sort((a, b) => b.value - a.value).slice(0, 8)
        const COLORS = ['#4f9cf9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16']
        if (data.length < 1) return null
        return (
          <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden p-4">
            <div className="text-xs font-semibold text-zinc-400 mb-3">Operasyon Bazlı Üretim Dağılımı</div>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="40%" height={140}>
                <PieChart>
                  <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={55} strokeWidth={0}>
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {data.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-zinc-400 flex-1">{d.name}</span>
                    <span className="font-mono text-zinc-300">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Sistem Durumu */}
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-sm font-semibold text-zinc-400">🔧 Sistem Durumu</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/30">
          {[
            { ad: 'Malzemeler', d: materials.length },
            { ad: 'Siparişler', d: orders.length },
            { ad: 'İş Emirleri', d: workOrders.length },
            { ad: 'Operatörler', d: operators.length },
            { ad: 'Kesim Planları', d: cuttingPlans.length },
            { ad: 'Stok Hareketleri', d: stokHareketler.length },
            { ad: 'Tedarikler', d: tedarikler.length },
            { ad: 'Üretim Logları', d: logs.length },
          ].map(c => (
            <div key={c.ad} className="bg-bg-2 p-3 flex items-center gap-2">
              {c.d > 0 ? <CheckCircle size={12} className="text-green" /> : <XCircle size={12} className="text-zinc-600" />}
              <div>
                <div className="text-[10px] text-zinc-500">{c.ad}</div>
                <div className="text-xs font-mono text-zinc-300">{c.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
