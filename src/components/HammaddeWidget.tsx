import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Weight, TrendingUp, AlertTriangle } from 'lucide-react'

interface TuketimRow {
  tarih: string
  toplam_metre: number
  toplam_kg: number
  adet: number
  kg_eksik: boolean
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

function startOfWeek(d: Date) {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1)
  copy.setDate(diff)
  return copy
}

function fmt(kg: number) {
  if (kg <= 0) return '—'
  return kg >= 1000
    ? `${(kg / 1000).toFixed(1)} t`
    : `${Math.round(kg)} kg`
}

function fmtM(m: number) {
  return m > 0 ? `${m.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m` : '—'
}

export function HammaddeWidget() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<TuketimRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    const from30 = new Date(today); from30.setDate(today.getDate() - 29)
    supabase
      .from('v_hammadde_tuketim')
      .select('tarih, toplam_metre, toplam_kg, adet, kg_eksik')
      .gte('tarih', isoDate(from30))
      .lte('tarih', isoDate(today))
      .then(({ data }) => { setRows((data || []) as TuketimRow[]); setLoading(false) })
  }, [])

  const today = isoDate(new Date())
  const weekStart = isoDate(startOfWeek(new Date()))
  const monthStart = today.slice(0, 8) + '01'

  function agg(filter: (r: TuketimRow) => boolean) {
    const f = rows.filter(filter)
    return {
      kg: f.reduce((a, r) => a + r.toplam_kg, 0),
      metre: f.reduce((a, r) => a + r.toplam_metre, 0),
      adet: f.reduce((a, r) => a + r.adet, 0),
    }
  }

  const bugun = agg(r => r.tarih === today)
  const hafta = agg(r => r.tarih >= weekStart)
  const ay = agg(r => r.tarih >= monthStart)

  // 30 günlük sparkline verileri (günlük kg)
  const sparkData: { tarih: string; kg: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = isoDate(d)
    const dayRows = rows.filter(r => r.tarih === key)
    sparkData.push({ tarih: key, kg: dayRows.reduce((a, r) => a + r.toplam_kg, 0) })
  }
  const maxKg = Math.max(...sparkData.map(d => d.kg), 1)

  const kgEksik = rows.some(r => r.kg_eksik)

  const cards = [
    { label: 'Bugün', data: bugun, color: 'text-accent' },
    { label: 'Bu Hafta', data: hafta, color: 'text-blue-400' },
    { label: 'Bu Ay', data: ay, color: 'text-amber' },
  ]

  return (
    <div
      className="bg-bg-2 border border-border rounded-xl p-4 cursor-pointer hover:border-accent/40 transition-colors"
      onClick={() => navigate('/hammadde-rapor')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Weight size={15} className="text-accent" />
          <span className="text-xs font-semibold">Hammadde Tüketimi</span>
        </div>
        {kgEksik && (
          <span className="flex items-center gap-1 text-[10px] text-amber">
            <AlertTriangle size={10} /> kg/m eksik
          </span>
        )}
      </div>

      {/* 3 KPI */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {cards.map(c => (
          <div key={c.label} className="bg-bg-3 rounded-lg p-2.5">
            <div className="text-[10px] text-zinc-500 mb-1">{c.label}</div>
            {loading ? (
              <div className="h-6 bg-bg-2 rounded animate-pulse" />
            ) : (
              <>
                <div className={`text-base font-bold ${c.color}`}>{fmt(c.data.kg)}</div>
                <div className="text-[10px] text-zinc-500">{fmtM(c.data.metre)} · {c.data.adet} bar</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 30 günlük sparkline */}
      <div className="flex items-end gap-px h-10">
        {sparkData.map((d, i) => {
          const h = maxKg > 0 ? Math.max(2, Math.round((d.kg / maxKg) * 40)) : 2
          const isToday = d.tarih === today
          return (
            <div
              key={i}
              title={`${d.tarih}: ${fmt(d.kg)}`}
              style={{ height: `${h}px` }}
              className={`flex-1 rounded-sm transition-all ${isToday ? 'bg-accent' : d.kg > 0 ? 'bg-accent/30' : 'bg-bg-3'}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
        <span>30 gün önce</span>
        <div className="flex items-center gap-1"><TrendingUp size={9} /> kg trendi</div>
        <span>bugün</span>
      </div>
    </div>
  )
}
