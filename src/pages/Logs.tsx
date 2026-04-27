/**
 * v15.75 Aşama 2 — Loglar Sayfası (İş Emri #13 madde 14)
 *
 * Tüm sistem aktivitesi tek sayfada, filtreli ve detaylı.
 *
 * 4 kaynak birleştirilir:
 *   1. uys_activity_log — sistem olayları (sipariş açıldı, MRP yapıldı, vb.)
 *   2. uys_logs — üretim girişleri (kaç adet üretildi, hangi WO)
 *   3. uys_stok_hareketler — stok hareketleri (giris/cikis/bar_acilis)
 *   4. uys_fire_logs — fire kayıtları
 *
 * Filtreler:
 *   - Tarih aralığı (bugün / son 7g / son 30g / özel)
 *   - Tip multi-select (Sistem / Üretim / Stok / Fire)
 *   - Kullanıcı (operatör/admin)
 *   - Arama (İE no / malkod / sipariş no / mamul)
 *
 * Tablo:
 *   - Tarih · Tip rozeti · Açıklama · Kullanıcı · Detay (tıklanabilir)
 *
 * Sağ panel:
 *   - Seçilen log'un tüm detayı + ilgili sayfalara link
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { Search, Calendar, Filter, X, ExternalLink, RefreshCw, Activity, Package, Factory, AlertTriangle } from 'lucide-react'
import { getDbActivityLog, type ActivityLogRow } from '@/lib/activityLog'

// Birleşik log tipi (UI için)
interface LogRow {
  id: string
  ts: string                  // ISO datetime
  tip: 'sistem' | 'uretim' | 'stok' | 'fire'
  baslik: string              // Tablodaki ana etiket (kısa)
  detay: string               // Açıklama
  kullanici: string
  modul?: string | null
  orderId?: string | null
  woId?: string | null
  malkod?: string | null
  // Stok hareketleri için ek
  miktar?: number
  hareketTipi?: string        // giris/cikis/bar_acilis
  // Üretim için ek
  qty?: number
  fire?: number
  duruslar?: any
  // Raw original (sağ panelde göstermek için)
  raw?: any
}

const TIP_RENK: Record<string, string> = {
  sistem: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  uretim: 'bg-green/15 text-green border-green/30',
  stok:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  fire:   'bg-red/15 text-red border-red/30',
}

const TIP_ICON: Record<string, any> = {
  sistem: Activity,
  uretim: Factory,
  stok:   Package,
  fire:   AlertTriangle,
}

type DateRange = 'bugun' | '7g' | '30g' | 'ozel'

export function Logs() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { workOrders, orders, materials, operators } = useStore()

  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('bugun')
  const [customMin, setCustomMin] = useState('')
  const [customMax, setCustomMax] = useState('')
  const [tipFilter, setTipFilter] = useState<Set<string>>(new Set(['sistem', 'uretim', 'stok', 'fire']))
  const [kullaniciFilter, setKullaniciFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<LogRow | null>(null)
  const [showFilters, setShowFilters] = useState(true)

  // Tarih aralığı hesapla
  const { tsMin, tsMax } = useMemo(() => {
    const now = new Date()
    if (dateRange === 'ozel') {
      return {
        tsMin: customMin ? new Date(customMin).toISOString() : null,
        tsMax: customMax ? new Date(customMax + 'T23:59:59').toISOString() : null,
      }
    }
    const days = dateRange === 'bugun' ? 1 : dateRange === '7g' ? 7 : 30
    const min = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    if (dateRange === 'bugun') {
      min.setHours(0, 0, 0, 0)
    }
    return { tsMin: min.toISOString(), tsMax: null }
  }, [dateRange, customMin, customMax])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const allLogs: LogRow[] = []

    // 1) uys_activity_log
    if (tipFilter.has('sistem')) {
      try {
        const rows = await getDbActivityLog({
          ts_min: tsMin || undefined,
          ts_max: tsMax || undefined,
          kullanici: kullaniciFilter || undefined,
          searchText: search || undefined,
          limit: 500,
        })
        for (const r of rows as ActivityLogRow[]) {
          allLogs.push({
            id: r.id,
            ts: r.ts,
            tip: 'sistem',
            baslik: r.aksiyon,
            detay: r.detay || '',
            kullanici: r.kullanici,
            modul: r.modul,
            orderId: r.order_id,
            woId: r.wo_id,
            malkod: r.malkod,
            raw: r,
          })
        }
      } catch (e) { console.warn('activity_log fetch fail:', e) }
    }

    // 2) uys_logs (üretim)
    if (tipFilter.has('uretim')) {
      try {
        let q = supabase.from('uys_logs').select('*').order('tarih', { ascending: false }).limit(500)
        if (tsMin) q = q.gte('updated_at', tsMin)
        if (tsMax) q = q.lte('updated_at', tsMax)
        const { data } = await q
        for (const r of (data || [])) {
          const wo = workOrders.find(w => w.id === r.wo_id)
          const opr = operators.find(o => o.id === r.opr_id)
          const baslik = `${wo?.ieNo || 'WO?'} → ${r.qty || 0} adet üretildi${r.fire ? ` (${r.fire} fire)` : ''}`
          // search filter
          if (search && !baslik.toLowerCase().includes(search.toLowerCase()) && (!wo?.ieNo || !wo.ieNo.toLowerCase().includes(search.toLowerCase()))) continue
          if (kullaniciFilter && opr?.ad !== kullaniciFilter) continue
          allLogs.push({
            id: r.id,
            ts: r.updated_at || r.tarih,
            tip: 'uretim',
            baslik,
            detay: `Operatör: ${opr?.ad || '?'} · Mamul: ${wo?.malad || '?'}`,
            kullanici: opr?.ad || '?',
            woId: r.wo_id,
            orderId: wo?.orderId || null,
            qty: r.qty,
            fire: r.fire,
            duruslar: r.duruslar,
            raw: r,
          })
        }
      } catch (e) { console.warn('uys_logs fetch fail:', e) }
    }

    // 3) uys_stok_hareketler
    if (tipFilter.has('stok')) {
      try {
        let q = supabase.from('uys_stok_hareketler').select('*').order('updated_at', { ascending: false }).limit(500)
        if (tsMin) q = q.gte('updated_at', tsMin)
        if (tsMax) q = q.lte('updated_at', tsMax)
        const { data } = await q
        for (const r of (data || [])) {
          const wo = r.wo_id ? workOrders.find(w => w.id === r.wo_id) : null
          const mat = materials.find(m => m.kod === r.malkod)
          const tipStr = r.tip === 'giris' ? '↑ Giriş' : r.tip === 'cikis' ? '↓ Çıkış' : r.tip === 'bar_acilis' ? '◯ Bar Açılış' : r.tip
          const baslik = `${tipStr}: ${r.malkod} (${r.miktar})`
          const detay = `${mat?.ad || r.malkod} · ${r.aciklama || ''}${wo ? ` · ${wo.ieNo}` : ''}`
          if (search && !baslik.toLowerCase().includes(search.toLowerCase()) && !detay.toLowerCase().includes(search.toLowerCase())) continue
          allLogs.push({
            id: r.id,
            ts: r.updated_at || r.tarih,
            tip: 'stok',
            baslik,
            detay,
            kullanici: '—',
            malkod: r.malkod,
            woId: r.wo_id,
            orderId: wo?.orderId || null,
            miktar: r.miktar,
            hareketTipi: r.tip,
            raw: r,
          })
        }
      } catch (e) { console.warn('uys_stok_hareketler fetch fail:', e) }
    }

    // 4) uys_fire_logs
    if (tipFilter.has('fire')) {
      try {
        let q = supabase.from('uys_fire_logs').select('*').order('updated_at', { ascending: false }).limit(500)
        if (tsMin) q = q.gte('updated_at', tsMin)
        if (tsMax) q = q.lte('updated_at', tsMax)
        const { data } = await q
        for (const r of (data || [])) {
          const wo = workOrders.find(w => w.id === r.wo_id)
          const opr = operators.find(o => o.id === r.opr_id)
          const baslik = `Fire: ${wo?.ieNo || 'WO?'} → ${r.adet || 0} adet`
          if (search && !baslik.toLowerCase().includes(search.toLowerCase())) continue
          if (kullaniciFilter && opr?.ad !== kullaniciFilter) continue
          allLogs.push({
            id: r.id,
            ts: r.updated_at || r.tarih,
            tip: 'fire',
            baslik,
            detay: `Sebep: ${r.sebep || '?'} · Operatör: ${opr?.ad || '?'}`,
            kullanici: opr?.ad || '?',
            woId: r.wo_id,
            orderId: wo?.orderId || null,
            raw: r,
          })
        }
      } catch (e) { console.warn('uys_fire_logs fetch fail:', e) }
    }

    // Tarihe göre sırala (yeni → eski)
    allLogs.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
    setLogs(allLogs)
    setLoading(false)
  }, [tipFilter, tsMin, tsMax, kullaniciFilter, search, workOrders, materials, operators])

  useEffect(() => { loadLogs() }, [loadLogs])

  // Özet kartlar
  const stats = useMemo(() => {
    const tipler: Record<string, number> = { sistem: 0, uretim: 0, stok: 0, fire: 0 }
    const kullanicilar: Record<string, number> = {}
    for (const l of logs) {
      tipler[l.tip] = (tipler[l.tip] || 0) + 1
      kullanicilar[l.kullanici] = (kullanicilar[l.kullanici] || 0) + 1
    }
    const enAktif = Object.entries(kullanicilar).sort((a, b) => b[1] - a[1])[0]
    return { toplam: logs.length, tipler, enAktif: enAktif ? `${enAktif[0]} (${enAktif[1]})` : '—' }
  }, [logs])

  function toggleTip(tip: string) {
    setTipFilter(prev => {
      const n = new Set(prev)
      n.has(tip) ? n.delete(tip) : n.add(tip)
      return n
    })
  }

  function formatTs(ts: string): string {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  // Kullanıcı seçenekleri
  const kullaniciOpts = useMemo(() => {
    const set = new Set<string>()
    for (const l of logs) set.add(l.kullanici)
    return [...set].filter(k => k && k !== '—').sort()
  }, [logs])

  if (!can('log_view')) {
    return (
      <div className="p-8 text-center text-zinc-500">
        <p className="text-sm">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Ana içerik */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h1 className="text-xl font-semibold">Sistem Logları</h1>
            <p className="text-xs text-zinc-500">Tüm aktivite tek sayfada · {logs.length} kayıt</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">
              <Filter size={13} /> {showFilters ? 'Filtreyi Gizle' : 'Filtre'}
            </button>
            <button onClick={loadLogs} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">
              <RefreshCw size={13} /> Yenile
            </button>
          </div>
        </div>

        {/* Özet kartlar */}
        <div className="grid grid-cols-4 gap-3 p-5 pb-3">
          <div className="p-3 bg-bg-2/50 border border-border rounded-lg">
            <div className="text-[10px] text-zinc-500 uppercase">Toplam Log</div>
            <div className="text-2xl font-semibold mt-1">{stats.toplam}</div>
          </div>
          <div className="p-3 bg-bg-2/50 border border-border rounded-lg">
            <div className="text-[10px] text-zinc-500 uppercase">En Aktif Kullanıcı</div>
            <div className="text-sm font-semibold mt-1.5 truncate">{stats.enAktif}</div>
          </div>
          <div className="p-3 bg-bg-2/50 border border-border rounded-lg">
            <div className="text-[10px] text-zinc-500 uppercase">Üretim Logu</div>
            <div className="text-2xl font-semibold mt-1 text-green">{stats.tipler.uretim}</div>
          </div>
          <div className="p-3 bg-bg-2/50 border border-border rounded-lg">
            <div className="text-[10px] text-zinc-500 uppercase">Fire Logu</div>
            <div className="text-2xl font-semibold mt-1 text-red">{stats.tipler.fire}</div>
          </div>
        </div>

        {/* Filtreler */}
        {showFilters && (
          <div className="px-5 pb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Tarih aralığı */}
              <div className="flex items-center gap-1 bg-bg-2 border border-border rounded-lg p-0.5">
                {(['bugun', '7g', '30g', 'ozel'] as DateRange[]).map(r => (
                  <button key={r} onClick={() => setDateRange(r)}
                    className={`px-2.5 py-1 text-[11px] rounded ${dateRange === r ? 'bg-accent text-white' : 'text-zinc-400 hover:text-white'}`}>
                    {r === 'bugun' ? 'Bugün' : r === '7g' ? 'Son 7 Gün' : r === '30g' ? 'Son 30 Gün' : 'Özel'}
                  </button>
                ))}
              </div>
              {dateRange === 'ozel' && (
                <>
                  <input type="date" value={customMin} onChange={e => setCustomMin(e.target.value)}
                    className="px-2 py-1 bg-bg-2 border border-border rounded text-xs text-zinc-200" />
                  <span className="text-zinc-500 text-xs">→</span>
                  <input type="date" value={customMax} onChange={e => setCustomMax(e.target.value)}
                    className="px-2 py-1 bg-bg-2 border border-border rounded text-xs text-zinc-200" />
                </>
              )}

              {/* Tip filter */}
              <div className="flex items-center gap-1 ml-2">
                {(['sistem', 'uretim', 'stok', 'fire'] as const).map(tip => {
                  const Icon = TIP_ICON[tip]
                  const aktif = tipFilter.has(tip)
                  return (
                    <button key={tip} onClick={() => toggleTip(tip)}
                      className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${aktif ? TIP_RENK[tip] : 'bg-bg-2 border-border text-zinc-500'}`}>
                      <Icon size={11} /> {tip[0].toUpperCase() + tip.slice(1)}
                    </button>
                  )
                })}
              </div>

              {/* Kullanıcı */}
              <select value={kullaniciFilter} onChange={e => setKullaniciFilter(e.target.value)}
                className="px-2 py-1 bg-bg-2 border border-border rounded text-xs text-zinc-200">
                <option value="">Tüm Kullanıcılar</option>
                {kullaniciOpts.map(k => <option key={k} value={k}>{k}</option>)}
              </select>

              {/* Arama */}
              <div className="flex-1 min-w-[200px] relative">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="İE no, malkod, sipariş no, mamul..."
                  className="w-full pl-7 pr-2 py-1 bg-bg-2 border border-border rounded text-xs text-zinc-200" />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ana tablo */}
        <div className="flex-1 overflow-auto px-5 pb-5">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-1 border-b border-border">
              <tr className="text-zinc-500">
                <th className="text-left px-3 py-2 font-medium">Tarih</th>
                <th className="text-left px-3 py-2 font-medium">Tip</th>
                <th className="text-left px-3 py-2 font-medium">Açıklama</th>
                <th className="text-left px-3 py-2 font-medium">Kullanıcı</th>
                <th className="text-left px-3 py-2 font-medium">Detay</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center py-8 text-zinc-500">Yükleniyor...</td></tr>
              )}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-zinc-500">Sonuç yok — filtreleri değiştirin</td></tr>
              )}
              {logs.map(l => {
                const Icon = TIP_ICON[l.tip]
                return (
                  <tr key={l.id + l.tip} onClick={() => setSelected(l)}
                    className={`border-b border-border/50 hover:bg-bg-2/40 cursor-pointer ${selected?.id === l.id ? 'bg-accent/10' : ''}`}>
                    <td className="px-3 py-1.5 text-zinc-400 whitespace-nowrap">{formatTs(l.ts)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${TIP_RENK[l.tip]}`}>
                        <Icon size={10} /> {l.tip}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-zinc-200">{l.baslik}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{l.kullanici}</td>
                    <td className="px-3 py-1.5 text-zinc-500 truncate max-w-[300px]">{l.detay}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sağ panel — seçilen log detayı */}
      {selected && (
        <div className="w-96 border-l border-border bg-bg-2/30 overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${TIP_RENK[selected.tip]}`}>
                {selected.tip}
              </span>
              <span className="text-xs text-zinc-400">Detay</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase mb-1">Tarih</div>
              <div className="text-sm text-zinc-200">{formatTs(selected.ts)}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase mb-1">Açıklama</div>
              <div className="text-sm text-zinc-200">{selected.baslik}</div>
            </div>
            {selected.detay && (
              <div>
                <div className="text-[10px] text-zinc-500 uppercase mb-1">Detay</div>
                <div className="text-xs text-zinc-300 whitespace-pre-wrap">{selected.detay}</div>
              </div>
            )}
            <div>
              <div className="text-[10px] text-zinc-500 uppercase mb-1">Kullanıcı</div>
              <div className="text-sm text-zinc-200">{selected.kullanici}</div>
            </div>
            {selected.modul && (
              <div>
                <div className="text-[10px] text-zinc-500 uppercase mb-1">Modül</div>
                <div className="text-sm text-zinc-200">{selected.modul}</div>
              </div>
            )}

            {/* İlgili sayfa link'leri */}
            {(selected.orderId || selected.woId || selected.malkod) && (
              <div className="pt-3 border-t border-border space-y-1.5">
                <div className="text-[10px] text-zinc-500 uppercase">İlgili Kayıtlar</div>
                {selected.orderId && (() => {
                  const ord = orders.find(o => o.id === selected.orderId)
                  return (
                    <button onClick={() => navigate('/orders?o=' + selected.orderId)}
                      className="w-full flex items-center justify-between p-2 bg-bg-2 border border-border rounded text-xs hover:border-accent transition-colors">
                      <div className="text-left">
                        <div className="text-zinc-500 text-[10px]">Sipariş</div>
                        <div className="text-zinc-200">{ord?.siparisNo || selected.orderId}</div>
                      </div>
                      <ExternalLink size={12} className="text-zinc-500" />
                    </button>
                  )
                })()}
                {selected.woId && (() => {
                  const wo = workOrders.find(w => w.id === selected.woId)
                  return (
                    <button onClick={() => navigate('/work-orders?w=' + selected.woId)}
                      className="w-full flex items-center justify-between p-2 bg-bg-2 border border-border rounded text-xs hover:border-accent transition-colors">
                      <div className="text-left">
                        <div className="text-zinc-500 text-[10px]">İş Emri</div>
                        <div className="text-zinc-200">{wo?.ieNo || selected.woId}</div>
                      </div>
                      <ExternalLink size={12} className="text-zinc-500" />
                    </button>
                  )
                })()}
                {selected.malkod && (() => {
                  const mat = materials.find(m => m.kod === selected.malkod)
                  return (
                    <button onClick={() => navigate('/materials?m=' + selected.malkod)}
                      className="w-full flex items-center justify-between p-2 bg-bg-2 border border-border rounded text-xs hover:border-accent transition-colors">
                      <div className="text-left">
                        <div className="text-zinc-500 text-[10px]">Malzeme</div>
                        <div className="text-zinc-200">{mat?.ad || selected.malkod}</div>
                      </div>
                      <ExternalLink size={12} className="text-zinc-500" />
                    </button>
                  )
                })()}
              </div>
            )}

            {/* Raw data */}
            <div className="pt-3 border-t border-border">
              <details className="text-xs">
                <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">Ham Veri (JSON)</summary>
                <pre className="mt-2 p-2 bg-bg-3 rounded text-[10px] text-zinc-400 overflow-auto max-h-64">
                  {JSON.stringify(selected.raw, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
