import { useEffect, useState } from 'react'
import { useProductionStore, useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'

function gecenDakika(baslangic: string): number {
  if (!baslangic) return 0
  const [h, m] = baslangic.split(':').map(Number)
  const now = new Date()
  const basMin = h * 60 + m
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const diff = nowMin - basMin
  return diff >= 0 ? diff : diff + 1440
}

function formatDakika(dk: number): string {
  if (dk < 60) return `${dk}dk`
  return `${Math.floor(dk / 60)}s ${dk % 60}dk`
}

function durumRenk(dk: number): string {
  if (dk < 60) return 'text-green'
  if (dk < 180) return 'text-amber'
  return 'text-red'
}

export function ActiveWorkPanel() {
  const activeWork = useProductionStore(s => s.activeWork)
  const workOrders = useProductionStore(s => s.workOrders)
  const loadOwn = useProductionStore(s => s.loadOwn)
  const operators = useAuthStore(s => s.operators)
  const [tick, setTick] = useState(0)
  const [realtime, setRealtime] = useState(true)

  // Her dakika yenile
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  // Realtime subscription
  useEffect(() => {
    if (!realtime) return
    const ch = supabase
      .channel('active-work-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uys_active_work' }, () => {
        loadOwn()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [realtime, loadOwn])

  // activeWork → WO detay birleştir
  const rows = (activeWork || []).map(aw => {
    const wo = workOrders.find(w => w.id === aw.woId)
    const opr = operators.find(o => o.id === aw.opId)
    const dk = gecenDakika(aw.baslangic)
    return { ...aw, wo, opr, dk }
  }).sort((a, b) => b.dk - a.dk)

  // İstatistikler
  const toplamCalisanOpr = new Set((activeWork || []).map(a => a.opId)).size
  const toplamAktifIE = new Set((activeWork || []).map(a => a.woId)).size
  const enUzun = rows[0]?.dk ?? 0

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-200">🏭 Canlı Üretim Takibi</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Operatörlerin anlık çalışma durumu</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={realtime} onChange={e => setRealtime(e.target.checked)}
              className="accent-accent" />
            Canlı
          </label>
          <button onClick={() => loadOwn()}
            className="px-2 py-1 text-xs bg-bg-2 border border-border rounded text-zinc-400 hover:text-zinc-200">
            ↻ Yenile
          </button>
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg-1 border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green">{toplamCalisanOpr}</div>
          <div className="text-xs text-zinc-500 mt-1">Çalışan Operatör</div>
        </div>
        <div className="bg-bg-1 border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-accent">{toplamAktifIE}</div>
          <div className="text-xs text-zinc-500 mt-1">Aktif İş Emri</div>
        </div>
        <div className="bg-bg-1 border border-border rounded-lg p-4 text-center">
          <div className={`text-2xl font-bold ${durumRenk(enUzun)}`}>{formatDakika(enUzun)}</div>
          <div className="text-xs text-zinc-500 mt-1">En Uzun Süre</div>
        </div>
      </div>

      {/* Canlı liste */}
      {rows.length === 0 ? (
        <div className="bg-bg-1 border border-border rounded-lg p-12 text-center">
          <div className="text-4xl mb-3">😴</div>
          <div className="text-zinc-500">Şu an çalışan operatör yok.</div>
        </div>
      ) : (
        <div className="bg-bg-1 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs text-zinc-500 font-medium">Operatör</th>
                <th className="px-4 py-2.5 text-left text-xs text-zinc-500 font-medium">İş Emri</th>
                <th className="px-4 py-2.5 text-left text-xs text-zinc-500 font-medium">Ürün</th>
                <th className="px-4 py-2.5 text-left text-xs text-zinc-500 font-medium">Bölüm</th>
                <th className="px-4 py-2.5 text-left text-xs text-zinc-500 font-medium">Başlangıç</th>
                <th className="px-4 py-2.5 text-left text-xs text-zinc-500 font-medium">Süre</th>
                <th className="px-4 py-2.5 text-left text-xs text-zinc-500 font-medium">Hedef</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-bg-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green animate-pulse inline-block" />
                      <span className="text-zinc-200 font-medium">{row.opAd}</span>
                    </div>
                    {row.opr?.bolum && (
                      <div className="text-[10px] text-zinc-500 ml-4">{row.opr.bolum}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {row.wo?.ieNo || row.woId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-zinc-300 text-xs">{row.woAd || row.wo?.malad}</div>
                    {row.wo?.malkod && (
                      <div className="text-[10px] text-zinc-600 font-mono">{row.wo.malkod}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {row.wo?.opAd || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {row.baslangic || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${durumRenk(row.dk)}`}>
                      {formatDakika(row.dk)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {row.wo?.hedef ? `${row.wo.hedef} adet` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Güncelleme zamanı */}
      <div className="text-[10px] text-zinc-600 text-right">
        Son güncelleme: {new Date().toLocaleTimeString('tr-TR')} {tick > 0 && `(${tick}. yenileme)`}
      </div>
    </div>
  )
}
