import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { topluFireTelafi, fireTelafiIeOlustur } from '@/features/production/fireTelafi'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'

const COLORS = ['#06b6d4', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function Reports() {
  const { workOrders, logs, operators, fireLogs, orders, operations, recipes, stokHareketler, materials, loadAll } = useStore()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('ozet')
  const [telafiRunning, setTelafiRunning] = useState(false)

  // Detaylı Rapor filtreleri
  const [dBaslangic, setDBaslangic] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [dBitis, setDBitis] = useState(today())
  const [dOperator, setDOperator] = useState('')
  const [dOperasyon, setDOperasyon] = useState('')
  const [dBolum, setDBolum] = useState('')
  const [dSiparis, setDSiparis] = useState('')

  const tabs = [
    { id: 'ozet', label: 'Özet' },
    { id: 'detayli', label: '📋 Detaylı Üretim' },
    { id: 'gunluk', label: 'Günlük Üretim' },
    { id: 'fire', label: 'Fire Analizi' },
    { id: 'operasyon', label: 'Operasyon Bazlı' },
    { id: 'oee', label: 'OEE' },
    { id: 'durus', label: 'Duruş Analizi' },
    { id: 'gecikme', label: 'Gecikme' },
    { id: 'operator', label: 'Operatör Performans' },
    { id: 'maltuket', label: 'Malzeme Tüketim' },
    { id: 'trend', label: 'Trend' },
    { id: 'istperf', label: 'İstasyon Perf.' },
    { id: 'oprsaat', label: 'Operatör Saat' },
  ]

  const todayStr = today()
  // v15.34.3 — Fire logları iki gruba ayır: parça fire vs bar hurda
  const parcaFireLogs = useMemo(() => fireLogs.filter(f => f.tip !== 'bar_hurda'), [fireLogs])
  const barHurdaLogs = useMemo(() => fireLogs.filter(f => f.tip === 'bar_hurda'), [fireLogs])

  const toplamUretim = logs.reduce((a, l) => a + l.qty, 0)
  const toplamFire = parcaFireLogs.reduce((a, f) => a + f.qty, 0)
  const bugunUretim = logs.filter(l => l.tarih === todayStr).reduce((a, l) => a + l.qty, 0)
  const bugunFire = parcaFireLogs.filter(f => f.tarih === todayStr).reduce((a, f) => a + f.qty, 0)

  // Son 14 gün günlük üretim
  const gunlukData = useMemo(() => {
    const map: Record<string, { tarih: string; uretim: number; fire: number }> = {}
    logs.forEach(l => { if (!map[l.tarih]) map[l.tarih] = { tarih: l.tarih, uretim: 0, fire: 0 }; map[l.tarih].uretim += l.qty })
    parcaFireLogs.forEach(f => { if (!map[f.tarih]) map[f.tarih] = { tarih: f.tarih, uretim: 0, fire: 0 }; map[f.tarih].fire += f.qty })
    return Object.values(map).sort((a, b) => a.tarih.localeCompare(b.tarih)).slice(-14)
  }, [logs, parcaFireLogs])

  // Operasyon bazlı
  const opData = useMemo(() => {
    const map: Record<string, { op: string; hedef: number; uretim: number; woCount: number }> = {}
    workOrders.forEach(w => {
      const k = w.opAd || 'Tanımsız'
      if (!map[k]) map[k] = { op: k, hedef: 0, uretim: 0, woCount: 0 }
      map[k].hedef += w.hedef; map[k].woCount++
      map[k].uretim += logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    })
    return Object.values(map).sort((a, b) => b.hedef - a.hedef)
  }, [workOrders, logs])

  // Fire operasyona göre dağılım — sadece parça fire
  const firePieData = useMemo(() => {
    const map: Record<string, number> = {}
    parcaFireLogs.forEach(f => { const k = f.opAd || 'Tanımsız'; map[k] = (map[k] || 0) + f.qty })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [parcaFireLogs])

  // v15.34.3 — Bar Hurda özeti
  const barHurdaOzet = useMemo(() => {
    const toplamBar = barHurdaLogs.length
    const toplamMm = barHurdaLogs.reduce((a, f) => a + (f.uzunlukMm || 0), 0)
    const bugunBar = barHurdaLogs.filter(f => f.tarih === todayStr).length
    const bugunMm = barHurdaLogs.filter(f => f.tarih === todayStr).reduce((a, f) => a + (f.uzunlukMm || 0), 0)
    return { toplamBar, toplamMm, bugunBar, bugunMm }
  }, [barHurdaLogs, todayStr])

  // ═══ DETAYLI ÜRETİM RAPORU ═══
  // Lookup maps
  const woMap = useMemo(() => { const m: Record<string, typeof workOrders[0]> = {}; workOrders.forEach(w => { m[w.id] = w }); return m }, [workOrders])
  const orderMap = useMemo(() => { const m: Record<string, typeof orders[0]> = {}; orders.forEach(o => { m[o.id] = o }); return m }, [orders])
  const opBolumMap = useMemo(() => { const m: Record<string, string> = {}; operations.forEach(op => { if (op.bolum) m[op.id] = op.bolum }); return m }, [operations])

  // Unique filter options
  const dOperatorList = useMemo(() => {
    const s = new Set<string>()
    logs.forEach(l => Array.isArray(l.operatorlar) && l.operatorlar.forEach(o => o.ad && s.add(o.ad)))
    return [...s].sort()
  }, [logs])
  const dOperasyonList = useMemo(() => [...new Set(workOrders.map(w => w.opAd).filter(Boolean))].sort(), [workOrders])
  const dBolumList = useMemo(() => [...new Set(operations.map(o => o.bolum).filter(Boolean))].sort(), [operations])
  const dSiparisList = useMemo(() => [...new Set(orders.map(o => o.siparisNo).filter(Boolean))].sort(), [orders])

  interface DetayRow {
    logId: string; woId: string; tarih: string; siparisNo: string; ieNo: string
    mamulKod: string; mamulAd: string; opAd: string; operatorler: string
    basStr: string; bitStr: string; calismaDk: number; calismaStr: string
    uretim: number; fire: number; fireOran: number; durusDk: number
    istAd: string; bolum: string
  }

  const detayliData = useMemo(() => {
    const rows: DetayRow[] = []
    logs.forEach(l => {
      if (l.tarih < dBaslangic || l.tarih > dBitis) return
      const wo = woMap[l.woId]
      if (!wo) return
      const order = wo.orderId ? orderMap[wo.orderId] : null
      const siparisNo = order?.siparisNo || (wo.siparisDisi ? 'Sipariş Dışı' : '')
      const bolum = wo.opId ? (opBolumMap[wo.opId] || '') : ''

      // Filters
      if (dSiparis && siparisNo !== dSiparis) return
      if (dOperasyon && wo.opAd !== dOperasyon) return
      if (dBolum && bolum !== dBolum) return

      const oprArr = Array.isArray(l.operatorlar) ? l.operatorlar : []
      const oprNames = oprArr.map(o => o.ad || '').filter(Boolean)
      if (dOperator && !oprNames.includes(dOperator)) return

      // Çalışma süresi: ilk bas — son bit
      let minBas = '', maxBit = '', calismaDk = 0
      oprArr.forEach(o => {
        if (o.bas && (!minBas || o.bas < minBas)) minBas = o.bas
        if (o.bit && (!maxBit || o.bit > maxBit)) maxBit = o.bit
        if (o.bas && o.bit && o.bit >= o.bas) {
          const b = parseInt(o.bas.split(':')[0]) * 60 + parseInt(o.bas.split(':')[1] || '0')
          const e = parseInt(o.bit.split(':')[0]) * 60 + parseInt(o.bit.split(':')[1] || '0')
          calismaDk = Math.max(calismaDk, e - b)
        }
      })

      // Duruş süresi
      let durusDk = 0
      if (Array.isArray(l.duruslar)) {
        l.duruslar.forEach(d => {
          const sure = (d as unknown as Record<string, unknown>).sure as number
          if (sure) { durusDk += sure }
          else if (d.bas && d.bit && d.bit >= d.bas) {
            const b = parseInt(d.bas.split(':')[0]) * 60 + parseInt(d.bas.split(':')[1] || '0')
            const e = parseInt(d.bit.split(':')[0]) * 60 + parseInt(d.bit.split(':')[1] || '0')
            durusDk += Math.max(0, e - b)
          }
        })
      }

      const fireQty = l.fire || 0
      const totalQty = l.qty + fireQty
      rows.push({
        logId: l.id, woId: l.woId, tarih: l.tarih, siparisNo, ieNo: wo.ieNo || l.ieNo || '',
        mamulKod: wo.mamulKod || wo.malkod || '', mamulAd: wo.mamulAd || wo.malad || '',
        opAd: wo.opAd || '', operatorler: oprNames.join(', '),
        basStr: minBas, bitStr: maxBit, calismaDk,
        calismaStr: calismaDk > 0 ? Math.floor(calismaDk / 60) + 's ' + (calismaDk % 60) + 'dk' : '',
        uretim: l.qty, fire: fireQty,
        fireOran: totalQty > 0 ? Math.round(fireQty / totalQty * 1000) / 10 : 0,
        durusDk, istAd: wo.istAd || '', bolum,
      })
    })
    return rows.sort((a, b) => b.tarih.localeCompare(a.tarih) || b.basStr.localeCompare(a.basStr))
  }, [logs, dBaslangic, dBitis, dOperator, dOperasyon, dBolum, dSiparis, woMap, orderMap, opBolumMap])

  const detayliTotals = useMemo(() => {
    const t = { uretim: 0, fire: 0, calismaDk: 0, durusDk: 0 }
    detayliData.forEach(r => { t.uretim += r.uretim; t.fire += r.fire; t.calismaDk += r.calismaDk; t.durusDk += r.durusDk })
    return {
      ...t,
      fireOran: (t.uretim + t.fire) > 0 ? Math.round(t.fire / (t.uretim + t.fire) * 1000) / 10 : 0,
      calismaStr: t.calismaDk > 0 ? Math.floor(t.calismaDk / 60) + 's ' + (t.calismaDk % 60) + 'dk' : '',
      count: detayliData.length,
    }
  }, [detayliData])

  const exportDetayli = () => {
    import('xlsx').then(XLSX => {
      const rows = detayliData.map(r => ({
        'Tarih': r.tarih, 'Sipariş No': r.siparisNo, 'İE No': r.ieNo,
        'Mamul Kodu': r.mamulKod, 'Mamul Adı': r.mamulAd, 'Operasyon': r.opAd,
        'Operatör(ler)': r.operatorler, 'Başlangıç': r.basStr, 'Bitiş': r.bitStr,
        'Çalışma (dk)': r.calismaDk, 'Üretim': r.uretim, 'Fire': r.fire,
        'Fire %': r.fireOran, 'Duruş (dk)': r.durusDk, 'İstasyon': r.istAd, 'Bölüm': r.bolum,
      }))
      // Toplam satırı
      rows.push({
        'Tarih': 'TOPLAM', 'Sipariş No': '', 'İE No': `${detayliTotals.count} kayıt`,
        'Mamul Kodu': '', 'Mamul Adı': '', 'Operasyon': '',
        'Operatör(ler)': '', 'Başlangıç': '', 'Bitiş': '',
        'Çalışma (dk)': detayliTotals.calismaDk, 'Üretim': detayliTotals.uretim, 'Fire': detayliTotals.fire,
        'Fire %': detayliTotals.fireOran, 'Duruş (dk)': detayliTotals.durusDk, 'İstasyon': '', 'Bölüm': '',
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      // Sütun genişlikleri
      ws['!cols'] = [
        { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 24 }, { wch: 16 },
        { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 7 },
        { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 14 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Detaylı Üretim')
      XLSX.writeFile(wb, `detayli_uretim_${dBaslangic}_${dBitis}.xlsx`)
      toast.success('Detaylı rapor Excel indirildi')
    })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold">Raporlar</h1>
        <select value={tab} onChange={e => setTab(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          {tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <span className="flex-1" />
        <button onClick={() => {
          import('xlsx').then(XLSX => {
            const wb = XLSX.utils.book_new()
            // Günlük üretim
            if (gunlukData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gunlukData), 'Günlük Üretim')
            // Operasyon bazlı
            if (opData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opData), 'Operasyon Bazlı')
            // OEE
            const oeeRows = opData.map(d => {
              const fire = parcaFireLogs.filter(f => f.opAd === d.op).reduce((a, f) => a + f.qty, 0)
              const perf = d.hedef > 0 ? Math.round(d.uretim / d.hedef * 100) : 0
              const qual = d.uretim > 0 ? Math.round((d.uretim - fire) / d.uretim * 100) : 100
              return { Operasyon: d.op, Hedef: d.hedef, Üretim: d.uretim, Fire: fire, 'Performans %': perf, 'Kalite %': qual, 'OEE %': Math.round(perf * qual / 100) }
            })
            if (oeeRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(oeeRows), 'OEE')
            // Geciken siparişler
            const gecikenRows = orders.filter(o => o.termin && o.termin < todayStr).map(o => ({ Sipariş: o.siparisNo, Müşteri: o.musteri, Termin: o.termin, Ürün: o.mamulAd }))
            if (gecikenRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gecikenRows), 'Gecikenler')
            XLSX.writeFile(wb, `rapor_${today()}.xlsx`)
            toast.success('Rapor Excel indirildi')
          })
        }} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
      </div>

      {tab === 'ozet' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono text-accent">{toplamUretim}</div><div className="text-[11px] text-zinc-500">Toplam Üretim</div></div>
            <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono text-red">{toplamFire}</div><div className="text-[11px] text-zinc-500">Toplam Fire</div></div>
            <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono text-green">{bugunUretim}</div><div className="text-[11px] text-zinc-500">Bugün Üretim</div></div>
            <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono text-amber">{bugunFire}</div><div className="text-[11px] text-zinc-500">Bugün Fire</div></div>
            <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono">{orders.length}</div><div className="text-[11px] text-zinc-500">Sipariş</div></div>
            <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono">{workOrders.length}</div><div className="text-[11px] text-zinc-500">İş Emri</div></div>
            <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono">{operators.length}</div><div className="text-[11px] text-zinc-500">Operatör</div></div>
            <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono">{toplamUretim > 0 ? Math.round(toplamFire / toplamUretim * 100) : 0}%</div><div className="text-[11px] text-zinc-500">Fire Oranı</div></div>
          </div>
          {gunlukData.length > 1 && (
            <div className="bg-bg-2 border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Son 14 Gün Üretim Trendi</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={gunlukData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: '#888' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="uretim" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} name="Üretim" />
                  <Line type="monotone" dataKey="fire" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Fire" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ═══ DETAYLI ÜRETİM RAPORU ═══ */}
      {tab === 'detayli' && (
        <div>
          {/* Filtreler */}
          <div className="bg-bg-2 border border-border rounded-lg p-3 mb-3">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Başlangıç</label>
                <input type="date" value={dBaslangic} onChange={e => setDBaslangic(e.target.value)} className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Bitiş</label>
                <input type="date" value={dBitis} onChange={e => setDBitis(e.target.value)} className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Operatör</label>
                <select value={dOperator} onChange={e => setDOperator(e.target.value)} className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300 min-w-[120px]">
                  <option value="">Tümü</option>
                  {dOperatorList.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Operasyon</label>
                <select value={dOperasyon} onChange={e => setDOperasyon(e.target.value)} className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300 min-w-[120px]">
                  <option value="">Tümü</option>
                  {dOperasyonList.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Bölüm</label>
                <select value={dBolum} onChange={e => setDBolum(e.target.value)} className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300 min-w-[100px]">
                  <option value="">Tümü</option>
                  {dBolumList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Sipariş</label>
                <select value={dSiparis} onChange={e => setDSiparis(e.target.value)} className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300 min-w-[120px]">
                  <option value="">Tümü</option>
                  {dSiparisList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button onClick={() => { setDOperator(''); setDOperasyon(''); setDBolum(''); setDSiparis('') }} className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-500 hover:text-white">✕ Temizle</button>
              <span className="flex-1" />
              <span className="text-[11px] text-zinc-500">{detayliTotals.count} kayıt</span>
              <button onClick={exportDetayli} className="px-3 py-1.5 bg-green/20 border border-green/30 rounded text-xs text-green hover:bg-green/30">📥 Excel</button>
            </div>
          </div>

          {/* Tablo */}
          <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border text-zinc-500 bg-bg-1/50">
                    <th className="text-left px-3 py-2">Tarih</th>
                    <th className="text-left px-3 py-2">Sipariş</th>
                    <th className="text-left px-3 py-2">İE No</th>
                    <th className="text-left px-3 py-2">Ürün</th>
                    <th className="text-left px-3 py-2">Operasyon</th>
                    <th className="text-left px-3 py-2">Operatör(ler)</th>
                    <th className="text-center px-3 py-2">Başlangıç</th>
                    <th className="text-center px-3 py-2">Bitiş</th>
                    <th className="text-right px-3 py-2">Süre</th>
                    <th className="text-right px-3 py-2">Üretim</th>
                    <th className="text-right px-3 py-2">Fire</th>
                    <th className="text-right px-3 py-2">Fire%</th>
                    <th className="text-right px-3 py-2">Duruş</th>
                    <th className="text-left px-3 py-2">İstasyon</th>
                    <th className="text-left px-3 py-2">Bölüm</th>
                  </tr>
                </thead>
                <tbody>
                  {detayliData.length === 0 && (
                    <tr><td colSpan={15} className="px-3 py-8 text-center text-zinc-600">Filtre kriterlerine uygun kayıt bulunamadı</td></tr>
                  )}
                  {detayliData.map(r => (
                    <tr key={r.logId} onClick={() => navigate(`/work-orders?ie=${r.woId}&log=${r.logId}`)}
                        title="İE detayına git" className="border-b border-border/20 hover:bg-accent/10 cursor-pointer">
                      <td className="px-3 py-1.5 font-mono text-zinc-400">{r.tarih}</td>
                      <td className="px-3 py-1.5 font-mono text-zinc-300">{r.siparisNo}</td>
                      <td className="px-3 py-1.5 font-mono text-accent">{r.ieNo}</td>
                      <td className="px-3 py-1.5 text-zinc-300" title={r.mamulKod}>{r.mamulAd || r.mamulKod}</td>
                      <td className="px-3 py-1.5 text-zinc-300">{r.opAd}</td>
                      <td className="px-3 py-1.5 text-zinc-300 max-w-[150px] truncate" title={r.operatorler}>{r.operatorler}</td>
                      <td className="px-3 py-1.5 text-center font-mono text-zinc-500">{r.basStr}</td>
                      <td className="px-3 py-1.5 text-center font-mono text-zinc-500">{r.bitStr}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{r.calismaStr}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-green">{r.uretim}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${r.fire > 0 ? 'text-red' : 'text-zinc-600'}`}>{r.fire}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${r.fireOran > 5 ? 'text-red' : r.fireOran > 0 ? 'text-amber' : 'text-zinc-600'}`}>{r.fireOran > 0 ? r.fireOran + '%' : '-'}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${r.durusDk > 0 ? 'text-amber' : 'text-zinc-600'}`}>{r.durusDk > 0 ? r.durusDk + ' dk' : '-'}</td>
                      <td className="px-3 py-1.5 text-zinc-400">{r.istAd}</td>
                      <td className="px-3 py-1.5 text-zinc-400">{r.bolum}</td>
                    </tr>
                  ))}
                </tbody>
                {detayliData.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-bg-1/60 font-semibold">
                      <td className="px-3 py-2 text-zinc-300" colSpan={2}>TOPLAM</td>
                      <td className="px-3 py-2 text-zinc-500 font-mono">{detayliTotals.count} kayıt</td>
                      <td colSpan={5} />
                      <td className="px-3 py-2 text-right font-mono text-zinc-300">{detayliTotals.calismaStr}</td>
                      <td className="px-3 py-2 text-right font-mono text-green">{detayliTotals.uretim}</td>
                      <td className="px-3 py-2 text-right font-mono text-red">{detayliTotals.fire}</td>
                      <td className="px-3 py-2 text-right font-mono text-amber">{detayliTotals.fireOran}%</td>
                      <td className="px-3 py-2 text-right font-mono text-amber">{detayliTotals.durusDk} dk</td>
                      <td colSpan={2} />
                    </tr>
                    <tr className="bg-bg-1/30">
                      <td className="px-3 py-1.5 text-zinc-500 text-[10px]" colSpan={2}>ORTALAMA</td>
                      <td colSpan={6} />
                      <td className="px-3 py-1.5 text-right font-mono text-[10px] text-zinc-500">{detayliTotals.count > 0 ? Math.floor(detayliTotals.calismaDk / detayliTotals.count) + ' dk' : ''}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[10px] text-zinc-500">{detayliTotals.count > 0 ? Math.round(detayliTotals.uretim / detayliTotals.count * 10) / 10 : ''}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[10px] text-zinc-500">{detayliTotals.count > 0 ? Math.round(detayliTotals.fire / detayliTotals.count * 10) / 10 : ''}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'gunluk' && (
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Günlük Üretim / Fire</h3>
          {gunlukData.length ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gunlukData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="tarih" tick={{ fontSize: 10, fill: '#888' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="uretim" fill="#06b6d4" name="Üretim" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="fire" fill="#ef4444" name="Fire" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="w-full text-xs mt-4"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2">Tarih</th><th className="text-right px-4 py-2">Üretim</th><th className="text-right px-4 py-2">Fire</th><th className="text-right px-4 py-2">Fire %</th></tr></thead>
              <tbody>{gunlukData.map(d => (<tr key={d.tarih} className="border-b border-border/30"><td className="px-4 py-1.5 font-mono text-zinc-400">{d.tarih}</td><td className="px-4 py-1.5 text-right font-mono text-green">{d.uretim}</td><td className="px-4 py-1.5 text-right font-mono text-red">{d.fire}</td><td className="px-4 py-1.5 text-right font-mono text-zinc-500">{d.uretim > 0 ? Math.round(d.fire / d.uretim * 100) : 0}%</td></tr>))}</tbody></table>
            </>
          ) : <div className="p-8 text-center text-zinc-600">Veri yok</div>}
        </div>
      )}

      {tab === 'fire' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Fire Dağılımı (Operasyon)</h3>
            {firePieData.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={firePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {firePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="p-8 text-center text-zinc-600">Fire verisi yok</div>}
          </div>
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Fire Detay</h3>
              {(() => {
                const telafisiz = parcaFireLogs.filter(f => f.qty > 0 && !f.telafiWoId).length
                if (telafisiz === 0 || !can('reports_view')) return null
                return (
                  <button
                    disabled={telafiRunning}
                    onClick={async () => {
                      const ok = await showConfirm(
                        `${telafisiz} fire için telafi İE'si oluşturulacak.\n\n` +
                        `v15.76 (madde 13): Telafi İE'leri orijinal SİPARİŞ'E BAĞLI olarak açılır.\n` +
                        `Alt basamak yarımamul stoğu yetersizse otomatik alt operasyon İE'si de açılır.\n` +
                        `Hammadde eksiği varsa MRP'de görünür (Tedarik sayfasından açılır).\n\n` +
                        `İE No formatı: ORİJİNAL-FT1234\n\nDevam?`
                      )
                      if (!ok) return
                      setTelafiRunning(true)
                      // v15.76 — recursive akış için recipes + stokHareketler + materials geçilir
                      const sonuc = await topluFireTelafi(parcaFireLogs, workOrders, recipes, stokHareketler, materials)
                      setTelafiRunning(false)
                      if (sonuc.basarili > 0) toast.success(`${sonuc.basarili} fire için telafi açıldı (alt basamaklar dahil)`)
                      if (sonuc.hata > 0) toast.error(`${sonuc.hata} hata — konsol kontrol et`)
                      if (sonuc.hatalar.length) console.warn('Fire telafi hataları:', sonuc.hatalar)
                      loadAll()
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber/10 border border-amber/25 text-amber rounded text-[11px] hover:bg-amber/20 disabled:opacity-40"
                  >
                    {telafiRunning ? 'İşleniyor...' : `🔁 ${telafisiz} telafisi İE Oluştur`}
                  </button>
                )
              })()}
            </div>
            {parcaFireLogs.length ? (
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-2 z-10">
                    <tr className="border-b border-border text-zinc-500">
                      <th className="text-left px-3 py-2">Tarih</th>
                      <th className="text-left px-3 py-2">İE</th>
                      <th className="text-left px-3 py-2">Malzeme</th>
                      <th className="text-right px-3 py-2">Adet</th>
                      <th className="text-left px-3 py-2 w-32">Telafi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...parcaFireLogs].sort((a, b) => b.tarih.localeCompare(a.tarih)).map(f => {
                      const telafiWo = f.telafiWoId ? workOrders.find(w => w.id === f.telafiWoId) : null
                      return (
                        <tr key={f.id} className="border-b border-border/30">
                          <td className="px-3 py-1 font-mono text-zinc-500">{f.tarih}</td>
                          <td className="px-3 py-1 font-mono text-accent">{f.ieNo}</td>
                          <td className="px-3 py-1 text-zinc-300">{f.malad}</td>
                          <td className="px-3 py-1 text-right font-mono text-red">{f.qty}</td>
                          <td className="px-3 py-1">
                            {telafiWo ? (
                              <span className="px-1.5 py-0.5 bg-green/10 text-green rounded text-[10px] font-mono" title="Telafi İE oluşturuldu">
                                ✓ {telafiWo.ieNo}
                              </span>
                            ) : f.telafiWoId ? (
                              <span className="text-[10px] text-zinc-600">İE silinmiş</span>
                            ) : f.qty > 0 ? (
                              <button
                                onClick={async () => {
                                  const wo = workOrders.find(w => w.id === f.woId)
                                  if (!wo) { toast.error('Orijinal İE bulunamadı'); return }
                                  const r = await fireTelafiIeOlustur(f, wo)
                                  if (r) { toast.success(`Telafi İE oluşturuldu: ${r.ieNo}`); loadAll() }
                                  else toast.error('Oluşturulamadı')
                                }}
                                className="px-1.5 py-0.5 bg-amber/10 text-amber rounded text-[10px] hover:bg-amber/20"
                              >
                                🔁 Aç
                              </button>
                            ) : <span className="text-zinc-600">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-8 text-center text-zinc-600">Fire kaydı yok</div>}
          </div>

          {/* v15.34.3 — Bar Hurda alt bölümü */}
          <div className="lg:col-span-2 bg-bg-2 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Bar Hurda <span className="text-zinc-500 text-xs font-normal">(ham malzeme hurdası)</span></h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="text-zinc-400">
                  Toplam: <span className="text-zinc-200 font-semibold">{barHurdaOzet.toplamBar}</span> bar
                  <span className="text-zinc-600"> · </span>
                  <span className="text-zinc-300 font-mono">{Math.round(barHurdaOzet.toplamMm)}</span> mm
                </div>
                {barHurdaOzet.bugunBar > 0 && (
                  <div className="text-red-400">
                    Bugün: <span className="font-semibold">{barHurdaOzet.bugunBar}</span> bar
                    <span className="text-zinc-600"> · </span>
                    <span className="font-mono">{Math.round(barHurdaOzet.bugunMm)}</span> mm
                  </div>
                )}
              </div>
            </div>
            {barHurdaLogs.length ? (
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-2 z-10">
                    <tr className="border-b border-border text-zinc-500">
                      <th className="text-left px-3 py-2">Tarih</th>
                      <th className="text-left px-3 py-2">Ham Malzeme</th>
                      <th className="text-right px-3 py-2">Uzunluk</th>
                      <th className="text-left px-3 py-2">Kullanıcı</th>
                      <th className="text-left px-3 py-2">Sebep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...barHurdaLogs].sort((a, b) => b.tarih.localeCompare(a.tarih)).map(f => (
                      <tr key={f.id} className="border-b border-border/30">
                        <td className="px-3 py-1 font-mono text-zinc-500">{f.tarih}</td>
                        <td className="px-3 py-1">
                          <div className="font-mono text-accent text-[11px]">{f.malkod}</div>
                          <div className="text-zinc-500 text-[10px]">{f.malad}</div>
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-red">{Math.round(f.uzunlukMm || 0)} mm</td>
                        <td className="px-3 py-1 text-zinc-300">{f.opAd || '-'}</td>
                        <td className="px-3 py-1 text-zinc-400 text-[11px]">
                          {(f.not || '').replace(/^Açık bar hurda( — )?/, '') || <span className="text-zinc-600 italic">sebepsiz</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-8 text-center text-zinc-600">Bar hurda kaydı yok</div>}
          </div>
        </div>
      )}

      {tab === 'operasyon' && (
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Operasyon Performansı</h3>
          {opData.length ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={opData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis dataKey="op" type="category" width={120} tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="hedef" fill="#333" name="Hedef" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="uretim" fill="#06b6d4" name="Üretim" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="w-full text-xs mt-4"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2">Operasyon</th><th className="text-right px-4 py-2">İE</th><th className="text-right px-4 py-2">Hedef</th><th className="text-right px-4 py-2">Üretim</th><th className="text-right px-4 py-2">%</th></tr></thead>
              <tbody>{opData.map(d => { const pct = d.hedef > 0 ? Math.round(d.uretim / d.hedef * 100) : 0; return (<tr key={d.op} className="border-b border-border/30"><td className="px-4 py-1.5 text-zinc-300">{d.op}</td><td className="px-4 py-1.5 text-right font-mono">{d.woCount}</td><td className="px-4 py-1.5 text-right font-mono">{d.hedef}</td><td className="px-4 py-1.5 text-right font-mono text-green">{d.uretim}</td><td className="px-4 py-1.5 text-right font-mono text-accent">{pct}%</td></tr>) })}</tbody></table>
            </>
          ) : <div className="p-8 text-center text-zinc-600">Veri yok</div>}
        </div>
      )}

      {/* OEE */}
      {tab === 'oee' && (() => {
        const oeeData = opData.map(d => {
          const perf = d.hedef > 0 ? Math.round(d.uretim / d.hedef * 100) : 0
          const quality = d.uretim > 0 ? Math.round((d.uretim - (parcaFireLogs.filter(f => f.opAd === d.op).reduce((a, f) => a + f.qty, 0))) / d.uretim * 100) : 100
          const oee = Math.round(perf * quality / 100)
          return { ...d, perf, quality, oee }
        })
        const avgOEE = oeeData.length ? Math.round(oeeData.reduce((a, d) => a + d.oee, 0) / oeeData.length) : 0
        return (
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">OEE — Genel Ekipman Etkinliği</h3>
              <div className={`text-2xl font-mono font-light ${avgOEE >= 85 ? 'text-green' : avgOEE >= 60 ? 'text-amber' : 'text-red'}`}>{avgOEE}%</div>
            </div>
            <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2">Operasyon</th><th className="text-right px-4 py-2">Performans</th><th className="text-right px-4 py-2">Kalite</th><th className="text-right px-4 py-2 font-semibold">OEE</th></tr></thead>
            <tbody>{oeeData.map(d => (
              <tr key={d.op} className="border-b border-border/30">
                <td className="px-4 py-1.5 text-zinc-300">{d.op}</td>
                <td className="px-4 py-1.5 text-right font-mono">{d.perf}%</td>
                <td className="px-4 py-1.5 text-right font-mono">{d.quality}%</td>
                <td className={`px-4 py-1.5 text-right font-mono font-semibold ${d.oee >= 85 ? 'text-green' : d.oee >= 60 ? 'text-amber' : 'text-red'}`}>{d.oee}%</td>
              </tr>
            ))}</tbody></table>
            <div className="mt-3 text-[10px] text-zinc-600">OEE = Performans × Kalite | Hedef: ≥85% | Performans = Üretilen/Hedef | Kalite = (Üretilen-Fire)/Üretilen</div>
          </div>
        )
      })()}

      {/* Duruş Analizi */}
      {tab === 'durus' && (() => {
        const durusMap: Record<string, { kod: string; ad: string; toplamDk: number; adet: number }> = {}
        logs.forEach(l => l.duruslar?.forEach(d => {
          const key = d.sebep || 'Tanımsız'
          if (!durusMap[key]) durusMap[key] = { kod: '', ad: key, toplamDk: 0, adet: 0 }
          // Süre hesabı: bas-bit arasından dk
          const sure = (d as unknown as Record<string, unknown>).sure as number || 0
          durusMap[key].toplamDk += sure
          durusMap[key].adet++
        }))
        const durusData = Object.values(durusMap).sort((a, b) => b.toplamDk - a.toplamDk)
        const toplamDurus = durusData.reduce((a, d) => a + d.toplamDk, 0)
        return (
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Duruş Analizi — Toplam: {toplamDurus} dk</h3>
            {durusData.length ? (
              <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={durusData}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="ad" tick={{ fontSize: 10, fill: '#888' }} /><YAxis tick={{ fontSize: 10, fill: '#888' }} /><Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="toplamDk" fill="#f59e0b" name="Toplam (dk)" radius={[3, 3, 0, 0]} /></BarChart>
              </ResponsiveContainer>
              <table className="w-full text-xs mt-3"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2">Duruş Kodu</th><th className="text-right px-4 py-2">Adet</th><th className="text-right px-4 py-2">Toplam dk</th><th className="text-right px-4 py-2">Oran</th></tr></thead>
              <tbody>{durusData.map(d => (<tr key={d.ad} className="border-b border-border/30"><td className="px-4 py-1.5 text-zinc-300">{d.ad}</td><td className="px-4 py-1.5 text-right font-mono">{d.adet}</td><td className="px-4 py-1.5 text-right font-mono text-amber">{d.toplamDk}</td><td className="px-4 py-1.5 text-right font-mono text-zinc-500">{toplamDurus > 0 ? Math.round(d.toplamDk / toplamDurus * 100) : 0}%</td></tr>))}</tbody></table>
              </>
            ) : <div className="p-8 text-center text-zinc-600">Duruş kaydı yok</div>}
          </div>
        )
      })()}

      {/* Gecikme Raporu */}
      {tab === 'gecikme' && (() => {
        const geciken = orders.filter(o => o.termin && o.termin < todayStr).map(o => {
          const wos = workOrders.filter(w => w.orderId === o.id)
          const totalPct = wos.length ? wos.reduce((s, w) => {
            const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
            return s + (w.hedef > 0 ? Math.min(100, prod / w.hedef * 100) : 0)
          }, 0) / wos.length : 0
          const pct = Math.round(totalPct)
          const gun = Math.ceil((new Date().getTime() - new Date(o.termin).getTime()) / 86400000)
          return { ...o, pct, gun, woCount: wos.length }
        }).filter(o => o.pct < 100).sort((a, b) => b.gun - a.gun)
        return (
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 text-red">Geciken Siparişler ({geciken.length})</h3>
            {geciken.length ? (
              <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2">Sipariş No</th><th className="text-left px-4 py-2">Müşteri</th><th className="text-left px-4 py-2">Termin</th><th className="text-right px-4 py-2">Gecikme</th><th className="text-right px-4 py-2">İlerleme</th></tr></thead>
              <tbody>{geciken.map(o => (<tr key={o.id} className="border-b border-border/30"><td className="px-4 py-1.5 font-mono text-accent">{o.siparisNo}</td><td className="px-4 py-1.5 text-zinc-300">{o.musteri}</td><td className="px-4 py-1.5 font-mono text-red">{o.termin}</td><td className="px-4 py-1.5 text-right font-mono text-red font-semibold">{o.gun} gün</td><td className="px-4 py-1.5 text-right font-mono text-amber">{o.pct}%</td></tr>))}</tbody></table>
            ) : <div className="p-8 text-center text-green">Geciken sipariş yok!</div>}
          </div>
        )
      })()}

      {/* Operatör Performans */}
      {tab === 'operator' && (() => {
        const oprMap: Record<string, { ad: string; uretim: number; fire: number; logSayisi: number; gunler: Set<string> }> = {}
        logs.forEach(l => {
          l.operatorlar?.forEach((o: { id?: string; ad?: string }) => {
            const key = o.ad || 'Tanımsız'
            if (!oprMap[key]) oprMap[key] = { ad: key, uretim: 0, fire: 0, logSayisi: 0, gunler: new Set() }
            oprMap[key].uretim += l.qty
            oprMap[key].fire += l.fire || 0
            oprMap[key].logSayisi++
            oprMap[key].gunler.add(l.tarih)
          })
        })
        const oprData = Object.values(oprMap).map(o => ({
          ...o, gunSayisi: o.gunler.size, gunlukOrt: o.gunler.size > 0 ? Math.round(o.uretim / o.gunler.size) : 0
        })).sort((a, b) => b.uretim - a.uretim)
        return (
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Operatör Performansı ({oprData.length} operatör)</h3>
            {oprData.length ? (
              <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={oprData.slice(0, 15)} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} /><YAxis dataKey="ad" type="category" width={100} tick={{ fontSize: 10, fill: '#888' }} /><Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="uretim" fill="#06b6d4" name="Üretim" radius={[0, 3, 3, 0]} /></BarChart>
              </ResponsiveContainer>
              <table className="w-full text-xs mt-3"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2">Operatör</th><th className="text-right px-4 py-2">Üretim</th><th className="text-right px-4 py-2">Fire</th><th className="text-right px-4 py-2">Gün</th><th className="text-right px-4 py-2">Günlük Ort.</th><th className="text-right px-4 py-2">Fire %</th></tr></thead>
              <tbody>{oprData.map(o => (<tr key={o.ad} className="border-b border-border/30"><td className="px-4 py-1.5 text-zinc-300">{o.ad}</td><td className="px-4 py-1.5 text-right font-mono text-green">{o.uretim}</td><td className="px-4 py-1.5 text-right font-mono text-red">{o.fire}</td><td className="px-4 py-1.5 text-right font-mono">{o.gunSayisi}</td><td className="px-4 py-1.5 text-right font-mono text-accent">{o.gunlukOrt}</td><td className="px-4 py-1.5 text-right font-mono text-zinc-500">{o.uretim > 0 ? Math.round(o.fire / o.uretim * 100) : 0}%</td></tr>))}</tbody></table>
              </>
            ) : <div className="p-8 text-center text-zinc-600">Veri yok</div>}
          </div>
        )
      })()}

      {/* Malzeme Tüketim */}
      {tab === 'maltuket' && (() => {
        const tuketimMap: Record<string, { malkod: string; malad: string; toplam: number }> = {}
        logs.forEach(l => {
          if (!l.malkod) return
          if (!tuketimMap[l.malkod]) tuketimMap[l.malkod] = { malkod: l.malkod, malad: '', toplam: 0 }
          tuketimMap[l.malkod].toplam += l.qty
        })
        // HM tüketim from stok hareketleri
        const { stokHareketler } = useStore.getState()
        stokHareketler.filter(h => h.tip === 'cikis' && h.logId).forEach(h => {
          if (!tuketimMap[h.malkod]) tuketimMap[h.malkod] = { malkod: h.malkod, malad: h.malad, toplam: 0 }
          tuketimMap[h.malkod].malad = h.malad
          tuketimMap[h.malkod].toplam += h.miktar
        })
        const data = Object.values(tuketimMap).sort((a, b) => b.toplam - a.toplam)
        return (
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Malzeme Tüketim ({data.length} malzeme)</h3>
            {data.length ? (
              <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2">Malzeme Kodu</th><th className="text-left px-4 py-2">Malzeme Adı</th><th className="text-right px-4 py-2">Toplam Tüketim</th></tr></thead>
              <tbody>{data.slice(0, 30).map(d => (<tr key={d.malkod} className="border-b border-border/30"><td className="px-4 py-1.5 font-mono text-accent">{d.malkod}</td><td className="px-4 py-1.5 text-zinc-300">{d.malad}</td><td className="px-4 py-1.5 text-right font-mono text-amber">{Math.round(d.toplam)}</td></tr>))}</tbody></table>
            ) : <div className="p-8 text-center text-zinc-600">Veri yok</div>}
          </div>
        )
      })()}

      {/* Trend */}
      {tab === 'trend' && (() => {
        const gunMap: Record<string, { gun: string; uretim: number; fire: number }> = {}
        logs.forEach(l => {
          if (!l.tarih) return
          if (!gunMap[l.tarih]) gunMap[l.tarih] = { gun: l.tarih, uretim: 0, fire: 0 }
          gunMap[l.tarih].uretim += l.qty
          gunMap[l.tarih].fire += l.fire || 0
        })
        const data = Object.values(gunMap).sort((a, b) => a.gun.localeCompare(b.gun)).slice(-30)
        return (
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Üretim Trend (son 30 gün)</h3>
            {data.length > 1 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="gun" tick={{ fontSize: 9, fill: '#888' }} /><YAxis tick={{ fontSize: 10, fill: '#888' }} /><Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} /><Line type="monotone" dataKey="uretim" stroke="#06b6d4" strokeWidth={2} name="Üretim" /><Line type="monotone" dataKey="fire" stroke="#ef4444" strokeWidth={1} name="Fire" /></LineChart>
              </ResponsiveContainer>
            ) : <div className="p-8 text-center text-zinc-600">Yeterli veri yok</div>}
          </div>
        )
      })()}

      {/* İstasyon Performans */}
      {tab === 'istperf' && (() => {
        const istMap: Record<string, { ad: string; uretim: number; woCount: number }> = {}
        workOrders.forEach(w => {
          const key = w.istAd || w.opAd || 'Tanımsız'
          if (!istMap[key]) istMap[key] = { ad: key, uretim: 0, woCount: 0 }
          istMap[key].uretim += logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
          istMap[key].woCount++
        })
        const data = Object.values(istMap).sort((a, b) => b.uretim - a.uretim)
        return (
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">İstasyon/Operasyon Performansı ({data.length})</h3>
            {data.length ? (
              <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.slice(0, 15)}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="ad" tick={{ fontSize: 9, fill: '#888' }} /><YAxis tick={{ fontSize: 10, fill: '#888' }} /><Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} /><Bar dataKey="uretim" fill="#22c55e" name="Üretim" radius={[3, 3, 0, 0]} /></BarChart>
              </ResponsiveContainer>
              <table className="w-full text-xs mt-3"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2">İstasyon</th><th className="text-right px-4 py-2">İE Sayısı</th><th className="text-right px-4 py-2">Toplam Üretim</th></tr></thead>
              <tbody>{data.map(d => (<tr key={d.ad} className="border-b border-border/30"><td className="px-4 py-1.5 text-zinc-300">{d.ad}</td><td className="px-4 py-1.5 text-right font-mono">{d.woCount}</td><td className="px-4 py-1.5 text-right font-mono text-green">{d.uretim}</td></tr>))}</tbody></table>
              </>
            ) : <div className="p-8 text-center text-zinc-600">Veri yok</div>}
          </div>
        )
      })()}

      {/* Operatör Saat Analizi */}
      {tab === 'oprsaat' && (() => {
        const oprSaatMap: Record<string, { ad: string; toplamDk: number; uretim: number; gunler: Set<string> }> = {}
        logs.forEach(l => {
          l.operatorlar?.forEach((o: { id?: string; ad?: string; bas?: string; bit?: string }) => {
            const key = o.ad || 'Tanımsız'
            if (!oprSaatMap[key]) oprSaatMap[key] = { ad: key, toplamDk: 0, uretim: 0, gunler: new Set() }
            oprSaatMap[key].uretim += l.qty
            oprSaatMap[key].gunler.add(l.tarih)
            if (o.bas && o.bit && o.bit >= o.bas) {
              const b = parseInt(o.bas.split(':')[0]) * 60 + parseInt(o.bas.split(':')[1] || '0')
              const e = parseInt(o.bit.split(':')[0]) * 60 + parseInt(o.bit.split(':')[1] || '0')
              oprSaatMap[key].toplamDk += Math.max(0, e - b)
            }
          })
        })
        const data = Object.values(oprSaatMap).map(o => ({
          ...o, gunSayisi: o.gunler.size,
          saatStr: Math.floor(o.toplamDk / 60) + 's ' + (o.toplamDk % 60) + 'dk',
          adetSaat: o.toplamDk > 0 ? Math.round(o.uretim / (o.toplamDk / 60) * 10) / 10 : 0,
        })).sort((a, b) => b.uretim - a.uretim)
        return (
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Operatör Saat Analizi ({data.length})</h3>
            {data.length ? (
              <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2">Operatör</th><th className="text-right px-4 py-2">Toplam Süre</th><th className="text-right px-4 py-2">Üretim</th><th className="text-right px-4 py-2">Gün</th><th className="text-right px-4 py-2">Adet/Saat</th></tr></thead>
              <tbody>{data.map(o => (<tr key={o.ad} className="border-b border-border/30"><td className="px-4 py-1.5 text-zinc-300">{o.ad}</td><td className="px-4 py-1.5 text-right font-mono text-accent">{o.saatStr}</td><td className="px-4 py-1.5 text-right font-mono text-green">{o.uretim}</td><td className="px-4 py-1.5 text-right font-mono">{o.gunSayisi}</td><td className="px-4 py-1.5 text-right font-mono text-amber">{o.adetSaat}</td></tr>))}</tbody></table>
            ) : <div className="p-8 text-center text-zinc-600">Operatör saat verisi yok — üretim girişinde başlama/bitiş saati girilmeli</div>}
          </div>
        )
      })()}
    </div>
  )
}
