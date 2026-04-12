import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function Layout({ onSignOut }: { onSignOut: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isTestMode = localStorage.getItem('uys_test_mode') === 'true'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        {isTestMode && (
          <div className="bg-amber text-black text-center text-xs font-semibold py-1 tracking-wider">
            ⚠ TEST ORTAMI — Veriler test amaçlıdır
          </div>
        )}
        <Topbar onMenuClick={() => setSidebarOpen(true)} onSignOut={onSignOut} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
