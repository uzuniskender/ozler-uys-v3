import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProductionStore, useOrderStore, useWarehouseStore, useAuthStore, loadAllStores } from '@/store'
import { today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { topluFireTelafi, fireTelafiIeOlustur } from '@/services/productionService/fireTelafi'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, ReferenceLine, Legend } from 'recharts'

const COLORS = ['#06b6d4', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const detayFiltreSchemasi = z.object({
  baslangic: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçerli bir başlangıç tarihi girin'),
  bitis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçerli bir bitiş tarihi girin'),
}).refine(d => d.baslangic <= d.bitis, { message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz', path: ['baslangic'] })

export function Reports() {
  const workOrders = useProductionStore(s => s.workOrders)
  const logs = useProductionStore(s => s.logs)
  const fireLogs = useProductionStore(s => s.fireLogs)
  const operations = useProductionStore(s => s.operations)
  const recipes = useProductionStore(s => s.recipes)
  const orders = useOrderStore(s => s.orders)
  const stokHareketler = useWarehouseStore(s => s.stokHareketler)
  const materials = useWarehouseStore(s => s.materials)
  const operators = useAuthStore(s => s.operators)
  const { can } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('ozet')
  const [telafiRunning, setTelafiRunning] = useState(false)
  const [stokKritikOnly, setStokKritikOnly] = useState(false)
  const [selectedIst, setSelectedIst] = useState('')

  // Detaylı Rapor filtreleri
  const [dBaslangic, setDBaslangic] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [dBitis, setDBitis] = useState(today())

  // Operatör Performans filtreleri
  const [oprBaslangic, setOprBaslangic] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [oprBitis, setOprBitis] = useState(today())
  const [dOperator, setDOperator] = useState('')
  const [dOperasyon, setDOperasyon] = useState('')
  const [dBolum, setDBolum] = useState('')
  const [dSiparis, setDSiparis] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  // Operatör Saat filtreleri
  const [osBaslangic, setOsBaslangic] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [osBitis, setOsBitis] = useState(today())
  const [osSecili, setOsSecili] = useState('')

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
    { id: 'stokdurum', label: 'Stok Durumu' },
  ]

  const todayStr = today()
  // v15.34.3 — Fire logları iki gruba ayır: parça fire vs bar hurda
  const parcaFireLogs = useMemo(() => fireLogs.filter(f => f.tip !== 'bar_hurda'), [fireLogs])
  const barHurdaLogs = useMemo(() => fireLogs.filter(f => f.tip === 'bar_hurda'), [fireLogs])

  const toplamUretim = useMemo(() => logs.reduce((a, l) => a + l.qty, 0), [logs])
  const toplamFire = parcaFireLogs.reduce((a, f) => a + f.qty, 0)
  const bugunUretim = useMemo(() => logs.filter(l => l.tarih === todayStr).reduce((a, l) => a + l.qty, 0), [logs, todayStr])
  const bugunFire = parcaFireLogs.filter(f => f.tarih === todayStr).reduce((a, f) => a + f.qty, 0)

  // Son 14 gün günlük üretim
  const gunlukData = useMemo(() => {
    const map: Record<string, { tarih: string; uretim: number; fire: number }> = {}
    logs.forEach(l => { if (!map[l.tarih]) map[l.tarih] = { tarih: l.tarih, uretim: 0, fire: 0 }; map[l.tarih].uretim += l.qty })
    parcaFireLogs.forEach(f => { if (!map[f.tarih]) map[f.tarih] = { tarih: f.tarih, uretim: 0, fire: 0 }; map[f.tarih].fire += f.qty })
    return Object.values(map).sort((a, b) => a.tarih.localeCompare(b.tarih)).slice(-14)
  }, [logs, parcaFireLogs])

  // woId → toplam üretim qty — gecikme, istperf ve opData paylaşır (O(n²) → O(n))
  const uretimByWo = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of logs) m.set(l.woId, (m.get(l.woId) ?? 0) + l.qty)
    return m
  }, [logs])

  // Operasyon bazlı
  const opData = useMemo(() => {
    const map: Record<string, { op: string; hedef: number; uretim: number; woCount: number }> = {}
    workOrders.forEach(w => {
      const k = w.opAd || 'Tanımsız'
      if (!map[k]) map[k] = { op: k, hedef: 0, uretim: 0, woCount: 0 }
      map[k].hedef += w.hedef; map[k].woCount++
      map[k].uretim += uretimByWo.get(w.id) ?? 0
    })
    return Object.values(map).sort((a, b) => b.hedef - a.hedef)
  }, [workOrders, uretimByWo])

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

  // OEE Availability: operasyon başına toplam çalışma + duruş dk (SUM — max değil)
  const opTimeMap = useMemo(() => {
    const calisma = new Map<string, number>()
    const durus = new Map<string, number>()
    logs.forEach(l => {
      const opAd = woMap[l.woId]?.opAd || 'Tanımsız'
      const oprArr = Array.isArray(l.operatorlar) ? l.operatorlar : []
      oprArr.forEach((o: { bas?: string; bit?: string }) => {
        if (o.bas && o.bit && o.bit >= o.bas) {
          const b = parseInt(o.bas.split(':')[0]) * 60 + parseInt(o.bas.split(':')[1] || '0')
          const e = parseInt(o.bit.split(':')[0]) * 60 + parseInt(o.bit.split(':')[1] || '0')
          calisma.set(opAd, (calisma.get(opAd) ?? 0) + Math.max(0, e - b))
        }
      })
      if (Array.isArray(l.duruslar)) {
        l.duruslar.forEach((d: { sure?: number }) => {
          durus.set(opAd, (durus.get(opAd) ?? 0) + (d.sure || 0))
        })
      }
    })
    return { calisma, durus }
  }, [logs, woMap])

  // Unique filter options
  // Stok Durumu: malkod bazında net stok
  const stokData = useMemo(() => {
    const netMap: Record<string, number> = {}
    const maladMap: Record<string, string> = {}
    stokHareketler.forEach(h => {
      if (!netMap[h.malkod]) netMap[h.malkod] = 0
      if (h.malad) maladMap[h.malkod] = h.malad
      if (h.tip === 'giris') netMap[h.malkod] += h.miktar
      else netMap[h.malkod] -= h.miktar  // cikis ve bar_acilis depodan çıkış
    })
    const matMap = new Map(materials.map(m => [m.kod, m]))
    const allKodlar = new Set([
      ...Object.keys(netMap),
      ...materials.filter(m => m.aktif !== false).map(m => m.kod),
    ])
    return [...allKodlar]
      .map(kod => {
        const mat = matMap.get(kod)
        if (mat && mat.aktif === false) return null
        const netStok = Math.round((netMap[kod] ?? 0) * 100) / 100
        const minStok = mat?.minStok ?? 0
        const malad = mat?.ad || maladMap[kod] || ''
        const birim = mat?.birim || ''
        const sifir = netStok <= 0
        const eksik = minStok > 0 && netStok < minStok
        return { kod, malad, birim, netStok, minStok, sifir, eksik }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        const pa = a.sifir ? 0 : a.eksik ? 1 : 2
        const pb = b.sifir ? 0 : b.eksik ? 1 : 2
        return pa !== pb ? pa - pb : a.kod.localeCompare(b.kod)
      })
  }, [stokHareketler, materials])

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

  async function pdfIndir() {
    if (!contentRef.current) return
    const toastId = toast.loading('PDF hazırlanıyor...')
    try {
      const [{ default: html2canvas }, { newPdf, ozlerHeader, ozlerFooter }] = await Promise.all([
        import('html2canvas'),
        import('@/lib/pdf'),
      ])
      const canvas = await html2canvas(contentRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
      })
      const doc = await newPdf()
      const tabLabel = tabs.find(t => t.id === tab)?.label || tab
      const margin = 15
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const imgW = pageW - 2 * margin
      const y0 = ozlerHeader(doc, { baslik: 'RAPOR', altBaslik: tabLabel })
      const usableH = pageH - y0 - 37
      const scale = imgW / canvas.width
      const sliceSrcH = Math.round(usableH / scale)
      let srcY = 0
      let firstPage = true
      while (srcY < canvas.height) {
        if (!firstPage) {
          doc.addPage()
          ozlerHeader(doc, { baslik: 'RAPOR', altBaslik: tabLabel + ' (devam)' })
        }
        const actualH = Math.min(sliceSrcH, canvas.height - srcY)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = actualH
        sliceCanvas.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, actualH, 0, 0, canvas.width, actualH)
        doc.addImage(sliceCanvas.toDataURL('image/jpeg', 0.85), 'JPEG', margin, y0, imgW, actualH * scale)
        srcY += actualH
        firstPage = false
      }
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) { doc.setPage(i); ozlerFooter(doc) }
      doc.save(`rapor_${tab}_${today()}.pdf`)
      toast.success('PDF indirildi', { id: toastId })
    } catch (e: unknown) {
      toast.error('PDF oluşturulamadı: ' + ((e as Error)?.message || ''), { id: toastId })
    }
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
              const calismaDk = opTimeMap.calisma.get(d.op) ?? 0
              const durusDk = Math.min(opTimeMap.durus.get(d.op) ?? 0, calismaDk)
              const avail = calismaDk > 0 ? Math.max(0, Math.round((calismaDk - durusDk) / calismaDk * 100)) : 100
              const perf = d.hedef > 0 ? Math.min(100, Math.round(d.uretim / d.hedef * 100)) : 0
              const qual = d.uretim > 0 ? Math.max(0, Math.round((d.uretim - fire) / d.uretim * 100)) : 100
              return { Operasyon: d.op, Hedef: d.hedef, Üretim: d.uretim, Fire: fire, 'Çalışma dk': calismaDk, 'Duruş dk': durusDk, 'Kullanılabilirlik %': calismaDk > 0 ? avail : '—', 'Performans %': perf, 'Kalite %': qual, 'OEE %': Math.round(avail * perf * qual / 10000) }
            })
            if (oeeRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(oeeRows), 'OEE')
            // Geciken siparişler
            const gecikenRows = orders.filter(o => o.termin && o.termin < todayStr).map(o => ({ Sipariş: o.siparisNo, Müşteri: o.musteri, Termin: o.termin, Ürün: o.mamulAd }))
            if (gecikenRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gecikenRows), 'Gecikenler')
            XLSX.writeFile(wb, `rapor_${today()}.xlsx`)
            toast.success('Rapor Excel indirildi')
          })
        }} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
        <button onClick={pdfIndir} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📄 PDF</button>
      </div>

      <div ref={contentRef}>
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
            <div className="bg-bg-2 border border-border rounded-lg p-4 text-center"><div className="text-2xl font-light font-mono">{(toplamUretim + toplamFire) > 0 ? Math.round(toplamFire / (toplamUretim + toplamFire) * 100) : 0}%</div><div className="text-[11px] text-zinc-500">Fire Oranı</div></div>
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
                <input type="date" value={dBaslangic} onChange={e => {
                  const g = detayFiltreSchemasi.safeParse({ baslangic: e.target.value, bitis: dBitis })
                  if (!g.success) { toast.error(g.error.issues[0].message); return }
                  setDBaslangic(e.target.value)
                }} className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Bitiş</label>
                <input type="date" value={dBitis} onChange={e => {
                  const g = detayFiltreSchemasi.safeParse({ baslangic: dBaslangic, bitis: e.target.value })
                  if (!g.success) { toast.error(g.error.issues[0].message); return }
                  setDBitis(e.target.value)
                }} className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300" />
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
              <tbody>{gunlukData.map(d => (<tr key={d.tarih} className="border-b border-border/30"><td className="px-4 py-1.5 font-mono text-zinc-400">{d.tarih}</td><td className="px-4 py-1.5 text-right font-mono text-green">{d.uretim}</td><td className="px-4 py-1.5 text-right font-mono text-red">{d.fire}</td><td className="px-4 py-1.5 text-right font-mono text-zinc-500">{(d.uretim + d.fire) > 0 ? Math.round(d.fire / (d.uretim + d.fire) * 100) : 0}%</td></tr>))}</tbody></table>
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
                      if (sonuc.hata > 0) toast.error(`${sonuc.hata} hata`)
                      loadAllStores()
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
                                  if (r) { toast.success(`Telafi İE oluşturuldu: ${r.ieNo}`); loadAllStores() }
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
        // Operasyon bazlı OEE (mevcut)
        const oeeData = opData.map(d => {
          const calismaDk = opTimeMap.calisma.get(d.op) ?? 0
          const durusDk = Math.min(opTimeMap.durus.get(d.op) ?? 0, calismaDk)
          const avail = calismaDk > 0 ? Math.max(0, Math.round((calismaDk - durusDk) / calismaDk * 100)) : 100
          const perf = d.hedef > 0 ? Math.min(100, Math.round(d.uretim / d.hedef * 100)) : 0
          const quality = d.uretim > 0 ? Math.max(0, Math.round((d.uretim - (parcaFireLogs.filter(f => f.opAd === d.op).reduce((a, f) => a + f.qty, 0))) / d.uretim * 100)) : 100
          const oee = Math.round(avail * perf * quality / 10000)
          return { ...d, avail, perf, quality, oee, calismaDk, durusDk }
        })
        const totalUretimOEE = oeeData.reduce((s, d) => s + d.uretim, 0)
        const avgOEE = totalUretimOEE > 0
          ? Math.round(oeeData.reduce((s, d) => s + d.oee * d.uretim, 0) / totalUretimOEE)
          : oeeData.length ? Math.round(oeeData.reduce((a, d) => a + d.oee, 0) / oeeData.length) : 0

        // Haftalık OEE trend (son 8 hafta)
        const getWeekStart = (dateStr: string): string => {
          const d = new Date(dateStr)
          const day = d.getDay()
          d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
          return d.toISOString().slice(0, 10)
        }
        const weekBuckets: Record<string, { uretim: number; fire: number; calismaDk: number; durusDk: number; woIds: Set<string> }> = {}
        logs.forEach(l => {
          if (!l.tarih) return
          const wb = getWeekStart(l.tarih)
          if (!weekBuckets[wb]) weekBuckets[wb] = { uretim: 0, fire: 0, calismaDk: 0, durusDk: 0, woIds: new Set() }
          const bk = weekBuckets[wb]
          bk.uretim += l.qty
          bk.fire += (l.fire || 0)
          bk.woIds.add(l.woId)
          ;(Array.isArray(l.operatorlar) ? l.operatorlar : []).forEach((o: { bas?: string; bit?: string }) => {
            if (o.bas && o.bit && o.bit >= o.bas) {
              const b = parseInt(o.bas.split(':')[0]) * 60 + parseInt(o.bas.split(':')[1] || '0')
              const e = parseInt(o.bit.split(':')[0]) * 60 + parseInt(o.bit.split(':')[1] || '0')
              bk.calismaDk += Math.max(0, e - b)
            }
          })
          if (Array.isArray(l.duruslar)) {
            l.duruslar.forEach((d: { sure?: number }) => { bk.durusDk += d.sure || 0 })
          }
        })
        const haftaOEE = Object.entries(weekBuckets)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-8)
          .map(([wb, bk]) => {
            const woHedef = [...bk.woIds].reduce((s, id) => s + (woMap[id]?.hedef || 0), 0)
            const avail = bk.calismaDk > 0 ? Math.max(0, Math.round((bk.calismaDk - Math.min(bk.durusDk, bk.calismaDk)) / bk.calismaDk * 100)) : 100
            const perf = woHedef > 0 ? Math.min(100, Math.round(bk.uretim / woHedef * 100)) : 100
            const quality = (bk.uretim + bk.fire) > 0 ? Math.max(0, Math.round(bk.uretim / (bk.uretim + bk.fire) * 100)) : 100
            const oee = Math.round(avail * perf * quality / 10000)
            return { hafta: wb.slice(5), oee }
          })

        // İstasyon bazlı OEE
        const istOpAds = new Map<string, Set<string>>()
        const istHedef = new Map<string, number>()
        const istUretim = new Map<string, number>()
        workOrders.forEach(w => {
          const key = w.istAd || w.opAd || 'Tanımsız'
          if (!istOpAds.has(key)) { istOpAds.set(key, new Set()); istHedef.set(key, 0); istUretim.set(key, 0) }
          if (w.opAd) istOpAds.get(key)!.add(w.opAd)
          istHedef.set(key, (istHedef.get(key) ?? 0) + (w.hedef || 0))
          istUretim.set(key, (istUretim.get(key) ?? 0) + (uretimByWo.get(w.id) ?? 0))
        })
        const istCalisma = new Map<string, number>()
        const istDurus = new Map<string, number>()
        logs.forEach(l => {
          const wo = woMap[l.woId]
          const key = wo?.istAd || wo?.opAd || 'Tanımsız'
          ;(Array.isArray(l.operatorlar) ? l.operatorlar : []).forEach((o: { bas?: string; bit?: string }) => {
            if (o.bas && o.bit && o.bit >= o.bas) {
              const b = parseInt(o.bas.split(':')[0]) * 60 + parseInt(o.bas.split(':')[1] || '0')
              const e = parseInt(o.bit.split(':')[0]) * 60 + parseInt(o.bit.split(':')[1] || '0')
              istCalisma.set(key, (istCalisma.get(key) ?? 0) + Math.max(0, e - b))
            }
          })
          if (Array.isArray(l.duruslar)) {
            l.duruslar.forEach((d: { sure?: number }) => { istDurus.set(key, (istDurus.get(key) ?? 0) + (d.sure || 0)) })
          }
        })
        const istOEE = [...istOpAds.keys()]
          .map(key => {
            const calisma = istCalisma.get(key) ?? 0
            const durus = Math.min(istDurus.get(key) ?? 0, calisma)
            const hedef = istHedef.get(key) ?? 0
            const uretim = istUretim.get(key) ?? 0
            const avail = calisma > 0 ? Math.max(0, Math.round((calisma - durus) / calisma * 100)) : 100
            const perf = hedef > 0 ? Math.min(100, Math.round(uretim / hedef * 100)) : 0
            const fire = parcaFireLogs.filter(f => istOpAds.get(key)?.has(f.opAd || '')).reduce((a, f) => a + f.qty, 0)
            const quality = uretim > 0 ? Math.max(0, Math.round((uretim - fire) / uretim * 100)) : 100
            const oee = Math.round(avail * perf * quality / 10000)
            return { ist: key, oee }
          })
          .filter(d => d.oee > 0)
          .sort((a, b) => b.oee - a.oee)
          .slice(0, 12)

        return (
          <div className="space-y-4">
            {/* KPI */}
            <div className="flex items-center justify-between bg-bg-2 border border-border rounded-lg px-5 py-4">
              <h3 className="text-sm font-semibold">OEE — Genel Ekipman Etkinliği</h3>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-zinc-500">Ağırlıklı Ortalama</span>
                <div className={`text-3xl font-mono font-light ${avgOEE >= 85 ? 'text-green' : avgOEE >= 60 ? 'text-amber' : 'text-red'}`}>{avgOEE}%</div>
                <span className={`text-xs px-2 py-0.5 rounded border ${avgOEE >= 85 ? 'text-green border-green/30 bg-green/10' : 'text-zinc-500 border-border'}`}>Hedef ≥85%</span>
              </div>
            </div>

            {/* Grafikler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Haftalık OEE trend */}
              <div className="bg-bg-2 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Haftalık OEE Trendi (son 8 hafta)</h3>
                {haftaOEE.length > 1 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={haftaOEE} margin={{ left: 4, right: 20, top: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="hafta" tick={{ fontSize: 9, fill: '#888' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} unit="%" />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`, 'OEE']} />
                      <ReferenceLine y={85} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: '%85 Hedef', fill: '#22c55e', fontSize: 9, position: 'insideTopRight' }} />
                      <Line type="monotone" dataKey="oee" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3, fill: COLORS[0] }} name="OEE" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="h-56 flex items-center justify-center text-zinc-600 text-xs">Yeterli haftalık veri yok</div>}
              </div>

              {/* İstasyon bazlı OEE */}
              <div className="bg-bg-2 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">İstasyon Bazlı OEE</h3>
                {istOEE.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={istOEE} margin={{ left: 4, right: 20, top: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="ist" tick={{ fontSize: 8, fill: '#888' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} unit="%" />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`, 'OEE']} />
                      <ReferenceLine y={85} stroke="#22c55e" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: '%85', fill: '#22c55e', fontSize: 9, position: 'insideTopRight' }} />
                      <Bar dataKey="oee" radius={[3, 3, 0, 0]} name="OEE">
                        {istOEE.map((d, i) => (
                          <Cell key={i} fill={d.oee >= 85 ? COLORS[3] : d.oee >= 60 ? COLORS[1] : COLORS[2]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-56 flex items-center justify-center text-zinc-600 text-xs">Veri yok</div>}
              </div>
            </div>

            {/* Operasyon detay tablosu */}
            <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-border">
                <h3 className="text-sm font-semibold">Operasyon Detayı</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border text-zinc-500 bg-bg-1/50">
                    <th className="text-left px-4 py-2">Operasyon</th>
                    <th className="text-right px-4 py-2">Kullanılabilirlik</th>
                    <th className="text-right px-4 py-2">Performans</th>
                    <th className="text-right px-4 py-2">Kalite</th>
                    <th className="text-right px-4 py-2 font-semibold">OEE</th>
                  </tr></thead>
                  <tbody>{oeeData.map(d => (
                    <tr key={d.op} className="border-b border-border/30">
                      <td className="px-4 py-1.5 text-zinc-300">{d.op}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-zinc-400">{d.calismaDk > 0 ? `${d.avail}%` : '—'}</td>
                      <td className="px-4 py-1.5 text-right font-mono">{d.perf}%</td>
                      <td className="px-4 py-1.5 text-right font-mono">{d.quality}%</td>
                      <td className={`px-4 py-1.5 text-right font-mono font-semibold ${d.oee >= 85 ? 'text-green' : d.oee >= 60 ? 'text-amber' : 'text-red'}`}>{d.oee}%</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
            <div className="text-[10px] text-zinc-600 px-1">OEE = Kullanılabilirlik × Performans × Kalite | Hedef: ≥85% | K=(Çalışma−Duruş)/Çalışma | P=Üretilen/Hedef | Q=(Üretilen−Fire)/Üretilen | K: operatör süresi girilmemişse 100% | Haftalık trend: WO hedefi o hafta aktif tüm WO'lardan hesaplanır</div>
          </div>
        )
      })()}

      {/* Duruş Analizi */}
      {tab === 'durus' && (() => {
        // Kod bazlı toplam
        const durusMap: Record<string, { ad: string; toplamDk: number; adet: number }> = {}
        logs.forEach(l => l.duruslar?.forEach(d => {
          const key = d.sebep || 'Tanımsız'
          if (!durusMap[key]) durusMap[key] = { ad: key, toplamDk: 0, adet: 0 }
          durusMap[key].toplamDk += (d as unknown as Record<string, unknown>).sure as number || 0
          durusMap[key].adet++
        }))
        const durusData = Object.values(durusMap).sort((a, b) => b.toplamDk - a.toplamDk)
        const toplamDurus = durusData.reduce((a, d) => a + d.toplamDk, 0)
        const toplamAdet = durusData.reduce((a, d) => a + d.adet, 0)

        // Pie chart — top 6 + Diğer
        const pieData = durusData.length <= 7
          ? durusData.map(d => ({ name: d.ad, value: d.toplamDk }))
          : [
              ...durusData.slice(0, 6).map(d => ({ name: d.ad, value: d.toplamDk })),
              { name: 'Diğer', value: durusData.slice(6).reduce((s, d) => s + d.toplamDk, 0) },
            ]

        // İstasyon bazlı duruş
        const istDurusMap: Record<string, number> = {}
        logs.forEach(l => {
          const wo = woMap[l.woId]
          const key = wo?.istAd || wo?.opAd || 'Tanımsız'
          if (Array.isArray(l.duruslar)) {
            l.duruslar.forEach((d: { sure?: number }) => {
              istDurusMap[key] = (istDurusMap[key] || 0) + (d.sure || 0)
            })
          }
        })
        const istDurusData = Object.entries(istDurusMap)
          .map(([ist, toplamDk]) => ({ ist, toplamDk }))
          .filter(d => d.toplamDk > 0)
          .sort((a, b) => b.toplamDk - a.toplamDk)
          .slice(0, 12)

        // Haftalık trend (son 8 hafta)
        const getWeekStart = (dateStr: string): string => {
          const d = new Date(dateStr)
          const day = d.getDay()
          d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
          return d.toISOString().slice(0, 10)
        }
        const haftaMap: Record<string, number> = {}
        logs.forEach(l => {
          if (!l.tarih) return
          const wb = getWeekStart(l.tarih)
          if (Array.isArray(l.duruslar)) {
            l.duruslar.forEach((d: { sure?: number }) => {
              haftaMap[wb] = (haftaMap[wb] || 0) + (d.sure || 0)
            })
          }
        })
        const haftaData = Object.entries(haftaMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-8)
          .map(([wb, toplamDk]) => ({ hafta: wb.slice(5), toplamDk }))

        return (
          <div className="space-y-4">
            {/* KPI */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-light font-mono text-amber">{toplamDurus}</div>
                <div className="text-[11px] text-zinc-500">Toplam Duruş (dk)</div>
              </div>
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-light font-mono">{toplamAdet}</div>
                <div className="text-[11px] text-zinc-500">Toplam Duruş Sayısı</div>
              </div>
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className="text-base font-mono text-zinc-200 truncate">{durusData[0]?.ad || '—'}</div>
                <div className="text-[11px] text-zinc-500">En Sık Neden</div>
              </div>
            </div>

            {durusData.length ? (
              <>
                {/* Pie + Haftalık trend */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Duruş kodu pie chart */}
                  <div className="bg-bg-2 border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3">Duruş Kodu Dağılımı</h3>
                    <div className="flex gap-3 items-center">
                      <ResponsiveContainer width="55%" height={200}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={85} dataKey="value" paddingAngle={2}>
                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} dk`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                        {pieData.map((d, i) => (
                          <div key={d.name} className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <span className="text-[10px] text-zinc-300 truncate flex-1">{d.name}</span>
                            <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">{toplamDurus > 0 ? Math.round(d.value / toplamDurus * 100) : 0}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Haftalık duruş trendi */}
                  <div className="bg-bg-2 border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3">Haftalık Duruş Trendi (son 8 hafta)</h3>
                    {haftaData.length > 1 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={haftaData} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="hafta" tick={{ fontSize: 9, fill: '#888' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} dk`, 'Duruş']} />
                          <Line type="monotone" dataKey="toplamDk" stroke={COLORS[1]} strokeWidth={2} dot={{ r: 3, fill: COLORS[1] }} name="Duruş (dk)" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <div className="h-48 flex items-center justify-center text-zinc-600 text-xs">Yeterli haftalık veri yok</div>}
                  </div>
                </div>

                {/* İstasyon bazlı duruş */}
                <div className="bg-bg-2 border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">İstasyon Bazlı Duruş Süresi</h3>
                  {istDurusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(180, istDurusData.length * 28)}>
                      <BarChart data={istDurusData} layout="vertical" margin={{ left: 4, right: 24, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} unit=" dk" />
                        <YAxis type="category" dataKey="ist" width={90} tick={{ fontSize: 9, fill: '#ccc' }} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} dk`, 'Duruş']} />
                        <Bar dataKey="toplamDk" fill={COLORS[2]} radius={[0, 3, 3, 0]} name="Duruş (dk)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-24 flex items-center justify-center text-zinc-600 text-xs">İstasyon verisi yok</div>}
                </div>

                {/* Detay tablo */}
                <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2 border-b border-border">
                    <h3 className="text-sm font-semibold">Detay ({durusData.length} kod)</h3>
                  </div>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border text-zinc-500 bg-bg-1/50">
                      <th className="text-left px-4 py-2">Duruş Kodu</th>
                      <th className="text-right px-4 py-2">Adet</th>
                      <th className="text-right px-4 py-2">Toplam dk</th>
                      <th className="text-right px-4 py-2">Oran</th>
                    </tr></thead>
                    <tbody>{durusData.map(d => (
                      <tr key={d.ad} className="border-b border-border/30">
                        <td className="px-4 py-1.5 text-zinc-300">{d.ad}</td>
                        <td className="px-4 py-1.5 text-right font-mono">{d.adet}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-amber">{d.toplamDk}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-zinc-500">{toplamDurus > 0 ? Math.round(d.toplamDk / toplamDurus * 100) : 0}%</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            ) : <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-zinc-600">Duruş kaydı yok</div>}
          </div>
        )
      })()}

      {/* Gecikme Raporu */}
      {tab === 'gecikme' && (() => {
        const geciken = orders.filter(o => o.termin && o.termin < todayStr).map(o => {
          const wos = workOrders.filter(w => w.orderId === o.id)
          const totalPct = wos.length ? wos.reduce((s, w) => {
            const prod = uretimByWo.get(w.id) ?? 0
            return s + (w.hedef > 0 ? Math.min(100, prod / w.hedef * 100) : 0)
          }, 0) / wos.length : 0
          const pct = Math.round(totalPct)
          const gun = Math.ceil((new Date().getTime() - new Date(o.termin).getTime()) / 86400000)
          return { ...o, pct, gun, woCount: wos.length }
        }).filter(o => o.pct < 100).sort((a, b) => b.gun - a.gun)

        // Müşteri bazlı özet
        const musteriOzet = Object.values(
          geciken.reduce<Record<string, { musteri: string; siparisSayisi: number; maxGun: number; toplamGun: number }>>((acc, o) => {
            const k = o.musteri || 'Belirsiz'
            if (!acc[k]) acc[k] = { musteri: k, siparisSayisi: 0, maxGun: 0, toplamGun: 0 }
            acc[k].siparisSayisi++
            acc[k].toplamGun += o.gun
            if (o.gun > acc[k].maxGun) acc[k].maxGun = o.gun
            return acc
          }, {})
        ).sort((a, b) => b.siparisSayisi - a.siparisSayisi || b.maxGun - a.maxGun)

        // Gecikme süresi dağılımı
        const dagılım = [
          { label: '1–7 gün', count: geciken.filter(o => o.gun <= 7).length, fill: '#22c55e' },
          { label: '8–30 gün', count: geciken.filter(o => o.gun > 7 && o.gun <= 30).length, fill: '#f59e0b' },
          { label: '30+ gün', count: geciken.filter(o => o.gun > 30).length, fill: '#ef4444' },
        ]

        const exportGecikme = () => {
          import('xlsx').then(XLSX => {
            const wb = XLSX.utils.book_new()
            const sipRows = geciken.map(o => ({
              'Sipariş No': o.siparisNo, 'Müşteri': o.musteri || '',
              'Termin': o.termin, 'Gecikme (gün)': o.gun, 'İlerleme %': o.pct,
            }))
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sipRows), 'Geciken Siparişler')
            const mRows = musteriOzet.map(m => ({
              'Müşteri': m.musteri, 'Geciken Sipariş': m.siparisSayisi,
              'Max Gecikme (gün)': m.maxGun,
              'Ort Gecikme (gün)': Math.round(m.toplamGun / m.siparisSayisi),
            }))
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mRows), 'Müşteri Özeti')
            XLSX.writeFile(wb, `gecikme_raporu_${todayStr}.xlsx`)
            toast.success('Gecikme raporu Excel indirildi')
          })
        }

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-red">Geciken Siparişler ({geciken.length})</h3>
              <span className="flex-1" />
              {geciken.length > 0 && (
                <button onClick={exportGecikme} className="px-3 py-1.5 bg-green/20 border border-green/30 rounded text-xs text-green hover:bg-green/30">📥 Excel</button>
              )}
            </div>
            {geciken.length === 0 ? (
              <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-green">Geciken sipariş yok!</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Gecikme süresi dağılımı */}
                  <div className="bg-bg-2 border border-border rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-zinc-400 mb-3">Gecikme Süresi Dağılımı</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={dagılım} barSize={44}>
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#888' }} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} sipariş`, 'Adet']} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {dagılım.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Müşteri bazlı özet */}
                  <div className="bg-bg-2 border border-border rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-zinc-400 mb-3">Müşteri Bazlı Özet</h4>
                    <div className="overflow-y-auto max-h-[160px]">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border text-zinc-500">
                            <th className="text-left pb-1.5">Müşteri</th>
                            <th className="text-right pb-1.5">Sipariş</th>
                            <th className="text-right pb-1.5">Max Gecikme</th>
                            <th className="text-right pb-1.5">Ort Gecikme</th>
                          </tr>
                        </thead>
                        <tbody>
                          {musteriOzet.map((m, i) => (
                            <tr key={i} className="border-b border-border/20">
                              <td className="py-1 text-zinc-300 pr-2">{m.musteri}</td>
                              <td className="py-1 text-right font-mono text-red">{m.siparisSayisi}</td>
                              <td className="py-1 text-right font-mono text-red">{m.maxGun} gün</td>
                              <td className="py-1 text-right font-mono text-amber">{Math.round(m.toplamGun / m.siparisSayisi)} gün</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Geciken siparişler tablosu */}
                <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-zinc-500">
                        <th className="text-left px-4 py-2">Sipariş No</th>
                        <th className="text-left px-4 py-2">Müşteri</th>
                        <th className="text-left px-4 py-2">Termin</th>
                        <th className="text-right px-4 py-2">Gecikme</th>
                        <th className="text-right px-4 py-2">İlerleme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geciken.map(o => (
                        <tr key={o.id} className="border-b border-border/30">
                          <td className="px-4 py-1.5 font-mono text-accent">{o.siparisNo}</td>
                          <td className="px-4 py-1.5 text-zinc-300">{o.musteri}</td>
                          <td className="px-4 py-1.5 font-mono text-red">{o.termin}</td>
                          <td className="px-4 py-1.5 text-right font-mono text-red font-semibold">{o.gun} gün</td>
                          <td className="px-4 py-1.5 text-right font-mono text-amber">{o.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Operatör Performans */}
      {tab === 'operator' && (() => {
        const oprMap: Record<string, { ad: string; uretim: number; fire: number; logSayisi: number; gunler: Set<string> }> = {}
        logs.forEach(l => {
          if (l.tarih < oprBaslangic || l.tarih > oprBitis) return
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
          ...o,
          gunSayisi: o.gunler.size,
          gunlukOrt: o.gunler.size > 0 ? Math.round(o.uretim / o.gunler.size) : 0,
          fireOran: (o.uretim + o.fire) > 0 ? Math.round(o.fire / (o.uretim + o.fire) * 1000) / 10 : 0,
        })).sort((a, b) => b.uretim - a.uretim)

        // En iyi / en kötü 3 — fire oranına göre, min 5 toplam üretim
        const rankable = oprData.filter(o => (o.uretim + o.fire) >= 5)
        const byFire = [...rankable].sort((a, b) => a.fireOran !== b.fireOran ? a.fireOran - b.fireOran : b.uretim - a.uretim)
        const enIyi3 = new Set(byFire.slice(0, 3).map(o => o.ad))
        const enKotu3 = new Set(byFire.slice(-3).map(o => o.ad))
        const showBadge = rankable.length >= 4

        return (
          <div className="bg-bg-2 border border-border rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold">Operatör Performansı ({oprData.length} operatör)</h3>
              <span className="flex-1" />
              <label className="text-[10px] text-zinc-500">Başlangıç</label>
              <input type="date" value={oprBaslangic} onChange={e => setOprBaslangic(e.target.value)}
                className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300" />
              <label className="text-[10px] text-zinc-500">Bitiş</label>
              <input type="date" value={oprBitis} onChange={e => setOprBitis(e.target.value)}
                className="px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300" />
            </div>
            {oprData.length ? (
              <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={oprData.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis dataKey="ad" type="category" width={100} tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="uretim" fill="#06b6d4" name="Üretim" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="fire" fill="#ef4444" name="Fire" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table className="w-full text-xs mt-3">
                <thead>
                  <tr className="border-b border-border text-zinc-500">
                    <th className="text-left px-4 py-2">Operatör</th>
                    <th className="text-right px-4 py-2">Üretim</th>
                    <th className="text-right px-4 py-2">Fire</th>
                    <th className="text-right px-4 py-2">Fire %</th>
                    <th className="text-right px-4 py-2">Gün</th>
                    <th className="text-right px-4 py-2">Günlük Ort.</th>
                  </tr>
                </thead>
                <tbody>
                  {oprData.map(o => {
                    const isEnIyi = showBadge && enIyi3.has(o.ad) && !enKotu3.has(o.ad)
                    const isEnKotu = showBadge && enKotu3.has(o.ad) && !enIyi3.has(o.ad)
                    return (
                      <tr key={o.ad} className={`border-b border-border/30 ${isEnIyi ? 'bg-green/5' : isEnKotu ? 'bg-red/5' : ''}`}>
                        <td className="px-4 py-1.5 text-zinc-300">
                          {o.ad}
                          {isEnIyi && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-green/20 text-green border border-green/30 font-semibold">En İyi</span>}
                          {isEnKotu && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-red/20 text-red border border-red/30 font-semibold">En Kötü</span>}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-green">{o.uretim}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-red">{o.fire}</td>
                        <td className="px-4 py-1.5 text-right font-mono">
                          <span className={o.fireOran >= 5 ? 'text-red font-semibold' : o.fireOran >= 2 ? 'text-amber' : 'text-green'}>
                            {o.fireOran.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono">{o.gunSayisi}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-accent">{o.gunlukOrt}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </>
            ) : <div className="p-8 text-center text-zinc-600">Seçilen dönemde veri yok</div>}
          </div>
        )
      })()}

      {/* Malzeme Tüketim */}
      {tab === 'maltuket' && (() => {
        const tuketimMap: Record<string, { malkod: string; malad: string; uretimQty: number; stokMiktar: number }> = {}
        logs.forEach(l => {
          if (!l.malkod) return
          if (!tuketimMap[l.malkod]) tuketimMap[l.malkod] = { malkod: l.malkod, malad: '', uretimQty: 0, stokMiktar: 0 }
          tuketimMap[l.malkod].uretimQty += l.qty
        })
        const uretimCikislar = stokHareketler.filter(h => h.tip === 'cikis' && h.logId)
        uretimCikislar.forEach(h => {
          if (!tuketimMap[h.malkod]) tuketimMap[h.malkod] = { malkod: h.malkod, malad: h.malad, uretimQty: 0, stokMiktar: 0 }
          tuketimMap[h.malkod].malad = h.malad
          tuketimMap[h.malkod].stokMiktar += h.miktar
        })
        const data = Object.values(tuketimMap).sort((a, b) => (b.stokMiktar || b.uretimQty) - (a.stokMiktar || a.uretimQty))
        const toplamCikis = data.reduce((a, d) => a + d.stokMiktar, 0)

        // Top 10 yatay bar chart için
        const top10 = data.slice(0, 10).map(d => ({
          malkod: d.malkod,
          miktar: Math.round(d.stokMiktar || d.uretimQty),
        }))

        // Ay bazlı trend (son 12 ay, üretim tüketimi — cikis+logId)
        const ayMap: Record<string, number> = {}
        uretimCikislar.forEach(h => {
          const ay = typeof h.tarih === 'string' ? h.tarih.slice(0, 7) : ''
          if (!ay) return
          ayMap[ay] = (ayMap[ay] || 0) + h.miktar
        })
        const ayTrend = Object.entries(ayMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-12)
          .map(([ay, miktar]) => ({ ay, miktar: Math.round(miktar) }))

        return (
          <div className="space-y-4">
            {/* KPI */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-light font-mono text-accent">{data.length}</div>
                <div className="text-[11px] text-zinc-500">Toplam Malzeme</div>
              </div>
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-light font-mono text-amber">{Math.round(toplamCikis).toLocaleString('tr')}</div>
                <div className="text-[11px] text-zinc-500">Toplam Stok Çıkış</div>
              </div>
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className="text-base font-mono text-zinc-200 truncate">{data[0]?.malkod || '—'}</div>
                <div className="text-[10px] text-zinc-500 truncate">{data[0]?.malad || 'En Çok Tüketilen'}</div>
                <div className="text-[11px] text-zinc-500">En Çok Tüketilen</div>
              </div>
            </div>

            {/* Grafikler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top 10 yatay bar chart */}
              <div className="bg-bg-2 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Top 10 — Malkod Bazlı Tüketim</h3>
                {top10.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={top10} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                      <YAxis type="category" dataKey="malkod" width={84} tick={{ fontSize: 9, fill: '#ccc' }} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v.toLocaleString('tr'), 'Miktar']} />
                      <Bar dataKey="miktar" fill={COLORS[1]} radius={[0, 3, 3, 0]} name="Stok Çıkış" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-64 flex items-center justify-center text-zinc-600 text-xs">Stok çıkış verisi yok</div>}
              </div>

              {/* Ay bazlı trend */}
              <div className="bg-bg-2 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Ay Bazlı Tüketim Trendi (son 12 ay)</h3>
                {ayTrend.length > 1 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={ayTrend} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="ay" tick={{ fontSize: 9, fill: '#888' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v.toLocaleString('tr'), 'Toplam Çıkış']} />
                      <Line type="monotone" dataKey="miktar" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3, fill: COLORS[0] }} name="Toplam Çıkış" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="h-64 flex items-center justify-center text-zinc-600 text-xs">Yeterli veri yok</div>}
              </div>
            </div>

            {/* Detay tablo */}
            <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                <h3 className="text-sm font-semibold">Detay ({data.length} malzeme)</h3>
              </div>
              {data.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border text-zinc-500 bg-bg-1/50">
                      <th className="text-left px-4 py-2 w-8">#</th>
                      <th className="text-left px-4 py-2">Malzeme Kodu</th>
                      <th className="text-left px-4 py-2">Malzeme Adı</th>
                      <th className="text-right px-4 py-2">Üretim (adet)</th>
                      <th className="text-right px-4 py-2">Stok Çıkış</th>
                    </tr></thead>
                    <tbody>{data.slice(0, 50).map((d, i) => (
                      <tr key={d.malkod} className="border-b border-border/30">
                        <td className="px-4 py-1.5 text-zinc-600 font-mono">{i + 1}</td>
                        <td className="px-4 py-1.5 font-mono text-accent">{d.malkod}</td>
                        <td className="px-4 py-1.5 text-zinc-300">{d.malad}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-zinc-400">{d.uretimQty > 0 ? d.uretimQty : '—'}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-amber">{d.stokMiktar > 0 ? Math.round(d.stokMiktar) : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <div className="p-8 text-center text-zinc-600">Veri yok</div>}
            </div>
          </div>
        )
      })()}

      {/* Trend */}
      {tab === 'trend' && (() => {
        // Günlük (son 30 gün)
        const gunMap: Record<string, { gun: string; uretim: number; fire: number }> = {}
        logs.forEach(l => {
          if (!l.tarih) return
          if (!gunMap[l.tarih]) gunMap[l.tarih] = { gun: l.tarih, uretim: 0, fire: 0 }
          gunMap[l.tarih].uretim += l.qty
          gunMap[l.tarih].fire += l.fire || 0
        })
        const gunData = Object.values(gunMap).sort((a, b) => a.gun.localeCompare(b.gun)).slice(-30)

        // Aylık toplam üretim (son 12 ay)
        const ayUretimMap: Record<string, number> = {}
        logs.forEach(l => {
          const ay = l.tarih?.slice(0, 7)
          if (!ay) return
          ayUretimMap[ay] = (ayUretimMap[ay] || 0) + l.qty
        })
        const aylar = Object.keys(ayUretimMap).sort().slice(-12)
        const aylarSet = new Set(aylar)

        // Ürün bazlı aylık — top 10 mamul + Diğer
        const mamulTotalMap: Record<string, number> = {}
        logs.forEach(l => {
          const wo = woMap[l.woId]
          const kod = wo?.mamulKod || wo?.malkod || 'Tanımsız'
          mamulTotalMap[kod] = (mamulTotalMap[kod] || 0) + l.qty
        })
        const top10Mamul = Object.entries(mamulTotalMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([k]) => k)
        const top10Set = new Set(top10Mamul)

        // Aylık × mamul agregasyonu (O(n))
        const mamulAyAgg: Record<string, Record<string, number>> = {}
        logs.forEach(l => {
          const ay = l.tarih?.slice(0, 7)
          if (!ay || !aylarSet.has(ay)) return
          const wo = woMap[l.woId]
          const kod = wo?.mamulKod || wo?.malkod || 'Tanımsız'
          if (!mamulAyAgg[ay]) mamulAyAgg[ay] = {}
          const target = top10Set.has(kod) ? kod : '__diger__'
          mamulAyAgg[ay][target] = (mamulAyAgg[ay][target] || 0) + l.qty
        })
        const mamulAylar: Array<Record<string, string | number>> = aylar.map(ay => {
          const row: Record<string, string | number> = { ay }
          const src = mamulAyAgg[ay] || {}
          top10Mamul.forEach(k => { row[k] = src[k] || 0 })
          if (src['__diger__']) row['Diğer'] = src['__diger__']
          return row
        })
        const hasDiger = mamulAylar.some(r => (r['Diğer'] as number || 0) > 0)

        // Sipariş termin vs gerçekleşen
        const ayPlanlananMap: Record<string, number> = {}
        workOrders.forEach(w => {
          const order = w.orderId ? orderMap[w.orderId] : null
          const ay = order?.termin?.slice(0, 7)
          if (!ay) return
          ayPlanlananMap[ay] = (ayPlanlananMap[ay] || 0) + (w.hedef || 0)
        })
        const siparisVsData = aylar.map(ay => ({
          ay,
          planlanan: ayPlanlananMap[ay] || 0,
          gerceklesen: ayUretimMap[ay] || 0,
        }))

        // Ay-ay büyüme oranı
        const buyumeData = aylar
          .map((ay, i) => {
            if (i === 0) return null
            const prev = ayUretimMap[aylar[i - 1]] || 0
            const curr = ayUretimMap[ay] || 0
            if (prev === 0) return null
            return { ay, oran: Math.round((curr - prev) / prev * 100) }
          })
          .filter((d): d is { ay: string; oran: number } => d !== null)

        const ortAylik = aylar.length > 0
          ? Math.round(aylar.reduce((s, ay) => s + (ayUretimMap[ay] || 0), 0) / aylar.length)
          : 0

        return (
          <div className="space-y-4">
            {/* Günlük trend */}
            <div className="bg-bg-2 border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Günlük Üretim Trendi (son 30 gün)</h3>
              {gunData.length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={gunData} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="gun" tick={{ fontSize: 9, fill: '#888' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="uretim" stroke={COLORS[0]} strokeWidth={2} name="Üretim" dot={false} />
                    <Line type="monotone" dataKey="fire" stroke={COLORS[2]} strokeWidth={1} name="Fire" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-48 flex items-center justify-center text-zinc-600 text-xs">Yeterli veri yok</div>}
            </div>

            {/* Ürün bazlı aylık stacked bar */}
            <div className="bg-bg-2 border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Ürün Bazlı Aylık Üretim — Top {top10Mamul.length} Mamul (son 12 ay)</h3>
              {mamulAylar.length > 0 && top10Mamul.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={mamulAylar} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="ay" tick={{ fontSize: 9, fill: '#888' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                      {top10Mamul.map((kod, i) => (
                        <Bar key={kod} dataKey={kod} stackId="a" fill={COLORS[i % COLORS.length]} name={kod} />
                      ))}
                      {hasDiger && <Bar dataKey="Diğer" stackId="a" fill="#52525b" name="Diğer" />}
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                    {top10Mamul.map((kod, i) => (
                      <div key={kod} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-[10px] text-zinc-400 truncate max-w-[110px]" title={kod}>{kod}</span>
                      </div>
                    ))}
                    {hasDiger && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 bg-zinc-600" />
                        <span className="text-[10px] text-zinc-400">Diğer</span>
                      </div>
                    )}
                  </div>
                </>
              ) : <div className="h-56 flex items-center justify-center text-zinc-600 text-xs">Ürün verisi yok</div>}
            </div>

            {/* Sipariş vs gerçekleşen + Büyüme oranı */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-bg-2 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">Sipariş vs Teslim — Aylık Planlanan / Gerçekleşen</h3>
                {siparisVsData.some(d => d.planlanan > 0 || d.gerceklesen > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={siparisVsData} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="ay" tick={{ fontSize: 9, fill: '#888' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} />
                        <Line type="monotone" dataKey="planlanan" stroke={COLORS[1]} strokeWidth={2} strokeDasharray="5 3" name="Planlanan (Hedef)" dot={{ r: 3, fill: COLORS[1] }} />
                        <Line type="monotone" dataKey="gerceklesen" stroke={COLORS[3]} strokeWidth={2} name="Gerçekleşen" dot={{ r: 3, fill: COLORS[3] }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={COLORS[1]} strokeWidth="2" strokeDasharray="5 3" /></svg>
                        <span className="text-[10px] text-zinc-400">Planlanan</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={COLORS[3]} strokeWidth="2" /></svg>
                        <span className="text-[10px] text-zinc-400">Gerçekleşen</span>
                      </div>
                    </div>
                  </>
                ) : <div className="h-56 flex items-center justify-center text-zinc-600 text-xs">Termin tarihi girilmiş sipariş yok</div>}
              </div>

              <div className="bg-bg-2 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Ay-ay Büyüme Oranı</h3>
                  <span className="text-[11px] text-zinc-500">Ort. {ortAylik.toLocaleString('tr')} adet/ay</span>
                </div>
                {buyumeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={buyumeData} margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="ay" tick={{ fontSize: 9, fill: '#888' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#888' }} unit="%" />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v > 0 ? '+' : ''}${v}%`, 'Büyüme']} />
                      <ReferenceLine y={0} stroke="#555" strokeWidth={1} />
                      <Bar dataKey="oran" radius={[3, 3, 0, 0]} name="Büyüme %">
                        {buyumeData.map((d, i) => (
                          <Cell key={i} fill={d.oran >= 0 ? COLORS[3] : COLORS[2]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-52 flex items-center justify-center text-zinc-600 text-xs">En az 2 aylık veri gerekli</div>}
              </div>
            </div>
          </div>
        )
      })()}

      {/* İstasyon Performans */}
      {tab === 'istperf' && (() => {
        // İstasyon veri toplama
        type IstBucket = { ad: string; uretim: number; woCount: number; hedef: number; calismaDk: number; durusDk: number; opAds: Set<string> }
        const istMap: Record<string, IstBucket> = {}
        workOrders.forEach(w => {
          const key = w.istAd || w.opAd || 'Tanımsız'
          if (!istMap[key]) istMap[key] = { ad: key, uretim: 0, woCount: 0, hedef: 0, calismaDk: 0, durusDk: 0, opAds: new Set() }
          istMap[key].uretim += uretimByWo.get(w.id) ?? 0
          istMap[key].woCount++
          istMap[key].hedef += w.hedef || 0
          if (w.opAd) istMap[key].opAds.add(w.opAd)
        })
        logs.forEach(l => {
          const wo = woMap[l.woId]
          const key = wo?.istAd || wo?.opAd || 'Tanımsız'
          if (!istMap[key]) return
          ;(Array.isArray(l.operatorlar) ? l.operatorlar : []).forEach((o: { bas?: string; bit?: string }) => {
            if (o.bas && o.bit && o.bit >= o.bas) {
              const b = parseInt(o.bas.split(':')[0]) * 60 + parseInt(o.bas.split(':')[1] || '0')
              const e = parseInt(o.bit.split(':')[0]) * 60 + parseInt(o.bit.split(':')[1] || '0')
              istMap[key].calismaDk += Math.max(0, e - b)
            }
          })
          if (Array.isArray(l.duruslar)) {
            l.duruslar.forEach((d: { sure?: number }) => { istMap[key].durusDk += d.sure || 0 })
          }
        })

        // opAd → fire toplam (O(n) önbellek)
        const opAdFireMap: Record<string, number> = {}
        parcaFireLogs.forEach(f => { const k = f.opAd || ''; opAdFireMap[k] = (opAdFireMap[k] || 0) + f.qty })

        const data = Object.values(istMap).map(d => {
          const durusCapped = Math.min(d.durusDk, d.calismaDk)
          const avail = d.calismaDk > 0 ? Math.max(0, Math.round((d.calismaDk - durusCapped) / d.calismaDk * 100)) : 100
          const perf = d.hedef > 0 ? Math.min(100, Math.round(d.uretim / d.hedef * 100)) : 0
          const fire = [...d.opAds].reduce((a, op) => a + (opAdFireMap[op] || 0), 0)
          const quality = d.uretim > 0 ? Math.max(0, Math.round((d.uretim - fire) / d.uretim * 100)) : 100
          const oee = Math.round(avail * perf * quality / 10000)
          const fireOran = (d.uretim + fire) > 0 ? Math.round(fire / (d.uretim + fire) * 1000) / 10 : 0
          return { ad: d.ad, woCount: d.woCount, uretim: d.uretim, hedef: d.hedef, calismaDk: d.calismaDk, avail, perf, quality, oee, fire, fireOran }
        }).sort((a, b) => b.uretim - a.uretim)

        const istListesi = data.map(d => d.ad)
        const aktifIst = selectedIst || istListesi[0] || ''

        // Haftalık trend — seçili istasyon (son 8 hafta)
        const getWeekStart = (dateStr: string): string => {
          const d = new Date(dateStr)
          const day = d.getDay()
          d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
          return d.toISOString().slice(0, 10)
        }
        const haftaMap: Record<string, { uretim: number; fire: number }> = {}
        logs.forEach(l => {
          if (!l.tarih) return
          const wo = woMap[l.woId]
          if ((wo?.istAd || wo?.opAd || 'Tanımsız') !== aktifIst) return
          const wb = getWeekStart(l.tarih)
          if (!haftaMap[wb]) haftaMap[wb] = { uretim: 0, fire: 0 }
          haftaMap[wb].uretim += l.qty
          haftaMap[wb].fire += l.fire || 0
        })
        const haftaData = Object.entries(haftaMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-8)
          .map(([wb, v]) => ({
            hafta: wb.slice(5),
            uretim: v.uretim,
            fire: v.fire,
            kalite: (v.uretim + v.fire) > 0 ? Math.round(v.uretim / (v.uretim + v.fire) * 100) : 100,
          }))

        const oeeBarData = [...data].filter(d => d.oee > 0).sort((a, b) => b.oee - a.oee).slice(0, 12)
        const fireBarData = [...data].filter(d => d.uretim + d.fire > 0).sort((a, b) => b.fireOran - a.fireOran).slice(0, 12)
        const topOee = oeeBarData[0]

        return data.length ? (
          <div className="space-y-4">
            {/* KPI */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-light font-mono text-accent">{data.length}</div>
                <div className="text-[11px] text-zinc-500">Aktif İstasyon</div>
              </div>
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-light font-mono text-green">{data.reduce((a, d) => a + d.uretim, 0)}</div>
                <div className="text-[11px] text-zinc-500">Toplam Üretim</div>
              </div>
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className={`text-2xl font-light font-mono ${(topOee?.oee ?? 0) >= 85 ? 'text-green' : 'text-amber'}`}>{topOee?.oee ?? '—'}%</div>
                <div className="text-[11px] text-zinc-500 truncate">En Yüksek OEE — {topOee?.ad ?? ''}</div>
              </div>
            </div>

            {/* OEE + Fire grafikleri */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-bg-2 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">İstasyon OEE Karşılaştırması</h3>
                {oeeBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={oeeBarData.slice(0, 8)} margin={{ left: 4, right: 8, top: 8, bottom: 4 }} barCategoryGap="25%" barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="ad" tick={{ fontSize: 8, fill: '#888' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} unit="%" />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number, name: string) => [`${v}%`, name]} />
                      <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                      <ReferenceLine y={85} stroke="#22c55e" strokeDasharray="5 3" strokeWidth={1} />
                      <Bar dataKey="avail" name="Kullanılabilirlik" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="perf" name="Performans" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="quality" name="Kalite" fill="#22c55e" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="oee" name="OEE" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-60 flex items-center justify-center text-zinc-600 text-xs">Veri yok</div>}
              </div>

              <div className="bg-bg-2 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">İstasyon Fire Oranı</h3>
                {fireBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={fireBarData} margin={{ left: 4, right: 20, top: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="ad" tick={{ fontSize: 8, fill: '#888' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#888' }} unit="%" />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`, 'Fire Oranı']} />
                      <Bar dataKey="fireOran" radius={[3, 3, 0, 0]} name="Fire %">
                        {fireBarData.map((d, i) => <Cell key={i} fill={d.fireOran <= 2 ? COLORS[3] : d.fireOran <= 5 ? COLORS[1] : COLORS[2]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-60 flex items-center justify-center text-zinc-600 text-xs">Fire verisi yok</div>}
              </div>
            </div>

            {/* Haftalık trend — seçili istasyon */}
            <div className="bg-bg-2 border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold">Haftalık Üretim Trendi</h3>
                <select
                  value={aktifIst}
                  onChange={e => setSelectedIst(e.target.value)}
                  className="ml-auto px-2.5 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-300"
                >
                  {istListesi.map(ist => <option key={ist} value={ist}>{ist}</option>)}
                </select>
              </div>
              {haftaData.length > 1 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={haftaData} margin={{ left: 4, right: 40, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="hafta" tick={{ fontSize: 9, fill: '#888' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} unit="%" />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 12 }} formatter={(v: number, name: string) => [name === 'Kalite %' ? `${v}%` : v, name]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Line yAxisId="left" type="monotone" dataKey="uretim" stroke={COLORS[3]} strokeWidth={2} dot={{ r: 3, fill: COLORS[3] }} name="Üretim" />
                    <Line yAxisId="left" type="monotone" dataKey="fire" stroke={COLORS[2]} strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2, fill: COLORS[2] }} name="Fire" />
                    <Line yAxisId="right" type="monotone" dataKey="kalite" stroke={COLORS[0]} strokeWidth={1.5} strokeDasharray="2 4" dot={{ r: 2, fill: COLORS[0] }} name="Kalite %" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-52 flex items-center justify-center text-zinc-600 text-xs">
                  {aktifIst ? `"${aktifIst}" için yeterli haftalık veri yok` : 'İstasyon seçin'}
                </div>
              )}
            </div>

            {/* Karşılaştırma tablosu */}
            <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-border">
                <h3 className="text-sm font-semibold">İstasyon Detayı — satıra tıklayarak trend seç</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border text-zinc-500 bg-bg-1/50">
                    <th className="text-left px-4 py-2">İstasyon</th>
                    <th className="text-right px-4 py-2">İE</th>
                    <th className="text-right px-4 py-2">Üretim</th>
                    <th className="text-right px-4 py-2">Fire</th>
                    <th className="text-right px-4 py-2">Fire %</th>
                    <th className="text-right px-4 py-2">Kullan.</th>
                    <th className="text-right px-4 py-2">Perf.</th>
                    <th className="text-right px-4 py-2">Kalite</th>
                    <th className="text-right px-4 py-2 font-semibold">OEE</th>
                  </tr></thead>
                  <tbody>{data.map(d => (
                    <tr
                      key={d.ad}
                      onClick={() => setSelectedIst(d.ad)}
                      className={`border-b border-border/30 cursor-pointer hover:bg-bg-1/40 transition-colors ${d.ad === aktifIst ? 'bg-accent/5 border-l-2 border-l-accent' : ''}`}
                    >
                      <td className="px-4 py-1.5 text-zinc-300">{d.ad}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-zinc-500">{d.woCount}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-green">{d.uretim}</td>
                      <td className="px-4 py-1.5 text-right font-mono text-red">{d.fire > 0 ? d.fire : '—'}</td>
                      <td className={`px-4 py-1.5 text-right font-mono ${d.fireOran > 5 ? 'text-red' : d.fireOran > 2 ? 'text-amber' : 'text-zinc-500'}`}>
                        {d.uretim + d.fire > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-10 h-1 bg-bg-3 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${d.fireOran > 5 ? 'bg-red' : d.fireOran > 2 ? 'bg-amber' : 'bg-green'}`} style={{ width: `${Math.min(100, d.fireOran * 10)}%` }} />
                            </div>
                            {d.fireOran}%
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-1.5 text-right font-mono text-zinc-400">{d.calismaDk > 0 ? `${d.avail}%` : '—'}</td>
                      <td className="px-4 py-1.5 text-right font-mono">{d.perf > 0 ? `${d.perf}%` : '—'}</td>
                      <td className="px-4 py-1.5 text-right font-mono">{d.quality}%</td>
                      <td className={`px-4 py-1.5 text-right font-mono font-semibold ${d.oee >= 85 ? 'text-green' : d.oee >= 60 ? 'text-amber' : 'text-red'}`}>
                        {d.oee > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${d.oee >= 85 ? 'bg-green' : d.oee >= 60 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${d.oee}%` }} />
                            </div>
                            {d.oee}%
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        ) : <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-zinc-600">Veri yok</div>
      })()}

      {/* Stok Durumu */}
      {tab === 'stokdurum' && (() => {
        const kritikSayisi = stokData.filter(r => r.sifir || r.eksik).length
        const sifirSayisi = stokData.filter(r => r.sifir).length
        const gosterilen = stokKritikOnly ? stokData.filter(r => r.sifir || r.eksik) : stokData
        return (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-bg-2 border border-border rounded-lg p-4 text-center">
                <div className="text-2xl font-light font-mono">{stokData.length}</div>
                <div className="text-[11px] text-zinc-500">Toplam Malzeme</div>
              </div>
              <div className={`bg-bg-2 border rounded-lg p-4 text-center ${kritikSayisi > 0 ? 'border-red/40' : 'border-border'}`}>
                <div className={`text-2xl font-light font-mono ${kritikSayisi > 0 ? 'text-red' : 'text-zinc-500'}`}>{kritikSayisi}</div>
                <div className="text-[11px] text-zinc-500">Kritik (Eksik / Sıfır)</div>
              </div>
              <div className={`bg-bg-2 border rounded-lg p-4 text-center ${sifirSayisi > 0 ? 'border-amber/40' : 'border-border'}`}>
                <div className={`text-2xl font-light font-mono ${sifirSayisi > 0 ? 'text-amber' : 'text-zinc-500'}`}>{sifirSayisi}</div>
                <div className="text-[11px] text-zinc-500">Sıfır / Negatif Stok</div>
              </div>
            </div>
            <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
                <h3 className="text-sm font-semibold">Malzeme Stok Durumu</h3>
                <span className="flex-1" />
                <button
                  onClick={() => setStokKritikOnly(v => !v)}
                  className={`px-2.5 py-1 rounded text-xs border transition-colors ${stokKritikOnly ? 'bg-red/20 border-red/40 text-red' : 'bg-bg-1 border-border text-zinc-400 hover:text-white'}`}
                >
                  {stokKritikOnly ? '⚠ Sadece Kritik' : 'Tümü'}
                </button>
                <span className="text-[11px] text-zinc-500">{gosterilen.length} malzeme</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-zinc-500 bg-bg-1/50">
                      <th className="text-left px-3 py-2">Malzeme Kodu</th>
                      <th className="text-left px-3 py-2">Malzeme Adı</th>
                      <th className="text-center px-3 py-2">Birim</th>
                      <th className="text-right px-3 py-2">Net Stok</th>
                      <th className="text-right px-3 py-2">Min Stok</th>
                      <th className="text-center px-3 py-2">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gosterilen.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-600">
                        {stokKritikOnly ? 'Min. stok altı malzeme yok' : 'Veri yok'}
                      </td></tr>
                    )}
                    {gosterilen.map(r => (
                      <tr key={r.kod} className={`border-b border-border/20 ${r.sifir ? 'bg-red/5' : r.eksik ? 'bg-amber/5' : ''}`}>
                        <td className="px-3 py-1.5 font-mono text-accent">{r.kod}</td>
                        <td className="px-3 py-1.5 text-zinc-300">{r.malad}</td>
                        <td className="px-3 py-1.5 text-center text-zinc-500">{r.birim || '—'}</td>
                        <td className={`px-3 py-1.5 text-right font-mono font-semibold ${r.sifir ? 'text-red' : r.eksik ? 'text-amber' : 'text-green'}`}>
                          {r.netStok}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-zinc-500">
                          {r.minStok > 0 ? r.minStok : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {r.sifir ? (
                            <span className="px-1.5 py-0.5 bg-red/20 text-red rounded text-[10px] font-semibold">STOK YOK</span>
                          ) : r.eksik ? (
                            <span className="px-1.5 py-0.5 bg-amber/20 text-amber rounded text-[10px] font-semibold">EKSİK</span>
                          ) : r.minStok > 0 ? (
                            <span className="px-1.5 py-0.5 bg-green/10 text-green rounded text-[10px]">OK</span>
                          ) : (
                            <span className="text-zinc-600 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Operatör Saat Analizi */}
      {tab === 'oprsaat' && (() => {
        type GunVeri = { tarih: string; dk: number; uretim: number }
        type OprVeri = { ad: string; gunler: Record<string, GunVeri>; toplamDk: number; uretim: number; fazlaGun: number }
        const oprMap: Record<string, OprVeri> = {}

        const filtredLogs = logs.filter(l => l.tarih >= osBaslangic && l.tarih <= osBitis)
        filtredLogs.forEach(l => {
          l.operatorlar?.forEach((o: { id?: string; ad?: string; bas?: string; bit?: string }) => {
            const key = o.ad || 'Tanımsız'
            if (!oprMap[key]) oprMap[key] = { ad: key, gunler: {}, toplamDk: 0, uretim: 0, fazlaGun: 0 }
            if (!oprMap[key].gunler[l.tarih]) oprMap[key].gunler[l.tarih] = { tarih: l.tarih, dk: 0, uretim: 0 }
            oprMap[key].gunler[l.tarih].uretim += l.qty
            if (o.bas && o.bit && o.bit >= o.bas) {
              const b = parseInt(o.bas.split(':')[0]) * 60 + parseInt(o.bas.split(':')[1] || '0')
              const e = parseInt(o.bit.split(':')[0]) * 60 + parseInt(o.bit.split(':')[1] || '0')
              const dk = Math.max(0, e - b)
              oprMap[key].gunler[l.tarih].dk += dk
              oprMap[key].toplamDk += dk
            }
          })
        })
        Object.values(oprMap).forEach(opr => {
          opr.fazlaGun = Object.values(opr.gunler).filter(g => g.dk > 480).length
          opr.uretim = Object.values(opr.gunler).reduce((a, g) => a + g.uretim, 0)
        })

        const data = Object.values(oprMap).sort((a, b) => b.toplamDk - a.toplamDk)
        const ozet = data.map(o => ({
          ad: o.ad.length > 12 ? o.ad.slice(0, 11) + '…' : o.ad,
          adTam: o.ad,
          saat: Math.round(o.toplamDk / 60 * 10) / 10,
          fazlaGun: o.fazlaGun,
        }))

        const secilenOpr = osSecili ? oprMap[osSecili] : null
        const drillData = secilenOpr
          ? Object.values(secilenOpr.gunler)
              .sort((a, b) => a.tarih.localeCompare(b.tarih))
              .map(g => ({
                gun: g.tarih.slice(5).replace('-', '/'),
                saat: Math.round(g.dk / 60 * 10) / 10,
                uretim: g.uretim,
                fazla: g.dk > 480,
              }))
          : []

        const osFmtSaat = (dk: number) => Math.floor(dk / 60) + 's ' + (dk % 60) + 'dk'

        // Haftalık chart — haftanın Pazartesi'ni key olarak kullan
        const weekMonday = (ds: string) => {
          const d = new Date(ds); const day = d.getDay() || 7
          d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10)
        }
        const top5Opr = data.slice(0, 5)
        const haftaDkMap: Record<string, Record<string, number>> = {}
        data.forEach(opr => {
          haftaDkMap[opr.ad] = {}
          Object.values(opr.gunler).forEach(g => {
            const hw = weekMonday(g.tarih)
            haftaDkMap[opr.ad][hw] = (haftaDkMap[opr.ad][hw] || 0) + g.dk
          })
        })
        const allWeeks = [...new Set(top5Opr.flatMap(o => Object.keys(haftaDkMap[o.ad] || {})))].sort().slice(-8)
        const haftalikData = allWeeks.map(hw => {
          const row: Record<string, string | number> = { hafta: hw.slice(5).replace('-', '.') }
          top5Opr.forEach(o => { row[o.ad] = Math.round((haftaDkMap[o.ad]?.[hw] || 0) / 60 * 10) / 10 })
          return row
        })

        return (
          <div className="space-y-4">
            {/* Filtre */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Başlangıç</label>
                <input type="date" value={osBaslangic} onChange={e => setOsBaslangic(e.target.value)}
                  className="px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-300" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Bitiş</label>
                <input type="date" value={osBitis} onChange={e => setOsBitis(e.target.value)}
                  className="px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-300" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Drill-down Operatör</label>
                <select value={osSecili} onChange={e => setOsSecili(e.target.value)}
                  className="px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-300 min-w-[160px]">
                  <option value="">— Seç —</option>
                  {data.map(o => <option key={o.ad} value={o.ad}>{o.ad}</option>)}
                </select>
              </div>
              {osSecili && (
                <button onClick={() => setOsSecili('')} className="text-[10px] text-zinc-500 hover:text-white px-2 py-1.5">✕ Temizle</button>
              )}
            </div>

            {data.length === 0 && (
              <div className="p-8 text-center text-zinc-600 bg-bg-2 border border-border rounded-lg">
                Seçili aralıkta operatör saat verisi yok — üretim girişinde başlama/bitiş saati girilmeli
              </div>
            )}

            {data.length > 0 && (
              <>
                {/* Özet bar chart */}
                <div className="bg-bg-2 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Operatör Bazlı Toplam Çalışma Saati</h3>
                    <span className="text-[10px] text-zinc-500">Turuncu = fazla mesai günü var</span>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={ozet} margin={{ top: 4, right: 12, left: 0, bottom: 40 }}>
                      <XAxis dataKey="ad" tick={{ fontSize: 10, fill: '#a1a1aa' }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} unit="s" />
                      <Tooltip
                        formatter={(v: number, _: string, p: any) => [`${v}s`, p.payload.adTam]}
                        contentStyle={{ background: '#1c1c24', border: '1px solid #3f3f46', fontSize: 11 }}
                      />
                      <Bar dataKey="saat" radius={[3, 3, 0, 0]} maxBarSize={48} onClick={(d: any) => setOsSecili(d.adTam)}>
                        {ozet.map((entry, i) => (
                          <Cell key={i} fill={entry.fazlaGun > 0 ? '#f59e0b' : '#06b6d4'} cursor="pointer" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Haftalık çalışma saati — top 5 operatör, son 8 hafta */}
                {haftalikData.length > 0 && (
                  <div className="bg-bg-2 border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3">
                      Haftalık Çalışma Saati — Top {top5Opr.length} Operatör (son 8 hafta, saat)
                    </h3>
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={haftalikData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                        <XAxis dataKey="hafta" tick={{ fontSize: 9, fill: '#a1a1aa' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} unit="s" />
                        <Tooltip
                          contentStyle={{ background: '#1c1c24', border: '1px solid #3f3f46', fontSize: 11 }}
                          formatter={(v: number, name: string) => [`${v}s`, name]}
                        />
                        {top5Opr.map((o, i) => (
                          <Bar key={o.ad} dataKey={o.ad} stackId="a" fill={COLORS[i % COLORS.length]} name={o.ad} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {top5Opr.map((o, i) => (
                        <div key={o.ad} className="flex items-center gap-1.5 cursor-pointer" onClick={() => setOsSecili(o.ad)}>
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors">{o.ad}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Özet tablo */}
                <div className="bg-bg-2 border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Operatör Özeti ({data.length} kişi)</h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-zinc-500">
                        <th className="text-left px-3 py-2">Operatör</th>
                        <th className="text-right px-3 py-2">Toplam Süre</th>
                        <th className="text-right px-3 py-2">Üretim</th>
                        <th className="text-right px-3 py-2">Çalışma Günü</th>
                        <th className="text-right px-3 py-2">Fazla Mesai Günü</th>
                        <th className="text-right px-3 py-2">Ort. Adet/Saat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map(o => {
                        const gunSayisi = Object.keys(o.gunler).length
                        const adetSaat = o.toplamDk > 0 ? Math.round(o.uretim / (o.toplamDk / 60) * 10) / 10 : 0
                        return (
                          <tr key={o.ad}
                            onClick={() => setOsSecili(osSecili === o.ad ? '' : o.ad)}
                            className={`border-b border-border/30 cursor-pointer transition-colors ${osSecili === o.ad ? 'bg-accent/10' : 'hover:bg-bg-3'}`}>
                            <td className="px-3 py-1.5 text-zinc-300 font-medium">{o.ad}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-accent">{osFmtSaat(o.toplamDk)}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-green-400">{o.uretim}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{gunSayisi}</td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {o.fazlaGun > 0
                                ? <span className="text-red-400 font-semibold">{o.fazlaGun} gün ⚠</span>
                                : <span className="text-zinc-600">—</span>}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-amber-400">{adetSaat}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Drill-down */}
                {secilenOpr && (
                  <div className="bg-bg-2 border border-accent/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">
                        Günlük Detay — <span className="text-accent">{osSecili}</span>
                        {secilenOpr.fazlaGun > 0 && (
                          <span className="ml-2 text-xs text-red-400">⚠ {secilenOpr.fazlaGun} fazla mesai günü</span>
                        )}
                      </h3>
                      <span className="text-[10px] text-zinc-500">Kırmızı çubuk = 8 saat üzeri</span>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={drillData} margin={{ top: 4, right: 12, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                        <XAxis dataKey="gun" tick={{ fontSize: 10, fill: '#a1a1aa' }} angle={-40} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} unit="s" />
                        <Tooltip
                          formatter={(v: number, _: string, p: any) => [`${v}s / ${p.payload.uretim} adet`, 'Çalışma']}
                          contentStyle={{ background: '#1c1c24', border: '1px solid #3f3f46', fontSize: 11 }}
                        />
                        <ReferenceLine y={8} stroke="#ef4444" strokeDasharray="4 3" label={{ value: '8s sınır', fill: '#ef4444', fontSize: 9, position: 'right' }} />
                        <Bar dataKey="saat" radius={[3, 3, 0, 0]} maxBarSize={40}>
                          {drillData.map((entry, i) => (
                            <Cell key={i} fill={entry.fazla ? '#ef4444' : '#06b6d4'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Drill-down tablo */}
                    <table className="w-full text-xs mt-3">
                      <thead>
                        <tr className="border-b border-border text-zinc-500">
                          <th className="text-left px-3 py-1.5">Tarih</th>
                          <th className="text-right px-3 py-1.5">Çalışma Süresi</th>
                          <th className="text-right px-3 py-1.5">Üretim (adet)</th>
                          <th className="text-right px-3 py-1.5">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(secilenOpr.gunler)
                          .sort((a, b) => a.tarih.localeCompare(b.tarih))
                          .map(g => (
                            <tr key={g.tarih} className="border-b border-border/30">
                              <td className="px-3 py-1 font-mono text-zinc-400">{g.tarih}</td>
                              <td className="px-3 py-1 text-right font-mono text-accent">{osFmtSaat(g.dk)}</td>
                              <td className="px-3 py-1 text-right font-mono text-green-400">{g.uretim}</td>
                              <td className="px-3 py-1 text-right">
                                {g.dk > 480
                                  ? <span className="text-red-400 text-[10px] font-semibold">FAZLA MESAİ</span>
                                  : g.dk > 0
                                    ? <span className="text-zinc-500 text-[10px]">Normal</span>
                                    : <span className="text-zinc-700 text-[10px]">Süre girilmemiş</span>}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })()}
      </div>
    </div>
  )
}
