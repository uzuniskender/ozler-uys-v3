import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '@/hooks/useAuth'

export function Layout({ onSignOut }: { onSignOut: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isGuest } = useAuth()
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
        {isGuest && (
          <div className="bg-zinc-800 text-amber text-center text-[11px] font-semibold py-1.5 tracking-wide border-b border-amber/20">
            🔒 MİSAFİR MODU — Sadece görüntüleme. Düzenleme, silme ve ekleme işlemleri devre dışıdır.
          </div>
        )}
        <Topbar onMenuClick={() => setSidebarOpen(true)} onSignOut={onSignOut} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6" data-guest={isGuest || undefined}>
          {isGuest && <style>{`
            /* Aksiyon butonları: Yeni, Sil, Kaydet, Düzenle, Excel Yükle vb. */
            [data-guest] button[class*="bg-accent"],
            [data-guest] button[class*="bg-green"],
            [data-guest] button[class*="bg-red"],
            [data-guest] button[class*="bg-amber"],
            [data-guest] button[class*="bg-cyan"],
            [data-guest] button[class*="bg-purple"] { pointer-events: none !important; opacity: 0.15 !important; }
            /* Silme/düzenleme butonları (küçük inline) */
            [data-guest] button[class*="hover:text-red"],
            [data-guest] button[class*="hover:bg-red"],
            [data-guest] button[class*="hover:bg-green"],
            [data-guest] button[class*="hover:bg-accent"] { pointer-events: none !important; opacity: 0.15 !important; }
            /* Input/textarea/select — sadece düzenleme alanları */
            [data-guest] input[type="number"],
            [data-guest] input[type="file"],
            [data-guest] textarea { pointer-events: none !important; opacity: 0.3 !important; }
            /* Checkbox — filtre hariç düzenleme */
            [data-guest] td input[type="checkbox"],
            [data-guest] label input[type="checkbox"][class*="accent-red"] { pointer-events: none !important; opacity: 0.3 !important; }
          `}</style>}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
