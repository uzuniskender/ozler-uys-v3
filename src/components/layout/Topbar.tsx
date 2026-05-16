import { useState, useMemo } from 'react'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Menu, LogOut, RefreshCw, Key, MessageCircle, AtSign, Workflow, Scissors, Calculator, Truck, Bell, X } from 'lucide-react'
import { useProductionStore, useOrderStore, useWarehouseStore, useAuthStore, loadAllStores } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { okunduIsaretle, topluOkunduIsaretle } from '@/services/bildirimlerService'
import { HelpNotesButtons } from '@/components/HelpNotesButtons'
import { useChatNotifications, useChatNotifStore } from '@/hooks/useChatNotifications'
import { cancelFlow, devamEttirFlow, stepToRoute, stepLabel } from '@/services/pendingFlowService'
import { isOrderMrpPending, isWorkOrderOpen, isProcurementPending, isKesimWO, getPlanliWoIds, getPlanBekleyenWoIds, computeOrderHammaddeEksik } from '@/lib/statusUtils'
import { Hourglass } from 'lucide-react'

interface TopbarProps {
  onMenuClick: () => void
  onSignOut: () => void
}

export function Topbar({ onMenuClick, onSignOut }: TopbarProps) {
  const navigate = useNavigate()
  const oSynced = useOrderStore(s => s.synced)
  const pSynced = useProductionStore(s => s.synced)
  const wSynced = useWarehouseStore(s => s.synced)
  const aSynced = useAuthStore(s => s.synced)
  const synced = oSynced && pSynced && wSynced && aSynced
  const pendingFlows = useProductionStore(s => s.pendingFlows)
  const workOrders = useProductionStore(s => s.workOrders)
  const cuttingPlans = useProductionStore(s => s.cuttingPlans)
  const logs = useProductionStore(s => s.logs)
  const orders = useOrderStore(s => s.orders)
  const tedarikler = useWarehouseStore(s => s.tedarikler)
  const stokHareketler = useWarehouseStore(s => s.stokHareketler)
  const bildirimler = useAuthStore(s => s.bildirimler)

  // v16.05 — #20: Sipariş-bütünü hammadde rekabeti için orderHmEksikMap
  const orderHmEksikMap = useMemo(
    () => computeOrderHammaddeEksik(orders, workOrders, stokHareketler, tedarikler),
    [orders, workOrders, stokHareketler, tedarikler]
  )
  const { user } = useAuth()
  const [showPassModal, setShowPassModal] = useState(false)
  const [showFlowModal, setShowFlowModal] = useState(false)
  // v15.96 — Madde 15 P4: Bildirim merkezi
  const [showBildirimPanel, setShowBildirimPanel] = useState(false)
  const isTestMode = localStorage.getItem('uys_test_mode') === 'true'

  // v15.96 — Okunmamis bildirimler (kendi hedef veya herkes hedefli)
  const myUid = user?.dbId || user?.email || user?.username || ''
  const okunmamisBildirimler = useMemo(() => {
    return (bildirimler || [])
      .filter(b => !b.okundu && (!b.hedefKullaniciId || b.hedefKullaniciId === myUid))
      .sort((a, b) => (b.olusturma || '').localeCompare(a.olusturma || ''))
  }, [bildirimler, myUid])
  const bildirimSayisi = okunmamisBildirimler.length
  const enYuksekTip: 'kirmizi' | 'sari' | null = okunmamisBildirimler.some(b => b.tip === 'kirmizi')
    ? 'kirmizi'
    : okunmamisBildirimler.some(b => b.tip === 'sari') ? 'sari' : null

  // Chat bildirim sistemi — realtime subscription + unread count (tek yerde çağrılmalı)
  useChatNotifications()
  const chatUnread = useChatNotifStore(s => s.unreadCount)
  const chatMentions = useChatNotifStore(s => s.unreadMentionCount)

  // v15.36 — Aktif yarım işler (sadece bu kullanıcıya ait)
  // v15.65 (madde 17) — 'beklet' durumlu flow'lar da Topbar'da görünür (kullanıcı geri açabilsin)
  const myUserId = user?.dbId || user?.email || user?.username || ''
  const activeFlows = (pendingFlows || []).filter(f =>
    (f.durum === 'aktif' || f.durum === 'beklet') &&
    (f.userId === myUserId || f.userId === user?.username || f.userId === user?.email)
  )
  const flowCount = activeFlows.length

  // ─── v15.47 — Üretim Zinciri durum göstergeleri ─────────────────
  // v15.47.2 — Durum string mismatch fix:
  //   uys_orders.durum 'kapalı' (eski) ve mrp_durum 'tamam' (kısa) string'leri
  //   normalize edilmiş statusUtils helper'larıyla yakalanıyor.
  //   Bkz: docs/UYS_v3_Bilgi_Bankasi.md §18.3 Durum String Konvansiyonu
  const zincirCounts = useMemo(() => {
    // v15.73 — Duplicate kod kaldırıldı, statusUtils helper'ları kullanılıyor (atıl kod sıra 7)
    const planliWoIds = getPlanliWoIds(cuttingPlans as any)
    const kesim = workOrders.filter(w =>
      isWorkOrderOpen(w) && isKesimWO(w) && !planliWoIds.has(w.id)
    ).length

    // v16.82 — MRP badge düzeltme: mrp_durum='eksik' ama tüm İE'leri Üretilebilir
    // olan siparişleri badge'den çıkar (kesim planı yapıldı → MRP stale kalmış).
    const planBekleyenWoIdSet = getPlanBekleyenWoIds(
      workOrders, cuttingPlans as any, tedarikler, stokHareketler as any, logs as any, orderHmEksikMap
    )
    const planBekleyenOrderIds = new Set(
      workOrders.filter(w => planBekleyenWoIdSet.has(w.id) && w.orderId).map(w => w.orderId!)
    )
    const mrp = orders.filter(o =>
      isOrderMrpPending(o) && planBekleyenOrderIds.has(o.id)
    ).length
    const tedarik = tedarikler.filter(isProcurementPending).length

    // v15.79 — Plan Bekleyen: Üretilebilir olmayan açık WO'ların toplamı.
    // Kapsamı KESİM/MRP/TEDARİK'ten daha geniş — operatör panelinde görünmeyen tüm engellileri toplar.
    const planBekleyen = getPlanBekleyenWoIds(
      workOrders, cuttingPlans as any, tedarikler, stokHareketler as any, logs as any, orderHmEksikMap
    ).size

    return { kesim, mrp, tedarik, planBekleyen }
  }, [workOrders, orders, cuttingPlans, tedarikler, stokHareketler, logs])

  // Renk eşiği: 0=yeşil, 1-5=sarı, 6+=kırmızı
  function badgeColor(n: number): string {
    if (n === 0) return 'bg-green/10 text-green border-green/30'
    if (n <= 5) return 'bg-amber/10 text-amber border-amber/30'
    return 'bg-red/10 text-red border-red/30'
  }
  function navTo(hash: string) {
    window.location.hash = hash
  }

  return (
    <>
    {isTestMode && (
      <div className="bg-amber text-black text-center text-xs font-bold py-1">
        ⚠ TEST ORTAMI — Veriler gerçek sisteme kaydedilmektedir, test sonrası temizleyin
        <button onClick={() => { localStorage.removeItem('uys_test_mode'); window.location.reload() }} className="ml-3 px-2 py-0.5 bg-black/20 rounded text-[10px]">Kapat</button>
      </div>
    )}
    <header className="h-12 bg-bg-1 border-b border-border flex items-center px-4 gap-3">
      <button onClick={onMenuClick} className="lg:hidden text-zinc-400 hover:text-white">
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      {!isTestMode && (
        <button onClick={() => { localStorage.setItem('uys_test_mode', 'true'); window.location.reload() }}
          className="text-[10px] text-zinc-600 hover:text-amber px-2 py-0.5 rounded" title="Test modunu aç">🧪 Test</button>
      )}

      {/* v15.47 — Üretim Zinciri durum badge'leri */}
      <div className="hidden md:flex items-center gap-1.5">
        <button
          onClick={() => navTo('/cutting')}
          className={`flex items-center gap-1 px-2 py-0.5 border rounded-full text-[10px] font-mono transition-colors hover:opacity-80 ${badgeColor(zincirCounts.kesim)}`}
          title={`${zincirCounts.kesim} İE kesim planı bekliyor`}
        >
          <Scissors size={10} />
          <span className="font-semibold">KESİM</span>
          <span className="font-bold tabular-nums">{zincirCounts.kesim}</span>
        </button>
        <button
          onClick={() => navTo('/orders?mrp=eksik')}
          className={`flex items-center gap-1 px-2 py-0.5 border rounded-full text-[10px] font-mono transition-colors hover:opacity-80 ${badgeColor(zincirCounts.mrp)}`}
          title={`${zincirCounts.mrp} sipariş MRP bekliyor`}
        >
          <Calculator size={10} />
          <span className="font-semibold">MRP</span>
          <span className="font-bold tabular-nums">{zincirCounts.mrp}</span>
        </button>
        <button
          onClick={() => navTo('/procurement')}
          className={`flex items-center gap-1 px-2 py-0.5 border rounded-full text-[10px] font-mono transition-colors hover:opacity-80 ${badgeColor(zincirCounts.tedarik)}`}
          title={`${zincirCounts.tedarik} tedarik bekliyor`}
        >
          <Truck size={10} />
          <span className="font-semibold">TEDARİK</span>
          <span className="font-bold tabular-nums">{zincirCounts.tedarik}</span>
        </button>
        {/* v15.79 (İş Emri #13 madde 8+9) — Plan Bekleyen rozeti.
            Açık ama Üretilebilir olmayan tüm WO'ları sayar (kesim plan eksik + tedarik açılmamış + yolda).
            KESİM/MRP/TEDARİK rozetleri sebep ayrımı, bu rozet TOPLAM görünüm. */}
        <button
          onClick={() => navigate('/work-orders?statusFilter=PlanBekliyor')}
          className={`flex items-center gap-1 px-2 py-0.5 border rounded-full text-[10px] font-mono transition-colors hover:opacity-80 cursor-pointer ${badgeColor(zincirCounts.planBekleyen)}`}
          title={`${zincirCounts.planBekleyen} iş emri Üretilebilir değil (Plan Bekliyor)`}
        >
          <Hourglass size={10} />
          <span className="font-semibold">PLAN BEKLEYEN</span>
          <span className="font-bold tabular-nums">{zincirCounts.planBekleyen}</span>
        </button>
      </div>

      {/* v15.36 — Yarım iş ikonu + badge */}
      {flowCount > 0 && (
        <button
          onClick={() => setShowFlowModal(true)}
          className="relative text-amber hover:text-amber transition-colors"
          title={`${flowCount} yarım iş`}
        >
          <Workflow size={16} />
          <span className="absolute -top-1.5 -right-1.5 bg-amber text-black text-[9px] font-bold px-1 rounded-full min-w-[15px] text-center leading-[14px] ring-2 ring-bg-1">
            {flowCount}
          </span>
        </button>
      )}

      {/* Chat ikonu + unread badge + mention badge (v15.17) */}
      <button
        onClick={() => { window.location.hash = '/chat' }}
        className="relative text-zinc-400 hover:text-white transition-colors"
        title={
          chatMentions > 0
            ? `${chatMentions} bahis · ${chatUnread} okunmamış mesaj`
            : chatUnread > 0
              ? `${chatUnread} okunmamış mesaj`
              : 'Ekip Sohbet'
        }
      >
        <MessageCircle size={16} />
        {chatMentions > 0 && (
          <span className="absolute -top-2 -left-2 bg-amber text-black text-[8px] font-bold px-1 rounded-full min-w-[15px] h-[15px] flex items-center justify-center ring-2 ring-bg-1" title={`${chatMentions} bahis`}>
            <AtSign size={9} strokeWidth={3} />
          </span>
        )}
        {chatUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red text-white text-[9px] font-bold px-1 rounded-full min-w-[15px] text-center leading-[14px] ring-2 ring-bg-1">
            {chatUnread > 99 ? '99+' : chatUnread}
          </span>
        )}
      </button>

      {/* v15.96 — Madde 15 P4: Bildirim merkezi (Bell icon + dropdown) */}
      <div className="relative">
        <button
          onClick={() => setShowBildirimPanel(p => !p)}
          className="relative text-zinc-400 hover:text-white transition-colors"
          title={bildirimSayisi > 0 ? `${bildirimSayisi} okunmamis bildirim` : 'Bildirimler'}
        >
          <Bell size={16} />
          {bildirimSayisi > 0 && (
            <span className={`absolute -top-1.5 -right-1.5 ${enYuksekTip === 'kirmizi' ? 'bg-red text-white' : 'bg-amber text-black'} text-[9px] font-bold px-1 rounded-full min-w-[15px] text-center leading-[14px] ring-2 ring-bg-1`}>
              {bildirimSayisi > 99 ? '99+' : bildirimSayisi}
            </span>
          )}
        </button>
        {showBildirimPanel && (
          <BildirimPanel
            bildirimler={okunmamisBildirimler}
            onClose={() => setShowBildirimPanel(false)}
            onAction={() => loadAllStores()}
          />
        )}
      </div>

      {user && (
        <span className="text-[11px] text-zinc-500 font-mono">{user.email ? `${user.username} (${user.email})` : user.username}</span>
      )}

      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        <div className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-green' : 'bg-red'}`} />
        <span className="text-zinc-500">{synced ? 'Bağlı' : 'Çevrimdışı'}</span>
      </div>

      <button onClick={() => loadAllStores({ force: true })} className="text-zinc-500 hover:text-zinc-300" title="Yenile"><RefreshCw size={14} /></button>
      <HelpNotesButtons username={user?.username || 'anonim'} />
      <button onClick={() => setShowPassModal(true)} className="text-zinc-500 hover:text-amber" title="Şifre Değiştir"><Key size={14} /></button>
      <button onClick={onSignOut} className="text-zinc-500 hover:text-red" title="Çıkış"><LogOut size={14} /></button>
    </header>

    {showPassModal && <PassModal onClose={() => setShowPassModal(false)} />}
    {showFlowModal && <FlowModal flows={activeFlows} onClose={() => setShowFlowModal(false)} onAction={() => { loadAllStores(); setShowFlowModal(false) }} />}
    </>
  )
}

// v15.36 — Yarım iş listesi + devam/iptal aksiyonları
function FlowModal({ flows, onClose, onAction }: {
  flows: import('@/types').PendingFlow[]
  onClose: () => void
  onAction: () => void
}) {
  async function iptal(flowId: string) {
    if (!await new Promise<boolean>(res => {
      const r = confirm('Bu akışı iptal et? Sipariş ve kesim planları silinmez, sadece akış bayrağı kapanır.')
      res(r)
    })) return
    const ok = await cancelFlow(flowId)
    if (ok) { toast.success('Akış iptal edildi'); onAction() }
    else toast.error('İptal başarısız')
  }
  function devam(flowId: string, step: string) {
    // v15.65 (madde 17) — Eğer bekletilen flow ise önce durumu 'aktif' yap
    const flow = flows.find(f => f.id === flowId)
    if (flow?.durum === 'beklet') {
      devamEttirFlow(flowId).then(() => {
        const hash = stepToRoute(step as any) + '?flow=' + flowId
        window.location.hash = hash.startsWith('#') ? hash.slice(1) : hash
        onClose()
      })
      return
    }
    const hash = stepToRoute(step as any) + '?flow=' + flowId
    window.location.hash = hash.startsWith('#') ? hash.slice(1) : hash
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Yarım İşler <span className="text-zinc-500 font-normal">({flows.length})</span></h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Devam et veya iptal et</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {!flows.length && <div className="p-8 text-center text-zinc-500 text-xs">Yarım iş yok</div>}
          {flows.map(f => (
            <div key={f.id} className={`p-3 flex items-center justify-between gap-3 ${f.durum === 'beklet' ? 'bg-purple-500/5' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-200 truncate flex items-center gap-2">
                  {f.stateData.baslik || (f.stateData.siparisNo ? `Sipariş ${f.stateData.siparisNo}` : f.flowType)}
                  {f.durum === 'beklet' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 font-semibold">
                      ⏸ BEKLETİLDİ
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Adım: <span className="text-amber">{stepLabel(f.currentStep)}</span>
                  <span className="text-zinc-600 mx-1">·</span>
                  {f.sonAktivite?.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => devam(f.id, f.currentStep)}
                  className="px-2.5 py-1 bg-accent hover:bg-accent-hover text-white rounded text-[11px] font-semibold"
                >
                  Devam
                </button>
                <button
                  onClick={() => iptal(f.id)}
                  className="px-2.5 py-1 bg-bg-3 hover:bg-red/20 text-zinc-400 hover:text-red rounded text-[11px]"
                >
                  İptal
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">Kapat</button>
        </div>
      </div>
    </div>
  )
}

const zSifre = z.string()
  .min(4, 'Şifre en az 4 karakter olmalıdır')
  .regex(/\d/, 'Şifre en az 1 rakam içermelidir')
  .max(50, 'Şifre en fazla 50 karakter')

function PassModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')

  function save() {
    if (current !== 'admin123' && current !== localStorage.getItem('uys_admin_pass')) {
      toast.error('Mevcut şifre hatalı'); return
    }
    const parsed = zSifre.safeParse(newPass)
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message || 'Geçersiz şifre'); return }
    if (newPass !== confirm) { toast.error('Şifreler eşleşmiyor'); return }
    localStorage.setItem('uys_admin_pass', newPass)
    toast.success('Şifre değiştirildi — yeni giriş: ' + newPass)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Şifre Değiştir</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Mevcut Şifre</label>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Yeni Şifre</label>
          <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Yeni Şifre (Tekrar)</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Değiştir</button>
        </div>
      </div>
    </div>
  )
}

// v15.96 — Madde 15 P4: Bildirim Merkezi Dropdown Panel
function BildirimPanel({ bildirimler, onClose, onAction }: {
  bildirimler: import('@/types').Bildirim[]
  onClose: () => void
  onAction: () => void
}) {
  async function isaretleOkundu(id: string) {
    await okunduIsaretle(id)
    onAction()
  }
  async function hepsiniOkunduIsaretle() {
    const ids = bildirimler.map(b => b.id)
    if (!ids.length) return
    await topluOkunduIsaretle(ids)
    onAction()
    toast.success(`${ids.length} bildirim okundu isaretlendi`)
  }
  function tikla(b: import('@/types').Bildirim) {
    isaretleOkundu(b.id)
    if (b.refTip === 'order' && b.refId) {
      window.location.hash = `/orders?orderId=${b.refId}`
    } else if (b.refTip === 'wo' && b.refId) {
      window.location.hash = `/workorders`
    }
    onClose()
  }
  function zamanFormat(iso: string) {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      const fark = (Date.now() - d.getTime()) / 1000
      if (fark < 60) return 'şimdi'
      if (fark < 3600) return Math.floor(fark / 60) + ' dk önce'
      if (fark < 86400) return Math.floor(fark / 3600) + ' saat önce'
      return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }
  return (
    <>
      {/* Backdrop tikla -> kapat */}
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div className="absolute right-0 top-7 z-[60] w-[380px] max-h-[480px] bg-bg-1 border border-border rounded-xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-amber" />
            <span className="text-sm font-semibold">Bildirimler</span>
            {bildirimler.length > 0 && <span className="text-[10px] text-zinc-500">({bildirimler.length} okunmamis)</span>}
          </div>
          <div className="flex items-center gap-2">
            {bildirimler.length > 0 && (
              <button onClick={hepsiniOkunduIsaretle} className="text-[10px] text-zinc-500 hover:text-accent">
                Hepsini okundu
              </button>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={14} /></button>
          </div>
        </div>
        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {bildirimler.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              Okunmamis bildirim yok
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {bildirimler.slice(0, 20).map(b => (
                <button
                  key={b.id}
                  onClick={() => tikla(b)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-bg-2 transition-colors flex gap-2 ${
                    b.tip === 'kirmizi' ? 'border-l-2 border-red' : 'border-l-2 border-amber'
                  }`}
                >
                  <span className="text-base mt-0.5 shrink-0">
                    {b.tip === 'kirmizi' ? '🔴' : '🟡'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-zinc-200">{b.baslik}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">{b.mesaj}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{zamanFormat(b.olusturma)}{b.kategori ? ' · ' + b.kategori : ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {bildirimler.length > 20 && (
          <div className="p-2 border-t border-border text-center text-[10px] text-zinc-500">
            +{bildirimler.length - 20} daha (eski bildirimler)
          </div>
        )}
      </div>
    </>
  )
}
