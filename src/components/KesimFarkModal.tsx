// v15.83 — Senaryo 1 modali (Faz 1 MVP)
// Kesim plani sonrasi bar cikisi ile siparis adeti farkliysa (veya esit olsa bile bilgi)
// kullaniciya gosterilir. Kabul edilirse IE.hedef bar cikisina guncellenir.
// Faz 2'de "Duzenle" + fire/geri kazanim sorusu eklenecek.
import { X, AlertTriangle, Check } from 'lucide-react'

export interface KesimFarkItem {
  woId: string
  ieNo: string
  mamulAd: string
  siparisAdeti: number   // wo.hedef (modal acilmadan onceki)
  barCikisi: number      // kesim planindan toplam adet
  fark: number           // barCikisi - siparisAdeti (+/0/-)
}

interface Props {
  items: KesimFarkItem[]
  onConfirm: () => void
  onCancel: () => void
}

export function KesimFarkModal({ items, onConfirm, onCancel }: Props) {
  const farkliSayisi = items.filter(i => i.fark !== 0).length
  const toplamFazla = items.reduce((a, b) => a + Math.max(0, b.fark), 0)
  const toplamEksik = items.reduce((a, b) => a + Math.max(0, -b.fark), 0)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {farkliSayisi > 0
              ? <AlertTriangle size={18} className="text-amber" />
              : <Check size={18} className="text-green" />}
            <h3 className="text-base font-semibold">
              Kesim Plani Onayi {farkliSayisi > 0 && <span className="text-amber text-xs ml-2">({farkliSayisi} farkli)</span>}
            </h3>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        {/* Aciklama */}
        <div className="px-4 pt-3 text-xs text-zinc-400">
          {farkliSayisi > 0 ? (
            <>
              Kesim plani sonucunda <span className="text-amber font-semibold">{farkliSayisi}</span> is emrinde
              bar bolumlemesi nedeniyle siparisten farkli adet ciktisi var.
              {toplamFazla > 0 && <> <span className="text-green">+{toplamFazla} fazla</span> stoga kalir.</>}
              {toplamEksik > 0 && <> <span className="text-red">-{toplamEksik} eksik</span> ek baska bar gerekir.</>}
            </>
          ) : (
            <>Kesim plani siparis adetiyle tam ortusuyor. Onaylayinca MRP ve tedarik adimlari calisir.</>
          )}
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {items.map(it => (
              <div key={it.woId} className={`border rounded-lg p-3 ${it.fark === 0 ? 'border-border bg-bg-2/30' : it.fark > 0 ? 'border-amber/30 bg-amber/5' : 'border-red/30 bg-red/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-zinc-500 mb-0.5">{it.ieNo}</div>
                    <div className="text-sm font-medium truncate">{it.mamulAd || '(adsiz)'}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-right">
                      <div className="text-zinc-500">Siparis</div>
                      <div className="font-mono font-semibold">{it.siparisAdeti}</div>
                    </div>
                    <div className="text-zinc-500">→</div>
                    <div className="text-right">
                      <div className="text-zinc-500">Bar Cikisi</div>
                      <div className={`font-mono font-semibold ${it.fark === 0 ? '' : it.fark > 0 ? 'text-amber' : 'text-red'}`}>{it.barCikisi}</div>
                    </div>
                    <div className={`px-2 py-0.5 rounded font-mono font-semibold text-[11px] ${it.fark === 0 ? 'bg-green/15 text-green' : it.fark > 0 ? 'bg-amber/15 text-amber' : 'bg-red/15 text-red'}`}>
                      {it.fark > 0 ? '+' : ''}{it.fark}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-border">
          <div className="text-[11px] text-zinc-500">
            Kabul edince: IE hedef = Bar Cikisi. Iptal: zincir durur, taslak kalir.
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">
              Iptal
            </button>
            <button onClick={onConfirm} className="px-4 py-1.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs font-semibold hover:bg-cyan-500/25">
              Kabul Et ve Devam
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
