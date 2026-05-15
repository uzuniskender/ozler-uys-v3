import { useEffect, lazy, Suspense } from 'react'
import { useOrderStore } from "@/store"
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useRealtime } from '@/hooks/useRealtime'
import { loadAllStores } from '@/store'
import { Layout } from '@/components/layout/Layout'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { ensureDailyAutoBackup } from '@/lib/backup'

import { GUEST_PATHS } from '@/components/layout/Sidebar'

const Orders = lazy(() => import('@/pages/Orders').then(m => ({ default: m.Orders })))
const WorkOrders = lazy(() => import('@/pages/WorkOrders').then(m => ({ default: m.WorkOrders })))
const ProductionEntry = lazy(() => import('@/pages/ProductionEntry').then(m => ({ default: m.ProductionEntry })))
const CuttingPlans = lazy(() => import('@/pages/CuttingPlans').then(m => ({ default: m.CuttingPlans })))
const MRP = lazy(() => import('@/pages/MRP').then(m => ({ default: m.MRP })))
const Warehouse = lazy(() => import('@/pages/Warehouse').then(m => ({ default: m.Warehouse })))
const Shipment = lazy(() => import('@/pages/Shipment').then(m => ({ default: m.Shipment })))
const BomTrees = lazy(() => import('@/pages/BomTrees').then(m => ({ default: m.BomTrees })))
const Recipes = lazy(() => import('@/pages/Recipes').then(m => ({ default: m.Recipes })))
const Materials = lazy(() => import('@/pages/Materials').then(m => ({ default: m.Materials })))
const Operations = lazy(() => import('@/pages/Operations').then(m => ({ default: m.Operations })))
const Stations = lazy(() => import('@/pages/Stations').then(m => ({ default: m.Stations })))
const Operators = lazy(() => import('@/pages/Operators').then(m => ({ default: m.Operators })))
const Suppliers = lazy(() => import('@/pages/Suppliers').then(m => ({ default: m.Suppliers })))
const DowntimeCodes = lazy(() => import('@/pages/DowntimeCodes').then(m => ({ default: m.DowntimeCodes })))
const Reports = lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })))
const HammaddeRapor = lazy(() => import('@/pages/HammaddeRapor').then(m => ({ default: m.HammaddeRapor })))
const TestPanel = lazy(() => import('@/pages/TestPanel').then(m => ({ default: m.TestPanel })))
const Logs = lazy(() => import('@/pages/Logs').then(m => ({ default: m.Logs })))
const DataManagement = lazy(() => import('@/pages/DataManagement').then(m => ({ default: m.DataManagement })))
const TestMode = lazy(() => import('@/pages/TestMode').then(m => ({ default: m.TestMode })))
const Procurement = lazy(() => import('@/pages/Procurement').then(m => ({ default: m.Procurement })))
const OperatorPanel = lazy(() => import('@/pages/OperatorPanel').then(m => ({ default: m.OperatorPanel })))
const Checklist = lazy(() => import('@/pages/Checklist').then(m => ({ default: m.Checklist })))
const Messages = lazy(() => import('@/pages/Messages').then(m => ({ default: m.Messages })))
const ProblemTakip = lazy(() => import('@/pages/ProblemTakip').then(m => ({ default: m.ProblemTakip })))
const Chat = lazy(() => import('@/pages/Chat'))
const HmTipleri = lazy(() => import('@/pages/HmTipleri').then(m => ({ default: m.HmTipleri })))
const Backup = lazy(() => import('@/pages/Backup').then(m => ({ default: m.Backup })))
const StokLog = lazy(() => import('@/pages/StokLog').then(m => ({ default: m.StokLog })))
const DevSync = lazy(() => import('@/pages/DevSync').then(m => ({ default: m.DevSync })))
const ActiveWorkPanel = lazy(() => import('@/pages/ActiveWorkPanel').then(m => ({ default: m.ActiveWorkPanel })))
const IeHazirlama = lazy(() => import('@/pages/IeHazirlama').then(m => ({ default: m.IeHazirlama })))

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-bg-0">
    <div className="text-zinc-500 text-sm">Yükleniyor...</div>
  </div>
)

// Admin sayfaları — auth kontrolü App seviyesinde, burada sadece rotalar
function AdminRoutes({ onSignOut }: { onSignOut: () => void }) {
  const loadAll = loadAllStores
  useRealtime()
  useEffect(() => { loadAll() }, [loadAll])

  return (
    <HashRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/operator" element={<OperatorPanel />} />
          <Route element={<Layout onSignOut={onSignOut} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/production" element={<ProductionEntry />} />
            <Route path="/cutting" element={<CuttingPlans />} />
            <Route path="/mrp" element={<MRP />} />
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/shipment" element={<Shipment />} />
            <Route path="/bom" element={<BomTrees />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/operations" element={<Operations />} />
            <Route path="/stations" element={<Stations />} />
            <Route path="/operators" element={<Operators />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/downtime-codes" element={<DowntimeCodes />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/hammadde-rapor" element={<HammaddeRapor />} />
            <Route path="/test" element={<TestPanel />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/test-mode" element={<TestMode />} />
            <Route path="/data" element={<DataManagement />} />
            <Route path="/procurement" element={<Procurement />} />
            <Route path="/checklist" element={<Checklist />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/problem-takip" element={<ProblemTakip />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/hm-tipleri" element={<HmTipleri />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="/stok-log" element={<StokLog />} />
            <Route path="/active-work" element={<ActiveWorkPanel />} />
            <Route path="/ie-hazirlama" element={<IeHazirlama />} />
            <Route path="/dev-sync" element={<DevSync />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}

// Operatör sayfası — admin rotası YOK, geri tuşu engellenmiş
function OperatorRoutes({ onSignOut }: { onSignOut: () => void }) {
  const loadAll = loadAllStores
  useRealtime()
  useEffect(() => { loadAll() }, [loadAll])

  // Geri tuşunu engelle — operatör asla admin sayfasına gidemez
  useEffect(() => {
    // Tarayıcı geçmişini temizle
    window.history.replaceState(null, '', window.location.href)
    function blockBack() {
      window.history.pushState(null, '', window.location.href)
    }
    // İlk yüklemede geçmiş yığınına bir giriş ekle
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', blockBack)
    return () => window.removeEventListener('popstate', blockBack)
  }, [])

  return (
    <HashRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="*" element={<OperatorPanel />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}

export default function App() {
  const { session, loading: authLoading, signIn, signInWithGoogle, signOut, guestLogin, operatorLogin, isGuest, isOperator, role, can } = useAuth()

  // v15.53 Adım 4 — Admin login olunca otomatik günlük yedek (fire-and-forget)
  // Idempotent: günde defalarca tetiklenebilir, ensureDailyAutoBackup içeride
  // 'bugün için yedek var mı?' kontrolü yapar. Sahaya etki: ilk login sonrası
  // arka planda ~5sn iş — render bloklamaz, sessiz fail (kullanıcıya gösterilmez).
  useEffect(() => {
    if (!session) return
    if (!can('backup_create')) return
    const alanKisi = session.username || session.email || (session as any).dbId || 'system'
    ensureDailyAutoBackup(alanKisi).then(r => {
      if (r.ok) console.log('[v15.53] Otomatik günlük yedek alındı (eski silinen: %s)', r.deletedOld)
      else if (r.skipped) console.log('[v15.53] Otomatik yedek bugün için zaten alınmış')
      else if (r.error) console.warn('[v15.53] Otomatik yedek alınamadı:', r.error)
    })
  }, [session?.dbId, session?.email, session?.username])

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-bg-0"><div className="text-zinc-500 text-sm">Yükleniyor...</div></div>
  }

  // Oturum yok → Giriş sayfası
  if (!session) {
    return <Login onLogin={signIn} onGoogleLogin={signInWithGoogle} onGuest={guestLogin} onOperatorLogin={(oprId, oprAd) => {
      operatorLogin(oprId, oprAd)
      setTimeout(() => { window.location.hash = '#/operator' }, 100)
    }} />
  }

  // ═══ OPERATÖR: Sadece OperatorPanel, admin rotası YOK ═══
  if (isOperator) {
    return (
      <>
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
        <div className="fixed top-0 left-0 right-0 z-50 bg-green/90 text-black text-center text-xs py-1 font-semibold">
          🏭 OPERATÖR MODU — {session.username} · <button onClick={signOut} className="underline">Çıkış</button>
        </div>
        <OperatorRoutes onSignOut={signOut} />
      </>
    )
  }

  const ROLE_LABELS: Record<string, string> = {
    uretim_sor: '🔧 ÜRETİM SORUMLUSU',
    planlama: '📋 PLANLAMA',
    depocu: '📦 DEPOCU',
  }

  // ═══ ADMİN / MİSAFİR / RBAC ROLLER: Tüm sayfalar ═══
  return (
    <>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
      {isGuest && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber/90 text-black text-center text-xs py-1 font-semibold">
          👁 MİSAFİR MODU — Salt okunur · <button onClick={signOut} className="underline">Çıkış</button>
        </div>
      )}
      {ROLE_LABELS[role] && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-accent/90 text-white text-center text-xs py-1 font-semibold">
          {ROLE_LABELS[role]} — {session.username} · <button onClick={signOut} className="underline">Çıkış</button>
        </div>
      )}
      <AdminRoutes onSignOut={signOut} />
    </>
  )
}
