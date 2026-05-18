import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildIhtiyacMap, buildStokMap } from '@/lib/hammaddeHesap'
import { useProductionStore, useOrderStore, useWarehouseStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { showPrompt, showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { Search, Download, Plus, Upload } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { z } from 'zod'
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown'
import { MaterialSearchModal } from '@/components/MaterialSearchModal'
import { acikBarHurdadanGeriAl, acikBarTuketimGeriAl } from '@/services/productionService/barModel'
// v15.92 — Madde 15 P2: Mamul cikis 2-asama modal
import { MamulCikisModal } from '@/components/MamulCikisModal'

const stokGirisSchema = z.object({
  malkod: z.string().min(1, 'Malzeme seçimi zorunlu'),
  miktar: z.coerce.number().positive('Miktar sıfırdan büyük olmalı'),
  tip: z.enum(['giris', 'cikis'] as const),
  aciklama: z.string(),
})

const stokInlineEditSchema = z.coerce.number().positive('Miktar sıfırdan büyük olmalı')

export function Warehouse() {
  const stokHareketler = useWarehouseStore(s => s.stokHareketler)
  const materials = useWarehouseStore(s => s.materials)
  const lokasyonlar = useWarehouseStore(s => s.lokasyonlar)
  const loadOwn = useWarehouseStore(s => s.loadOwn)
  const acikBarlar = useProductionStore(s => s.acikBarlar)
  const workOrders = useProductionStore(s => s.workOrders)
  const cuttingPlans = useProductionStore(s => s.cuttingPlans)
  const orders = useOrderStore(s => s.orders)
  const { can, user } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'stok'|'hareketler'|'sayim'|'acikBarlar'|'hurda'|'tuketildi'|'lokasyonlar'>('stok')
  const [lokasyonAtaMalkod, setLokasyonAtaMalkod] = useState<{ malkod: string; malad: string; current: string } | null>(null)
  const [lokasyonForm, setLokasyonForm] = useState<{ id?: string; kod: string; ad: string; bolum: string; tip: string; kapasite: string } | null>(null)
  const [showGiris, setShowGiris] = useState(false)
  // v15.92 — mamul cikis modal state (2-asama akisi)
  const [cikisMalkod, setCikisMalkod] = useState<{ malkod: string; malad: string } | null>(null)
  const [tipFilter, setTipFilter] = useState<Set<string>>(new Set())
  const [detayHam, setDetayHam] = useState<string | null>(null)  // v15.34 — açık bar detay modal
  const [secilenKritik, setSecilenKritik] = useState<Set<string>>(new Set())
  const [showKritik, setShowKritik] = useState(true)
  const [arsivleniyor, setArsivleniyor] = useState(false)

  // Malzeme tipleri
  const tipler = useMemo(() => [...new Set(materials.map(m => m.tip).filter(Boolean))].sort(), [materials])

  const stokMap = useMemo(() => {
    // Net stok: merkezi kaynak (lib/hammaddeHesap.ts:buildStokMap) — getStok ile aynı semantik
    const netMap = buildStokMap(stokHareketler)
    const adMap: Record<string, string> = {}
    for (const h of stokHareketler) {
      if (h.malkod && !adMap[h.malkod]) adMap[h.malkod] = h.malad
    }
    return Object.entries(netMap)
      .map(([malkod, miktar]) => ({ malkod, malad: adMap[malkod] || '', miktar }))
      .filter(s => Math.abs(s.miktar) > 0.01)
      .sort((a, b) => a.malad.localeCompare(b.malad, 'tr'))
  }, [stokHareketler])

  // Anlık ihtiyaç: kesim planı varsa plan bar adedi, yoksa WO hm toplamı
  // ihtiyacMap → merkezi kaynak: hammaddeHesap.ts → buildIhtiyacMap
  const ihtiyacMap = useMemo(() => {
    const raw = buildIhtiyacMap(workOrders, cuttingPlans as any, materials)
    const m: Record<string, number> = {}
    for (const v of Object.values(raw)) m[v.malkod] = v.ihtiyac
    return m
  }, [workOrders, cuttingPlans, materials])

  const filteredStok = useMemo(() => {
    let result = stokMap
    if (tipFilter.size > 0) {
      const tipMalkodlar = new Set(materials.filter(m => tipFilter.has(m.tip) || tipFilter.has(m.hammaddeTipi)).map(m => m.kod))
      result = result.filter(s => tipMalkodlar.has(s.malkod))
    }
    if (search) { const q = search.toLowerCase(); result = result.filter(s => (s.malkod + s.malad).toLowerCase().includes(q)) }
    return result
  }, [stokMap, search, tipFilter, materials])

  const hareketOzeti = useMemo(() => {
    const days: { gun: string; giris: number; cikis: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const giris = stokHareketler.filter(h => h.tarih === key && h.tip === 'giris').reduce((a, h) => a + (h.miktar || 0), 0)
      const cikis = stokHareketler.filter(h => h.tarih === key && (h.tip === 'cikis' || h.tip === 'bar_acilis')).reduce((a, h) => a + (h.miktar || 0), 0)
      days.push({ gun: key.slice(5), giris: Math.round(giris * 100) / 100, cikis: Math.round(cikis * 100) / 100 })
    }
    return days
  }, [stokHareketler])

  const kritikStok = useMemo(() => {
    return stokMap
      .filter(s => {
        const mat = materials.find(m => m.kod === s.malkod)
        return mat?.minStok && s.miktar < mat.minStok
          && mat.tip !== 'Mamul' && mat.tip !== 'mamul'
          && mat.tip !== 'YariMamul' && mat.tip !== 'yari_mamul'
      })
      .map(s => {
        const mat = materials.find(m => m.kod === s.malkod)!
        return {
          malkod: s.malkod,
          malad: s.malad,
          stok: Math.round(s.miktar),
          minStok: mat.minStok,
          eksik: Math.max(mat.minStok - Math.round(s.miktar), 1),
          birim: mat.birim || 'Ad',
        }
      })
      .sort((a, b) => (a.stok / a.minStok) - (b.stok / b.minStok))
  }, [stokMap, materials])

  const filteredHareketler = useMemo(() => {
    const sorted = [...stokHareketler].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
    if (!search) return sorted.slice(0, 200)
    const q = search.toLowerCase()
    return sorted.filter(h => (h.malkod + h.malad + h.aciklama).toLowerCase().includes(q)).slice(0, 200)
  }, [stokHareketler, search])

  async function topluTedarikOlustur() {
    const seciliList = kritikStok.filter(k => secilenKritik.has(k.malkod))
    if (!seciliList.length) return
    if (!await showConfirm(`${seciliList.length} malzeme için tedarik kaydı oluşturulsun mu?`)) return
    const rows = seciliList.map(k => ({
      id: uid(),
      tarih: today(),
      malkod: k.malkod,
      malad: k.malad,
      miktar: k.eksik,
      birim: k.birim,
      durum: 'bekliyor',
      geldi: false,
      not_: 'Toplu tedarik — kritik stok',
    }))
    const { error } = await supabase.from('uys_tedarikler').insert(rows)
    if (error) { toast.error('Tedarik oluşturulamadı: ' + error.message); return }
    toast.success(`${seciliList.length} tedarik kaydı oluşturuldu`)
    setSecilenKritik(new Set())
    navigate('/procurement')
  }

  // #30: Stok Onarım — negatif stokları sıfırla
  async function stokOnar() {
    const negatifler = stokMap.filter(s => s.miktar < -0.01)
    if (!negatifler.length) { toast.info('Negatif stok yok — her şey düzgün'); return }
    if (!await showConfirm(`${negatifler.length} malzemede negatif stok var. Düzeltme girişleri oluşturulsun mu?`)) return
    for (const s of negatifler) {
      await supabase.from('uys_stok_hareketler').insert({
        id: uid(), tarih: today(), malkod: s.malkod, malad: s.malad,
        miktar: Math.abs(s.miktar), tip: 'giris',
        aciklama: 'Stok onarım — negatif düzeltme',
      })
    }
    loadOwn(); toast.success(negatifler.length + ' malzeme düzeltildi')
  }

  async function arsivle() {
    const kesilmeTarihi = new Date()
    kesilmeTarihi.setFullYear(kesilmeTarihi.getFullYear() - 1)
    const kesilmeTarihiStr = kesilmeTarihi.toISOString().slice(0, 10)

    const { count } = await supabase
      .from('uys_stok_hareketler')
      .select('*', { count: 'exact', head: true })
      .lt('tarih', kesilmeTarihiStr)
      .is('test_run_id', null)

    if ((count ?? 0) === 0) { toast.info('Arşivlenecek kayıt yok (1 yıldan eski)'); return }

    const onay = await showConfirm(
      `${count} stok hareketi arşivlenecek (${kesilmeTarihiStr} öncesi).\n\n` +
      `• Kayıtlar uys_stok_hareketler_arsiv tablosuna taşınır.\n` +
      `• Her malzeme için bakiye konsolidasyonu yapılır — net stok KORUNUR.\n` +
      `• Bu işlem geri alınamaz (sadece DB seviyesinde).\n\n` +
      `Devam edilsin mi?`
    )
    if (!onay) return

    setArsivleniyor(true)
    try {
      const { data, error } = await supabase.rpc('arsivle_stok_hareketleri', {
        kesim_tarihi: kesilmeTarihiStr,
      })
      if (error) { toast.error('Arşivleme başarısız: ' + error.message); return }
      const result = data as { arsivlendi: number; konsolide: number; kesim_tarihi: string }
      toast.success(`${result.arsivlendi} kayıt arşivlendi · ${result.konsolide} malzeme konsolide edildi`)
      loadOwn()
    } finally {
      setArsivleniyor(false)
    }
  }

  // Stok Excel Import
  function importExcel() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      if (!rows.length) { toast.error('Excel boş'); return }
      let count = 0
      for (const row of rows) {
        const malkod = String(row['Kod'] || row['Malzeme Kodu'] || row['malkod'] || '').trim()
        const miktar = parseFloat(String(row['Miktar'] || row['miktar'] || row['Stok'] || '0')) || 0
        const tip = String(row['Tip'] || row['tip'] || 'giris').toLowerCase().includes('çık') ? 'cikis' : 'giris'
        if (!malkod || miktar <= 0) continue
        const mat = materials.find(m => m.kod === malkod)
        await supabase.from('uys_stok_hareketler').insert({
          id: uid(), tarih: today(), malkod, malad: mat?.ad || malkod,
          miktar, tip, aciklama: 'Excel import',
        })
        count++
      }
      loadOwn(); toast.success(count + ' stok hareketi yüklendi')
    }
    input.click()
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filteredStok.map(s => ({ Kod: s.malkod, Malzeme: s.malad, Stok: Math.round(s.miktar * 100) / 100 }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stok')
      XLSX.writeFile(wb, `stok_${today()}.xlsx`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Depolar</h1><p className="text-xs text-zinc-500">{stokHareketler.length} hareket · {stokMap.length} malzeme</p></div>
        <div className="flex gap-2">
          <button onClick={importExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Upload size={13} /> Excel Yükle</button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          {can('stok_onarim') && <button onClick={() => stokOnar()} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-amber" title="Negatif stokları sıfırla">🔧 Onar</button>}
          {can('stok_arsivle') && <button onClick={arsivle} disabled={arsivleniyor} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-red disabled:opacity-50" title="1 yıldan eski hareketleri arşivle">{arsivleniyor ? '⏳ Arşivleniyor…' : '🗄 Arşivle'}</button>}
          <button onClick={async () => {
            const lines = await showPrompt('Toplu stok girişi (her satır: malzeme_kodu,miktar)', 'H-001,100')
            if (!lines) return
            const rows = lines.split('\n').filter(l => l.includes(','))
            let count = 0
            for (const line of rows) {
              const [malkod, miktarStr] = line.split(',').map(s => s.trim())
              const miktar = parseFloat(miktarStr) || 0
              if (!malkod || miktar <= 0) continue
              const mat = materials.find(m => m.kod === malkod)
              await supabase.from('uys_stok_hareketler').insert({
                id: uid(), tarih: today(), malkod, malad: mat?.ad || malkod,
                miktar, tip: 'giris', aciklama: 'Toplu giriş',
              })
              count++
            }
            loadOwn(); toast.success(count + ' stok girişi yapıldı')
          }} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📦 Toplu Giriş</button>
          {can('stok_giris') && <button onClick={() => setShowGiris(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Manuel Giriş/Çıkış</button>}
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        <select value={tab} onChange={e => setTab(e.target.value as 'stok'|'hareketler'|'sayim'|'acikBarlar'|'hurda'|'tuketildi')} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="stok">Anlık Stok</option>
          <option value="hareketler">Hareketler</option>
          <option value="sayim">Stok Sayım</option>
          <option value="acikBarlar">Açık Bar Havuzu</option>
          <option value="hurda">Hurdaya Gönderilen</option>
          <option value="tuketildi">Tüketilmiş Bar</option>
        </select>
      </div>

      {hareketOzeti.some(d => d.giris > 0 || d.cikis > 0) && (
        <div className="bg-bg-2 border border-border rounded-lg px-4 pt-3 pb-2 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-zinc-400">Son 7 Gün Stok Hareketi</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-zinc-500"><span className="w-2 h-2 bg-green rounded-sm inline-block" />Giriş</span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-500"><span className="w-2 h-2 bg-red rounded-sm inline-block" />Çıkış</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={hareketOzeti} barSize={14} barGap={2} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="gun" tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, fontSize: 11 }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                formatter={(v: number, name: string) => [v, name === 'giris' ? 'Giriş' : 'Çıkış']}
              />
              <Bar dataKey="giris" fill="#22c55e" radius={[3, 3, 0, 0]} name="giris" />
              <Bar dataKey="cikis" fill="#ef4444" radius={[3, 3, 0, 0]} name="cikis" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>
        <MultiCheckDropdown label="Malzeme Tipi"
          options={tipler}
          selected={tipFilter} onChange={setTipFilter} />
      </div>

      {kritikStok.length > 0 && can('ted_add') && (
        <div className="bg-bg-2 border border-amber/30 rounded-lg mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-amber/5 border-b border-amber/20">
            <button
              onClick={() => setShowKritik(v => !v)}
              className="flex items-center gap-2 text-xs text-amber font-semibold select-none"
            >
              <span className={`transition-transform text-[10px] ${showKritik ? 'rotate-90' : ''}`}>▶</span>
              Kritik Stok — {kritikStok.length} malzeme
            </button>
            {showKritik && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSecilenKritik(new Set(kritikStok.map(k => k.malkod)))}
                  className="text-[11px] text-zinc-400 hover:text-white"
                >Tümünü Seç</button>
                <span className="text-zinc-600">·</span>
                <button
                  onClick={() => setSecilenKritik(new Set())}
                  className="text-[11px] text-zinc-400 hover:text-white"
                >Temizle</button>
                <button
                  onClick={topluTedarikOlustur}
                  disabled={secilenKritik.size === 0}
                  className="flex items-center gap-1 px-3 py-1 bg-accent hover:bg-accent-hover disabled:bg-bg-3 disabled:text-zinc-600 text-white rounded text-[11px] font-semibold"
                >
                  <Plus size={11} /> Toplu Tedarik Oluştur ({secilenKritik.size})
                </button>
              </div>
            )}
          </div>
          {showKritik && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-zinc-500">
                  <th className="w-8 px-3 py-1.5"></th>
                  <th className="text-left px-3 py-1.5">Kod</th>
                  <th className="text-left px-3 py-1.5">Malzeme</th>
                  <th className="text-right px-3 py-1.5">Stok</th>
                  <th className="text-right px-3 py-1.5">Min</th>
                  <th className="text-right px-3 py-1.5 text-amber">Eksik</th>
                  <th className="text-left px-3 py-1.5">Birim</th>
                </tr>
              </thead>
              <tbody>
                {kritikStok.map(k => (
                  <tr key={k.malkod} className={`border-b border-border/30 hover:bg-bg-3/20 ${secilenKritik.has(k.malkod) ? 'bg-accent/5' : ''}`}>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={secilenKritik.has(k.malkod)}
                        onChange={() => {
                          const n = new Set(secilenKritik)
                          n.has(k.malkod) ? n.delete(k.malkod) : n.add(k.malkod)
                          setSecilenKritik(n)
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5 font-mono text-accent text-[11px]">{k.malkod}</td>
                    <td className="px-3 py-1.5 text-zinc-300">{k.malad}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-semibold ${k.stok < 0 ? 'text-red' : 'text-amber'}`}>{k.stok}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{k.minStok}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-amber">+{k.eksik}</td>
                    <td className="px-3 py-1.5 text-zinc-600 text-[10px]">{k.birim}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
        {tab === 'stok' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Malzeme</th><th className="text-left px-4 py-2.5">Tip</th><th className="text-right px-4 py-2.5">Stok</th><th className="text-right px-3 py-2.5 text-orange-400">İhtiyaç</th><th className="text-right px-3 py-2.5 text-cyan-400">Fark</th><th className="text-left px-3 py-2.5">Birim</th><th className="text-right px-3 py-2.5">Min</th><th className="text-right px-3 py-2.5">Aksiyon</th></tr></thead>
            <tbody>
              {filteredStok.map(s => {
                const mat = materials.find(m => m.kod === s.malkod)
                const kartYok = !mat
                const minStokAlt = mat?.minStok && s.miktar < mat.minStok
                const isMamul = mat && (mat.tip === 'Mamul' || mat.tip === 'mamul' || mat.tip === 'YariMamul' || mat.tip === 'yari_mamul')
                const ihtiyac = Math.ceil(ihtiyacMap[s.malkod] || 0)
                const fark = Math.round(s.miktar) - ihtiyac
                return (
                <tr key={s.malkod} className={`border-b border-border/30 hover:bg-bg-3/30 ${kartYok ? 'bg-amber/5' : fark < 0 ? 'bg-red/5' : minStokAlt ? 'bg-red/5' : ''}`}>
                  <td className="px-4 py-1.5 font-mono text-accent text-[11px]">
                    {s.malkod}
                    {kartYok && <span className="ml-1.5 px-1 py-0.5 bg-amber/20 text-amber rounded text-[9px] font-semibold">⚠ Kart Yok</span>}
                  </td>
                  <td className="px-4 py-1.5 text-zinc-300">{s.malad}</td>
                  <td className="px-4 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[9px] ${kartYok ? 'bg-amber/15 text-amber' : 'bg-bg-3 text-zinc-500'}`}>{mat?.tip || (kartYok ? 'Kart Yok' : '—')}</span></td>
                  <td className={`px-4 py-1.5 text-right font-mono font-semibold ${s.miktar < 0 ? 'text-red' : minStokAlt ? 'text-amber' : 'text-green'}`}>{Math.round(s.miktar)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-orange-400">{ihtiyac > 0 ? ihtiyac : '—'}</td>
                  <td className={`px-3 py-1.5 text-right font-mono font-semibold ${fark < 0 ? 'text-red' : fark > 0 ? 'text-amber' : 'text-zinc-500'}`}>
                    {ihtiyac > 0 ? (fark < 0 ? `⚠ ${fark}` : `+${fark}`) : Math.round(s.miktar) > 0 ? <span className="text-amber">+{Math.round(s.miktar)}</span> : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-zinc-600 text-[10px]">{mat?.birim || 'Ad'}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-600 text-[10px]">{mat?.minStok || '—'}</td>
                  <td className="px-3 py-1.5 text-right">
                    {kartYok && (
                      <a href="#/stok-log" className="px-2 py-0.5 bg-amber/10 border border-amber/30 text-amber rounded text-[10px] hover:bg-amber/20">
                        StokLog'da Düzelt
                      </a>
                    )}
                    {!kartYok && isMamul && s.miktar > 0 && can('stok_cikis') && (
                      <button
                        onClick={() => setCikisMalkod({ malkod: s.malkod, malad: s.malad })}
                        className="px-2 py-0.5 bg-amber/10 border border-amber/30 text-amber rounded text-[10px] hover:bg-amber/20"
                        title="Mamul cikis (rezerv kontrol)"
                      >
                        📤 Çıkış
                      </button>
                    )}
                    {!kartYok && !isMamul && minStokAlt && can('ted_add') && (
                      <button
                        onClick={() => navigate(`/procurement?malkod=${s.malkod}`)}
                        className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded text-[10px] hover:bg-cyan-500/20"
                        title="Min stok altında — tedarik önerisi oluştur"
                      >
                        Tedarik Öner
                      </button>
                    )}
                  </td>
                </tr>)
              })}
            </tbody>
          </table>
        )}

        {tab === 'hareketler' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Tarih</th><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Malzeme</th><th className="text-left px-4 py-2.5">Tip</th><th className="text-right px-4 py-2.5">Miktar</th><th className="text-left px-4 py-2.5">Açıklama</th></tr></thead>
            <tbody>
              {filteredHareketler.map(h => (
                <tr key={h.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-1.5 font-mono text-zinc-500">{h.tarih}</td>
                  <td className="px-4 py-1.5 font-mono text-accent text-[11px]">{h.malkod}</td>
                  <td className="px-4 py-1.5 text-zinc-300">{h.malad}</td>
                  <td className="px-4 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${h.tip === 'giris' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>{h.tip === 'giris' ? '↑ Giriş' : '↓ Çıkış'}</span></td>
                  <td className="px-4 py-1.5 text-right font-mono">{h.miktar}</td>
                  <td className="px-4 py-1.5 text-zinc-500 max-w-[200px] truncate">{h.aciklama || '—'}</td>
                  <td className="px-4 py-1.5 text-right">
                    {!h.logId && <><button onClick={async () => {
                      const newMiktar = await showPrompt('Yeni miktar', 'Miktar', String(h.miktar))
                      if (!newMiktar) return
                      const inlineParsed = stokInlineEditSchema.safeParse(newMiktar)
                      if (!inlineParsed.success) { toast.error(inlineParsed.error.issues[0]?.message || 'Geçersiz miktar'); return }
                      await supabase.from('uys_stok_hareketler').update({ miktar: inlineParsed.data }).eq('id', h.id)
                      loadOwn(); toast.success('Stok hareketi güncellendi')
                    }} className="text-zinc-600 hover:text-amber text-[10px] mr-1">Düzenle</button>
                    <button onClick={async () => {
                      if (!await showConfirm('Bu stok hareketini silmek istediğinize emin misiniz?')) return
                      await supabase.from('uys_stok_hareketler').delete().eq('id', h.id)
                      loadOwn(); toast.success('Stok hareketi silindi')
                    }} className="text-zinc-600 hover:text-red text-[10px]">Sil</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'sayim' && (
          <div className="p-4">
            <p className="text-xs text-zinc-500 mb-3">Fiziksel sayım sonuçlarını girin — sistem stoğuyla karşılaştırılır.</p>
            <div className="space-y-2">
              {filteredStok.slice(0, 30).map(s => (
                <div key={s.malkod} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-accent w-28 shrink-0 select-all cursor-text">{s.malkod}</span>
                  <span className="flex-1 text-zinc-700 truncate min-w-0">{s.malad}</span>
                  <span className="text-zinc-500 shrink-0 text-[10px]">Sys:{Math.round(s.miktar)}</span>
                  <input type="number" placeholder="Sayım" data-malkod={s.malkod}
                    className="w-20 px-2 py-1 bg-bg-3 border border-border rounded text-xs text-right focus:outline-none focus:border-accent shrink-0" />
                </div>
              ))}
            </div>
            <button onClick={async () => {
              const inputs = document.querySelectorAll('[data-malkod]') as NodeListOf<HTMLInputElement>
              let farklar = 0
              inputs.forEach(inp => {
                const sayim = parseFloat(inp.value)
                if (isNaN(sayim)) return
                const malkod = inp.dataset.malkod || ''
                const stokItem = stokMap.find(s => s.malkod === malkod)
                if (!stokItem) return
                const fark = sayim - stokItem.miktar
                if (Math.abs(fark) > 0.01) {
                  supabase.from('uys_stok_hareketler').insert({
                    id: uid(), tarih: today(), malkod, malad: stokItem.malad,
                    miktar: Math.abs(fark), tip: fark > 0 ? 'giris' : 'cikis',
                    aciklama: `Sayım farkı: sistem ${Math.round(stokItem.miktar)}, sayım ${sayim}`,
                  })
                  farklar++
                }
              })
              if (farklar > 0) { loadOwn(); toast.success(farklar + ' fark düzeltmesi kaydedildi') }
              else toast.info('Fark bulunamadı')
            }} className="mt-3 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">
              Sayımı Uygula
            </button>
          </div>
        )}

        {tab === 'acikBarlar' && (() => {
          // Ham malkod bazlı grupla + filtreye göre ara
          const aktifler = acikBarlar.filter(a => a.durum === 'acik')
          const q = search.trim().toLowerCase()
          const filtered = q
            ? aktifler.filter(a => (a.hamMalkod + ' ' + a.hamMalad).toLowerCase().includes(q))
            : aktifler
          const gruplu: Record<string, { hamMalkod: string; hamMalad: string; adet: number; toplamMm: number; barlar: typeof aktifler }> = {}
          filtered.forEach(a => {
            const k = a.hamMalkod
            if (!gruplu[k]) gruplu[k] = { hamMalkod: k, hamMalad: a.hamMalad || k, adet: 0, toplamMm: 0, barlar: [] }
            gruplu[k].adet++
            gruplu[k].toplamMm += a.uzunlukMm
            gruplu[k].barlar.push(a)
          })
          const rows = Object.values(gruplu).sort((a, b) => (a.hamMalad || '').localeCompare(b.hamMalad || '', 'tr'))
          return (
            <div>
              <div className="px-4 py-2 bg-bg-3/40 border-b border-border text-[11px] text-zinc-500">
                {aktifler.length} açık bar · {rows.length} ham malzeme · toplam {Math.round(aktifler.reduce((a, b) => a + b.uzunlukMm, 0))} mm
              </div>
              {!rows.length ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  Açık bar havuzunda kayıt yok. Kesim planları tamamlandıkça artık barlar buraya düşer.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Ham Malzeme</th><th className="text-right px-4 py-2.5">Bar Adet</th><th className="text-right px-4 py-2.5">Toplam mm</th><th className="text-left px-4 py-2.5">Uzunluklar</th><th className="text-right px-4 py-2.5 w-20"></th></tr></thead>
                  <tbody>
                    {rows.map(g => (
                      <tr key={g.hamMalkod} className="border-b border-border/30 hover:bg-bg-3/30">
                        <td className="px-4 py-2">
                          <div className="font-mono text-accent text-[11px]">{g.hamMalkod}</div>
                          <div className="text-zinc-500 text-[10px]">{g.hamMalad}</div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-zinc-200">{g.adet}</td>
                        <td className="px-4 py-2 text-right font-mono text-zinc-300">{Math.round(g.toplamMm)}</td>
                        <td className="px-4 py-2 text-zinc-400 text-[10px]">
                          {g.barlar.sort((a, b) => b.uzunlukMm - a.uzunlukMm).slice(0, 8).map(b => (
                            <span key={b.id} className="inline-block mr-1.5 px-1.5 py-0.5 bg-bg-3 rounded font-mono">{Math.round(b.uzunlukMm)}</span>
                          ))}
                          {g.barlar.length > 8 && <span className="text-zinc-600">+{g.barlar.length - 8}</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => setDetayHam(g.hamMalkod)} className="px-2 py-1 bg-bg-3 hover:bg-bg-3/70 text-zinc-300 hover:text-accent rounded text-[10px]">
                            Detay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })()}

        {tab === 'hurda' && (() => {
          // v15.34.2 — Hurdaya Gönderilen barlar. Düz liste, tarih azalan sıralı.
          // v15.44 — Admin'e "Geri Al" butonu eklendi (acikbar_hurda_geri_al yetkisi).
          const hurdalar = [...acikBarlar]
            .filter(a => a.durum === 'hurda')
            .sort((a, b) => (b.hurdaTarihi || '').localeCompare(a.hurdaTarihi || ''))
          const q = search.trim().toLowerCase()
          const filtered = q
            ? hurdalar.filter(a =>
                (a.hamMalkod + ' ' + a.hamMalad + ' ' + (a.hurdaKullaniciAd || '') + ' ' + (a.hurdaSebep || ''))
                  .toLowerCase().includes(q))
            : hurdalar
          const toplamMm = filtered.reduce((a, b) => a + (b.uzunlukMm || 0), 0)
          const canHurdaGeriAl = can('acikbar_hurda_geri_al')
          const currentUserId = user?.dbId || user?.email || user?.username || ''
          const currentUserAd = user?.username || ''

          async function geriAlHurda(barId: string, malkod: string, uzunluk: number) {
            if (!currentUserAd) { toast.error('Kullanıcı adı tespit edilemedi. Yeniden giriş yap.'); return }
            const onay = await showConfirm(
              `${malkod} (${Math.round(uzunluk)} mm) hurdadan geri alınacak.\n\n` +
              `Bar tekrar açık havuza dönecek. Fire log'undaki kayıt KORUNUR ` +
              `("İPTAL" notu eklenir, audit trail bozulmaz).\n\nDevam edilsin mi?`
            )
            if (!onay) return
            const ok = await acikBarHurdadanGeriAl(barId, currentUserId, currentUserAd)
            if (ok) {
              toast.success('Hurda geri alındı, bar açık havuza döndü')
              loadOwn()
            } else {
              toast.error('Geri alma başarısız — konsola bak')
            }
          }

          return (
            <div>
              <div className="px-4 py-2 bg-bg-3/40 border-b border-border text-[11px] text-zinc-500">
                {filtered.length} hurda bar · toplam {Math.round(toplamMm)} mm
                {q && <span className="ml-2">({hurdalar.length} toplam)</span>}
              </div>
              {!filtered.length ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  {hurdalar.length ? 'Arama kriterine uyan hurda yok.' : 'Hurda kaydı yok. Açık Bar Havuzu → Detay → "Hurdaya Gönder" ile hurda işaretlenir.'}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500">
                    <th className="text-left px-4 py-2.5">Ham Malzeme</th>
                    <th className="text-right px-4 py-2.5">Uzunluk</th>
                    <th className="text-left px-4 py-2.5">Hurda Tarihi</th>
                    <th className="text-left px-4 py-2.5">Kullanıcı</th>
                    <th className="text-left px-4 py-2.5">Sebep</th>
                    <th className="text-right px-4 py-2.5 w-24">İşlem</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(b => (
                      <tr key={b.id} className="border-b border-border/30 hover:bg-bg-3/30">
                        <td className="px-4 py-2">
                          <div className="font-mono text-accent text-[11px]">{b.hamMalkod}</div>
                          <div className="text-zinc-500 text-[10px]">{b.hamMalad}</div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-zinc-200">{Math.round(b.uzunlukMm)} mm</td>
                        <td className="px-4 py-2 text-zinc-400 text-[11px] font-mono">
                          {(b.hurdaTarihi || '').slice(0, 16).replace('T', ' ') || '-'}
                        </td>
                        <td className="px-4 py-2 text-zinc-300">{b.hurdaKullaniciAd || '-'}</td>
                        <td className="px-4 py-2 text-zinc-400 text-[11px]">
                          {b.hurdaSebep || <span className="text-zinc-600 italic">sebepsiz</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {canHurdaGeriAl ? (
                            <button
                              onClick={() => geriAlHurda(b.id, b.hamMalkod, b.uzunlukMm)}
                              title="Hurdadan geri al — bar açık havuza döner"
                              className="px-2 py-1 bg-amber/10 hover:bg-amber/20 border border-amber/30 text-amber rounded text-[10px] font-semibold">
                              ↩ Geri Al
                            </button>
                          ) : (
                            <span className="text-zinc-600 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })()}
        {tab === 'tuketildi' && (() => {
          // v15.44 — Tüketilmiş barlar. 'tuketildi' durumlu açık barlar.
          // Admin'e "Geri Al" butonu (acikbar_havuz_geri_al yetkisi).
          // NOT: Stok hareketlerine dokunulmaz — yanlış işaretleme senaryosu için.
          const tuketilenler = [...acikBarlar]
            .filter(a => a.durum === 'tuketildi')
            .sort((a, b) => (b.tuketimTarihi || '').localeCompare(a.tuketimTarihi || ''))
          const q = search.trim().toLowerCase()
          const filtered = q
            ? tuketilenler.filter(a =>
                (a.hamMalkod + ' ' + a.hamMalad + ' ' + (a.tuketimLogId || ''))
                  .toLowerCase().includes(q))
            : tuketilenler
          const toplamMm = filtered.reduce((a, b) => a + (b.uzunlukMm || 0), 0)
          const canHavuzGeriAl = can('acikbar_havuz_geri_al')
          const currentUserId = user?.dbId || user?.email || user?.username || ''
          const currentUserAd = user?.username || ''

          async function geriAlTuketim(barId: string, malkod: string, uzunluk: number) {
            if (!currentUserAd) { toast.error('Kullanıcı adı tespit edilemedi. Yeniden giriş yap.'); return }
            const onay = await showConfirm(
              `${malkod} (${Math.round(uzunluk)} mm) tüketim geri alınacak.\n\n` +
              `⚠ DİKKAT: Stok hareketlerine DOKUNULMAZ.\n` +
              `Eğer üretim gerçekten yapıldıysa stok zaten düşmüştür; otomatik geri alma double-counting yaratır.\n` +
              `Yanlış işaretleme senaryosu için tasarlandı.\n` +
              `Manuel düzeltme gerekirse Stok sayfasından yapın.\n\n` +
              `Devam edilsin mi?`
            )
            if (!onay) return
            const ok = await acikBarTuketimGeriAl(barId, currentUserId, currentUserAd)
            if (ok) {
              toast.success('Tüketim geri alındı, bar açık havuza döndü')
              loadOwn()
            } else {
              toast.error('Geri alma başarısız — konsola bak')
            }
          }

          return (
            <div>
              <div className="px-4 py-2 bg-bg-3/40 border-b border-border text-[11px] text-zinc-500">
                {filtered.length} tüketilmiş bar · toplam {Math.round(toplamMm)} mm
                {q && <span className="ml-2">({tuketilenler.length} toplam)</span>}
              </div>
              {!filtered.length ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  {tuketilenler.length ? 'Arama kriterine uyan tüketilmiş bar yok.' : 'Tüketilmiş bar kaydı yok. Açık barlar üretim sırasında havuzdan çekildiğinde tüketilmiş olarak işaretlenir.'}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500">
                    <th className="text-left px-4 py-2.5">Ham Malzeme</th>
                    <th className="text-right px-4 py-2.5">Uzunluk</th>
                    <th className="text-left px-4 py-2.5">Tüketim Tarihi</th>
                    <th className="text-left px-4 py-2.5">Tüketen Log/WO</th>
                    <th className="text-right px-4 py-2.5 w-24">İşlem</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(b => (
                      <tr key={b.id} className="border-b border-border/30 hover:bg-bg-3/30">
                        <td className="px-4 py-2">
                          <div className="font-mono text-accent text-[11px]">{b.hamMalkod}</div>
                          <div className="text-zinc-500 text-[10px]">{b.hamMalad}</div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-zinc-200">{Math.round(b.uzunlukMm)} mm</td>
                        <td className="px-4 py-2 text-zinc-400 text-[11px] font-mono">
                          {(b.tuketimTarihi || '').slice(0, 16).replace('T', ' ') || '-'}
                        </td>
                        <td className="px-4 py-2 text-zinc-400 text-[10px] font-mono truncate max-w-[200px]">
                          {b.tuketimLogId || <span className="text-zinc-600 italic">-</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {canHavuzGeriAl ? (
                            <button
                              onClick={() => geriAlTuketim(b.id, b.hamMalkod, b.uzunlukMm)}
                              title="Tüketimi geri al — bar açık havuza döner. Stok hareketleri dokunulmaz."
                              className="px-2 py-1 bg-amber/10 hover:bg-amber/20 border border-amber/30 text-amber rounded text-[10px] font-semibold">
                              ↩ Geri Al
                            </button>
                          ) : (
                            <span className="text-zinc-600 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })()}
      </div>
      {detayHam && (
        <AcikBarHurdaModal
          hamMalkod={detayHam}
          barlar={acikBarlar.filter(b => b.hamMalkod === detayHam)}
          canHurda={can('acikbar_hurda')}
          currentUserId={user?.dbId || user?.email || user?.username || ''}
          currentUserAd={user?.username || ''}
          onClose={() => setDetayHam(null)}
          onSaved={() => { loadOwn() }}
        />
      )}

      {/* v15.69 — Manuel Giriş/Çıkış modal render (eksikti — buton tıklandığında modal açılmıyordu) */}
      {showGiris && (
        <StokGirisModal
          materials={materials}
          onClose={() => setShowGiris(false)}
          onSaved={() => { setShowGiris(false); loadOwn(); toast.success('Stok hareketi kaydedildi') }}
        />
      )}

      {/* v15.92 — Madde 15 P2: Mamul cikis 2-asama modal (rezerv kontrol) */}
      {cikisMalkod && (
        <MamulCikisModal
          malkod={cikisMalkod.malkod}
          malad={cikisMalkod.malad}
          hareketler={stokHareketler}
          orders={orders.map(o => ({ id: o.id, siparisNo: o.siparisNo, musteri: o.musteri, termin: o.termin })) as any}
          canManuelMudahale={can('manuel_mudahale_yap')}
          currentUserId={user?.dbId || user?.email || user?.username || ''}
          currentUserAd={user?.username || ''}
          onClose={() => setCikisMalkod(null)}
          onSaved={() => { setCikisMalkod(null); loadOwn(); toast.success('Mamul cikis kaydedildi') }}
        />
      )}
    </div>
  )
}

function StokGirisModal({ materials, onClose, onSaved }: {
  materials: { id: string; kod: string; ad: string }[]
  onClose: () => void; onSaved: () => void
}) {
  const [malkod, setMalkod] = useState('')
  const [miktar, setMiktar] = useState('')
  const [tip, setTip] = useState<'giris' | 'cikis'>('giris')
  const [aciklama, setAciklama] = useState('')
  const [search, setSearch] = useState('')
  const [showMatSearch, setShowMatSearch] = useState(false)
  const [submitting, _setSubmitting] = useState(false)

  const filteredMats = materials.filter(m => !search || (m.kod + m.ad).toLowerCase().includes(search.toLowerCase())).slice(0, 20)
  const selectedMat = materials.find(m => m.kod === malkod)

  async function save() {
    const parsed = stokGirisSchema.safeParse({ malkod, miktar, tip, aciklama })
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message || 'Geçersiz form'); return }
    await supabase.from('uys_stok_hareketler').insert({
      id: uid(), tarih: today(), malkod: parsed.data.malkod, malad: selectedMat?.ad || parsed.data.malkod,
      miktar: parsed.data.miktar, tip: parsed.data.tip,
      aciklama: parsed.data.aciklama || (parsed.data.tip === 'giris' ? 'Manuel giriş' : 'Manuel çıkış'),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Manuel Stok Giriş/Çıkış</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Malzeme *</label>
            <div className="flex items-center gap-1">
              <input value={search} onChange={e => { setSearch(e.target.value); setMalkod('') }} placeholder="Malzeme ara..."
                className="flex-1 px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
              <button type="button" onClick={() => setShowMatSearch(true)} title="Detaylı arama (ölçü filtreli)"
                className="w-9 h-9 flex items-center justify-center rounded bg-bg-3 border border-border/50 text-zinc-400 hover:text-accent hover:border-accent/50 shrink-0">
                <Search size={12} />
              </button>
            </div>
            {search && !malkod && (
              <div className="mt-1 max-h-32 overflow-y-auto bg-bg-2 border border-border rounded-lg">
                {filteredMats.map(m => (
                  <button key={m.id} onClick={async () => { setMalkod(m.kod); setSearch(m.kod + ' — ' + m.ad) }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-3 truncate">
                    <span className="font-mono text-accent">{m.kod}</span> — {m.ad}
                  </button>
                ))}
              </div>
            )}
            {malkod && <div className="mt-1 text-[11px] text-green">✓ {selectedMat?.ad}</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Tip</label>
            <select value={tip} onChange={e => setTip(e.target.value as 'giris' | 'cikis')} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
              <option value="giris">Giriş</option><option value="cikis">Çıkış</option>
            </select></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Miktar *</label>
            <input type="number" min={0.01} value={miktar} onChange={e => setMiktar(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Açıklama</label>
          <input value={aciklama} onChange={e => setAciklama(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" placeholder="Opsiyonel..." /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} disabled={submitting} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-bg-3 disabled:text-zinc-600 text-white rounded-lg text-xs font-semibold">{submitting ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </div>
      </div>
      {showMatSearch && (
        <MaterialSearchModal
          materials={materials as any}
          title="Malzeme Ara — Ölçü Filtreli"
          onSelect={(mat) => { setMalkod(mat.kod); setSearch(mat.kod + ' — ' + mat.ad); setShowMatSearch(false) }}
          onClose={() => setShowMatSearch(false)}
        />
      )}
    </div>
  )
}

// ═══ AÇIK BAR HURDA MODALI — v15.34 ═══
// Belirli bir ham malzemenin açık barlarını listeler, checkbox ile seçim,
// toplu hurdaya gönderme. Hurdaya giden barlar uys_acik_barlar tablosunda
// durum='hurda' + hurda_tarihi/sebep/kullanici alanları ile işaretlenir.
function AcikBarHurdaModal({
  hamMalkod, barlar, canHurda, currentUserId, currentUserAd, onClose, onSaved,
}: {
  hamMalkod: string
  barlar: import('@/types').AcikBar[]
  canHurda: boolean
  currentUserId: string
  currentUserAd: string
  onClose: () => void
  onSaved: () => void
}) {
  const [secimler, setSecimler] = useState<Set<string>>(new Set())
  const [sebep, setSebep] = useState('')
  const [hurdayiGoster, setHurdayiGoster] = useState(false)
  const [loading, setLoading] = useState(false)

  const hamMalad = barlar[0]?.hamMalad || hamMalkod
  const aktifSayi = barlar.filter(b => b.durum === 'acik').length
  const hurdaSayi = barlar.filter(b => b.durum === 'hurda').length
  const tuketilmisSayi = barlar.filter(b => b.durum === 'tuketildi').length

  // Görüntülenecek liste: varsayılan sadece acik; toggle'la hurda da görünür
  const gosterilecek = barlar
    .filter(b => b.durum === 'acik' || (hurdayiGoster && b.durum === 'hurda'))
    .sort((a, b) => {
      // Açıklar önce, sonra uzunluk azalan
      if (a.durum !== b.durum) return a.durum === 'acik' ? -1 : 1
      return (b.uzunlukMm || 0) - (a.uzunlukMm || 0)
    })

  function toggleSec(id: string) {
    const y = new Set(secimler)
    if (y.has(id)) y.delete(id); else y.add(id)
    setSecimler(y)
  }
  function tumAcikSec() {
    setSecimler(new Set(gosterilecek.filter(b => b.durum === 'acik').map(b => b.id)))
  }
  function temizle() { setSecimler(new Set()) }

  const secilenBarlar = barlar.filter(b => secimler.has(b.id) && b.durum === 'acik')
  const toplamMm = secilenBarlar.reduce((a, b) => a + (b.uzunlukMm || 0), 0)

  async function hurdayaGonder() {
    if (!secilenBarlar.length) { toast.error('Seçim yok'); return }
    if (!currentUserAd) { toast.error('Kullanıcı adı tespit edilemedi. Yeniden giriş yap.'); return }
    const onay = await showConfirm(
      `${secilenBarlar.length} açık bar (${Math.round(toplamMm)} mm) hurdaya gönderilecek. Onaylıyor musun?`
    )
    if (!onay) return

    setLoading(true)
    try {
      const now = new Date()
      const nowIso = now.toISOString()
      const tarihKisa = nowIso.slice(0, 10)  // YYYY-MM-DD (fire_logs.tarih formatı)
      const sebepClean = sebep.trim()

      // 1. uys_acik_barlar: durum + hurda alanları
      const { error: e1 } = await supabase
        .from('uys_acik_barlar')
        .update({
          durum: 'hurda',
          hurda_tarihi: nowIso,
          hurda_sebep: sebepClean || null,
          hurda_kullanici_id: currentUserId,
          hurda_kullanici_ad: currentUserAd,
        })
        .in('id', secilenBarlar.map(b => b.id))

      if (e1) { toast.error('Hurda işlemi başarısız: ' + e1.message); return }

      // 2. uys_fire_logs: her hurda bar için bir fire kaydı (tip='bar_hurda')
      //    Rapor takibi için. qty=1 (bar adedi), uzunluk_mm dolu.
      //    v15.44: ID deterministik 'fire-bar-hurda-' + acikBarId →
      //    geri alma sırasında bulunabilir + idempotent (tekrar hurda et = aynı kayıt).
      const fireRows = secilenBarlar.map(b => ({
        id: 'fire-bar-hurda-' + b.id,
        log_id: null,
        wo_id: null,
        tarih: tarihKisa,
        malkod: b.hamMalkod,
        malad: b.hamMalad,
        qty: 1,
        ie_no: '',
        op_ad: currentUserAd,
        operatorlar: [],
        not_: sebepClean ? 'Açık bar hurda — ' + sebepClean : 'Açık bar hurda',
        tip: 'bar_hurda',
        uzunluk_mm: b.uzunlukMm,
      }))
      const { error: e2 } = await supabase
        .from('uys_fire_logs')
        .upsert(fireRows, { onConflict: 'id' })   // upsert: geri al + tekrar hurda senaryosunda idempotent
      if (e2) {
        // Hurda zaten kaydedildi, fire log başarısız ise uyar ama geri alma
        toast.warning('Hurda kaydedildi, fire log yazılamadı: ' + e2.message)
      }

      toast.success(`${secilenBarlar.length} bar hurdaya gönderildi`)
      setSecimler(new Set())
      setSebep('')
      onSaved()
      // Kalan açık bar yoksa modal'ı kapat
      if (aktifSayi - secilenBarlar.length <= 0) onClose()
    } catch (e: any) {
      toast.error('Hurda işlemi başarısız: ' + (e?.message || 'bilinmeyen hata'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Başlık */}
        <div className="px-6 py-4 border-b border-border">
          <div className="font-mono text-accent text-sm">{hamMalkod}</div>
          <div className="text-zinc-400 text-xs">{hamMalad}</div>
          <div className="mt-1.5 text-[11px] text-zinc-500">
            <span className="text-green">{aktifSayi} açık</span>
            {hurdaSayi > 0 && <span> · <span className="text-red-400">{hurdaSayi} hurda</span></span>}
            {tuketilmisSayi > 0 && <span> · <span className="text-zinc-500">{tuketilmisSayi} tüketilmiş</span></span>}
          </div>
        </div>

        {/* Kontrol çubuğu */}
        <div className="px-6 py-2.5 border-b border-border flex items-center justify-between text-[11px]">
          <label className="flex items-center gap-2 text-zinc-400 cursor-pointer select-none">
            <input type="checkbox" checked={hurdayiGoster} onChange={e => setHurdayiGoster(e.target.checked)} />
            Hurdaya gidenleri de göster
          </label>
          {canHurda && aktifSayi > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={tumAcikSec} className="text-accent hover:underline">Tüm açıkları seç</button>
              <span className="text-zinc-600">·</span>
              <button onClick={temizle} className="text-zinc-400 hover:underline">Temizle</button>
            </div>
          )}
        </div>

        {/* Tablo */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2 z-10">
              <tr className="border-b border-border text-zinc-500">
                {canHurda && <th className="w-10 px-3 py-2"></th>}
                <th className="text-right px-3 py-2">Uzunluk</th>
                <th className="text-left px-3 py-2">Oluşma</th>
                <th className="text-left px-3 py-2">Kaynak Plan</th>
                <th className="text-left px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {gosterilecek.map(b => {
                const isHurda = b.durum === 'hurda'
                const secili = secimler.has(b.id)
                return (
                  <tr key={b.id} className={`border-b border-border/30 ${isHurda ? 'opacity-60' : 'hover:bg-bg-3/30'} ${secili ? 'bg-accent/5' : ''}`}>
                    {canHurda && (
                      <td className="px-3 py-1.5 text-center">
                        {!isHurda ? (
                          <input type="checkbox" checked={secili} onChange={() => toggleSec(b.id)} />
                        ) : null}
                      </td>
                    )}
                    <td className="text-right px-3 py-1.5 font-mono text-zinc-200">{Math.round(b.uzunlukMm)} mm</td>
                    <td className="px-3 py-1.5 text-zinc-400">{b.olusmaTarihi || '-'}</td>
                    <td className="px-3 py-1.5 text-zinc-500 font-mono text-[10px]">
                      {b.kaynakPlanId ? '…' + b.kaynakPlanId.slice(-6) : '-'}
                    </td>
                    <td className="px-3 py-1.5">
                      {isHurda ? (
                        <span
                          className="text-red-400 cursor-help"
                          title={`${b.hurdaKullaniciAd || '?'} · ${b.hurdaTarihi?.slice(0, 16).replace('T', ' ') || ''}${b.hurdaSebep ? '\n' + b.hurdaSebep : ''}`}
                        >
                          HURDA
                        </span>
                      ) : (
                        <span className="text-green">AÇIK</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!gosterilecek.length && (
                <tr>
                  <td colSpan={canHurda ? 5 : 4} className="text-center py-8 text-zinc-500 text-xs">
                    Kayıt yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Alt alan — sebep + aksiyon */}
        {canHurda ? (
          <div className="px-6 py-4 border-t border-border space-y-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Hurda sebebi (opsiyonel)</label>
              <input
                value={sebep}
                onChange={e => setSebep(e.target.value)}
                placeholder="Örn: Çok kısa, kullanılamaz"
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-400">
                Seçili: <span className="text-zinc-200 font-semibold">{secilenBarlar.length}</span> bar
                {secilenBarlar.length > 0 && (
                  <> · <span className="text-zinc-300 font-mono">{Math.round(toplamMm)}</span> mm</>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">Kapat</button>
                <button
                  onClick={hurdayaGonder}
                  disabled={!secilenBarlar.length || loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-bg-3 disabled:text-zinc-600 text-white rounded-lg text-xs font-semibold"
                >
                  {loading ? 'Gönderiliyor…' : 'Hurdaya Gönder'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 border-t border-border flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">Kapat</button>
          </div>
        )}
      </div>
    </div>
  )
}
