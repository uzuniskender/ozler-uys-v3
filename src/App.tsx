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

function AppContent() {
  const { signOut } = useAuth()
  const { loadAll, loading } = useStore()
  useRealtime()

  useEffect(() => { loadAll() }, [loadAll])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-0">
        <div className="text-center">
          <div className="text-accent text-sm font-semibold mb-2">Veriler yükleniyor...</div>
          <div className="text-zinc-600 text-xs font-mono">Supabase tablolarından okunuyor</div>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout onSignOut={signOut} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/production" element={<ProductionEntry />} />
          <Route path="/cutting" element={<CuttingPlans />} />
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
          <Route path="/operator" element={<OperatorPanel />} />
          <Route path="/checklist" element={<Checklist />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default function App() {
  const { session, loading: authLoading, signIn, signOut, guestLogin, isGuest } = useAuth()

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-bg-0"><div className="text-zinc-500 text-sm">Yükleniyor...</div></div>
  }

  if (!session) {
    return <Login onLogin={signIn} onGuest={guestLogin} />
  }

  return (
    <>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
      {isGuest && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber/90 text-black text-center text-xs py-1 font-semibold">
          👁 MİSAFİR MODU — Salt okunur · <button onClick={signOut} className="underline">Çıkış</button>
        </div>
      )}
      <AppContent />
    </>
  )
}
