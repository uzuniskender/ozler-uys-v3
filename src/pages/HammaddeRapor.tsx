import { useState, useMemo } from 'react'
import { fmtDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'
import { Download, BarChart2, Package, Weight, Calendar, Filter, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface TuketimRow {
  tarih: string
  malkod: string
  malad: string
  adet: number
  toplam_metre: number
  toplam_kg: number
  kg_eksik: boolean
}

type Granularite = 'gunluk' | 'haftalik' | 'aylik'

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function grupKey(tarih: string, gran: Granularite): string {
  if (gran === 'gunluk') return tarih
  if (gran === 'haftalik') {
    const sw = startOfWeek(new Date(tarih))
    return isoDate(sw)
  }
  return tarih.slice(0, 7)
}

function grupLabel(key: string, gran: Granularite): string {
  if (gran === 'gunluk') return fmtDate(key)
  if (gran === 'haftalik') {
    const d = new Date(key)
    const end = new Date(d); end.setDate(d.getDate() + 6)
    return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })} \u2013 ${fmtDate(end)}`
  }
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

export function HammaddeRapor() {
  const today = isoDate(new Date())
  const firstOfMonth = today.slice(0, 8) + '01'

  const [rows, setRows] = useState<TuketimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [baslangic, setBaslangic] = useState(firstOfMonth)
  const [bitis, setBitis] = useState(today)
  const [gran, setGran] = useState<Granularite>('gunluk')
  const [malkodFiltre, setMalkodFiltre] = useState('')
  const [grupFiltre, setGrupFiltre] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('v_hammadde_tuketim')
        .select('*')
        .gte('tarih', baslangic)
        .lte('tarih', bitis)
        .order('tarih', { ascending: false })
      if (error) { toast.error('Veri yuklenemedi: ' + error.message); setLoading(false); return }
      // Supabase numeric alanlari string dondurebilir, Number() ile normalize et
      setRows((data || []).map(r => ({
        ...r,
        malad: r.malad ?? r.malkod ?? '',
        adet: Number(r.adet),
        toplam_metre: Number(r.toplam_metre),
        toplam_kg: Number(r.toplam_kg),
      })) as TuketimRow[])
      setLoading(false)
    }
    load()
  }, [baslangic, bitis])

  const gruplar = useMemo(() => {
    const s = new Set(rows.map(r => r.hammadde_tipi || '(Diger)').filter(Boolean))
    return Array.from(s).sort()
  }, [rows])

  const filtrelenmis = useMemo(() => rows.filter(r => {
    if (malkodFiltre && !(r.malkod || '').toLowerCase().includes(malkodFiltre.toLowerCase()) &&
        !(r.malad || '').toLowerCase().includes(malkodFiltre.toLowerCase())) return false
    if (grupFiltre && (r.hammadde_tipi || '(Diger)') !== grupFiltre) return false
    return true
  }), [rows, malkodFiltre, grupFiltre])

  const grouped = useMemo(() => {
    const map: Record<string, { tarihLabel: string; malkodler: Record<string, TuketimRow & { key: string }> }> = {}
    for (const r of filtrelenmis) {
      const gk = grupKey(r.tarih, gran)
      if (!map[gk]) map[gk] = { tarihLabel: grupLabel(gk, gran), malkodler: {} }
      const mk = r.malkod
      if (!map[gk].malkodler[mk]) {
        map[gk].malkodler[mk] = { ...r, key: gk, adet: 0, toplam_metre: 0, toplam_kg: 0 }
      }
      map[gk].malkodler[mk].adet += r.adet
      map[gk].malkodler[mk].toplam_metre += r.toplam_metre
      map[gk].malkodler[mk].toplam_kg += r.toplam_kg
      if (r.kg_eksik) map[gk].malkodler[mk].kg_eksik = true
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [filtrelenmis, gran])

  const toplamlar = useMemo(() => ({
    adet: filtrelenmis.reduce((a, r) => a + r.adet, 0),
    metre: filtrelenmis.reduce((a, r) => a + r.toplam_metre, 0),
    kg: filtrelenmis.reduce((a, r) => a + r.toplam_kg, 0),
    kgEksikSayisi: new Set(filtrelenmis.filter(r => r.kg_eksik).map(r => r.malkod)).size,
  }), [filtrelenmis])

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const exportRows = filtrelenmis.map(r => ({
      'Tarih': r.tarih,
      'Malzeme Kodu': r.malkod,
      'Malzeme Adi': r.malad,
      'Bar Adedi': r.adet,
      'Toplam (m)': r.toplam_metre,
      'Toplam (kg)': r.toplam_kg,
      'kg/m Eksik': r.kg_eksik ? 'Evet' : '',
    }))
    exportRows.push({
      'Tarih': 'TOPLAM',
      'Malzeme Kodu': '',
      'Malzeme Adi': '',
      'Bar Adedi': toplamlar.adet,
      'Toplam (m)': Math.round(toplamlar.metre * 1000) / 1000,
      'Toplam (kg)': Math.round(toplamlar.kg),
      'kg/m Eksik': toplamlar.kgEksikSayisi > 0 ? `${toplamlar.kgEksikSayisi} malzeme eksik` : '',
    })
    const ws = XLSX.utils.json_to_sheet(exportRows)
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 48 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Hammadde Tuketim')
    XLSX.writeFile(wb, `hammadde_tuketim_${baslangic}_${bitis}.xlsx`)
    toast.success('Excel indirildi')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BarChart2 size={20} className="text-accent" />
            Hammadde Tuketim Raporu
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Tuketilen bar bazli hammadde ozeti</p>
        </div>
        <button
          onClick={exportExcel}
          disabled={loading || filtrelenmis.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green/10 border border-green/25 text-green rounded-lg text-xs hover:bg-green/20 disabled:opacity-40"
        >
          <Download size={13} /> Excel Indir
        </button>
      </div>

      <div className="bg-bg-2 border border-border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 uppercase">Baslangic</label>
          <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)}
            className="px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 uppercase">Bitis</label>
          <input type="date" value={bitis} onChange={e => setBitis(e.target.value)}
            className="px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 uppercase">Granularite</label>
          <div className="flex rounded overflow-hidden border border-border">
            {(['gunluk', 'haftalik', 'aylik'] as Granularite[]).map(g => (
              <button key={g} onClick={() => setGran(g)}
                className={`px-3 py-1.5 text-xs ${gran === g ? 'bg-accent text-white' : 'bg-bg-3 text-zinc-400 hover:text-white'}`}>
                {g === 'gunluk' ? 'Gunluk' : g === 'haftalik' ? 'Haftalik' : 'Aylik'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500 uppercase">Malzeme Grubu</label>
          <select value={grupFiltre} onChange={e => setGrupFiltre(e.target.value)}
            className="px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent">
            <option value="">Tumu</option>
            {gruplar.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-[10px] text-zinc-500 uppercase">Malzeme Ara</label>
          <div className="relative">
            <Filter size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" placeholder="Kod veya ad..." value={malkodFiltre} onChange={e => setMalkodFiltre(e.target.value)}
              className="w-full pl-6 pr-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-accent" />
            <span className="text-[10px] text-zinc-500 uppercase">Bar Adedi</span>
          </div>
          <div className="text-2xl font-bold">{loading ? '\u2014' : toplamlar.adet.toLocaleString('tr-TR')}</div>
          <div className="text-[10px] text-zinc-500 mt-1">secili donem</div>
        </div>
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 size={14} className="text-blue-400" />
            <span className="text-[10px] text-zinc-500 uppercase">Toplam Metre</span>
          </div>
          <div className="text-2xl font-bold">{loading ? '\u2014' : toplamlar.metre.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} <span className="text-sm font-normal text-zinc-400">m</span></div>
          <div className="text-[10px] text-zinc-500 mt-1">secili donem</div>
        </div>
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Weight size={14} className="text-amber" />
            <span className="text-[10px] text-zinc-500 uppercase">Toplam Agirlik</span>
          </div>
          <div className="text-2xl font-bold">
            {loading ? '\u2014' : toplamlar.kg >= 1000
              ? `${(toplamlar.kg / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} t`
              : `${Math.round(toplamlar.kg).toLocaleString('tr-TR')} kg`}
          </div>
          {toplamlar.kgEksikSayisi > 0 && (
            <div className="text-[10px] text-amber mt-1 flex items-center gap-1">
              <AlertTriangle size={10} /> {toplamlar.kgEksikSayisi} malzemede kg/m eksik
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-xs text-zinc-500">Yukleniyor...</div>
      ) : grouped.length === 0 ? (
        <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-xs text-zinc-500">
          Secili donemde tuketim kaydi yok.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([gk, gv]) => {
            const satirlar = Object.values(gv.malkodler).sort((a, b) => b.toplam_metre - a.toplam_metre)
            const topMetre = satirlar.reduce((a, r) => a + r.toplam_metre, 0)
            const topKg = satirlar.reduce((a, r) => a + r.toplam_kg, 0)
            const topAdet = satirlar.reduce((a, r) => a + r.adet, 0)
            return (
              <div key={gk} className="bg-bg-2 border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-bg-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-accent" />
                    <span className="text-xs font-semibold">{gv.tarihLabel}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                    <span>{topAdet} bar</span>
                    <span className="text-zinc-200 font-medium">{topMetre.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} m</span>
                    {topKg > 0 && <span className="text-amber">{topKg >= 1000
                      ? `${(topKg / 1000).toFixed(2)} t`
                      : `${Math.round(topKg)} kg`}</span>}
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-zinc-500 uppercase border-b border-border">
                      <th className="px-4 py-2 text-left">Malzeme</th>
                      <th className="px-3 py-2 text-right">Bar</th>
                      <th className="px-3 py-2 text-right">Metre</th>
                      <th className="px-3 py-2 text-right">Agirlik</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map(r => (
                      <tr key={r.malkod} className="border-b border-border/50 hover:bg-bg-3 transition-colors">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-accent text-[10px]">{r.malkod}</span>
                            {r.kg_eksik && <span title="kg/m bilgisi eksik"><AlertTriangle size={10} className="text-amber" /></span>}
                          </div>
                          <div className="text-zinc-400 mt-0.5 leading-tight">{r.malad}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-300">{r.adet}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {r.toplam_metre.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} m
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber">
                          {r.kg_eksik
                            ? <span className="text-zinc-600 text-[10px]">kg/m eksik</span>
                            : r.toplam_kg >= 1000
                              ? `${(r.toplam_kg / 1000).toFixed(2)} t`
                              : `${Math.round(r.toplam_kg)} kg`}
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
    </div>
  )
}
