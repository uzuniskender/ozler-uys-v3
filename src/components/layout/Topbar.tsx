import { Menu, LogOut, RefreshCw } from 'lucide-react'
import { useStore } from '@/store'

interface TopbarProps {
  onMenuClick: () => void
  onSignOut: () => void
}

export function Topbar({ onMenuClick, onSignOut }: TopbarProps) {
  const { synced, loadAll } = useStore()

  return (
    <header className="h-12 bg-bg-1 border-b border-border flex items-center px-4 gap-3">
      <button onClick={onMenuClick} className="lg:hidden text-zinc-400 hover:text-white">
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        <div className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-green' : 'bg-red'}`} />
        <span className="text-zinc-500">{synced ? 'Bağlı' : 'Çevrimdışı'}</span>
      </div>

      <button
        onClick={() => loadAll()}
        className="text-zinc-500 hover:text-zinc-300 transition-colors"
        title="Yenile"
      >
        <RefreshCw size={14} />
      </button>

      <button
        onClick={onSignOut}
        className="text-zinc-500 hover:text-red transition-colors"
        title="Çıkış"
      >
        <LogOut size={14} />
      </button>
    </header>
  )
}
