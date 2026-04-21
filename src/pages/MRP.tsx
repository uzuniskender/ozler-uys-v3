import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Download } from 'lucide-react'
import { hesaplaMRP, type MRPRow } from '@/features/production/mrp'

export function MRP() {
  const { orders, workOrders, logs, recipes, stokHareketler, tedarikler, cuttingPlans, materials, loadAll } = useStore()
  const { can } = useAuth()
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [selectedYMs, setSelectedYMs] = useState<Set<string>>(new Set())
  const [sonuc, setSonuc] = useState<MRPRow[]>([])
  const [hesaplandi, setHesaplandi] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const [showTamamlanan, setShowTamamlanan] = useState(false)
  const [showYMTamamlanan, setShowYMTamamlanan] = useState(false)
  const [viewFilter, setViewFilter] = useState<'eksik' | 'yeterli' | 'tum'>('eksik')

  // MRP tamamlanmış YM İE'leri (localStorage'da tutuluyor)
  const mrpDoneYMs = useMemo(() => {
    try { return new Set(JSON.parse(localStorage.getItem('uys_mrp_done_ym') || '[]') as string[]) } catch { return new Set<string>() }
  }, [sonuc]) // sonuc değişince yeniden oku

  const aktifOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.durum === 'Tamamlandı' || o.durum === 'tamamlandi' || o.durum === 'İptal' || o.durum === 'iptal') return false
      if (!showTamamlanan && (o.mrpDurum === 'tamam' || o.mrpDurum === 'tamamlandi')) return false
      // MRP tamamlanmış siparişleri varsayılan olarak gizle
      // Gerçek ilerlemeye bak — %100 ise gösterme
      const wos = workOrders.filter(w => w.orderId === o.id)
      if (!wos.length) return true // İE yoksa göster (henüz oluşturulmamış)
      const total = wos.reduce((a, w) => a + w.hedef, 0)
      const done = wos.reduce((a, w) => a + logs.filter(l => l.woId === w.id).reduce((s, l) => s + l.qty, 0), 0)
      return total <= 0 || done < total
    }).sort((a, b) => (a.termin || '').localeCompare(b.termin || ''))
  }, [orders, workOrders, logs, showTamamlanan])

  // MRP tamamlanmış ama hâlâ aktif sipariş sayısı (toggle label için)
  const mrpTamamSayisi = useMemo(() =>
    orders.filter(o => (o.mrpDurum === 'tamam' || o.mrpDurum === 'tamamlandi') && o.durum !== 'Tamamlandı' && o.durum !== 'tamamlandi' && o.durum !== 'İptal' && o.durum !== 'iptal').length
  , [orders])

  // Bağımsız YM İE'leri — MRP yapılmışları varsayılan gizle
  const ymIEs = useMemo(() =>
    workOrders.filter(w => {
      if (!w.bagimsiz || w.durum === 'iptal') return false
      if (logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0) >= w.hedef) return false
      if (!showYMTamamlanan && mrpDoneYMs.has(w.id)) return false
      return true
    }),
    [workOrders, logs, showYMTamamlanan, mrpDoneYMs])

  const ymTamamSayisi = useMemo(() =>
    workOrders.filter(w => w.bagimsiz && w.durum !== 'iptal' && mrpDoneYMs.has(w.id) &&
      logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0) < w.hedef
    ).length
  , [workOrders, logs, mrpDoneYMs])

  function toggleOrder(id: string) { setSelectedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleYM(id: string) { setSelectedYMs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function selectAll() { setSelectedOrders(new Set(aktifOrders.map(o => o.id))); setSelectedYMs(new Set(ymIEs.map(w => w.id))) }
  function selectNone() { setSelectedOrders(new Set()); setSelectedYMs(new Set()) }

  // Tarih filtre: termini bu tarihe kadar olan siparişleri seç
  function filterByDate(tarih: string) {
    if (!tarih) { selectAll(); return }
    const secilen = aktifOrders.filter(o => !o.termin || o.termin <= tarih)
    setSelectedOrders(new Set(secilen.map(o => o.id)))
    toast.info(secilen.length + ' sipariş seçildi (termin ≤ ' + tarih + ')')
  }

  function orderPct(orderId: string) {
    const wos = workOrders.filter(w => w.orderId === orderId)
    if (!wos.length) return 0
    const total = wos.reduce((a, w) => a + w.hedef, 0)
    const done = wos.reduce((a, w) => a + logs.filter(l => l.woId === w.id).reduce((s, l) => s + l.qty, 0), 0)
    return total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0
  }

  // Kesim planı eksik uyarısı
  const kesimEksik = useMemo(() => {
    if (!selectedOrders.size) return 0
    const kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH']
    const planliWoIds = new Set(cuttingPlans.flatMap(p => (p.satirlar || []).flatMap((s: any) => (s.kesimler || []).map((k: any) => k.woId))))
    return workOrders.filter(w => {
      if (!selectedOrders.has(w.orderId)) return false
      if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false
      if (planliWoIds.has(w.id)) return false
      return kesimOps.some(k => (w.opAd || '').toUpperCase().includes(k))
    }).length
  }, [selectedOrders, workOrders, cuttingPlans])

  async function hesapla() {
    if (!selectedOrders.size && !selectedYMs.size) { toast.error('Sipariş veya YM İE seçin'); return }
    const ordIds = [...selectedOrders]
    const cpMapped = cuttingPlans.map((p: any) => ({
      hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
      gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
    }))
    const ymSet = selectedYMs.size > 0 ? selectedYMs : null
    const result = hesaplaMRP(ordIds, orders as any, workOrders, recipes, stokHareketler, tedarikler, cpMapped, materials, ymSet)
    setSonuc(result)
    setHesaplandi(true)

    // Seçili siparişlerin mrp_durum'unu güncelle (sonuca göre tamam/eksik)
    const yeniDurum = result.some(r => r.net > 0) ? 'eksik' : 'tamam'
    for (const oid of ordIds) {
      await supabase.from('uys_orders').update({ mrp_durum: yeniDurum }).eq('id', oid)
    }
    // Seçili YM İE'leri MRP tamamlandı olarak işaretle
    if (selectedYMs.size > 0) {
      const prev = new Set(JSON.parse(localStorage.getItem('uys_mrp_done_ym') || '[]') as string[])
      selectedYMs.forEach(id => prev.add(id))
      localStorage.setItem('uys_mrp_done_ym', JSON.stringify([...prev]))
    }
    if (ordIds.length) loadAll()

    toast.success(result.length + ' kalem hesaplandı · ' + result.filter(r => r.durum === 'eksik').length + ' eksik')
  }

  const eksikler = sonuc.filter(s => s.net > 0)
  const yeterliler = sonuc.filter(s => s.net <= 0)

  async function topluTedarikOlustur() {
    const secili = sonuc.filter(s => selectedRows.has(s.malkod) && s.net > 0)
    if (!secili.length) { toast.error('Tedarik oluşturulacak malzeme seçin'); return }
    if (!await showConfirm(`${secili.length} malzeme için tedarik oluşturulacak. Devam?`)) return
    let count = 0
    for (const s of secili) {
      // Aynı malkod için zaten açık tedarik var mı?
      const mevcut = tedarikler.find(t => t.malkod === s.malkod && !t.geldi)
      if (mevcut) { toast.info(s.malkod + ' için zaten açık tedarik var — atlandı'); continue }
      await supabase.from('uys_tedarikler').insert({
        id: uid(), malkod: s.malkod, malad: s.malad, miktar: Math.ceil(s.net),
        birim: s.birim || 'Adet', tarih: today(), durum: 'bekliyor', geldi: false, not_: 'MRP önerisi',
      })
      count++
    }
    // Seçili siparişleri 'tamam' yap — MRP akışı kapandı (eksik → tedarik oluşturuldu)
    for (const oid of selectedOrders) {
      await supabase.from('uys_orders').update({ mrp_durum: 'tamam' }).eq('id', oid)
    }
    loadAll(); setSelectedRows(new Set())
    toast.success(count + ' tedarik oluşturuldu')
  }

  function exportExcel() {
    if (!sonuc.length) return
    import('xlsx').then(XLSX => {
      const rows = sonuc.map(s => ({
        'Malzeme Kodu': s.malkod, 'Malzeme Adı': s.malad, 'Tip': s.tip || '', 'Termin': s.termin || '',
        'Brüt İhtiyaç': Math.round(s.brut * 100) / 100, 'Stok': Math.round(s.stok * 100) / 100,
        'Açık Tedarik': Math.round(s.acikTedarik * 100) / 100,
        'Net İhtiyaç': Math.round(s.net * 100) / 100,
        'Durum': s.durum, 'Birim': s.birim || 'Adet',
      }))
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'MRP'); XLSX.writeFile(wb, `mrp_raporu_${today()}.xlsx`)
      toast.success('MRP Excel indirildi')
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">📊 MRP — Malzeme İhtiyaç Planlaması</h1>
          <p className="text-xs text-zinc-500">{aktifOrders.length} aktif sipariş · {ymIEs.length} YM İE</p></div>
        {hesaplandi && <div className="flex gap-2">
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> MRP Excel</button>
          {eksikler.length > 0 && <button onClick={() => {
            import('xlsx').then(XLSX => {
              const rows = eksikler.map(s => ({
                'Malzeme Kodu': s.malkod, 'Sipariş Miktarı': Math.ceil(s.net),
                'Beklenen Tarih': s.termin || '', 'Tedarikçi': '',
                '(Bilgi) Malzeme Adı': s.malad, '(Bilgi) Net İhtiyaç': Math.ceil(s.net),
                '(Bilgi) Mevcut Stok': Math.round(s.stok),
              }))
              const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
              ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 40 }, { wch: 14 }, { wch: 14 }]
              XLSX.utils.book_append_sheet(wb, ws, 'Tedarik')
              XLSX.writeFile(wb, `tedarik_mrp_${today()}.xlsx`)
              toast.success('Tedarik şablonu indirildi — Beklenen Tarih ve Tedarikçi doldurup Tedarik sayfasından yükleyin')
            })
          }} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber/10 border border-amber/25 text-amber rounded-lg text-xs hover:bg-amber/20"><Download size={13} /> Tedarik Şablonu ({eksikler.length})</button>}
        </div>}
      </div>

      {/* Sipariş Seçimi */}
      <div className="bg-bg-2 border border-border rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-zinc-500 uppercase">Siparişler</div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-zinc-500">Termin ≤</label>
              <input type="date" onChange={e => filterByDate(e.target.value)} className="px-2 py-1 bg-bg-3 border border-border rounded text-[10px] text-zinc-300 focus:outline-none focus:border-accent" />
            </div>
            <button onClick={selectAll} className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">Tümünü Seç</button>
            <button onClick={selectNone} className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">Hiçbirini</button>
            {mrpTamamSayisi > 0 && (
              <button onClick={() => setShowTamamlanan(!showTamamlanan)}
                className={`px-2 py-1 rounded text-[10px] ${showTamamlanan ? 'bg-green/10 text-green border border-green/20' : 'bg-bg-3 text-zinc-500 hover:text-white'}`}>
                {showTamamlanan ? `✓ Tamamlananlar (${mrpTamamSayisi})` : `+ Tamamlananlar (${mrpTamamSayisi})`}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto">
          {aktifOrders.map(o => {
            const sel = selectedOrders.has(o.id); const pct = orderPct(o.id)
            const mrpDone = o.mrpDurum === 'tamam' || o.mrpDurum === 'tamamlandi'
            return (
              <button key={o.id} onClick={() => toggleOrder(o.id)}
                className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${sel ? 'bg-accent/10 border border-accent/30' : mrpDone ? 'bg-green/5 border border-green/15' : 'bg-bg-3 border border-border'}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={sel} readOnly className="accent-accent" />
                  <span className="font-mono font-medium">{o.siparisNo}</span>
                  {mrpDone && <span className="px-1 py-0.5 bg-green/10 text-green rounded text-[9px]">MRP ✓</span>}
                  <span className="text-zinc-500 ml-auto">{pct}%</span>
                </div>
                <div className="text-zinc-500 truncate mt-0.5">{o.musteri} · {o.mamulAd || ''}</div>
              </button>
            )
          })}
        </div>
        {aktifOrders.length === 0 && mrpTamamSayisi > 0 && !showTamamlanan && (
          <div className="p-3 text-center text-xs text-green">✓ Tüm siparişlerin MRP hesabı yapıldı. Tekrar hesaplamak için "Tamamlananlar" butonuna tıklayın.</div>
        )}

        {/* Bağımsız YM İş Emirleri */}
        {(ymIEs.length > 0 || ymTamamSayisi > 0) && (<>
          <div className="text-xs font-semibold text-zinc-500 uppercase mt-3 mb-2 flex items-center gap-2">
            Bağımsız YM İş Emirleri
            <button onClick={() => setSelectedYMs(prev => prev.size === ymIEs.length ? new Set() : new Set(ymIEs.map(w => w.id)))} className="text-[10px] text-amber font-normal hover:text-white">
              {selectedYMs.size === ymIEs.length && ymIEs.length > 0 ? 'Hiçbirini' : 'Tümünü Seç'}
            </button>
            {ymTamamSayisi > 0 && (
              <button onClick={() => setShowYMTamamlanan(!showYMTamamlanan)}
                className={`text-[10px] font-normal ${showYMTamamlanan ? 'text-green' : 'text-zinc-500 hover:text-white'}`}>
                {showYMTamamlanan ? `✓ Tamamlananlar (${ymTamamSayisi})` : `+ Tamamlananlar (${ymTamamSayisi})`}
              </button>
            )}
          </div>
          {ymIEs.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto">
            {ymIEs.map(w => {
              const sel = selectedYMs.has(w.id)
              const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
              const pct = w.hedef > 0 ? Math.min(100, Math.round(prod / w.hedef * 100)) : 0
              return (
                <button key={w.id} onClick={() => toggleYM(w.id)}
                  className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${sel ? 'bg-amber/10 border border-amber/30' : mrpDoneYMs.has(w.id) ? 'bg-green/5 border border-green/15' : 'bg-bg-3 border border-border'}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={sel} readOnly className="accent-amber" />
                    <span className="font-mono font-medium text-amber">{w.ieNo}</span>
                    {mrpDoneYMs.has(w.id) && <span className="px-1 py-0.5 bg-green/10 text-green rounded text-[9px]">MRP ✓</span>}
                    <span className="text-zinc-500 ml-auto">{pct}%</span>
                  </div>
                  <div className="text-zinc-500 truncate mt-0.5">{w.malad} · {w.hedef - prod} kalan</div>
                </button>
              )
            })}
          </div>
          ) : (
            <div className="p-2 text-center text-xs text-green">✓ Tüm YM İE'lerin MRP hesabı yapıldı.</div>
          )}
        </>)}

        <div className="flex items-center gap-3 mt-3">
          <button onClick={hesapla} disabled={!can('mrp_calc') || (!selectedOrders.size && !selectedYMs.size)}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
            Hesapla →
          </button>
          <span className="text-xs text-zinc-500">{selectedOrders.size} sipariş{selectedYMs.size > 0 ? ` · ${selectedYMs.size} YM İE` : ''} seçili</span>
        </div>
      </div>

      {/* Kesim Uyarısı */}
      {kesimEksik > 0 && (
        <div className="mb-4 p-3 bg-red/5 border border-red/20 rounded-lg text-xs text-red">
          🚫 <strong>{kesimEksik} kesim İE'si</strong> için kesim planı oluşturulmamış. MRP sonuçları eksik olabilir — önce Kesim Planları sayfasından plan oluşturun.
        </div>
      )}

      {/* Sonuç */}
      {hesaplandi && (
        <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <button onClick={() => setViewFilter(viewFilter === 'eksik' ? 'tum' : 'eksik')} className={`px-2 py-1 rounded text-[10px] font-semibold ${viewFilter === 'eksik' ? 'bg-red text-white' : 'bg-red/10 text-red hover:bg-red/20'}`}>⚠ {eksikler.length} eksik</button>
            <button onClick={() => setViewFilter(viewFilter === 'yeterli' ? 'tum' : 'yeterli')} className={`px-2 py-1 rounded text-[10px] font-semibold ${viewFilter === 'yeterli' ? 'bg-green text-white' : 'bg-green/10 text-green hover:bg-green/20'}`}>✓ {yeterliler.length} yeterli</button>
            <span className="flex-1" />
            {selectedRows.size > 0 && (
              <button onClick={topluTedarikOlustur} className="px-3 py-1.5 bg-accent text-white rounded-lg text-[10px] font-semibold">
                + Toplu Tedarik ({selectedRows.size})
              </button>
            )}
            <button onClick={() => setSelectedRows(new Set(eksikler.map(s => s.malkod)))} className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">☑ Eksikleri Seç</button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500">
                <th className="px-2 py-2 w-6"><input type="checkbox" onChange={e => setSelectedRows(e.target.checked ? new Set(eksikler.map(s => s.malkod)) : new Set())} className="accent-accent" /></th>
                <th className="text-left px-3 py-2">Malzeme Kodu</th><th className="text-left px-3 py-2">Malzeme Adı</th><th className="text-left px-3 py-2">Tip</th>
                <th className="text-right px-3 py-2">Brüt</th><th className="text-right px-3 py-2">Stok</th><th className="text-right px-3 py-2">Açık Ted.</th>
                <th className="text-right px-3 py-2">Net</th><th className="text-left px-3 py-2">Termin</th><th className="text-left px-3 py-2">Durum</th><th className="px-3 py-2"></th>
              </tr></thead>
              <tbody>
                {sonuc.filter(s => viewFilter === 'tum' ? true : viewFilter === 'eksik' ? s.net > 0 : s.net <= 0).map(s => {
                  const color = s.durum === 'yeterli' ? 'text-green' : s.durum === 'eksik' ? 'text-amber' : 'text-red'
                  return (
                    <tr key={s.malkod} className="border-b border-border/30 hover:bg-bg-3/30">
                      <td className="px-2 py-1.5">{s.durum !== 'yeterli' && <input type="checkbox" checked={selectedRows.has(s.malkod)} onChange={() => setSelectedRows(prev => { const n = new Set(prev); n.has(s.malkod) ? n.delete(s.malkod) : n.add(s.malkod); return n })} className="accent-accent" />}</td>
                      <td className="px-3 py-1.5 font-mono text-accent text-[11px]">{s.malkod}</td>
                      <td className="px-3 py-1.5 text-zinc-300">{s.malad}</td>
                      <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 bg-bg-3 rounded text-[9px] text-zinc-500">{s.tip || '—'}</span></td>
                      <td className="px-3 py-1.5 text-right font-mono">{Math.round(s.brut)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-green">{Math.round(s.stok)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-cyan-400">{s.acikTedarik > 0 ? Math.round(s.acikTedarik) : '—'}</td>
                      <td className={`px-3 py-1.5 text-right font-mono font-semibold ${color}`}>{Math.round(s.net)}</td><td className={`px-3 py-1.5 font-mono text-[11px] ${s.termin && s.termin < today() ? "text-red font-semibold" : "text-zinc-400"}`}>{s.termin || "-"}</td>
                      <td className={`px-3 py-1.5 font-semibold ${color}`}>{s.durum === 'yeterli' ? '✓ Yeterli' : '⚠ Eksik'}</td>
                      <td className="px-3 py-1.5">{s.durum !== 'yeterli' && (
                        <button onClick={async () => {
                          const mevcut = tedarikler.find(t => t.malkod === s.malkod && !t.geldi)
                          if (mevcut) { toast.info('Zaten açık tedarik var'); return }
                          await supabase.from('uys_tedarikler').insert({
                            id: uid(), malkod: s.malkod, malad: s.malad, miktar: Math.ceil(s.net),
                            birim: s.birim || 'Adet', tarih: today(), teslim_tarihi: s.termin || null, durum: 'bekliyor', geldi: false, not_: 'MRP',
                          })
                          // Secili siparislerin mrp_durum'unu 'tamam' yap (MRP akisi kapandi)
                          for (const oid of selectedOrders) {
                            await supabase.from('uys_orders').update({ mrp_durum: 'tamam' }).eq('id', oid)
                          }
                          loadAll(); toast.success('Tedarik oluşturuldu: ' + s.malkod)
                        }} className="px-2 py-0.5 bg-accent/10 text-accent rounded text-[10px] hover:bg-accent/20">+ Tedarik</button>
                      )}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
