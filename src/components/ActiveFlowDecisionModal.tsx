/**
 * v15.64 (İş Emri #13 madde 17) — Aktif Akış Karar Modalı
 *
 * Spec: "Yeni iş emri yaratmak için taslak ya beklet, ya iptal, ya tamamla."
 *
 * Bu modal kullanıcı yeni iş emri açmaya çalıştığında, yarım kalmış bir akış varsa
 * gösterilir ve mecburi karar isteğinde bulunur:
 *   - Devam Et: mevcut akışın sayfasına yönlendirir
 *   - İptal Et: cancelFlow() ile akış sonlandırılır, yeni iş emri yolu açılır
 *
 * "Beklet" durumu ileride eklenir (DB'de yeni durum string'i + UI buton).
 */
import { cancelFlow, stepToRoute } from '@/lib/pendingFlow'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight, X } from 'lucide-react'
import type { PendingFlow } from '@/types'

export function ActiveFlowDecisionModal({ flow, onResolved, onClose }: {
  flow: PendingFlow
  onResolved: () => void  // İptal sonrası çağrılır — yeni iş emri akışı başlayabilir
  onClose: () => void
}) {
  function devamEt() {
    const route = stepToRoute(flow.currentStep as any)
    const hash = (route.startsWith('#') ? route : '#' + route) + '?flow=' + flow.id
    window.location.hash = hash.startsWith('#') ? hash.slice(1) : hash
    onClose()
  }

  async function iptalEt() {
    const ok = await cancelFlow(flow.id)
    if (ok) {
      toast.success('Akış iptal edildi — yeni iş emri açılabilir')
      onResolved()
    } else {
      toast.error('İptal başarısız')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber" />
            <h2 className="text-lg font-semibold">Yarım Kalmış İş Var</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-zinc-300 leading-relaxed">
            <strong className="text-amber">"{flow.stateData?.baslik || flow.flowType || 'Bilinmeyen akış'}"</strong> akışı tamamlanmadı.
            Yeni iş emri yaratabilmek için bu akışı <strong>devam ettirmeli</strong> veya <strong>iptal etmelisin</strong>.
          </p>
          <div className="text-xs text-zinc-500 bg-bg-2 border border-border rounded-lg p-3 space-y-1">
            <div>Mevcut Adım: <span className="font-mono text-zinc-300">{flow.currentStep || '—'}</span></div>
            <div>Tip: <span className="font-mono text-zinc-300">{flow.flowType || '—'}</span></div>
          </div>
          <p className="text-xs text-zinc-500 italic">
            "Beklet" seçeneği yakında eklenecek (İş Emri #13 madde 17 ileri faz).
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={iptalEt} className="px-3 py-2 bg-red/10 hover:bg-red/20 text-red border border-red/25 rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <X size={13} /> İptal Et
          </button>
          <button onClick={devamEt} className="px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
            <ArrowRight size={13} /> Devam Et
          </button>
        </div>
      </div>
    </div>
  )
}
