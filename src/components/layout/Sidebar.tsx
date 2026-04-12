import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import {
  LayoutDashboard, ClipboardList, Clock, PlusCircle, Scissors,
  Warehouse, Truck, TreePine, BookOpen, Package, Settings2,
  Users, Building2, AlertCircle, BarChart3, Database, HardHat, ShoppingCart
} from 'lucide-react'

const NAV = [
  { label: 'GENEL', items: [
    { path: '/', label: 'Genel Bakış', icon: LayoutDashboard, badge: 'dash' },
  ]},
  { label: 'ÜRETİM', items: [
    { path: '/orders', label: 'Siparişler', icon: ClipboardList, badge: 'orders' },
    { path: '/work-orders', label: 'İş Emirleri', icon: Clock, badge: 'workOrders' },
    { path: '/production', label: 'Üretim Girişi', icon: PlusCircle },
    { path: '/cutting', label: 'Kesim Planları', icon: Scissors, badge: 'cuttingPlans' },
    { path: '/warehouse', label: 'Depolar', icon: Warehouse, badge: 'stokHareketler' },
    { path: '/shipment', label: 'Sevkiyat', icon: Truck, badge: 'sevkler' },
  ]},
  { label: 'TANIMLAR', items: [
    { path: '/bom', label: 'Ürün Ağaçları', icon: TreePine, badge: 'bomTrees' },
    { path: '/recipes', label: 'Reçeteler', icon: BookOpen, badge: 'recipes' },
    { path: '/materials', label: 'Malzeme Listesi', icon: Package, badge: 'materials' },
    { path: '/operations', label: 'Operasyonlar', icon: Settings2, badge: 'operations' },
    { path: '/operators', label: 'Operatörler', icon: Users, badge: 'operators' },
    { path: '/suppliers', label: 'Tedarikçiler', icon: Building2, badge: 'tedarikciler' },
    { path: '/procurement', label: 'Tedarik Yönetimi', icon: ShoppingCart, badge: 'tedarikler' },
    { path: '/downtime-codes', label: 'Duruş Kodları', icon: AlertCircle, badge: 'durusKodlari' },
  ]},
  { label: 'SİSTEM', items: [
    { path: '/reports', label: 'Raporlar', icon: BarChart3 },
    { path: '/data', label: 'Veri Yönetimi', icon: Database },
    { path: '/operator', label: 'Operatör Paneli', icon: HardHat },
  ]},
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const store = useStore()

  function getBadge(key?: string): string {
    if (!key) return ''
    const arr = (store as unknown as Record<string, unknown>)[key]
    if (Array.isArray(arr)) return String(arr.length)
    return ''
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-full w-56 bg-bg-1 border-r border-border overflow-y-auto transition-transform lg:translate-x-0 lg:static lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="px-4 py-4 border-b border-border">
          <div className="text-sm font-bold text-accent tracking-wide">ÜRETİM YÖNETİM</div>
          <div className="text-[10px] text-zinc-500 font-mono">v3</div>
        </div>

        <nav className="py-2">
          {NAV.map(group => (
            <div key={group.label}>
              <div className="px-4 pt-4 pb-1 text-[10px] font-semibold text-zinc-500 tracking-widest">
                {group.label}
              </div>
              {group.items.map(item => {
                const active = location.pathname === item.path
                const badge = getBadge(item.badge)
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); onClose() }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors',
                      active
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-zinc-400 hover:bg-bg-2 hover:text-zinc-200'
                    )}
                  >
                    <item.icon size={15} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {badge && (
                      <span className="text-[10px] font-mono bg-bg-3 text-zinc-400 px-1.5 py-0.5 rounded">
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
