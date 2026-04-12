import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { today } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'

const COLORS = ['#06b6d4', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function Reports() {
  const { workOrders, logs, operators, fireLogs, orders } = useStore()
  const [tab, setTab] = useState('ozet')

  const tabs = [
    { id: 'ozet', label: 'Özet' },
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
  ]

  const todayStr = today()
  const toplamUretim = logs.reduce((a, l) => a + l.qty, 0)
  const toplamFire = fireLogs.reduce((a, f) => a + f.qty, 0)
  const bugunUretim = logs.filter(l => l.tarih === todayStr).reduce((a, l) => a + l.qty, 0)
  const bugunFire = fireLogs.filter(f => f.tarih === todayStr).reduce((a, f) => a + f.qty, 0)

  // Son 14 gün günlük üretim
  const gunlukData = useMemo(() => {
    const map: Record<string, { tarih: string; uretim: number; fire: number }> = {}
    logs.forEach(l => { if (!map[l.tarih]) map[l.tarih] = { tarih: l.tarih, uretim: 0, fire: 0 }; map[l.tarih].uretim += l.qty })
    fireLogs.forEach(f => { if (!map[f.tarih]) map[f.tarih] = { tarih: f.tarih, uretim: 0, fire: 0 }; map[f.tarih].fire += f.qty })
    return Object.values(map).sort((a, b) => a.tarih.localeCompare(b.tarih)).slice(-14)
  }, [logs, fireLogs])

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

  // Fire operasyona göre dağılım
  const firePieData = useMemo(() => {
    const map: Record<string, number> = {}
    fireLogs.forEach(f => { const k = f.opAd || 'Tanımsız'; map[k] = (map[k] || 0) + f.qty })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [fireLogs])

  return (
    <div>
      <div className="mb-4"><h1 className="text-xl font-semibold">Raporlar</h1></div>
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${tab === t.id ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400 hover:text-white'}`}>{t.label}</button>
        ))}
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
            <h3 className="text-sm font-semibold mb-3">Fire Detay</h3>
            {fireLogs.length ? (
              <div className="max-h-[300px] overflow-y-auto"><table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Tarih</th><th className="text-left px-3 py-2">İE</th><th className="text-left px-3 py-2">Malzeme</th><th className="text-right px-3 py-2">Adet</th></tr></thead>
              <tbody>{[...fireLogs].sort((a, b) => b.tarih.localeCompare(a.tarih)).map(f => (<tr key={f.id} className="border-b border-border/30"><td className="px-3 py-1 font-mono text-zinc-500">{f.tarih}</td><td className="px-3 py-1 font-mono text-accent">{f.ieNo}</td><td className="px-3 py-1 text-zinc-300">{f.malad}</td><td className="px-3 py-1 text-right font-mono text-red">{f.qty}</td></tr>))}</tbody></table></div>
            ) : <div className="p-8 text-center text-zinc-600">Fire kaydı yok</div>}
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
          const quality = d.uretim > 0 ? Math.round((d.uretim - (fireLogs.filter(f => f.opAd === d.op).reduce((a, f) => a + f.qty, 0))) / d.uretim * 100) : 100
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
    </div>
  )
}
