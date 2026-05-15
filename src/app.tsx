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
const Logs = lazy(() => import('@/pages/Logs').then(m => ({ default: m.Logs })))
const DataManagement = lazy(() => import('@/pages/DataManagement').then(m => ({ default: m.DataManagement })))
const Procurement = lazy(() => import('@/pages/Procurement').then(m => ({ default: m.Procurement })))
const OperatorPanel = lazy(() => import('@/pages/OperatorPanel').then(m => ({ default: m.OperatorPanel })))

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-bg-0">
    <div className="text-zinc-500 text-sm">Yükleniyor...</div>
  </div>
)

export default function App() {

  const { session, loading: authLoading, signIn, signInWithGoogle, signOut, guestLogin, operatorLogin, isGuest, isOperator, role, can } = useAuth()

  useRealtime()
  useEffect(() => { loadAllStores() }, [])

  // Auto backup
  useEffect(() => {
    if (!session || !can('backup_create')) return

    const alanKisi = session.username || session.email || 'system'

    ensureDailyAutoBackup(alanKisi)
  }, [session, can])

  if (authLoading) {
    return <PageFallback />
  }

  if (!session) {
    return <Login
      onLogin={signIn}
      onGoogleLogin={signInWithGoogle}
      onGuest={guestLogin}
      onOperatorLogin={(oprId, oprAd) => {
        operatorLogin(oprId, oprAd)
        setTimeout(() => { window.location.hash = '#/operator' }, 100)
      }}
    />
  }

  return (
    <HashRouter>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />

      {isOperator ? (
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="*" element={<OperatorPanel />} />
          </Routes>
        </Suspense>
      ) : (
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<Layout onSignOut={signOut} />}>
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
              <Route path="/logs" element={<Logs />} />
              <Route path="/data" element={<DataManagement />} />
              <Route path="/procurement" element={<Procurement />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )}
    </HashRouter>
  )
}
