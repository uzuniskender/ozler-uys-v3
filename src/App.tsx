import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useRealtime } from '@/hooks/useRealtime'
import { useStore } from '@/store'
import { Layout } from '@/components/layout/Layout'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Orders } from '@/pages/Orders'
import { WorkOrders } from '@/pages/WorkOrders'
import { ProductionEntry } from '@/pages/ProductionEntry'
import { CuttingPlans } from '@/pages/CuttingPlans'
import { MRP } from '@/pages/MRP'
import { Warehouse } from '@/pages/Warehouse'
import { Shipment } from '@/pages/Shipment'
import { BomTrees } from '@/pages/BomTrees'
import { Recipes } from '@/pages/Recipes'
import { Materials } from '@/pages/Materials'
import { Operations } from '@/pages/Operations'
import { Stations } from '@/pages/Stations'
import { Operators } from '@/pages/Operators'
import { Suppliers } from '@/pages/Suppliers'
import { DowntimeCodes } from '@/pages/DowntimeCodes'
import { Reports } from '@/pages/Reports'
import { DataManagement } from '@/pages/DataManagement'
import { Procurement } from '@/pages/Procurement'
import { OperatorPanel } from '@/pages/OperatorPanel'
import { Checklist } from '@/pages/Checklist'

import { GUEST_PATHS } from '@/components/layout/Sidebar'

// Admin sayfaları — auth kontrolü App seviyesinde, burada sadece rotalar
function AdminRoutes({ onSignOut }: { onSignOut: () => void }) {
  const { loadAll } = useStore()
  useRealtime()
  useEffect(() => { loadAll() }, [loadAll])

  return (
    <HashRouter>
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
          <Route path="/data" element={<DataManagement />} />
          <Route path="/procurement" element={<Procurement />} />
          <Route path="/checklist" element={<Checklist />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

// Operatör sayfası — admin rotası YOK, geri tuşu engellenmiş
function OperatorRoutes({ onSignOut }: { onSignOut: () => void }) {
  const { loadAll } = useStore()
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
      <Routes>
        <Route path="*" element={<OperatorPanel />} />
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  const { session, loading: authLoading, signIn, signInWithGoogle, signOut, guestLogin, operatorLogin, isGuest, isOperator, role } = useAuth()

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
