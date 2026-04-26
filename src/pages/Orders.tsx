import { useAuth } from '@/hooks/useAuth'
import { logAction } from '@/lib/activityLog'
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { buildWorkOrders, autoZincir } from '@/features/production/autoChain'
import { hesaplaMRP, mrpTedarikOlustur, rezerveYaz, rezerveSil, rezerveleriSenkronla, siparisSilKapsamli, cuttingPlanTemizle } from '@/features/production/mrp'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today, pctColor } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Plus, Search, Download, Trash2, Eye, Pencil, Calculator, Copy, Upload, ArrowUp, ArrowDown, X } from 'lucide-react'
import type { Order, OrderItem } from '@/types'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { RecipeSearchModal } from '@/components/RecipeSearchModal'
import { startFlow, advanceFlow } from '@/lib/pendingFlow'

// Tüm aktif siparişlerin rezervelerini termin-FIFO ile yeniden hesaplar.
// Sipariş ekleme/revize/silme/kapatma, toplu MRP, tedarik değişimi sonrası çağrılmalı.
// Store'dan taze veri okur — loadAll()'dan SONRA çağır.
async function triggerRezerveSync() {
  const s = useStore.getState()
  const cpMapped = s.cuttingPlans.map((p: any) => ({
    hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
    gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
  }))
  try {
    await rezerveleriSenkronla(
      s.orders as any, s.workOrders, s.recipes,
      s.stokHareketler, s.tedarikler, cpMapped, s.materials
    )
    // Store'u tekrar yükle ki UI rezerve değişikliklerini görsün
    await s.loadAll()
  } catch (e) {
    console.error('[Orders] rezerve senkron hatası:', e)
  }
}

export function Orders() {
  const { orders, workOrders, logs, recipes, cuttingPlans, materials, pendingFlows, loadAll } = useStore()
  const { can, isGuest, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlFlowId = searchParams.get('flow') || ''
  const urlMrpFilter = searchParams.get('mrp') || ''  // v15.49a — Topbar MRP badge'inden ?mrp=eksik
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [mrpFilter, setMrpFilter] = useState(urlMrpFilter === 'eksik' ? 'eksik' : 'all')
  // v15.49a — URL'den geldiyse filtreyi uygula (dropdown da senkron olur)
  useEffect(() => {
    if (urlMrpFilter === 'eksik' && mrpFilter !== 'eksik') {
      setMrpFilter('eksik')
    }
  }, [urlMrpFilter])
  const [showForm, setShowForm] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selIds, setSelIds] = useState<Set<string>>(new Set())
  const [showBulkImport, setShowBulkImport] = useState(false)

  // v15.36 — Aktif yarım iş kontrolü (yeni sipariş tıklarken uyarı için)
  const myUserId = user?.dbId || user?.email || user?.username || ''
  const myActiveFlow = pendingFlows.find(f =>
    f.durum === 'aktif' &&
    (f.userId === myUserId || f.userId === user?.username || f.userId === user?.email)
  )

  function handleNewOrderClick() {
    // Yeni sipariş tıklandı — aktif flow varsa uyar
    if (myActiveFlow && !urlFlowId) {
      toast.warning(
        `Tamamlanmamış akış var: ${myActiveFlow.stateData.baslik || 'Sipariş akışı'} (${myActiveFlow.currentStep}). ` +
        `Önce onu tamamla veya Topbar'dan iptal et.`,
        { duration: 6000 }
      )
      return
    }
    setEditOrder(null); setShowForm(true)
  }

  // v15.36 — Flow akışında "Yeni Sipariş Ekle" ile gelindi → formu otomatik aç
  useEffect(() => {
    if (urlFlowId && !showForm) {
      setEditOrder(null)
      setShowForm(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFlowId])

  function selToggle(id: string) { setSelIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s }) }

  async function selDeleteAll() {
    if (!selIds.size) return
    if (!await showConfirm(`${selIds.size} sipariş SİLİNECEK.\n\nHer sipariş için İE + kesim plan + açık tedarik + rezerve temizlenecek. Üretim başlamışsa ayrıca onay sorulacak. Devam?`)) return

    const s = useStore.getState()
    let basariSayac = 0
    let iptalSayac = 0
    let hataSayac = 0

    for (const id of selIds) {
      let result = await siparisSilKapsamli(id, { workOrders: s.workOrders, logs: s.logs, cuttingPlans: s.cuttingPlans as any })
      if (!result.ok && result.hata === 'Siparişte üretim başlamış') {
        const d = result.detay!
        const order = orders.find(o => o.id === id)
        const devam = await showConfirm(`⚠ ${order?.siparisNo || id}: ÜRETİM BAŞLAMIŞ (${d.kayitSayisi} kayıt · ${d.toplamMiktar} adet). Yine de silinsin mi?`)
        if (!devam) { iptalSayac++; continue }
        result = await siparisSilKapsamli(id, { workOrders: s.workOrders, logs: s.logs, cuttingPlans: s.cuttingPlans as any }, { force: true })
      }
      if (result.ok) basariSayac++
      else hataSayac++
    }

    setSelIds(new Set())
    await loadAll()
    await triggerRezerveSync()
    toast.success(`${basariSayac} sipariş silindi${iptalSayac ? ` · ${iptalSayac} iptal` : ''}${hataSayac ? ` · ${hataSayac} hata` : ''}`)
  }

  function orderPct(orderId: string): number {
    const wos = workOrders.filter(w => w.orderId === orderId)
    if (!wos.length) return 0
    const total = wos.reduce((s, w) => {
      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
      return s + (w.hedef > 0 ? Math.min(100, prod / w.hedef * 100) : 0)
    }, 0)
    return Math.round(total / wos.length)
  }

  // Siparişin en yakın termini — kalemlerden alınır, yoksa ana termin
  function orderNearestTermin(o: Order): string {
    const terminler = (o.urunler || []).map(u => u.termin).filter(Boolean) as string[]
    if (terminler.length) return terminler.slice().sort()[0]
    return o.termin || ''
  }

  function orderUniqueTerminCount(o: Order): number {
    const set = new Set((o.urunler || []).map(u => u.termin).filter(Boolean))
    return set.size
  }

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (search) { const q = search.toLowerCase(); if (!(o.siparisNo + o.musteri + o.mamulAd).toLowerCase().includes(q)) return false }
      // v15.49a — MRP filtresi (Topbar badge'inden geliyor olabilir)
      if (mrpFilter === 'eksik') {
        // 'tamam' veya 'tamamlandi' = MRP yapılmış. Diğer her şey eksik sayılır.
        // Kapalı siparişler MRP eksik bile olsa gündemde değil; bu filtrede gizle.
        const mrpDone = o.mrpDurum === 'tamam' || o.mrpDurum === 'tamamlandi'
        if (mrpDone) return false
        if (o.durum === 'kapalı') return false
      } else if (mrpFilter === 'tamam') {
        if (!(o.mrpDurum === 'tamam' || o.mrpDurum === 'tamamlandi')) return false
      }
      const nearT = orderNearestTermin(o)
      if (statusFilter === 'active') return o.durum !== 'kapalı' && orderPct(o.id) < 100
      if (statusFilter === 'done') return orderPct(o.id) >= 100
      if (statusFilter === 'late') return o.durum !== 'kapalı' && nearT && nearT < today() && orderPct(o.id) < 100
      if (statusFilter === 'closed') return o.durum === 'kapalı'
      return o.durum !== 'kapalı'
    })
  }, [orders, search, statusFilter, mrpFilter, workOrders, logs])

  async function copyOrder(o: Order) {
    const newId = uid()
    const { error } = await supabase.from('uys_orders').insert({
      id: newId, siparis_no: o.siparisNo + '-KOPYA', musteri: o.musteri, tarih: today(), termin: o.termin,
      mamul_kod: o.mamulKod, mamul_ad: o.mamulAd, adet: o.adet, recete_id: o.receteId,
      urunler: o.urunler || [], mrp_durum: 'bekliyor', olusturma: today(),
    })
    if (!error) { loadAll(); toast.success('Sipariş kopyalandı: ' + o.siparisNo + '-KOPYA') }
  }
  async function deleteOrder(id: string) {
    const order = orders.find(o => o.id === id)
    if (!order) return
    if (!await showConfirm(`"${order.siparisNo}" siparişini silmek istediğinize emin misiniz?\n\nİş emirleri, kesim plan kesimleri, açık tedarikler ve rezerveler temizlenecek. Gelmiş malzemeler serbest stokta kalacak.`)) return

    const s = useStore.getState()
    let result = await siparisSilKapsamli(id, { workOrders: s.workOrders, logs: s.logs, cuttingPlans: s.cuttingPlans as any })

    // Üretim başladıysa: kullanıcıya onay sor, force ile tekrar dene
    if (!result.ok && result.hata === 'Siparişte üretim başlamış') {
      const d = result.detay!
      const devam = await showConfirm(
        `⚠ ÜRETİM BAŞLAMIŞ\n\n${d.kayitSayisi} üretim kaydı · toplam ${d.toplamMiktar} adet üretilmiş.\n\n` +
        `Üretim logları ve stok hareketleri KORUNACAK — sadece sipariş, İE ve plan kayıtları silinecek.\n\n` +
        `Yine de silmek istiyor musunuz?`
      )
      if (!devam) return
      result = await siparisSilKapsamli(id, { workOrders: s.workOrders, logs: s.logs, cuttingPlans: s.cuttingPlans as any }, { force: true })
    }

    if (!result.ok) { toast.error('Silme hatası: ' + (result.hata || 'bilinmeyen')); return }

    logAction('Sipariş silindi', id)
    await loadAll()
    await triggerRezerveSync()

    const o = result.ozet!
    toast.success(
      `Sipariş silindi — ${o.silinenIE} İE, ${o.guncellenenPlan + o.silinenPlan} plan etkilendi, ${o.silinenAcikTedarik} açık tedarik silindi, ${o.kopanGelmisTedarik} gelmiş tedarik serbest`
    )
  }

  async function topluMRP() {
    const { recipes: fullRecipes, stokHareketler, tedarikler, workOrders: wos, cuttingPlans: cp, materials: mats, mrpRezerve } = useStore.getState()
    const hedefOrders = selIds.size > 0
      ? orders.filter(o => selIds.has(o.id))
      : orders.filter(o => orderPct(o.id) < 100 && ((o.urunler && o.urunler.length > 0 && o.urunler.some(u => u.rcId)) || o.receteId))

    if (!hedefOrders.length) { toast.error('MRP çalıştırılacak sipariş yok'); return }
    if (!await showConfirm(`${hedefOrders.length} sipariş için MRP çalıştırılacak. Devam?`)) return

    const ordIds = hedefOrders.map(o => o.id)
    const cpMapped = cp.map((p: any) => ({ hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '', gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [] }))
    const mrpRows = hesaplaMRP(ordIds, orders as any, wos, fullRecipes, stokHareketler, tedarikler, cpMapped, mats, null, mrpRezerve)
    const count = await mrpTedarikOlustur(ordIds[0] || '', hedefOrders[0]?.siparisNo || '', mrpRows)

    // Her siparişin kendi durumunu ayrı ayrı hesapla ve yaz
    for (const o of hedefOrders) {
      const tekMrpRows = hesaplaMRP([o.id], orders as any, wos, fullRecipes, stokHareketler, tedarikler, cpMapped, mats, null, mrpRezerve, o.id)
      const yeniDurum = tekMrpRows.some(r => r.net > 0) ? 'eksik' : 'tamam'
      await supabase.from('uys_orders').update({ mrp_durum: yeniDurum }).eq('id', o.id)
      // Rezerve kayıtları yaz
      await rezerveYaz(o.id, tekMrpRows)
    }
    loadAll()
    await triggerRezerveSync()
    toast.success(`${hedefOrders.length} sipariş için MRP tamamlandı — ${count} tedarik oluşturuldu`)
  }

  function downloadTemplate() {
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet([{ 'Sipariş No': 'SIP-001', 'Müşteri': 'ABC Ltd', 'Termin': '2026-05-01', 'Adet': 100, 'Mamul Kod': '', 'Mamul Ad': '' }])
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Siparişler')
      XLSX.writeFile(wb, 'siparis_sablonu.xlsx')
    })
  }

  async function oncelikDegistir(orderId: string, delta: number) {
    const order = orders.find(o => o.id === orderId)
    if (!order) return
    await supabase.from('uys_orders').update({ oncelik: (order.oncelik || 0) + delta }).eq('id', orderId)
    loadAll()
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(o => {
        const kCount = (o.urunler || []).length
        const urun = kCount > 1 ? `${o.mamulAd || o.mamulKod} +${kCount - 1}` : (o.mamulAd || o.mamulKod)
        return { 'Sipariş No': o.siparisNo, 'Müşteri': o.musteri, 'Tarih': o.tarih, 'Termin': orderNearestTermin(o), 'Ürün': urun, 'Adet': o.adet, 'İlerleme': orderPct(o.id) + '%' }
      })
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Siparişler'); XLSX.writeFile(wb, `siparisler_${today()}.xlsx`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Siparişler</h1><p className="text-xs text-zinc-500">{orders.length} sipariş{isGuest ? ' (salt okunur)' : ''}</p></div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white" title="Şablon indir"><Download size={13} /> Şablon</button>
          {can('orders_add') && <button onClick={() => setShowBulkImport(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Upload size={13} /> Excel Yükle</button>}
          {can('orders_mrp') && <button onClick={topluMRP} className="flex items-center gap-1.5 px-3 py-1.5 bg-green/10 border border-green/25 text-green rounded-lg text-xs hover:bg-green/20"><Calculator size={13} /> Toplu MRP</button>}
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          {can('orders_add') && <button onClick={handleNewOrderClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Sipariş</button>}
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sipariş no veya müşteri ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="all">Tümü</option><option value="active">Üretimde</option><option value="done">Tamamlandı</option><option value="late">Gecikmeli</option><option value="closed">Kapalı</option>
        </select>
        {/* v15.49a — MRP filtresi (Topbar MRP badge'inden de tetiklenir: ?mrp=eksik) */}
        <select value={mrpFilter} onChange={e => setMrpFilter(e.target.value)} className={`px-3 py-2 border rounded-lg text-xs ${mrpFilter === 'eksik' ? 'bg-red/10 border-red/30 text-red' : mrpFilter === 'tamam' ? 'bg-green/10 border-green/30 text-green' : 'bg-bg-2 border-border text-zinc-300'}`} title="MRP durumuna göre filtrele">
          <option value="all">MRP: Tümü</option>
          <option value="eksik">MRP: Eksik</option>
          <option value="tamam">MRP: Tamam</option>
        </select>
      </div>

      {selIds.size > 0 && (
        <div className="mb-3 p-2 bg-accent/5 border border-accent/20 rounded-lg flex items-center gap-2">
          <span className="text-xs font-semibold text-accent">{selIds.size} seçili</span>
          {can('orders_delete') && <button onClick={selDeleteAll} className="px-2 py-1 bg-red/10 text-red rounded text-[10px]">Toplu Sil</button>}
          <span className="flex-1" />
          <button onClick={() => setSelIds(new Set(filtered.map(o => o.id)))} className="text-[10px] text-zinc-500 hover:text-white">Tümü</button>
          <button onClick={() => setSelIds(new Set())} className="text-[10px] text-zinc-500 hover:text-white">Temizle</button>
        </div>
      )}

      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {filtered.length ? (
          <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="px-2 py-2.5 w-6"><input type="checkbox" onChange={e => e.target.checked ? setSelIds(new Set(filtered.map(o => o.id))) : setSelIds(new Set())} className="accent-accent" /></th><th className="text-left px-4 py-2.5">Sipariş No</th><th className="text-left px-4 py-2.5">Müşteri</th><th className="text-left px-4 py-2.5">Ürün</th><th className="text-right px-4 py-2.5">Adet</th><th className="text-left px-4 py-2.5">Termin</th><th className="text-right px-4 py-2.5">İlerleme</th><th className="text-right px-4 py-2.5">İE</th><th className="text-center px-2 py-2.5">MRP</th><th className="text-center px-2 py-2.5">Sevk</th><th className="px-4 py-2.5"></th></tr></thead>
          <tbody>
            {filtered.map(o => {
              const pct = orderPct(o.id); const woCount = workOrders.filter(w => w.orderId === o.id).length
              const nearT = orderNearestTermin(o)
              const terminCount = orderUniqueTerminCount(o)
              const kalemCount = (o.urunler || []).length
              const isLate = nearT && nearT < today() && pct < 100
              const mrpBadge = (o.mrpDurum === 'tamam' || o.mrpDurum === 'tamamlandi') ? { bg: 'bg-green/10', color: 'text-green', label: '✓' } : o.mrpDurum === 'eksik' ? { bg: 'bg-red/10', color: 'text-red', label: '⚠' } : o.mrpDurum === 'calistirildi' ? { bg: 'bg-amber/10', color: 'text-amber', label: '⚡' } : { bg: 'bg-cyan-500/10', color: 'text-cyan-400', label: '📊' }
              const sevkBadge = o.sevkDurum === 'tamamen_sevk' ? { bg: 'bg-green/10', color: 'text-green', label: '✓ Tamam', title: 'Tamamen sevk edildi' } : o.sevkDurum === 'kismi_sevk' ? { bg: 'bg-amber/10', color: 'text-amber', label: 'Kısmi', title: 'Kısmi sevk edildi' } : { bg: 'bg-bg-3', color: 'text-zinc-600', label: '—', title: 'Sevk yok' }
              return (
                <tr key={o.id} className={`border-b border-border/50 hover:bg-bg-3/50 ${selIds.has(o.id) ? 'bg-accent/5' : ''}`}>
                  <td className="px-2 py-2.5"><input type="checkbox" checked={selIds.has(o.id)} onChange={() => selToggle(o.id)} className="accent-accent" /></td>
                  <td className="px-4 py-2.5"><button onClick={() => setSelectedOrder(o)} className="font-mono text-accent hover:underline">{o.siparisNo}</button></td>
                  <td className="px-4 py-2.5">{o.musteri ? <button onClick={() => setSearch(o.musteri)} className="text-zinc-300 hover:text-accent hover:underline">{o.musteri}</button> : <span className="text-zinc-600">—</span>}</td>
                  <td className="px-4 py-2.5 text-zinc-400 max-w-[220px] truncate">
                    {o.mamulAd || o.mamulKod || '—'}
                    {kalemCount > 1 && <span className="ml-1 text-[10px] px-1 py-0.5 bg-accent/15 text-accent rounded font-semibold">+{kalemCount - 1}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{o.adet}</td>
                  <td className={`px-4 py-2.5 font-mono ${isLate ? 'text-red font-semibold' : 'text-zinc-500'}`}>
                    {nearT || '—'}
                    {terminCount > 1 && <span className="ml-1 text-[10px] text-zinc-500">+{terminCount - 1}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-2"><div className="w-14 h-1.5 bg-bg-3 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${pct}%` }} /></div><span className={`font-mono text-[11px] w-8 text-right ${pctColor(pct)}`}>{pct}%</span></div></td>
                  <td className="px-4 py-2.5 text-right font-mono text-zinc-500">{woCount}</td>
                  <td className="px-2 py-2.5 text-center">{woCount > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${mrpBadge.bg} ${mrpBadge.color}`}>{mrpBadge.label}</span>}</td>
                  <td className="px-2 py-2.5 text-center"><span title={sevkBadge.title} className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${sevkBadge.bg} ${sevkBadge.color}`}>{sevkBadge.label}</span></td>
                  <td className="px-4 py-2.5 text-right"><div className="flex gap-1 justify-end">
                    <button onClick={() => setSelectedOrder(o)} className="p-1 text-zinc-500 hover:text-accent" title="Detay"><Eye size={13} /></button>
                    {can('orders_edit') && <button onClick={() => oncelikDegistir(o.id, 1)} className="p-1 text-zinc-500 hover:text-amber" title="Öncelik artır"><ArrowUp size={11} /></button>}
                    {can('orders_edit') && <button onClick={() => oncelikDegistir(o.id, -1)} className="p-1 text-zinc-500 hover:text-zinc-300" title="Öncelik azalt"><ArrowDown size={11} /></button>}
                    {can('orders_add') && <button onClick={() => copyOrder(o)} className="p-1 text-zinc-500 hover:text-green" title="Kopyala"><Copy size={13} /></button>}
                    {can('orders_edit') && <button onClick={async () => { setEditOrder(o); setShowForm(true) }} className="p-1 text-zinc-500 hover:text-amber" title="Düzenle"><Pencil size={13} /></button>}
                    {can('orders_edit') && <button onClick={async () => {
                      const yeniDurum = o.durum === 'kapalı' ? '' : 'kapalı'
                      await supabase.from('uys_orders').update({ durum: yeniDurum }).eq('id', o.id)
                      // Sipariş kapatıldı — rezerveleri serbest bırak
                      if (yeniDurum === 'kapalı') await rezerveSil(o.id)
                      loadAll(); toast.success(o.siparisNo + (yeniDurum === 'kapalı' ? ' kapatıldı' : ' açıldı'))
                      await triggerRezerveSync()
                    }} className={`p-1 ${o.durum === 'kapalı' ? 'text-green hover:text-green' : 'text-zinc-500 hover:text-amber'}`} title={o.durum === 'kapalı' ? 'Aç' : 'Kapat'}>
                      {o.durum === 'kapalı' ? '🔓' : '🔒'}
                    </button>}
                    {can('orders_delete') && <button onClick={() => deleteOrder(o.id)} className="p-1 text-zinc-500 hover:text-red" title="Sil"><Trash2 size={13} /></button>}
                  </div></td>
                </tr>
              )
            })}
          </tbody></table>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">{search ? 'Arama sonucu bulunamadı' : 'Henüz sipariş yok'}</div>}
      </div>
      {showForm && <OrderFormModal initial={editOrder} recipes={recipes} materials={materials} onClose={() => { setShowForm(false); setEditOrder(null) }} onSaved={async () => { setShowForm(false); setEditOrder(null); loadAll(); toast.success(editOrder ? 'Güncellendi' : 'Oluşturuldu'); await triggerRezerveSync() }} />}
      {showBulkImport && <BulkOrderImportModal existingOrders={orders} recipes={recipes} onClose={() => setShowBulkImport(false)} onComplete={async () => { setShowBulkImport(false); loadAll(); await triggerRezerveSync() }} />}
      {selectedOrder && <OrderDetailModal order={selectedOrder} workOrders={workOrders.filter(w => w.orderId === selectedOrder.id)} logs={logs} onClose={() => setSelectedOrder(null)} />}
    </div>
  )
}

// ═══ OrderFormModal — Çoklu ürün kalemi destekli ═══
function OrderFormModal({ initial, recipes, materials, onClose, onSaved }: {
  initial: Order | null
  recipes: { id: string; rcKod?: string; mamulKod: string; mamulAd: string; ad: string }[]
  materials: any[]
  onClose: () => void
  onSaved: () => void
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeFlowId = searchParams.get('flow') || ''  // Zaten bir flow içindeyse (örn. CuttingPlans'tan geri geldi)
  const { user } = useAuth()
  const [siparisNo, setSiparisNo] = useState(initial?.siparisNo || '')
  const [musteri, setMusteri] = useState(initial?.musteri || '')
  const [genelNot, setGenelNot] = useState(initial?.not || '')

  // Kalem listesi — initial'dan veya boş bir kalemle başla
  const [kalemler, setKalemler] = useState<OrderItem[]>(() => {
    if (initial?.urunler && initial.urunler.length > 0) {
      // Eski kayıtlarda kalem-termin/not olmayabilir — sipariş seviyesinden doldur
      return initial.urunler.map(u => ({
        ...u,
        termin: (u as any).termin || initial.termin || '',
        not: (u as any).not || '',
      }))
    }
    // Çok eski kayıt: urunler[] yok, sadece receteId/adet var
    if (initial?.receteId) {
      return [{
        rcId: initial.receteId,
        mamulKod: initial.mamulKod || '',
        mamulAd: initial.mamulAd || '',
        adet: initial.adet || 1,
        termin: initial.termin || '',
        not: '',
      }]
    }
    return [{ rcId: '', mamulKod: '', mamulAd: '', adet: 1, termin: today(), not: '' }]
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchKalemIdx, setSearchKalemIdx] = useState<number | null>(null)

  const toplamAdet = useMemo(() => kalemler.reduce((s, k) => s + (k.adet || 0), 0), [kalemler])

  function updateKalem(idx: number, patch: Partial<OrderItem>) {
    setKalemler(prev => prev.map((k, i) => i === idx ? { ...k, ...patch } : k))
  }

  function addKalem() {
    // Yeni kalemin varsayılan termini = son eklenenin termini
    const sonTermin = kalemler[kalemler.length - 1]?.termin || today()
    setKalemler(prev => [...prev, { rcId: '', mamulKod: '', mamulAd: '', adet: 1, termin: sonTermin, not: '' }])
  }

  function removeKalem(idx: number) {
    if (kalemler.length <= 1) return
    setKalemler(prev => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    if (!siparisNo.trim()) { setError('Sipariş No zorunlu'); return }
    if (!kalemler.length) { setError('En az bir ürün kalemi olmalı'); return }

    for (let i = 0; i < kalemler.length; i++) {
      const k = kalemler[i]
      if (!k.rcId) { setError(`${i + 1}. kalem için ürün / reçete seçilmedi`); return }
      if (!k.termin) { setError(`${i + 1}. kalem termini boş`); return }
      if (!k.adet || k.adet < 1) { setError(`${i + 1}. kalem adedi 1'den küçük`); return }
      // v15.36 — Sıkı reçete kontrolü: reçete gerçekten var ve satırlı mı?
      const rc = recipes.find(r => r.id === k.rcId)
      if (!rc) { setError(`${i + 1}. kalem: "${k.mamulAd || k.mamulKod}" için reçete bulunamadı — silinmiş olabilir`); return }
      if (!rc.satirlar?.length) { setError(`${i + 1}. kalem: "${k.mamulAd || k.mamulKod}" reçetesinde hiç satır yok — reçeteyi tamamla`); return }
    }

    setError('')
    setSaving(true)

    const ilk = kalemler[0]
    const terminler = kalemler.map(k => k.termin).filter(Boolean).slice().sort()
    const enYakinTermin = terminler[0] || ''

    const row = {
      siparis_no: siparisNo.trim(),
      musteri: musteri.trim(),
      termin: enYakinTermin,
      mamul_kod: ilk.mamulKod,
      mamul_ad: ilk.mamulAd,
      recete_id: ilk.rcId,
      adet: toplamAdet,
      not_: genelNot,
      urunler: kalemler,
    }

    const { recipes: fullRecipes, workOrders: allWos, cuttingPlans: allPlans } = useStore.getState()

    let createdOrderId = ''  // v15.36: yeni sipariş için DB id — flow state'ine yazılacak

    if (initial?.id) {
      // Güncelleme — eski İE'leri sil, her kalem için yeniden üret
      // ÜYSREV2 (v15.29): Önce eski İE'lerin woId'lerini yakala — kesim planı temizliği için.
      // Delete sonrası cuttingPlanTemizle ile orphan kesimleri temizle (§14 Öncelik 1 kapanışı).
      const eskiWoIds = allWos.filter(w => w.orderId === initial.id).map(w => w.id)
      await supabase.from('uys_work_orders').delete().eq('order_id', initial.id)
      const cpResult = await cuttingPlanTemizle(eskiWoIds, allPlans as any)
      await supabase.from('uys_orders').update({ ...row, mrp_durum: 'bekliyor' }).eq('id', initial.id)
      // Sipariş revize oldu — eski rezervasyonları temizle (yeni hesapla tekrar oluşacak)
      await rezerveSil(initial.id)
      let woTotal = 0
      for (const k of kalemler) {
        if (k.rcId) { const c = await buildWorkOrders(initial.id, siparisNo.trim(), k.rcId, k.adet, fullRecipes, k.termin, woTotal); woTotal += c }
      }
      const temizlikNotu = cpResult.temizlenenKesim
        ? ` · ${cpResult.temizlenenKesim} kesim temizlendi${cpResult.silinenPlan ? ` · ${cpResult.silinenPlan} plan silindi` : ''}`
        : ''
      toast.info(woTotal + ' iş emri güncellendi' + temizlikNotu)
    } else {
      const newId = uid()
      createdOrderId = newId
      await supabase.from('uys_orders').insert({ id: newId, ...row, tarih: today(), mrp_durum: 'bekliyor', olusturma: today() })
      let woTotal = 0
      for (const k of kalemler) {
        if (k.rcId) { const c = await buildWorkOrders(newId, siparisNo.trim(), k.rcId, k.adet, fullRecipes, k.termin, woTotal); woTotal += c }
      }
      toast.info(woTotal + ' iş emri oluşturuldu')
    }

    logAction(initial ? 'Sipariş güncellendi' : 'Sipariş oluşturuldu', siparisNo.trim())
    setSaving(false)

    // v15.36 — Yeni sipariş akışı: flow başlat + kesim planına yönlendir
    // Revize/güncelleme için akış başlatma (sadece yeni sipariş)
    if (!initial && user) {
      const userId = user.dbId || user.email || user.username || ''
      const userAd = user.username || ''

      if (activeFlowId) {
        // Zaten bir flow vardı (CuttingPlans'tan "yeni sipariş ekle" ile geldik) → aynı flow kalır
        await advanceFlow(activeFlowId, 'kesim', { siparisNo: siparisNo.trim() })
        toast.success('Sipariş eklendi — kesim planına dönülüyor')
        onSaved()
        navigate('/cutting?flow=' + activeFlowId)
        return
      } else {
        // Yeni flow başlat
        const flow = await startFlow({
          flowType: 'siparis',
          initialStep: 'kesim',
          userId, userAd,
          stateData: { siparisNo: siparisNo.trim(), orderId: createdOrderId, baslik: `Sipariş ${siparisNo.trim()}` },
        })
        if (flow) {
          toast.success('Sipariş oluşturuldu — kesim planına yönlendiriliyor')
          onSaved()
          navigate('/cutting?flow=' + flow.id)
          return
        }
      }
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">{initial ? 'Sipariş Düzenle' : 'Yeni Sipariş'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="p-2 bg-red/10 border border-red/25 rounded text-xs text-red">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Sipariş No *</label>
              <input value={siparisNo} onChange={e => setSiparisNo(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Müşteri</label>
              {(() => {
                const { customers, orders: allOrders } = useStore.getState()
                const musteriSet = new Set([...customers.map(c => c.ad || c.kod), ...allOrders.map(o => o.musteri)].filter(Boolean))
                const opts = [...musteriSet].sort((a, b) => a.localeCompare(b, 'tr')).map(m => ({ value: m, label: m }))
                return <SearchSelect options={opts} value={musteri} onChange={(v) => setMusteri(v)} placeholder="Müşteri ara veya yaz..." allowNew />
              })()}
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Ürünler</h3>
              <span className="text-[11px] text-zinc-500">{kalemler.length} kalem · toplam {toplamAdet} adet</span>
            </div>

            <div className="space-y-2">
              {kalemler.map((k, idx) => (
                <div key={idx} className="p-3 bg-bg-2/50 border border-border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setSearchKalemIdx(idx)}
                      className={`flex-1 text-left px-3 py-2 bg-bg-1 border rounded text-xs hover:border-accent transition-colors ${k.rcId ? 'border-border' : 'border-amber/40'}`}
                    >
                      {k.rcId ? (
                        <>
                          <span className="font-mono text-accent">{k.mamulKod}</span>
                          <span className="text-zinc-400"> · {k.mamulAd}</span>
                        </>
                      ) : (
                        <span className="text-amber">⚠ Ürün/reçete seç... (tıkla)</span>
                      )}
                    </button>
                    {kalemler.length > 1 && (
                      <button onClick={() => removeKalem(idx)}
                        className="p-1.5 text-zinc-500 hover:text-red rounded" title="Kalemi sil">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-[90px_140px_1fr] gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">Adet</label>
                      <input type="number" min={1} value={k.adet}
                        onChange={e => updateKalem(idx, { adet: parseInt(e.target.value) || 1 })}
                        className="w-full px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-right text-zinc-200 focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">Termin *</label>
                      <input type="date" value={k.termin}
                        onChange={e => updateKalem(idx, { termin: e.target.value })}
                        className="w-full px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">Not</label>
                      <input type="text" value={k.not || ''}
                        onChange={e => updateKalem(idx, { not: e.target.value })}
                        placeholder="Opsiyonel..."
                        className="w-full px-2 py-1.5 bg-bg-1 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addKalem}
              className="mt-2 w-full py-2 border border-dashed border-border rounded text-xs text-zinc-400 hover:text-accent hover:border-accent">
              + Ürün kalemi ekle
            </button>
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Sipariş notu (tüm kalemler için)</label>
            <input value={genelNot} onChange={e => setGenelNot(e.target.value)}
              placeholder="Opsiyonel..."
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-bg-2/30">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs disabled:opacity-40">İptal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
            {saving ? 'Kaydediliyor...' : initial ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </div>

      {searchKalemIdx !== null && (
        <RecipeSearchModal
          recipes={recipes as any}
          materials={materials}
          onSelect={(r) => {
            updateKalem(searchKalemIdx, { rcId: r.rcId, mamulKod: r.mamulKod, mamulAd: r.mamulAd })
            setSearchKalemIdx(null)
          }}
          onClose={() => setSearchKalemIdx(null)}
        />
      )}
    </div>
  )
}

function OrderDetailModal({ order, workOrders, logs, onClose }: { order: Order; workOrders: { id: string; ieNo: string; malad: string; malkod: string; opAd: string; hedef: number }[]; logs: { woId: string; qty: number; tarih: string; fire: number; operatorlar: { ad: string }[] }[]; onClose: () => void }) {
  const { recipes, stokHareketler, tedarikler, cuttingPlans: cp, materials: mats, orders: allOrders, workOrders: allWOs, mrpRezerve, loadAll } = useStore()
  const { can, user } = useAuth()
  const [tab, setTab] = useState<'ie' | 'mrp'>('ie')
  const [mrpRows, setMrpRows] = useState<ReturnType<typeof hesaplaMRP>>([])
  const [mrpDone, setMrpDone] = useState(false)
  // v15.50b — Son MRP run snapshot id (uys_mrp_calculations.id).
  // Tedarik insert'lerinde mrp_calculation_id alanına yazılır → audit/raporlama için bağ.
  const [lastCalcId, setLastCalcId] = useState<string | null>(null)

  const kalemler = order.urunler || []
  const cokKalem = kalemler.length > 1

  async function runMRP() {
    const cpMapped = cp.map((p: any) => ({ hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '', gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [] }))
    const rows = hesaplaMRP([order.id], allOrders as any, allWOs, recipes, stokHareketler, tedarikler, cpMapped, mats, null, mrpRezerve, order.id)
    setMrpRows(rows); setMrpDone(true); setTab('mrp')

    // v15.50b — uys_mrp_calculations snapshot insert (Tip C, §18.2 uyumlu).
    // JSONB formatı: {malkod: miktar}. Aynı malkod birden fazla termin satırı olabilir
    // (v15.50a termin gruplama) → toplam alınır.
    const calcId = uid()
    const brut: Record<string, number> = {}
    const stok: Record<string, number> = {}
    const acik: Record<string, number> = {}
    const net:  Record<string, number> = {}
    for (const r of rows) {
      brut[r.malkod] = (brut[r.malkod] || 0) + r.brut
      // stok ve acik aynı malkod için tüm termin satırlarında aynı (pool tek tahsisten)
      stok[r.malkod] = r.stok
      acik[r.malkod] = r.acikTedarik
      net[r.malkod]  = (net[r.malkod]  || 0) + r.net
    }
    const hesaplayan = user?.username || user?.email || user?.dbId || 'system'
    try {
      await supabase.from('uys_mrp_calculations').insert({
        id: calcId,
        order_id: order.id,
        hesaplayan,
        brut_ihtiyac: brut,
        stok_durumu: stok,
        acik_tedarik: acik,
        net_ihtiyac: net,
        durum: 'tamamlandi',
      })
      setLastCalcId(calcId)
    } catch (e) {
      // Snapshot insert sessiz başarısız olursa MRP akışı bozulmamalı; sadece konsola yaz
      console.warn('[v15.50b] uys_mrp_calculations insert failed:', e)
    }

    const yeniDurum = rows.some(r => r.net > 0) ? 'eksik' : 'tamam'
    await supabase.from('uys_orders').update({ mrp_durum: yeniDurum }).eq('id', order.id)
    // Rezerve kayıtları yaz
    await rezerveYaz(order.id, rows)
    loadAll()
    await triggerRezerveSync()
    toast.success(rows.length + ' malzeme hesaplandı')
  }

  async function createTedarik() {
    // v15.50b — RBAC: tedarik_auto izni gerekli (toplu/otomatik akış).
    if (!can('tedarik_auto')) { toast.error('Yetkiniz yok: tedarik_auto'); return }
    // v15.50b — calcId ve auto bayrağı pass edildi.
    const count = await mrpTedarikOlustur(order.id, order.siparisNo, mrpRows, {
      mrpCalculationId: lastCalcId || undefined,
      auto: true,
    })
    if (count > 0) { loadAll(); toast.success(count + ' tedarik kaydı oluşturuldu'); await triggerRezerveSync() }
    else toast.info('Tüm ihtiyaçlar karşılanmış')
  }

  async function yenidenCalistir() {
    if (!await showConfirm('Mevcut İE\'ler silinip reçetelerden yeniden oluşturulacak. Devam?')) return
    for (const w of workOrders) { await supabase.from('uys_work_orders').delete().eq('id', w.id) }
    const { recipes: fullRecipes } = useStore.getState()
    let total = 0
    const liste = kalemler.length > 0 ? kalemler : (order.receteId ? [{ rcId: order.receteId, adet: order.adet, mamulKod: order.mamulKod, mamulAd: order.mamulAd, termin: order.termin, not: '' }] : [])
    for (const k of liste) {
      if (k.rcId) { const c = await buildWorkOrders(order.id, order.siparisNo, k.rcId, k.adet, fullRecipes, k.termin, total); total += c }
    }
    loadAll(); toast.success(total + ' İE yeniden oluşturuldu')
  }

  async function eksikIETamamla() {
    const { recipes: fullRecipes } = useStore.getState()
    const rcId = kalemler[0]?.rcId || order.receteId
    if (!rcId) { toast.error('Reçete bulunamadı'); return }
    const rc = fullRecipes.find(r => r.id === rcId)
    if (!rc) { toast.error('Reçete bulunamadı'); return }
    const mevcutKodlar = new Set(workOrders.map(w => w.malkod))
    const eksikSatirlar = (rc.satirlar || []).filter(s => !mevcutKodlar.has(s.malkod))
    if (!eksikSatirlar.length) { toast.info('Eksik İE yok — tüm bileşenler mevcut'); return }
    const adet = kalemler[0]?.adet || order.adet
    const count = await buildWorkOrders(order.id, order.siparisNo, rcId, adet, fullRecipes, kalemler[0]?.termin || order.termin)
    loadAll(); toast.success(count + ' eksik İE oluşturuldu')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div><h2 className="text-lg font-semibold">{order.siparisNo}</h2><p className="text-xs text-zinc-500">{order.musteri} · {order.tarih}</p></div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        {/* Özet Kartları */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-bg-2 border border-border rounded-lg p-3">
            <div className="text-[10px] text-zinc-500">Kalem / Adet</div>
            <div className="text-sm font-mono">{kalemler.length || 1} kalem · {order.adet} adet</div>
          </div>
          <div className="bg-bg-2 border border-border rounded-lg p-3">
            <div className="text-[10px] text-zinc-500">En yakın termin</div>
            <div className={`text-sm font-mono ${order.termin && order.termin < today() ? 'text-red' : ''}`}>{order.termin || '—'}</div>
          </div>
          <div className="bg-bg-2 border border-border rounded-lg p-3">
            <div className="text-[10px] text-zinc-500">İş emri</div>
            <div className="text-sm font-mono">{workOrders.length}</div>
          </div>
          <div className="bg-bg-2 border border-border rounded-lg p-3">
            <div className="text-[10px] text-zinc-500">Not</div>
            <div className="text-sm truncate">{order.not || '—'}</div>
          </div>
        </div>

        {/* Kalem Listesi */}
        {kalemler.length > 0 && (
          <div className="mb-4 p-3 bg-bg-2/40 border border-border rounded-lg">
            <h3 className="text-xs font-semibold text-zinc-400 mb-2">Ürün Kalemleri ({kalemler.length})</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-border/50">
                  <th className="text-left px-2 py-1 font-medium">#</th>
                  <th className="text-left px-2 py-1 font-medium">Mamul</th>
                  <th className="text-right px-2 py-1 font-medium">Adet</th>
                  <th className="text-left px-2 py-1 font-medium">Termin</th>
                  <th className="text-left px-2 py-1 font-medium">Not</th>
                </tr>
              </thead>
              <tbody>
                {kalemler.map((u, i) => {
                  const gecikti = u.termin && u.termin < today()
                  return (
                    <tr key={i} className="border-b border-border/30">
                      <td className="px-2 py-1.5 text-zinc-500 font-mono">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <span className="font-mono text-accent">{u.mamulKod || '—'}</span>
                        <span className="text-zinc-400 ml-1">· {u.mamulAd || '—'}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-zinc-300">{u.adet}</td>
                      <td className={`px-2 py-1.5 font-mono ${gecikti ? 'text-red font-semibold' : 'text-zinc-400'}`}>{u.termin || '—'}</td>
                      <td className="px-2 py-1.5 text-zinc-500 truncate max-w-[200px]">{u.not || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-1 mb-3">
          <select value={tab} onChange={e => { const v = e.target.value as 'ie' | 'mrp'; if (v === 'mrp' && !mrpDone) runMRP(); setTab(v) }} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
            <option value="ie">İş Emirleri ({workOrders.length})</option>
            <option value="mrp">MRP {mrpDone ? `(${mrpRows.length})` : ''}</option>
          </select>
          <span className="flex-1" />
          {(kalemler.some(k => k.rcId) || order.receteId) && <button onClick={yenidenCalistir} className="px-3 py-1.5 bg-amber/10 text-amber rounded-lg text-xs hover:bg-amber/20">⛓ Yeniden Çalıştır</button>}
          {!cokKalem && order.receteId && <button onClick={eksikIETamamla} className="px-3 py-1.5 bg-green/10 text-green rounded-lg text-xs hover:bg-green/20">+ Eksik İE Tamamla</button>}
          {(kalemler.some(k => k.rcId) || order.receteId) && <TamZincirButton order={order} workOrders={workOrders} loadAll={loadAll} onClose={onClose} />}
        </div>

        {tab === 'ie' && (
          <>
            {workOrders.length ? (
              <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">İE No</th><th className="text-left px-3 py-2">Ürün</th><th className="text-left px-3 py-2">Operasyon</th><th className="text-right px-3 py-2">Hedef</th><th className="text-right px-3 py-2">Üretilen</th><th className="text-right px-3 py-2">%</th></tr></thead>
                <tbody>
                  {workOrders.map(w => {
                    const woLogs = logs.filter(l => l.woId === w.id)
                    const prod = woLogs.reduce((a, l) => a + l.qty, 0)
                    const pct = w.hedef > 0 ? Math.min(100, Math.round(prod / w.hedef * 100)) : 0
                    return (
                      <tr key={w.id} className="border-b border-border/50">
                        <td className="px-3 py-1.5 font-mono text-accent">{w.ieNo}</td>
                        <td className="px-3 py-1.5 text-zinc-300">{w.malad}</td>
                        <td className="px-3 py-1.5 text-zinc-500">{w.opAd}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{w.hedef}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-green">{prod}</td>
                        <td className={`px-3 py-1.5 text-right font-mono font-semibold ${pctColor(pct)}`}>{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody></table>
            ) : <div className="p-4 text-center text-zinc-600 text-xs">İş emri yok — reçete atanmış mı?</div>}
          </>
        )}

        {tab === 'mrp' && (
          <>
            {mrpRows.length ? (
              <>
                <div className="flex items-center gap-3 mb-3 text-xs">
                  <div className="px-2 py-1 bg-red/10 text-red rounded font-semibold">⚠ {mrpRows.filter(r => r.net > 0).length} eksik</div>
                  <div className="px-2 py-1 bg-green/10 text-green rounded font-semibold">✓ {mrpRows.filter(r => r.net <= 0).length} yeterli</div>
                  <span className="flex-1" />
                  <button onClick={() => {
                    import('xlsx').then(XLSX => {
                      const rows = mrpRows.map(r => ({ 'Malzeme Kodu': r.malkod, 'Malzeme Adı': r.malad, 'Tip': r.tip, 'Termin': r.termin || '', 'Birim': r.birim || 'Adet', 'Brüt İhtiyaç': r.brut, 'Stok': r.stok, 'Açık Tedarik': r.acikTedarik, 'Net İhtiyaç': r.net, 'Durum': r.net > 0 ? 'Eksik' : 'Yeterli' }))
                      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
                      XLSX.utils.book_append_sheet(wb, ws, 'MRP'); XLSX.writeFile(wb, `mrp_${order.siparisNo}_${today()}.xlsx`)
                    })
                  }} className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">📥 Excel</button>
                </div>
                <table className="w-full text-xs mb-3"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Malzeme Kodu</th><th className="text-left px-3 py-2">Malzeme Adı</th><th className="text-left px-3 py-2">Tip</th><th className="text-left px-3 py-2">Termin</th><th className="text-right px-3 py-2">Brüt</th><th className="text-right px-3 py-2">Stok</th><th className="text-right px-3 py-2">Açık Ted.</th><th className="text-right px-3 py-2 font-semibold">Net</th><th className="text-left px-3 py-2">Durum</th><th className="px-3 py-2"></th></tr></thead>
                  <tbody>
                    {mrpRows.map(r => (
                      <tr key={r.malkod} className={`border-b border-border/30 ${r.net > 0 ? 'bg-red/5' : ''}`}>
                        <td className="px-3 py-1.5 font-mono text-accent text-[11px]">{r.malkod}</td>
                        <td className="px-3 py-1.5 text-zinc-300">{r.malad}</td>
                        <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 bg-bg-3 rounded text-[10px]">{r.tip}</span></td><td className={`px-3 py-1.5 font-mono text-[11px] ${r.termin && r.termin < today() ? "text-red font-semibold" : "text-zinc-400"}`}>{r.termin || "-"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{r.brut}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-green">{r.stok}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{r.acikTedarik}</td>
                        <td className={`px-3 py-1.5 text-right font-mono font-semibold ${r.net > 0 ? 'text-red' : 'text-green'}`}>{r.net}</td>
                        <td className="px-3 py-1.5"><span className={`text-[10px] font-semibold ${r.net > 0 ? 'text-red' : 'text-green'}`}>{r.net > 0 ? '⚠ Eksik' : '✓ Yeterli'}</span></td>
                        <td className="px-3 py-1.5">{r.net > 0 && can('mrp_supply') && <button onClick={async () => {
                          await supabase.from('uys_tedarikler').insert({ id: uid(), malkod: r.malkod, malad: r.malad, miktar: Math.ceil(r.net), birim: r.birim || 'Adet', tarih: today(), teslim_tarihi: r.termin || null, durum: 'bekliyor', geldi: false, siparis_no: order.siparisNo, order_id: order.id, not_: 'MRP', auto_olusturuldu: false, mrp_calculation_id: lastCalcId })
                          await supabase.from('uys_orders').update({ mrp_durum: 'tamam' }).eq('id', order.id)
                          loadAll(); toast.success(r.malkod + ' tedarik oluşturuldu')
                          await triggerRezerveSync()
                        }} className="text-amber text-[10px] hover:underline">+ Tedarik</button>}</td>
                      </tr>
                    ))}
                  </tbody></table>
                {mrpRows.some(r => r.net > 0) && can('tedarik_auto') && (
                  <button onClick={createTedarik} className="px-4 py-2 bg-amber hover:bg-amber/80 text-black rounded-lg text-xs font-semibold">
                    📦 Toplu Tedarik Oluştur ({mrpRows.filter(r => r.net > 0).length} kalem)
                  </button>
                )}
                {!mrpRows.some(r => r.net > 0) && (
                  <div className="p-3 bg-green/5 border border-green/20 rounded-lg text-xs text-green">✅ Tüm malzeme ihtiyaçları karşılanmış</div>
                )}
              </>
            ) : (
              <div className="p-4 text-center">
                {(kalemler.some(k => k.rcId) || order.receteId) ? (
                  can('orders_mrp') && <button onClick={runMRP} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Calculator size={13} className="inline mr-1" /> MRP Hesapla</button>
                ) : (
                  <div className="text-zinc-600 text-xs">Bu siparişe reçete atanmamış — MRP hesaplanamaz</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TamZincirButton({ order, workOrders, loadAll, onClose }: { order: Order; workOrders: any[]; loadAll: () => void; onClose: () => void }) {
  const [running, setRunning] = useState(false)
  const [adimlar, setAdimlar] = useState<string[]>([])
  const [sonuc, setSonuc] = useState<{ woCount: number; kesimCount: number; mrpCount: number; tedCount: number; eksikler: any[] } | null>(null)

  async function run() {
    if (!await showConfirm('Tam Zincir: İE → Kesim Planı → MRP → Tedarik çalıştırılacak. Devam?')) return
    setRunning(true)
    setAdimlar(['⏳ İş emirleri kontrol ediliyor...'])
    try {
      const s = useStore.getState()
      const kalemler = order.urunler || []
      let woCount = workOrders.length
      if (!woCount) {
        if (kalemler.length > 0) {
          for (const u of kalemler) {
            if (u.rcId) { const c = await buildWorkOrders(order.id, order.siparisNo, u.rcId, u.adet, s.recipes, u.termin, woCount); woCount += c }
          }
        } else if (order.receteId) {
          woCount = await buildWorkOrders(order.id, order.siparisNo, order.receteId, order.adet, s.recipes, order.termin)
        }
      }
      setAdimlar(['✅ ' + woCount + ' iş emri hazır'])

      const cpMapped = s.cuttingPlans.map((p: any) => ({ id: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, hamBoy: p.hamBoy, hamEn: p.hamEn || 0, kesimTip: p.kesimTip || 'boy', durum: p.durum || '', tarih: p.tarih || '', satirlar: p.satirlar || [], gerekliAdet: p.gerekliAdet || 0 }))
      const result = await autoZincir(
        order.id, woCount,
        s.orders as any, s.workOrders, s.recipes, s.operations as any,
        s.materials, s.stokHareketler, s.tedarikler,
        s.logs.map(l => ({ woId: l.woId, qty: l.qty })),
        cpMapped,
        (steps) => setAdimlar([...steps])
      )
      setSonuc(result)
      loadAll()
    } catch (e: any) {
      setAdimlar(prev => [...prev, '❌ Hata: ' + e.message])
    }
  }

  if (!running) {
    return <button onClick={run} className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs hover:bg-cyan-500/20">⚙ Tam Zincir</button>
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-1">⚙ Sipariş Zinciri</h3>
        <div className="text-xs text-zinc-500 mb-4">{order.siparisNo} · {order.musteri}</div>

        <div className="space-y-2 mb-4">
          {adimlar.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span>{a.startsWith('✅') ? '✅' : a.startsWith('⚠') ? '⚠️' : a.startsWith('❌') ? '❌' : a.startsWith('ℹ') ? 'ℹ️' : '⏳'}</span>
              <span className="text-zinc-300">{a.replace(/^[✅⚠️❌ℹ️⏳]\s*/, '')}</span>
            </div>
          ))}
          {!sonuc && <div className="flex items-center gap-2 text-xs text-zinc-500"><span className="animate-spin">⏳</span> Çalışıyor...</div>}
        </div>

        {sonuc && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-accent/10 rounded-lg p-3 text-center"><div className="text-lg font-mono text-accent">{sonuc.woCount}</div><div className="text-[9px] text-zinc-500">İE</div></div>
              <div className="bg-green/10 rounded-lg p-3 text-center"><div className="text-lg font-mono text-green">{sonuc.kesimCount}</div><div className="text-[9px] text-zinc-500">Kesim</div></div>
              <div className="bg-cyan-500/10 rounded-lg p-3 text-center"><div className="text-lg font-mono text-cyan-400">{sonuc.mrpCount}</div><div className="text-[9px] text-zinc-500">MRP</div></div>
              <div className={`${sonuc.tedCount > 0 ? 'bg-amber/10' : 'bg-green/10'} rounded-lg p-3 text-center`}><div className={`text-lg font-mono ${sonuc.tedCount > 0 ? 'text-amber' : 'text-green'}`}>{sonuc.tedCount}</div><div className="text-[9px] text-zinc-500">Tedarik</div></div>
            </div>
            {sonuc.eksikler.length > 0 && (
              <div className="mb-4 max-h-[150px] overflow-y-auto">
                <div className="text-[10px] text-red font-semibold mb-1">Eksik Malzemeler ({sonuc.eksikler.length})</div>
                <table className="w-full text-[10px]"><thead><tr className="text-zinc-600"><th className="text-left">Kod</th><th className="text-left">Malzeme</th><th className="text-right">İhtiyaç</th><th className="text-right">Stok</th><th className="text-right font-semibold">Eksik</th></tr></thead>
                  <tbody>{sonuc.eksikler.slice(0, 15).map((e, i) => (
                    <tr key={i}><td className="font-mono text-accent">{e.malkod}</td><td className="text-zinc-400 truncate max-w-[120px]">{e.malad}</td><td className="text-right font-mono">{e.brut}</td><td className="text-right font-mono text-green">{Math.round(e.stok)}</td><td className="text-right font-mono text-red font-semibold">{e.net}</td></tr>
                  ))}</tbody></table>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setRunning(false); setSonuc(null) }} className="flex-1 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">Kapat</button>
              <button onClick={() => { setRunning(false); setSonuc(null); window.location.hash = '#/mrp' }} className="px-3 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs">📊 MRP</button>
              <button onClick={() => { setRunning(false); setSonuc(null); window.location.hash = '#/cutting' }} className="px-3 py-2 bg-green/10 text-green rounded-lg text-xs">✂ Kesim</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══ Toplu Sipariş Excel Import — önizlemeli (DEĞİŞMEDİ) ═══
type BulkRow = {
  satir: number
  siparisNo: string
  musteri: string
  termin: string
  adet: number
  mamulKod: string
  mamulAd: string
  not: string
  receteId: string
  receteAd: string
  durum: 'ok' | 'warn' | 'error' | 'skip'
  mesaj: string
}

function parseTarih(s: unknown): string | null {
  if (!s) return null
  if (typeof s === 'number') {
    if (s > 10000 && s < 100000) {
      const d = new Date((s - 25569) * 86400 * 1000)
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    }
    return null
  }
  const str = String(s).trim()
  if (!str) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str); return !isNaN(d.getTime()) ? str : null
  }
  const m = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (m) {
    const [, dd, mm, yyyy] = m
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    const d = new Date(iso); return !isNaN(d.getTime()) ? iso : null
  }
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function BulkOrderImportModal({ existingOrders, recipes, onClose, onComplete }: {
  existingOrders: Order[]
  recipes: { id: string; mamulKod: string; mamulAd: string; ad: string }[]
  onClose: () => void
  onComplete: () => void
}) {
  const [rows, setRows] = useState<BulkRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ cur: 0, total: 0 })

  async function handleFile(file: File) {
    setParsing(true)
    setFileName(file.name)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { cellDates: false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true, defval: '' })
      if (!raw.length) { toast.error('Excel boş'); setParsing(false); return }

      const existingSipNoSet = new Set(existingOrders.map(o => o.siparisNo))
      const excelSipNoSeen = new Set<string>()

      const parsed: BulkRow[] = raw.map((r, i) => {
        const siparisNo = String(r['Sipariş No'] || r['SiparisNo'] || r['siparis_no'] || '').trim()
        const musteri = String(r['Müşteri'] || r['musteri'] || '').trim()
        const terminRaw = r['Termin'] ?? r['termin'] ?? ''
        const adetRaw = r['Adet'] ?? r['adet'] ?? 1
        const mamulKod = String(r['Mamul Kod'] || r['Mamul Kodu'] || r['mamulKod'] || r['mamul_kod'] || '').trim()
        const mamulAd = String(r['Mamul Ad'] || r['Mamul Adı'] || r['mamulAd'] || r['mamul_ad'] || '').trim()
        const not = String(r['Not'] || r['not'] || r['not_'] || '').trim()

        const termin = parseTarih(terminRaw) || ''
        const adet = typeof adetRaw === 'number' ? adetRaw : parseInt(String(adetRaw)) || 0

        const rc = mamulKod
          ? recipes.find(x => x.mamulKod === mamulKod)
          : mamulAd ? recipes.find(x => x.mamulAd === mamulAd || x.ad === mamulAd) : null

        const out: BulkRow = {
          satir: i + 2, siparisNo, musteri, termin, adet,
          mamulKod: mamulKod || rc?.mamulKod || '',
          mamulAd: mamulAd || rc?.mamulAd || '',
          not,
          receteId: rc?.id || '',
          receteAd: rc ? (rc.mamulAd || rc.ad) : '',
          durum: 'ok', mesaj: '',
        }

        if (!siparisNo) { out.durum = 'error'; out.mesaj = 'Sipariş No boş'; return out }
        if (excelSipNoSeen.has(siparisNo)) { out.durum = 'error'; out.mesaj = 'Excel içinde tekrar eden sipariş no'; return out }
        excelSipNoSeen.add(siparisNo)
        if (existingSipNoSet.has(siparisNo)) { out.durum = 'skip'; out.mesaj = 'Bu sipariş no zaten var — atlanacak'; return out }
        if (!termin) { out.durum = 'error'; out.mesaj = 'Termin tarihi geçersiz'; return out }
        if (!adet || adet < 1) { out.durum = 'error'; out.mesaj = 'Adet 1\'den küçük'; return out }
        if (!mamulKod && !mamulAd) { out.durum = 'warn'; out.mesaj = 'Ürün bilgisi yok — İE oluşmaz'; return out }
        if (!rc) { out.durum = 'warn'; out.mesaj = 'Reçete bulunamadı — sipariş oluşur ama İE oluşmaz' }
        return out
      })

      setRows(parsed)
    } catch (err) {
      toast.error('Excel okuma hatası: ' + (err as Error).message)
    }
    setParsing(false)
  }

  async function executeImport() {
    const kabul = rows.filter(r => r.durum === 'ok' || r.durum === 'warn')
    if (!kabul.length) { toast.error('İçeri alınacak geçerli satır yok'); return }

    setImporting(true)
    setProgress({ cur: 0, total: kabul.length })

    const { recipes: fullRecipes } = useStore.getState()

    const insertRows = kabul.map(r => ({
      id: uid(),
      siparis_no: r.siparisNo, musteri: r.musteri, tarih: today(), termin: r.termin,
      mamul_kod: r.mamulKod, mamul_ad: r.mamulAd, adet: r.adet,
      recete_id: r.receteId, not_: r.not,
      mrp_durum: 'bekliyor', olusturma: today(),
      urunler: r.receteId ? [{ rcId: r.receteId, mamulKod: r.mamulKod, mamulAd: r.mamulAd, adet: r.adet, termin: r.termin, not: r.not }] : [],
    }))

    const { error } = await supabase.from('uys_orders').insert(insertRows)
    if (error) {
      toast.error('DB hatası: ' + error.message); setImporting(false); return
    }

    let woTotal = 0
    for (let i = 0; i < kabul.length; i++) {
      const r = kabul[i]
      const ins = insertRows[i]
      if (r.receteId) {
        woTotal += await buildWorkOrders(ins.id, r.siparisNo, r.receteId, r.adet, fullRecipes, r.termin)
      }
      setProgress({ cur: i + 1, total: kabul.length })
      try { logAction('Sipariş oluşturuldu (toplu)', r.siparisNo) } catch { /* */ }
    }

    toast.success(`${kabul.length} sipariş oluşturuldu · ${woTotal} İE üretildi`)
    setImporting(false)
    onComplete()
  }

  const okCount = rows.filter(r => r.durum === 'ok').length
  const warnCount = rows.filter(r => r.durum === 'warn').length
  const errorCount = rows.filter(r => r.durum === 'error').length
  const skipCount = rows.filter(r => r.durum === 'skip').length

  function renkSinif(d: BulkRow['durum']) {
    if (d === 'ok') return 'bg-green/5 border-l-2 border-green'
    if (d === 'warn') return 'bg-amber/5 border-l-2 border-amber'
    if (d === 'skip') return 'bg-zinc-700/20 border-l-2 border-zinc-600 opacity-60'
    return 'bg-red/5 border-l-2 border-red'
  }

  function renkIkon(d: BulkRow['durum']) {
    if (d === 'ok') return <span className="text-green">✓</span>
    if (d === 'warn') return <span className="text-amber">⚠</span>
    if (d === 'skip') return <span className="text-zinc-500">⏩</span>
    return <span className="text-red">✗</span>
  }

  function sablonIndir() {
    import('xlsx').then(XLSX => {
      const ornekler = [
        { 'Sipariş No': 'SIP-2026-001', 'Müşteri': 'ABC İnşaat', 'Termin': '2026-05-15', 'Adet': 100, 'Mamul Kod': '', 'Mamul Ad': '', 'Not': 'Örnek satır' },
        { 'Sipariş No': 'SIP-2026-002', 'Müşteri': 'XYZ Ltd', 'Termin': '2026-06-01', 'Adet': 50, 'Mamul Kod': '', 'Mamul Ad': '', 'Not': '' },
      ]
      const ws = XLSX.utils.json_to_sheet(ornekler)
      ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 25 }, { wch: 30 }]
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Siparişler')
      XLSX.writeFile(wb, 'siparis_sablonu.xlsx')
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Toplu Sipariş Yükle</h2>
            <p className="text-[11px] text-zinc-500">Excel dosyası seç · Önizlemeden sonra İçeri Al</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <button onClick={sablonIndir} className="flex items-center gap-1.5 px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">
              <Download size={13} /> Şablonu İndir
            </button>
            <button
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'; input.accept = '.xlsx,.xls'
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0]
                  if (f) handleFile(f)
                }
                input.click()
              }}
              disabled={parsing}
              className="flex items-center gap-1.5 px-3 py-2 bg-accent/10 border border-accent/25 text-accent rounded-lg text-xs hover:bg-accent/20 disabled:opacity-40"
            >
              <Upload size={13} /> {parsing ? 'Okunuyor...' : fileName ? 'Başka Dosya Seç' : 'Excel Dosyası Seç'}
            </button>
            {fileName && <span className="text-[11px] text-zinc-500 truncate">📄 {fileName}</span>}
          </div>
          <div className="text-[10px] text-zinc-600 mt-2">
            Beklenen kolonlar: <span className="font-mono text-zinc-400">Sipariş No, Müşteri, Termin, Adet, Mamul Kod, Mamul Ad, Not</span>
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <div className="px-5 py-2 border-b border-border flex items-center gap-3 text-xs flex-wrap">
              <span className="text-zinc-500">{rows.length} satır okundu:</span>
              {okCount > 0 && <span className="px-2 py-0.5 bg-green/10 text-green rounded">✓ {okCount} hazır</span>}
              {warnCount > 0 && <span className="px-2 py-0.5 bg-amber/10 text-amber rounded">⚠ {warnCount} uyarı</span>}
              {skipCount > 0 && <span className="px-2 py-0.5 bg-zinc-700/30 text-zinc-400 rounded">⏩ {skipCount} atlanacak</span>}
              {errorCount > 0 && <span className="px-2 py-0.5 bg-red/10 text-red rounded">✗ {errorCount} hata</span>}
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-bg-1 border-b border-border z-10">
                  <tr className="text-zinc-500">
                    <th className="px-2 py-2 w-8"></th>
                    <th className="px-2 py-2 w-10 text-right">#</th>
                    <th className="text-left px-2 py-2">Sipariş No</th>
                    <th className="text-left px-2 py-2">Müşteri</th>
                    <th className="text-left px-2 py-2">Termin</th>
                    <th className="text-right px-2 py-2">Adet</th>
                    <th className="text-left px-2 py-2">Mamul / Reçete</th>
                    <th className="text-left px-2 py-2">Durum / Mesaj</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.satir} className={`border-b border-border/30 ${renkSinif(r.durum)}`}>
                      <td className="px-2 py-1.5 text-center">{renkIkon(r.durum)}</td>
                      <td className="px-2 py-1.5 text-right text-zinc-600 font-mono">{r.satir}</td>
                      <td className="px-2 py-1.5 font-mono text-accent">{r.siparisNo || <span className="text-zinc-600">—</span>}</td>
                      <td className="px-2 py-1.5 text-zinc-300 truncate max-w-[150px]">{r.musteri || <span className="text-zinc-600">—</span>}</td>
                      <td className="px-2 py-1.5 font-mono text-zinc-400">{r.termin || <span className="text-red">—</span>}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{r.adet || <span className="text-red">—</span>}</td>
                      <td className="px-2 py-1.5 text-zinc-400 truncate max-w-[200px]">
                        {r.mamulKod && <span className="font-mono text-accent">{r.mamulKod}</span>}
                        {r.mamulKod && r.receteAd && ' · '}
                        {r.receteAd || r.mamulAd || <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-2 py-1.5 text-[11px]">
                        {r.mesaj || <span className="text-green">Hazır</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="px-5 py-3 border-t border-border flex items-center gap-3">
          {importing && (
            <div className="flex-1">
              <div className="text-[11px] text-zinc-400 mb-1">İE oluşturuluyor · {progress.cur}/{progress.total}</div>
              <div className="h-1.5 bg-bg-2 rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: progress.total ? (progress.cur / progress.total * 100) + '%' : '0%' }} />
              </div>
            </div>
          )}
          {!importing && <div className="flex-1" />}
          <button onClick={onClose} disabled={importing} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white disabled:opacity-40">
            İptal
          </button>
          <button
            onClick={executeImport}
            disabled={importing || (okCount + warnCount) === 0}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold"
          >
            {importing ? 'İçeri alınıyor...' : `${okCount + warnCount} sipariş İçeri Al`}
          </button>
        </div>
      </div>
    </div>
  )
}
