// v15.36 — Akış Progress Bar
// Sipariş → Kesim → MRP → Tedarik adımlarında kullanıcıya "neredeyim" hissi verir.
// Her akış sayfasında ortak kullanılır: Orders, CuttingPlans, MRP, Procurement.
// Flow store'dan okur; durum='aktif' değilse render etmez (tamamlanan akış banner'ı göstermez).

import { useStore } from '@/store'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { FlowStep } from '@/types'

const STEPS: { key: FlowStep; label: string; route: string }[] = [
  { key: 'siparis', label: 'Sipariş',  route: '/orders' },
  { key: 'kesim',   label: 'Kesim',    route: '/cutting' },
  { key: 'mrp',     label: 'MRP',      route: '/mrp' },
  { key: 'tedarik', label: 'Tedarik',  route: '/procurement' },
]

export function FlowProgress({
  flowId,
  current,
  actions,
}: {
  flowId: string
  current: FlowStep
  actions?: React.ReactNode
}) {
  const { pendingFlows } = useStore()
  const navigate = useNavigate()
  const flow = flowId ? pendingFlows.find(f => f.id === flowId) : null
  if (!flow || flow.durum !== 'aktif') return null

  const currentIdx = STEPS.findIndex(s => s.key === current)
  if (currentIdx < 0) return null

  return (
    <div className="mb-4 p-3 bg-amber/5 border border-amber/25 rounded-lg">
      {/* Başlık + aksiyonlar */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-xs min-w-0 flex-1 truncate">
          <span className="font-semibold text-amber">🔄 Akış</span>
          <span className="ml-2 text-zinc-300 truncate">
            {flow.stateData.baslik || `Sipariş ${flow.stateData.siparisNo || ''}`}
          </span>
        </div>
        {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Progress bar — 4 adım */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          const clickable = done  // Tamamlanan adımlara geri dönebilir
          return (
            <div key={s.key} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => clickable && navigate(s.route + '?flow=' + flowId)}
                disabled={!clickable}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded transition-colors
                  ${clickable ? 'hover:bg-bg-3/50 cursor-pointer' : 'cursor-default'}
                `}
                title={clickable ? 'Bu adıma dön' : ''}
              >
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                  ${done
                    ? 'bg-green text-white'
                    : active
                      ? 'bg-amber text-black ring-2 ring-amber/30'
                      : 'bg-bg-3 text-zinc-500'
                  }
                `}>
                  {done ? <Check size={12} strokeWidth={3} /> : (i + 1)}
                </div>
                <span className={`
                  text-[11px] whitespace-nowrap
                  ${active ? 'text-amber font-semibold' : done ? 'text-green' : 'text-zinc-500'}
                `}>
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-green' : 'bg-bg-3'}`}></div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
