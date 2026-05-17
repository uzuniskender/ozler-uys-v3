// ActiveWorkPanel v2 — Canlı Üretim Takibi
// v17.04 — % tamamlanma + progress bar, istasyon bazlı gruplama,
//           bölüm filtresi, günlük üretim, hedef kalan hesabı

import { useEffect, useState, useMemo } from 'react'
import { useProductionStore, useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

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

function sureRenk(dk: number): string {
  if (dk < 60) return 'text-green'
  if (dk < 180) return 'text-amber'
  return 'text-red'
}

function pctRenk(pct: number): string {
  if (pct >= 100) return '#22c55e'   // yeşil — tamamlandı
  if (pct >= 70)  return '#3b82f6'   // mavi
  if (pct >= 40)  return '#f59e0b'   // amber
  return '#ef4444'                    // kırmızı
}

// ─── ProgressBar bileşeni ─────────────────────────────────────────────────────

function ProgressBar({ pct, uretilen, hedef }: { pct: number; uretilen: number; hedef: number }) {
  const w = Math.min(100, pct)
  const renk = pctRenk(pct)
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-bg-3 rounded-full overflow-hidden min-w-[60px]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${w}%`, backgroundColor: renk }}
        />
      </div>
      <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: renk }}>
        {uretilen}/{hedef}
      </span>
    </div>
  )
}

// ─── Ana bileşen ──────────────────────────────────────────────────────────────

export function ActiveWorkPanel() {
  const activeWork = useProductionStore(s => s.activeWork)
  const workOrders = useProductionStore(s => s.workOrders)
  const logs       = useProductionStore(s => s.logs)
  const loadOwn    = useProductionStore(s => s.loadOwn)
  const operators  = useAuthStore(s => s.operators)

  const [tick, setTick]       = useState(0)
  const [realtime, setRealtime] = useState(true)
  const [grupla, setGrupla]   = useState<'liste' | 'istasyon' | 'bolum'>('liste')
  const [bolumFilter, setBolumFilter] = useState<string>('')

  // Her dakika yenile
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  // Realtime subscription
  useEffect(() => {
    if (!realtime) return
    const ch = supabase
      .channel('active-work-panel-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uys_active_work' }, () => {
        loadOwn()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [realtime, loadOwn])

  // Satır hesaplama — log verisini de birleştir
  const rows = useMemo(() => {
    return (activeWork || []).map(aw => {
      const wo  = workOrders.find(w => w.id === aw.woId)
      const opr = operators.find(o => o.id === aw.opId)
      const dk  = gecenDakika(aw.baslangic)

      // Bugünkü üretim (bu WO için)
      const woLogs   = logs.filter(l => l.woId === aw.woId)
      const uretilen = woLogs.reduce((a, l) => a + (l.qty || 0), 0)
      const fireSayi = woLogs.reduce((a, l) => a + (l.fire || 0), 0)
      const hedef    = wo?.hedef ?? 0
      const pct      = hedef > 0 ? Math.min(100, Math.round((uretilen + fireSayi) / hedef * 100)) : 0
      const kalan    = Math.max(0, hedef - uretilen - fireSayi)

      return {
        ...aw,
        wo, opr, dk,
        uretilen, fireSayi, hedef, pct, kalan,
        bolum:    opr?.bolum || wo?.opAd || '—',
        istasyon: wo?.istAd  || wo?.opAd  || '—',
      }
    }).sort((a, b) => b.dk - a.dk)
  }, [activeWork, workOrders, logs, operators, tick])

  // Bölüm listesi (filtre için)
  const bolumler = useMemo(() =>
    [...new Set(rows.map(r => r.bolum).filter(Boolean))].sort(),
    [rows]
  )

  const filtreliRows = bolumFilter
    ? rows.filter(r => r.bolum === bolumFilter)
    : rows

  // İstatistikler
  const toplamCalisanOpr = new Set(rows.map(a => a.opId)).size
  const toplamAktifIE    = new Set(rows.map(a => a.woId)).size
  const enUzun           = rows[0]?.dk ?? 0
  const toplamUretilen   = rows.reduce((a, r) => a + r.uretilen, 0)
  const ortalamaPct      = rows.length > 0
    ? Math.round(rows.reduce((a, r) => a + r.pct, 0) / rows.length)
    : 0

  // İstasyon gruplaması
  const istasyonGruplari = useMemo(() => {
    const map = new Map<string, typeof filtreliRows>()
    for (const r of filtreliRows) {
      const k = r.istasyon
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr'))
  }, [filtreliRows])

  // Bölüm gruplaması
  const bolumGruplari = useMemo(() => {
    const map = new Map<string, typeof filtreliRows>()
    for (const r of filtreliRows) {
      const k = r.bolum
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(r)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr'))
  }, [filtreliRows])

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Başlık + kontroller */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-200">🏭 Canlı Üretim Takibi</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Operatörlerin anlık çalışma ve ilerleme durumu</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bölüm filtresi */}
          {bolumler.length > 1 && (
            <select
              value={bolumFilter}
              onChange={e => setBolumFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-bg-2 border border-border rounded text-zinc-300 focus:outline-none focus:border-accent"
            >
              <option value="">Tüm Bölümler</option>
              {bolumler.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          {/* Gruplama seçeneği */}
          <div className="flex rounded overflow-hidden border border-border text-[11px]">
            {(['liste', 'istasyon', 'bolum'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGrupla(g)}
                className={`px-2.5 py-1 ${grupla === g ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400 hover:text-zinc-200'}`}
              >
                {g === 'liste' ? 'Liste' : g === 'istasyon' ? 'İstasyon' : 'Bölüm'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={realtime}
              onChange={e => setRealtime(e.target.checked)}
              className="accent-accent"
            />
            Canlı
          </label>
          <button
            onClick={() => loadOwn({ force: true })}
            className="px-2 py-1 text-xs bg-bg-2 border border-border rounded text-zinc-400 hover:text-zinc-200"
          >
            ↻ Yenile
          </button>
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-bg-1 border border-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green">{toplamCalisanOpr}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Çalışan Operatör</div>
        </div>
        <div className="bg-bg-1 border border-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-accent">{toplamAktifIE}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Aktif İş Emri</div>
        </div>
        <div className="bg-bg-1 border border-border rounded-lg p-3 text-center">
          <div className={`text-2xl font-bold ${sureRenk(enUzun)}`}>{formatDakika(enUzun)}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">En Uzun Süre</div>
        </div>
        <div className="bg-bg-1 border border-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-zinc-200">{toplamUretilen}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Bugün Üretilen</div>
        </div>
        <div className="bg-bg-1 border border-border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold" style={{ color: pctRenk(ortalamaPct) }}>%{ortalamaPct}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Ort. İlerleme</div>
        </div>
      </div>

      {/* Boş durum */}
      {rows.length === 0 && (
        <div className="bg-bg-1 border border-border rounded-lg p-12 text-center">
          <div className="text-4xl mb-3">😴</div>
          <div className="text-zinc-500">Şu an çalışan operatör yok.</div>
        </div>
      )}

      {/* ─── LİSTE görünümü ─── */}
      {rows.length > 0 && grupla === 'liste' && (
        <div className="bg-bg-1 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-bg-2 border-b border-border">
              <tr className="text-zinc-500">
                <th className="px-4 py-2.5 text-left font-medium">Operatör</th>
                <th className="px-4 py-2.5 text-left font-medium">İş Emri</th>
                <th className="px-4 py-2.5 text-left font-medium">Ürün</th>
                <th className="px-4 py-2.5 text-left font-medium">İstasyon</th>
                <th className="px-4 py-2.5 text-left font-medium">Süre</th>
                <th className="px-4 py-2.5 text-left font-medium min-w-[140px]">İlerleme</th>
                <th className="px-4 py-2.5 text-right font-medium">Kalan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtreliRows.map(row => (
                <tr key={row.id} className="hover:bg-bg-2">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green animate-pulse shrink-0" />
                      <span className="text-zinc-200 font-medium">{row.opAd}</span>
                    </div>
                    {row.bolum && row.bolum !== '—' && (
                      <div className="text-[10px] text-zinc-600 ml-4">{row.bolum}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-400">
                    {row.wo?.ieNo || row.woId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-zinc-300">{row.woAd || row.wo?.malad}</div>
                    {row.wo?.malkod && (
                      <div className="text-[10px] text-zinc-600 font-mono">{row.wo.malkod}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{row.istasyon}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-semibold ${sureRenk(row.dk)}`}>
                      {formatDakika(row.dk)}
                    </span>
                    <div className="text-[10px] text-zinc-600">{row.baslangic || '—'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.hedef > 0
                      ? <ProgressBar pct={row.pct} uretilen={row.uretilen} hedef={row.hedef} />
                      : <span className="text-zinc-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-400">
                    {row.hedef > 0 ? row.kalan : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── İSTASYON görünümü ─── */}
      {rows.length > 0 && grupla === 'istasyon' && (
        <div className="space-y-3">
          {istasyonGruplari.map(([istasyon, grpRows]) => {
            const grpPct = grpRows.length > 0
              ? Math.round(grpRows.reduce((a, r) => a + r.pct, 0) / grpRows.length)
              : 0
            return (
              <div key={istasyon} className="bg-bg-1 border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-bg-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-300 font-semibold text-sm">⚙ {istasyon}</span>
                    <span className="text-[10px] text-zinc-500">{grpRows.length} operatör</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, grpPct)}%`, backgroundColor: pctRenk(grpPct) }} />
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: pctRenk(grpPct) }}>%{grpPct}</span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-border">
                    {grpRows.map(row => (
                      <tr key={row.id} className="hover:bg-bg-2">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse shrink-0" />
                            <span className="text-zinc-200">{row.opAd}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 font-mono text-zinc-400">{row.wo?.ieNo || '—'}</td>
                        <td className="px-4 py-2 text-zinc-400 max-w-[180px] truncate">{row.woAd || row.wo?.malad}</td>
                        <td className="px-4 py-2">
                          <span className={`font-semibold ${sureRenk(row.dk)}`}>{formatDakika(row.dk)}</span>
                        </td>
                        <td className="px-4 py-2 min-w-[140px]">
                          {row.hedef > 0
                            ? <ProgressBar pct={row.pct} uretilen={row.uretilen} hedef={row.hedef} />
                            : <span className="text-zinc-600">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── BÖLÜM görünümü ─── */}
      {rows.length > 0 && grupla === 'bolum' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bolumGruplari.map(([bolum, grpRows]) => {
            const grpUretilen = grpRows.reduce((a, r) => a + r.uretilen, 0)
            const grpPct = grpRows.length > 0
              ? Math.round(grpRows.reduce((a, r) => a + r.pct, 0) / grpRows.length)
              : 0
            return (
              <div key={bolum} className="bg-bg-1 border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-bg-2 border-b border-border">
                  <div>
                    <span className="text-zinc-200 font-semibold">{bolum}</span>
                    <span className="text-[10px] text-zinc-500 ml-2">{grpRows.length} kişi · {grpUretilen} üretilen</span>
                  </div>
                  <span className="text-[11px] font-mono" style={{ color: pctRenk(grpPct) }}>%{grpPct}</span>
                </div>
                <div className="divide-y divide-border">
                  {grpRows.map(row => (
                    <div key={row.id} className="flex items-center gap-3 px-4 py-2 hover:bg-bg-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-200 text-xs font-medium truncate">{row.opAd}</span>
                          <span className={`text-[10px] ${sureRenk(row.dk)}`}>{formatDakika(row.dk)}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">{row.wo?.ieNo} · {row.woAd || row.wo?.malad}</div>
                      </div>
                      {row.hedef > 0 && (
                        <div className="shrink-0 w-24">
                          <ProgressBar pct={row.pct} uretilen={row.uretilen} hedef={row.hedef} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-[10px] text-zinc-600 text-right">
        Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}{tick > 0 && ` · ${tick}. yenileme`}
      </div>
    </div>
  )
}
