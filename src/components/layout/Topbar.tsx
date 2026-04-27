import { useState, useMemo } from 'react'
import { Menu, LogOut, RefreshCw, Key, MessageCircle, AtSign, Workflow, Scissors, Calculator, Truck } from 'lucide-react'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { HelpNotesButtons } from '@/components/HelpNotesButtons'
import { useChatNotifications, useChatNotifStore } from '@/hooks/useChatNotifications'
import { cancelFlow, devamEttirFlow, stepToRoute, stepLabel } from '@/lib/pendingFlow'
import { isOrderMrpPending, isWorkOrderOpen, isCuttingPlanActive, isProcurementPending } from '@/lib/statusUtils'

interface TopbarProps {
  onMenuClick: () => void
  onSignOut: () => void
}

export function Topbar({ onMenuClick, onSignOut }: TopbarProps) {
  const { synced, loadAll, pendingFlows, workOrders, orders, cuttingPlans, tedarikler } = useStore()
  const { user } = useAuth()
  const [showPassModal, setShowPassModal] = useState(false)
  const [showFlowModal, setShowFlowModal] = useState(false)
  const isTestMode = localStorage.getItem('uys_test_mode') === 'true'

  // Chat bildirim sistemi — realtime subscription + unread count (tek yerde çağrılmalı)
  useChatNotifications()
  const chatUnread = useChatNotifStore(s => s.unreadCount)
  const chatMentions = useChatNotifStore(s => s.unreadMentionCount)

  // v15.36 — Aktif yarım işler (sadece bu kullanıcıya ait)
  // v15.65 (madde 17) — 'beklet' durumlu flow'lar da Topbar'da görünür (kullanıcı geri açabilsin)
  const myUserId = user?.dbId || user?.email || user?.username || ''
  const activeFlows = pendingFlows.filter(f =>
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
    // v15.50a.6 — Kesim operasyon tespiti: CuttingPlans.tsx'teki kesimOps listesi ile birebir.
    // Eski kod sadece 'KESIM' arıyordu, "KESME LAZER" gibi operasyonları kaçırıyordu.
    // Tüm kesim varyantları: 'KESİM', 'KESME', 'KES' (kök), '+ kesim makineleri'.
    // opAd üzerinden direkt arama — operations tablosuna bağımlılık yok, opId boş bile olsa çalışır.
    const KESIM_OPS = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH', 'ROUTER']
    const isKesimWO = (w: typeof workOrders[0]) => {
      const opAd = (w.opAd || '').toLocaleUpperCase('tr-TR')
      return KESIM_OPS.some(k => opAd.includes(k))
    }

    // Plana atanmış WO ID seti (sadece iptal olmamış planlar)
    const planliWoIds = new Set<string>()
    for (const cp of cuttingPlans) {
      if (!isCuttingPlanActive(cp)) continue
      for (const s of (cp.satirlar || [])) {
        for (const k of (s.kesimler || [])) {
          if (k.woId) planliWoIds.add(k.woId)
        }
      }
    }
    const kesim = workOrders.filter(w => {
      if (!isWorkOrderOpen(w)) return false
      if (!isKesimWO(w)) return false
      return !planliWoIds.has(w.id)
    }).length

    const mrp = orders.filter(isOrderMrpPending).length
    const tedarik = tedarikler.filter(isProcurementPending).length

    return { kesim, mrp, tedarik }
  }, [workOrders, orders, cuttingPlans, tedarikler])

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

      {user && (
        <span className="text-[11px] text-zinc-500 font-mono">{user.email ? `${user.username} (${user.email})` : user.username}</span>
      )}

      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        <div className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-green' : 'bg-red'}`} />
        <span className="text-zinc-500">{synced ? 'Bağlı' : 'Çevrimdışı'}</span>
      </div>

      <button onClick={() => loadAll()} className="text-zinc-500 hover:text-zinc-300" title="Yenile"><RefreshCw size={14} /></button>
      <HelpNotesButtons username={user?.username || 'anonim'} />
      <button onClick={() => setShowPassModal(true)} className="text-zinc-500 hover:text-amber" title="Şifre Değiştir"><Key size={14} /></button>
      <button onClick={onSignOut} className="text-zinc-500 hover:text-red" title="Çıkış"><LogOut size={14} /></button>
    </header>

    {showPassModal && <PassModal onClose={() => setShowPassModal(false)} />}
    {showFlowModal && <FlowModal flows={activeFlows} onClose={() => setShowFlowModal(false)} onAction={() => { loadAll(); setShowFlowModal(false) }} />}
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

function PassModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')

  function save() {
    if (current !== 'admin123' && current !== localStorage.getItem('uys_admin_pass')) {
      toast.error('Mevcut şifre hatalı'); return
    }
    if (newPass.length < 4) { toast.error('Yeni şifre en az 4 karakter olmalı'); return }
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
