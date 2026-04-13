import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import {
  LayoutDashboard, ClipboardList, Clock, PlusCircle, Scissors,
  Warehouse, Truck, TreePine, BookOpen, Package, Settings2,
  Users, Building2, AlertCircle, BarChart3, Database, HardHat, ShoppingCart, ClipboardCheck, Calculator, Cpu
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
    { path: '/mrp', label: 'MRP', icon: Calculator },
    { path: '/procurement', label: 'Tedarik', icon: ShoppingCart, badge: 'tedarikler' },
    { path: '/warehouse', label: 'Depolar', icon: Warehouse, badge: 'stokHareketler' },
    { path: '/shipment', label: 'Sevkiyat', icon: Truck, badge: 'sevkler' },
  ]},
  { label: 'TANIMLAR', items: [
    { path: '/bom', label: 'Ürün Ağaçları', icon: TreePine, badge: 'bomTrees' },
    { path: '/recipes', label: 'Reçeteler', icon: BookOpen, badge: 'recipes' },
    { path: '/materials', label: 'Malzeme Listesi', icon: Package, badge: 'materials' },
    { path: '/operations', label: 'Operasyonlar', icon: Settings2, badge: 'operations' },
    { path: '/stations', label: 'İstasyonlar', icon: Cpu, badge: 'stations' },
    { path: '/operators', label: 'Operatörler', icon: Users, badge: 'operators' },
    { path: '/suppliers', label: 'Tedarikçiler', icon: Building2, badge: 'tedarikciler' },
    { path: '/downtime-codes', label: 'Duruş Kodları', icon: AlertCircle, badge: 'durusKodlari' },
  ]},
  { label: 'SİSTEM', items: [
    { path: '/reports', label: 'Raporlar', icon: BarChart3 },
    { path: '/data', label: 'Veri Yönetimi', icon: Database },
    { path: '/operator', label: 'Operatör Paneli', icon: HardHat },
    { path: '/checklist', label: 'Checklist', icon: ClipboardCheck, badge: 'checklist' },
  ]},
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const store = useStore()

  function getBadge(key?: string): string {
    if (!key) return ''
    if (key === 'orders') {
      const open = store.orders.filter(o => o.durum !== 'kapalı').length
      return open > 0 ? String(open) : ''
    }
    if (key === 'workOrders') {
      const active = store.workOrders.filter(w => {
        const prod = store.logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
        return prod < w.hedef && w.durum !== 'iptal' && w.durum !== 'tamamlandi'
      }).length
      return active > 0 ? String(active) : ''
    }
    if (key === 'dash') {
      const okunmamis = store.operatorNotes.filter(n => !n.okundu).length
      return okunmamis > 0 ? String(okunmamis) : ''
    }
    if (key === 'tedarikler') {
      const bekleyen = store.tedarikler.filter(t => !t.geldi).length
      return bekleyen > 0 ? String(bekleyen) : ''
    }
    if (key === 'cuttingPlans') {
      const bekleyen = store.cuttingPlans.filter(p => p.durum !== 'tamamlandi').length
      return bekleyen > 0 ? String(bekleyen) : ''
    }
    const arr = (store as unknown as Record<string, unknown>)[key]
    if (Array.isArray(arr) && arr.length > 0) return String(arr.length)
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
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        item.badge === 'dash' && parseInt(badge) > 0 ? 'bg-red/20 text-red' :
                        item.badge === 'tedarikler' ? 'bg-amber/15 text-amber' :
                        item.badge === 'workOrders' ? 'bg-accent/15 text-accent' :
                        item.badge === 'cuttingPlans' ? 'bg-green/15 text-green' :
                        'bg-bg-3 text-zinc-400'
                      }`}>
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
