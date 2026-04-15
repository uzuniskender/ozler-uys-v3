import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo, useCallback } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today, pctColor } from '@/lib/utils'
import { showPrompt, showMultiPrompt, showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { Search, Download, Eye, CheckSquare, Plus, ChevronRight, Copy } from 'lucide-react'
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { stokKontrolWO } from '@/features/production/stokKontrol'
import { requirePassword } from '@/lib/prompt'
import { OprEntryModal } from '@/pages/OperatorPanel'

export function WorkOrders() {
  const { workOrders, logs, orders, operations, operators, stokHareketler, recipes, cuttingPlans, tedarikler, materials, loadAll } = useStore()
  const { isGuest } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(['bekliyor', 'uretimde', 'kismi', 'beklemede']))
  const [tipFilter, setTipFilter] = useState<Set<string>>(new Set(['siparis', 'ym']))
  const [groupBy, setGroupBy] = useState('siparis')
  const [detailWO, setDetailWO] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showNewIE, setShowNewIE] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleCollapse(key: string) { setCollapsed(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s }) }

  function toggleSelect(id: string) { setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s }) }
  function selectAll() { setSelected(new Set(filtered.map(w => w.id))) }
  function selectNone() { setSelected(new Set()) }

  async function topluDurumGuncelle(durum: string) {
    if (!selected.size) return
    if (!await showConfirm(`${selected.size} İE'nin durumu "${durum}" olarak güncellenecek. Devam?`)) return
    for (const id of selected) { await supabase.from('uys_work_orders').update({ durum }).eq('id', id) }
    const cnt = selected.size; setSelected(new Set()); loadAll(); toast.success(`${cnt} İE güncellendi`)
  }

  async function topluSil() {
    if (!selected.size) return
    const uretimli = [...selected].filter(id => logs.some(l => l.woId === id))
    if (uretimli.length > 0) { toast.error(uretimli.length + ' İE\'de üretim var — silemezsiniz'); return }
    if (!await showConfirm(`${selected.size} İE SİLİNECEK. Bu işlem geri alınamaz!`)) return
    if (!await requirePassword('Toplu İE Silme')) return
    for (const id of selected) { await supabase.from('uys_work_orders').delete().eq('id', id) }
    const cnt = selected.size; setSelected(new Set()); loadAll(); toast.success(`${cnt} İE silindi`)
  }

  async function topluKopyala() {
    if (!selected.size) return
    if (!await showConfirm(`${selected.size} İE kopyalanacak (-K son eki ile). Devam?`)) return
    let cnt = 0
    for (const id of selected) {
      const w = workOrders.find(x => x.id === id); if (!w) continue
      await supabase.from('uys_work_orders').insert({
        id: uid(), order_id: w.orderId || null, rc_id: w.rcId || null,
        sira: workOrders.length + cnt + 1, kirno: w.kirno,
        op_id: w.opId, op_kod: w.opKod, op_ad: w.opAd,
        ist_id: w.istId, ist_kod: w.istKod, ist_ad: w.istAd,
        malkod: w.malkod, malad: w.malad, hedef: w.hedef,
        mpm: w.mpm, hm: w.hm || [], ie_no: w.ieNo + '-K',
        wh_alloc: 0, hazirlik_sure: w.hazirlikSure, islem_sure: w.islemSure,
        durum: 'bekliyor', bagimsiz: w.bagimsiz, siparis_disi: w.siparisDisi,
        mamul_kod: w.mamulKod, mamul_ad: w.mamulAd, mamul_auto: w.mamulAuto,
        not_: w.not, olusturma: today(),
      })
      cnt++
    }
    setSelected(new Set()); loadAll(); toast.success(`${cnt} İE kopyalandı`)
  }

  function wProd(woId: string): number { return logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0) }
  function wPct(w: { id: string; hedef: number }): number { return w.hedef > 0 ? Math.min(100, Math.round(wProd(w.id) / w.hedef * 100)) : 0 }

  const getStokDurum = useCallback((w: any) => {
    const kalan = Math.max(0, w.hedef - wProd(w.id))
    if (kalan <= 0) return null
    try { return stokKontrolWO(w, kalan, stokHareketler, tedarikler, materials) } catch { return null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stokHareketler, tedarikler, logs])

  function stokBadgeEl(w: any) {
    const sk = getStokDurum(w)
    if (!sk || sk.durum === 'OK') return null
    const eks = sk.satirlar.filter((s: any) => s.durum !== 'YETERLI')
    const detay = eks.slice(0, 2).map((s: any) => `${s.mevcut}/${s.gerekli}`).join(' ')
    if (sk.durum === 'YOK') return (
      <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-red/10 text-red font-semibold cursor-pointer ml-1"
        title={eks.map((s: any) => s.malkod + ': ' + s.mevcut + '/' + s.gerekli).join(', ')}
        onClick={e => { e.stopPropagation(); setDetailWO(w.id) }}>
        ⛔ YOK<br/><span className="font-normal">{detay}</span>
      </span>
    )
    return (
      <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber/10 text-amber font-semibold cursor-pointer ml-1"
        title={eks.map((s: any) => s.malkod + ': ' + s.mevcut + '/' + s.gerekli).join(', ')}
        onClick={e => { e.stopPropagation(); setDetailWO(w.id) }}>
        ⚠ EKSİK<br/><span className="font-normal">{detay}</span>
      </span>
    )
  }

  const filtered = useMemo(() => {
    return workOrders.filter(w => {
      if (tipFilter.size > 0 && tipFilter.size < 2) {
        if (tipFilter.has('siparis') && w.bagimsiz) return false
        if (tipFilter.has('ym') && !w.bagimsiz) return false
      }
      if (statusFilter.size > 0) {
        const pct = wPct(w)
        const wDurum = w.durum === 'iptal' ? 'iptal' : w.durum === 'beklemede' ? 'beklemede' : pct >= 100 ? 'tamamlandi' : pct > 0 ? 'uretimde' : 'bekliyor'
        if (!statusFilter.has(wDurum)) return false
      }
      if (search) {
        const q = search.toLowerCase(); const ord = orders.find(o => o.id === w.orderId)
        if (!(w.ieNo + w.malad + w.malkod + w.opAd + (ord?.siparisNo || '')).toLowerCase().includes(q)) return false
      }
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrders, logs, search, statusFilter, tipFilter, orders])

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {}
    filtered.forEach(w => {
      const key = groupBy === 'siparis'
        ? (orders.find(o => o.id === w.orderId)?.siparisNo || 'Bağımsız İE')
        : groupBy === 'urun' ? (w.malkod || w.mamulKod || 'Tanımsız') : (w.opAd || 'Tanımsız')
      if (!map[key]) map[key] = []; map[key].push(w)
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [filtered, groupBy, orders])

  async function setDurum(id: string, durum: string) {
    const wo = workOrders.find(w => w.id === id); if (!wo) return
    const prod = logs.filter(l => l.woId === id).reduce((a, l) => a + l.qty, 0)
    const tarih = today()
    if (durum === 'iptal') {
      if (!await requirePassword('İE İptal')) return
      const neden = await showPrompt('İptal nedeni (zorunlu)')
      if (!neden?.trim()) { toast.error('İptal nedeni zorunlu'); return }
      if (prod > 0) {
        if (!await showConfirm(`${wo.ieNo}: ${prod} adet üretim var.\nİptal edilirse stok ters kayıt yapılır. Devam?`)) return
        await supabase.from('uys_stok_hareketler').insert({ id: uid(), tarih, malkod: wo.malkod, malad: wo.malad, miktar: prod, tip: 'cikis', aciklama: 'İPTAL ters — ' + wo.ieNo + ' (' + neden + ')', wo_id: id })
        const hmCikislar = stokHareketler.filter(h => h.woId === id && h.tip === 'cikis' && h.logId)
        for (const h of hmCikislar) {
          await supabase.from('uys_stok_hareketler').insert({ id: uid(), tarih, malkod: h.malkod, malad: h.malad, miktar: h.miktar, tip: 'giris', aciklama: 'İPTAL HM iadesi — ' + wo.ieNo, wo_id: id })
        }
        toast.info('Ters stok hareketi yazıldı')
      }
      await supabase.from('uys_work_orders').update({ durum: 'iptal', not_: (wo.not || '') + '\n[İPTAL] ' + neden }).eq('id', id)
      loadAll(); toast.success(wo.ieNo + ' iptal edildi'); return
    }
    if (durum === 'tamamlandi') await supabase.from('uys_work_orders').update({ durum, tamamlanma_tarih: tarih }).eq('id', id)
    else await supabase.from('uys_work_orders').update({ durum }).eq('id', id)
    loadAll(); toast.success(wo.ieNo + ' → ' + durum)
  }

  async function deleteWO(id: string) {
    const wo = workOrders.find(w => w.id === id); if (!wo) return
    const prod = logs.filter(l => l.woId === id).reduce((a, l) => a + l.qty, 0)
    if (prod > 0) { toast.error('Üretim girişi var — İptal Et kullanın'); return }
    if (!await showConfirm(wo.ieNo + ' silinecek.')) return
    if (!await requirePassword("İE Silme")) return
    await supabase.from('uys_work_orders').delete().eq('id', id)
    loadAll(); toast.success(wo.ieNo + ' silindi')
  }

  async function updateHedef(id: string) {
    const wo = workOrders.find(w => w.id === id)
    const val = await showPrompt('Yeni hedef adet', 'Hedef', String(wo?.hedef || 0))
    if (!val) return
    const hedef = parseInt(val); if (isNaN(hedef) || hedef < 0) return
    await supabase.from('uys_work_orders').update({ hedef }).eq('id', id)
    loadAll(); toast.success('Hedef güncellendi: ' + hedef)
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(w => {
        const ord = orders.find(o => o.id === w.orderId)
        return { 'İE No': w.ieNo, 'Sipariş': ord?.siparisNo || '', 'Müşteri': ord?.musteri || '', 'Malzeme Kodu': w.malkod, 'Malzeme': w.malad, 'Operasyon': w.opAd, 'İstasyon': w.istAd, 'Hedef': w.hedef, 'Üretilen': wProd(w.id), '%': wPct(w), 'Durum': w.durum || '', 'Tip': w.bagimsiz ? 'YM' : 'Sipariş' }
      })
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'İş Emirleri'); XLSX.writeFile(wb, `is_emirleri_${today()}.xlsx`)
    })
  }

  const detailW = detailWO ? workOrders.find(w => w.id === detailWO) : null

  function grpStats(wos: typeof workOrders) {
    const topHedef = wos.reduce((a, w) => a + (w.hedef || 0), 0)
    const topProd = wos.reduce((a, w) => a + wProd(w.id), 0)
    const pct = topHedef > 0 ? Math.min(100, Math.round(topProd / topHedef * 100)) : 0
    const tamam = wos.filter(w => wPct(w) >= 100).length
    let stokSorun = false; try { stokSorun = wos.some(w => { const sk = getStokDurum(w); return sk && sk.durum !== 'OK' }) } catch { stokSorun = false }
    return { topHedef, topProd, pct, tamam, stokSorun }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">İş Emirleri</h1><p className="text-xs text-zinc-500">{workOrders.length} toplam · {filtered.length} gösterilen{isGuest ? ' (salt okunur)' : ''}</p></div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          <button onClick={async () => {
            let count = 0
            for (const w of workOrders) {
              if (w.durum === 'iptal' || w.durum === 'beklemede') continue
              const pct = wPct(w); const pr = wProd(w.id)
              const yeniDurum = pct >= 100 ? 'tamamlandi' : pr > 0 ? 'uretimde' : 'bekliyor'
              if (w.durum !== yeniDurum) { await supabase.from('uys_work_orders').update({ durum: yeniDurum }).eq('id', w.id); count++ }
            }
            if (count > 0) { loadAll(); toast.success(count + ' İE durumu güncellendi') } else toast.info('Tüm durumlar güncel')
          }} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">🔄 Durumları Güncelle</button>
          <button onClick={() => setShowNewIE(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni İE</button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="İE no, malzeme, sipariş ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" /></div>
        <MultiCheckDropdown label="Durum" options={[
          { value: 'bekliyor', label: 'Başlamadı', color: 'text-zinc-400' },
          { value: 'uretimde', label: 'Üretimde', color: 'text-accent' },
          { value: 'beklemede', label: 'Beklemede', color: 'text-purple-400' },
          { value: 'tamamlandi', label: 'Tamamlandı', color: 'text-green' },
          { value: 'iptal', label: 'İptal', color: 'text-red' },
        ]} selected={statusFilter} onChange={setStatusFilter} />
        <MultiCheckDropdown label="Tip" options={[
          { value: 'siparis', label: 'Siparişten', color: 'text-accent' },
          { value: 'ym', label: 'Manuel YM', color: 'text-amber' },
        ]} selected={tipFilter} onChange={setTipFilter} />
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="siparis">Siparişe Göre</option><option value="operasyon">Operasyona Göre</option><option value="urun">Malzemeye Göre</option>
        </select>
        {grouped.length > 1 && <>
          <button onClick={() => setCollapsed(new Set())} className="text-[10px] text-zinc-500 hover:text-white">▼ Aç</button>
          <button onClick={() => setCollapsed(new Set(grouped.map(([k]) => k)))} className="text-[10px] text-zinc-500 hover:text-white">▲ Kapat</button>
        </>}
      </div>

      {selected.size > 0 && (
        <div className="mb-3 p-2 bg-accent/5 border border-accent/20 rounded-lg flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-accent"><CheckSquare size={13} className="inline" /> {selected.size} seçili</span>
          <button onClick={() => topluDurumGuncelle('uretimde')} className="px-2 py-1 bg-accent/20 text-accent rounded text-[10px] hover:bg-accent/30">→ Üretimde</button>
          <button onClick={() => topluDurumGuncelle('tamamlandi')} className="px-2 py-1 bg-green/20 text-green rounded text-[10px] hover:bg-green/30">→ Tamamlandı</button>
          <button onClick={() => topluDurumGuncelle('beklemede')} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-[10px] hover:bg-purple-500/30">→ Beklemede</button>
          <button onClick={() => topluDurumGuncelle('iptal')} className="px-2 py-1 bg-red/10 text-red rounded text-[10px] hover:bg-red/20">→ İptal</button>
          <button onClick={topluKopyala} className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded text-[10px] hover:bg-cyan-500/20 flex items-center gap-1"><Copy size={10} /> Kopyala</button>
          <button onClick={topluSil} className="px-2 py-1 bg-red/10 text-red rounded text-[10px] hover:bg-red/20">🗑 Sil</button>
          <span className="flex-1" />
          <button onClick={selectAll} className="text-[10px] text-zinc-500 hover:text-white">Tümünü Seç</button>
          <button onClick={selectNone} className="text-[10px] text-zinc-500 hover:text-white">Seçimi Kaldır</button>
        </div>
      )}

      {grouped.map(([group, wos]) => {
        const stats = grpStats(wos)
        const isCollapsed = collapsed.has(group)
        const ord = groupBy === 'siparis' ? orders.find(o => o.siparisNo === group) : null
        const grpIds = wos.map(w => w.id)
        const grpAllSelected = grpIds.length > 0 && grpIds.every(id => selected.has(id))
        return (
          <div key={group} className="mb-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-bg-3/50 border border-border rounded-t-lg cursor-pointer select-none hover:bg-bg-3/70" onClick={() => toggleCollapse(group)}>
              <span className="text-zinc-500 transition-transform" style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}><ChevronRight size={14} /></span>
              <input type="checkbox" checked={grpAllSelected} onClick={e => e.stopPropagation()} onChange={e => { const s = new Set(selected); if (e.target.checked) grpIds.forEach(id => s.add(id)); else grpIds.forEach(id => s.delete(id)); setSelected(s) }} className="accent-accent" />
              <span className="font-mono text-[11px] text-accent font-bold">{group}</span>
              {ord && <span className="text-[11px] text-zinc-400 truncate max-w-[200px]">{ord.musteri} — {ord.mamulAd || ''} ×{ord.adet}</span>}
              {ord && <span className="text-[10px] text-zinc-500">Termin: {ord.termin || '—'}</span>}
              {stats.stokSorun && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red/10 text-red font-semibold">⚠ STOK</span>}
              <span className="flex-1" />
              <span className="text-[10px] text-zinc-500 font-mono">{stats.tamam}/{wos.length} İE</span>
              <span className="text-[10px] font-mono text-zinc-400">
                {stats.topProd > stats.topHedef
                  ? <><b className="text-green">{stats.topHedef}</b> <span className="text-green">✓</span> <span className="text-accent">(+{stats.topProd - stats.topHedef} stok)</span></>
                  : <><b>{stats.topProd}</b><span className="text-zinc-600">/{stats.topHedef}</span></>}
              </span>
              <div className="w-16 h-1.5 bg-bg-3 rounded-full overflow-hidden"><div className={`h-full rounded-full ${stats.pct >= 100 ? 'bg-green' : stats.pct > 0 ? 'bg-accent' : 'bg-zinc-700'}`} style={{ width: `${Math.max(2, stats.pct)}%` }} /></div>
              <span className={`text-[10px] font-mono font-bold ${stats.pct >= 100 ? 'text-green' : stats.pct > 0 ? 'text-accent' : 'text-zinc-600'}`}>{stats.pct}%</span>
            </div>
            {!isCollapsed && (
              <div className="bg-bg-2 border border-border border-t-0 rounded-b-lg overflow-hidden">
                <table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500">
                  <th className="px-2 py-2 w-6"></th><th className="text-left px-3 py-2">İE No</th><th className="text-left px-3 py-2">Malzeme / HM</th><th className="text-left px-3 py-2">Operasyon</th><th className="text-left px-3 py-2">İstasyon</th><th className="text-right px-3 py-2">Adet</th><th className="text-right px-3 py-2 w-24">İlerleme</th><th className="text-left px-3 py-2">Durum</th><th className="px-3 py-2 w-8"></th>
                </tr></thead><tbody>
                  {wos.map(w => {
                    const prod = wProd(w.id); const pct = wPct(w); const ord2 = orders.find(o => o.id === w.orderId)
                    return (
                      <tr key={w.id} className="border-b border-border/30 hover:bg-bg-3/30">
                        <td className="px-2 py-1.5"><input type="checkbox" checked={selected.has(w.id)} onChange={() => toggleSelect(w.id)} className="accent-accent" /></td>
                        <td className="px-3 py-1.5"><div className="font-mono text-accent text-[11px]">{w.ieNo}</div>{ord2 && groupBy !== 'siparis' && <div className="text-[9px] text-zinc-600">{ord2.siparisNo}</div>}</td>
                        <td className="px-3 py-1.5 max-w-[220px]">
                          <div className="text-[11px] text-zinc-300 truncate">{w.malad}</div>
                          <div className="text-[9px] text-zinc-600 font-mono">{w.malkod}</div>
                          {w.hm && w.hm.length > 0 && <div className="mt-0.5 flex flex-wrap gap-0.5">{w.hm.slice(0, 3).map((h, i) => <span key={i} className="text-[8px] px-1 rounded bg-cyan-500/8 text-cyan-400/80 border border-cyan-500/15">{(h.malad || '').slice(0, 20)}</span>)}{w.hm.length > 3 && <span className="text-[8px] text-zinc-600">+{w.hm.length - 3}</span>}</div>}
                          {w.whAlloc > 0 && <div className="text-[8px] mt-0.5"><span className="px-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/15">Depo: {w.whAlloc}</span></div>}
                          {stokBadgeEl(w)}
                        </td>
                        <td className="px-3 py-1.5"><span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/8 text-accent border border-accent/15">{w.opAd || '—'}</span></td>
                        <td className="px-3 py-1.5 text-zinc-500 text-[11px]">{w.istAd || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono"><b>{prod}</b><span className="text-zinc-600">/{w.hedef}</span></td>
                        <td className="px-3 py-1.5"><div className="flex items-center justify-end gap-1.5"><div className="w-12 h-1.5 bg-bg-3 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : pct > 0 ? 'bg-accent' : 'bg-zinc-700'}`} style={{ width: `${Math.max(2, pct)}%` }} /></div><span className={`font-mono text-[10px] ${pctColor(pct)}`}>{pct}%</span></div></td>
                        <td className="px-3 py-1.5">
                          <select value={(() => { if (w.durum === 'iptal') return 'iptal'; if (w.durum === 'beklemede') return 'beklemede'; if (pct >= 100) return 'tamamlandi'; if (prod > 0) return 'uretimde'; return 'bekliyor' })()} onChange={e => setDurum(w.id, e.target.value)} className={`px-1.5 py-0.5 rounded text-[10px] bg-bg-3 border border-border ${w.durum === 'tamamlandi' || pct >= 100 ? 'text-green' : w.durum === 'iptal' ? 'text-red' : w.durum === 'beklemede' ? 'text-purple-400' : 'text-accent'}`}>
                            <option value="bekliyor">Başlamadı</option><option value="uretimde">Üretimde</option><option value="beklemede">Beklemede</option><option value="tamamlandi">Tamamlandı</option><option value="iptal">İptal</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-right"><button onClick={() => setDetailWO(w.id)} className="p-1 text-zinc-500 hover:text-accent"><Eye size={13} /></button></td>
                      </tr>
                    )
                  })}
                </tbody></table>
              </div>
            )}
          </div>
        )
      })}
      {!grouped.length && <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-zinc-600 text-sm">İş emri bulunamadı</div>}

      {detailW && <WODetailModal wo={detailW} onClose={() => setDetailWO(null)} logs={logs} orders={orders} operators={operators} recipes={recipes} cuttingPlans={cuttingPlans} stokHareketler={stokHareketler} tedarikler={tedarikler} wProd={wProd} wPct={wPct} getStokDurum={getStokDurum} setDurum={setDurum} deleteWO={deleteWO} updateHedef={updateHedef} loadAll={loadAll} />}
      {showNewIE && <NewIEModal operations={operations} orders={orders} onClose={() => setShowNewIE(false)} onSaved={() => { setShowNewIE(false); loadAll(); toast.success('İş emri oluşturuldu') }} recipes={recipes} />}
    </div>
  )
}

function WODetailModal({ wo, onClose, logs, orders, operators, recipes, cuttingPlans, stokHareketler, tedarikler, wProd, wPct, getStokDurum, setDurum, deleteWO, updateHedef, loadAll }: any) {
  const { durusKodlari } = useStore()
  const [adminEntryWO, setAdminEntryWO] = useState<string | null>(null)
  const prod = wProd(wo.id); const pct = wPct(wo); const kalan = Math.max(0, wo.hedef - prod)

  // #7: Stok kontrollü log düzenleme
  async function editLog(l: any) {
    const result = await showMultiPrompt('Log Düzenle — Stok Kontrollü', [
      { label: 'Adet', key: 'qty', defaultValue: String(l.qty), type: 'number' },
      { label: 'Fire', key: 'fire', defaultValue: String(l.fire || 0), type: 'number' },
    ])
    if (!result) return
    const yeniQty = parseInt(result.qty) || 0
    const yeniFire = parseInt(result.fire) || 0
    if (yeniQty <= 0) { toast.error('Geçersiz adet'); return }

    const delta = yeniQty - (l.qty || 0)
    const rc = wo.rcId ? recipes.find((r: any) => r.id === wo.rcId) : recipes.find((r: any) => r.mamulKod === wo.mamulKod)
    const hmSatirlar = (rc?.satirlar || []).filter((s: any) => s.tip === 'Hammadde' || s.tip === 'hammadde')

    // Delta > 0 ise stok kontrolü yap
    if (delta > 0 && hmSatirlar.length > 0) {
      const eksikler: string[] = []
      for (const hm of hmSatirlar) {
        const birAdet = (hm.miktar || 0) * (wo.mpm || 1)
        if (birAdet <= 0) continue
        const ekTuketim = birAdet * delta
        const mevcut = stokHareketler.filter((h: any) => h.malkod === (hm.malkod || hm.kod))
          .reduce((a: number, h: any) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
        if (mevcut < ekTuketim) {
          eksikler.push(`${hm.malad || hm.malkod}: mevcut ${Math.round(mevcut)}, gerekli ${Math.round(ekTuketim)}`)
        }
      }
      if (eksikler.length > 0) {
        toast.error('Stok yetersiz!\n' + eksikler.join('\n'))
        return
      }
    }

    // Log güncelle
    await supabase.from('uys_logs').update({ qty: yeniQty, fire: yeniFire }).eq('id', l.id)

    // Ürün stok hareketi güncelle
    const { data: sh } = await supabase.from('uys_stok_hareketler').select('id').eq('log_id', l.id).eq('tip', 'giris').limit(1)
    if (sh?.[0]) await supabase.from('uys_stok_hareketler').update({ miktar: yeniQty }).eq('id', sh[0].id)

    // HM stok hareketlerini güncelle (delta)
    if (delta !== 0 && hmSatirlar.length > 0) {
      for (const hm of hmSatirlar) {
        const birAdet = (hm.miktar || 0) * (wo.mpm || 1)
        if (birAdet <= 0) continue
        const hmDelta = birAdet * Math.abs(delta)
        if (delta > 0) {
          // Arttı → ek HM tüketimi
          await supabase.from('uys_stok_hareketler').insert({
            id: uid(), malkod: hm.malkod || hm.kod, malad: hm.malad || hm.ad, miktar: hmDelta,
            tip: 'cikis', kaynak: 'uretim-hm-duzeltme', aciklama: wo.ieNo + ' düzeltme +' + delta,
            tarih: today(), log_id: l.id, wo_id: wo.id,
          })
        } else {
          // Azaldı → HM iadesi
          await supabase.from('uys_stok_hareketler').insert({
            id: uid(), malkod: hm.malkod || hm.kod, malad: hm.malad || hm.ad, miktar: hmDelta,
            tip: 'giris', kaynak: 'uretim-hm-iade', aciklama: wo.ieNo + ' düzeltme ' + delta,
            tarih: today(), log_id: l.id, wo_id: wo.id,
          })
        }
      }
      toast.success(`Log güncellendi: ${l.qty} → ${yeniQty} (${delta > 0 ? '+' : ''}${delta}) · HM stok ${delta > 0 ? 'tüketildi' : 'iade edildi'}`)
    } else {
      toast.success('Log güncellendi')
    }
    loadAll()
  }

  async function deleteLog(l: any) {
    if (!await showConfirm('Bu logu silmek istediğinize emin misiniz? İlişkili stok hareketleri de silinecek.')) return
    await supabase.from('uys_logs').delete().eq('id', l.id)
    await supabase.from('uys_stok_hareketler').delete().eq('log_id', l.id)
    loadAll(); toast.success('Log ve stok hareketleri silindi')
  }
  const ord = orders.find((o: any) => o.id === wo.orderId)
  const woLogs = logs.filter((l: any) => l.woId === wo.id).sort((a: any, b: any) => (b.tarih || '').localeCompare(a.tarih || ''))
  const gunler = new Set(woLogs.map((l: any) => l.tarih))
  const gunlukOrt = gunler.size > 0 ? Math.round(prod / gunler.size) : 0
  const tahminiGun = gunlukOrt > 0 && kalan > 0 ? Math.ceil(kalan / gunlukOrt) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold font-mono">{wo.ieNo} <span className={`text-sm ${pctColor(pct)}`}>{pct}%</span></h2>
            <p className="text-xs text-zinc-500">{ord?.siparisNo || ''} · {ord?.musteri || ''} · Kırılım: {wo.kirno}</p>
            <div className="text-sm font-medium mt-1">{wo.malad}</div>
            <div className="flex gap-1.5 mt-1.5"><span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/8 text-accent border border-accent/15">{wo.opAd || '—'}</span>{wo.istAd && <span className="text-[10px] text-zinc-500">{wo.istAd}</span>}</div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        {wo.whAlloc > 0 && <div className="mb-3 text-[10px] px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/15 inline-block">Depodan kullanılan: {wo.whAlloc} adet</div>}

        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-bg-2 border border-border rounded-lg p-3 text-center"><div className="text-[10px] text-zinc-500 font-mono mb-1">HEDEF</div><div className="text-xl font-mono font-bold cursor-pointer hover:text-accent" onClick={() => updateHedef(wo.id)}>{wo.hedef}</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-3 text-center"><div className="text-[10px] text-zinc-500 font-mono mb-1">GERÇEKLEŞEN</div><div className={`text-xl font-mono font-bold ${pctColor(pct)}`}>{prod}</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-3 text-center"><div className="text-[10px] text-zinc-500 font-mono mb-1">KALAN</div><div className="text-xl font-mono font-bold">{kalan}</div></div>
          <div className="bg-bg-2 border border-border rounded-lg p-3 text-center"><div className="text-[10px] text-zinc-500 font-mono mb-1">TAHMİNİ</div><div className="text-sm font-mono text-accent">{kalan <= 0 ? '✅' : tahminiGun > 0 ? `${tahminiGun} gün` : '—'}</div></div>
        </div>
        <div className="w-full h-1.5 bg-bg-3 rounded-full overflow-hidden mb-4"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct > 0 ? 'bg-accent' : 'bg-zinc-700'}`} style={{ width: `${Math.max(2, pct)}%` }} /></div>

        <div className="mb-4 flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Atanan Operatör:</span>
          <select value={wo.operatorId || ''} onChange={async e => { const opId = e.target.value || null; const op = operators.find((o: any) => o.id === opId); await supabase.from('uys_work_orders').update({ operator_id: opId }).eq('id', wo.id); loadAll(); toast.success(op ? op.ad + ' atandı' : 'Operatör kaldırıldı') }} className="px-2 py-1 bg-bg-2 border border-border rounded text-xs text-zinc-200">
            <option value="">— Atanmadı —</option>
            {operators.filter((o: any) => o.aktif !== false).sort((a: any, b: any) => a.ad.localeCompare(b.ad, 'tr')).map((o: any) => <option key={o.id} value={o.id}>{o.ad} ({o.bolum})</option>)}
          </select>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(wo.durum === 'beklemede' || wo.durum === 'tamamlandi') && <button onClick={() => { setDurum(wo.id, 'uretimde'); onClose() }} className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs hover:bg-accent/20">▶ {wo.durum === 'tamamlandi' ? 'Devam Ettir' : 'Devam Et'}</button>}
          {wo.durum !== 'beklemede' && wo.durum !== 'tamamlandi' && wo.durum !== 'iptal' && <button onClick={() => { setDurum(wo.id, 'beklemede'); onClose() }} className="px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-xs hover:bg-purple-500/20">⏸ Beklet</button>}
          {wo.durum !== 'tamamlandi' && wo.durum !== 'iptal' && prod > 0 && <button onClick={() => { setDurum(wo.id, 'tamamlandi'); onClose() }} className="px-3 py-1.5 bg-green/10 text-green rounded-lg text-xs hover:bg-green/20">✓ Tamamla</button>}
          {wo.durum !== 'iptal' && wo.durum !== 'tamamlandi' && (prod === 0 ? <button onClick={() => { deleteWO(wo.id); onClose() }} className="px-3 py-1.5 bg-red/10 text-red rounded-lg text-xs hover:bg-red/20">🗑 Sil</button> : <button onClick={() => { setDurum(wo.id, 'iptal'); onClose() }} className="px-3 py-1.5 bg-red/10 text-red rounded-lg text-xs hover:bg-red/20">✕ İptal Et</button>)}
        </div>

        {(() => {
          const rc = wo.rcId ? recipes.find((r: any) => r.id === wo.rcId) : recipes.find((r: any) => r.mamulKod === wo.mamulKod)
          if (!rc?.satirlar?.length) return null
          const kirno = wo.kirno || '1'; const depth = kirno.split('.').length
          const parentKirno = depth > 1 ? kirno.split('.').slice(0, -1).join('.') : ''
          const prevSteps = rc.satirlar.filter((s: any) => s.opId && s.kirno.startsWith(kirno + '.') && s.kirno.split('.').length === depth + 1)
          const nextStep = parentKirno ? rc.satirlar.find((s: any) => s.kirno === parentKirno && s.opId) : null
          const directHM = rc.satirlar.filter((s: any) => s.tip === 'Hammadde' && s.kirno.startsWith(kirno + '.') && s.kirno.split('.').length === depth + 1)
          const sipAdet = ord?.adet || wo.hedef || 1
          return (<>{prevSteps.length > 0 && <div className="mb-3 p-3 bg-purple-500/5 border border-purple-500/15 rounded-lg"><div className="text-[10px] font-semibold text-purple-400 mb-1.5">Önceki Adım — Bu yarı mamulün girdileri</div>{prevSteps.map((s: any, i: number) => <div key={i} className="flex justify-between text-xs py-1 border-b border-border/20"><span><span className="font-mono text-zinc-600 text-[9px]">{s.kirno} </span>{s.malad}</span><div className="flex gap-1.5 items-center"><span className="text-[9px] px-1 rounded bg-accent/8 text-accent">{s.opAd || '—'}</span><span className="font-mono text-zinc-500">{Math.round(sipAdet * s.miktar)}</span></div></div>)}</div>}
          {directHM.length > 0 && <div className="mb-3 p-3 bg-cyan-500/5 border border-cyan-500/15 rounded-lg"><div className="text-[10px] font-semibold text-cyan-400 mb-1.5">Hammadde (Direkt Girdi)</div>{directHM.map((h: any, i: number) => <div key={i} className="flex justify-between text-xs py-1 border-b border-border/20"><span>{h.malad}</span><span className="font-mono text-cyan-400">{Math.round(sipAdet * h.miktar)} adet</span></div>)}</div>}
          {nextStep && <div className="mb-3 p-3 bg-green/5 border border-green/15 rounded-lg"><div className="text-[10px] font-semibold text-green mb-1.5">Sonraki Adım — Montaj</div><div className="flex justify-between text-xs"><span><span className="font-mono text-zinc-600 text-[9px]">{nextStep.kirno} </span>{nextStep.malad}</span><div className="flex gap-1.5 items-center"><span className="text-[9px] px-1 rounded bg-accent/8 text-accent">{nextStep.opAd || '—'}</span><span className="font-mono text-zinc-500">{Math.round(sipAdet * nextStep.miktar)}</span></div></div></div>}
          </>)
        })()}

        {(() => {
          const isKesim = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH'].some(k => (wo.opAd || '').toUpperCase().includes(k))
          if (!isKesim) return null
          const ilgili: any[] = []
          cuttingPlans.forEach((p: any) => p.satirlar?.forEach((s: any) => s.kesimler?.forEach((k: any) => { if (k.woId === wo.id) ilgili.push({ plan: p, kesim: k }) })))
          if (!ilgili.length) return null
          return <div className="mb-3 p-3 bg-green/5 border border-green/15 rounded-lg"><div className="text-[10px] font-semibold text-green mb-1.5">✂ Kesim Planı</div>{ilgili.map((item: any, i: number) => <div key={i} className="flex justify-between text-xs py-1 border-b border-border/20"><span><span className="font-mono text-zinc-600 text-[9px]">{item.plan.hamMalkod} </span>{item.kesim.malad || ''}</span><span className="font-mono text-green">{item.kesim.parcaBoy}mm{item.kesim.parcaEn ? ' × ' + item.kesim.parcaEn + 'mm' : ''} × <b>{item.kesim.adet}</b></span></div>)}</div>
        })()}

        {wo.hm?.length > 0 && <div className="mb-4"><h3 className="text-sm font-semibold mb-2">Hammadde Bileşenleri</h3><div className="bg-bg-2 border border-border rounded-lg overflow-hidden"><table className="w-full text-xs"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Malzeme</th><th className="text-right px-3 py-2">Toplam İhtiyaç</th></tr></thead><tbody>{wo.hm.map((h: any, i: number) => <tr key={i} className="border-b border-border/30"><td className="px-3 py-1.5"><span className="font-mono text-accent text-[11px]">{h.malkod}</span> {h.malad}</td><td className="px-3 py-1.5 text-right font-mono">{h.miktarTotal}</td></tr>)}</tbody></table></div></div>}

        {(() => {
          const sk = getStokDurum(wo); if (!sk || sk.durum === 'OK') return null
          return <div className={`mb-4 p-3 rounded-lg border ${sk.durum === 'YOK' ? 'bg-red/5 border-red/20' : 'bg-amber/5 border-amber/20'}`}><div className={`text-xs font-semibold mb-2 ${sk.durum === 'YOK' ? 'text-red' : 'text-amber'}`}>{sk.durum === 'YOK' ? '🚫 Stok Yok' : '⚠ Stok Eksik'} — Max: {sk.maxYapilabilir}</div><table className="w-full text-[11px]"><thead><tr className="text-zinc-500"><th className="text-left pb-1">Malzeme</th><th className="text-right pb-1">Gerekli</th><th className="text-right pb-1">Mevcut</th><th className="text-right pb-1">Açık Ted.</th><th className="text-right pb-1">Durum</th></tr></thead><tbody>{sk.satirlar.map((s: any, i: number) => <tr key={i}><td className="py-0.5"><span className="font-mono text-accent text-[9px]">{s.malkod}</span> {s.malad}</td><td className="py-0.5 text-right font-mono">{s.gerekli}</td><td className="py-0.5 text-right font-mono text-green">{s.mevcut}</td><td className="py-0.5 text-right font-mono text-zinc-500">{s.acikTed > 0 ? s.acikTed : '—'}</td><td className={`py-0.5 text-right font-mono text-[10px] ${s.durum === 'YOK' ? 'text-red' : s.durum === 'BEKLIYOR' ? 'text-purple-400' : 'text-amber'}`}>{s.durum}</td></tr>)}</tbody></table></div>
        })()}

        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Hareket Geçmişi ({woLogs.length} kayıt)</h3>
          <button onClick={() => setAdminEntryWO(wo.id)} className="px-3 py-1.5 bg-green/10 border border-green/20 text-green rounded-lg text-xs font-semibold hover:bg-green/20">+ Kayıt Ekle</button>
        </div>
        {woLogs.length > 0 ? (
          <div className="overflow-x-auto mb-4"><table className="w-full text-xs min-w-[500px]"><thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Tarih</th><th className="text-right px-3 py-2">Adet</th><th className="text-left px-3 py-2">Operatör / Duruş</th><th className="text-left px-3 py-2">Not</th><th className="px-3 py-2"></th></tr></thead><tbody>
            {woLogs.map((l: any) => {
              const oprList = l.operatorlar || []; const durusList = l.duruslar || []
              return (<tr key={l.id} className="border-b border-border/30">
                <td className="px-3 py-1.5 font-mono text-zinc-500 whitespace-nowrap">{l.tarih}</td>
                <td className="px-3 py-1.5 text-right font-mono text-sm font-bold text-green pr-3">+{l.qty}{l.fire > 0 && <span className="text-red text-[10px] ml-1">🔥{l.fire}</span>}</td>
                <td className="px-3 py-1.5"><div className="flex flex-wrap gap-1">{oprList.length > 0 ? oprList.map((op: any, i: number) => <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-accent/10 text-[10px]">{op.ad}{(op.bas || op.bit) && <span className="font-mono text-zinc-500 ml-1">{op.bas || ''}→{op.bit || ''}</span>}</span>) : <span className="text-[10px] text-zinc-600">—</span>}</div>{durusList.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{durusList.map((d: any, i: number) => <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-red/8 border border-red/15 text-[10px] text-red">⏸ {d.sebep || d.kodAd || ''}{d.sure ? ` ${d.sure}dk` : ''}</span>)}</div>}</td>
                <td className="px-3 py-1.5 text-zinc-500 text-[11px]">{l.not || ''}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <button onClick={() => editLog(l)} className="text-zinc-600 hover:text-amber text-[10px] mr-1">Düz.</button>
                  <button onClick={() => deleteLog(l)} className="text-zinc-600 hover:text-red text-[10px]">×</button>
                </td>
              </tr>)
            })}
          </tbody></table></div>
        ) : <div className="text-zinc-600 text-xs p-3 mb-4">Kayıt yok</div>}
        <div className="flex justify-end"><button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white">Kapat</button></div>
        {adminEntryWO && <OprEntryModal woId={adminEntryWO} oprId="admin" oprAd="Admin" allOperators={operators} durusKodlari={durusKodlari}
          onClose={() => setAdminEntryWO(null)} onSaved={() => { setAdminEntryWO(null); loadAll(); toast.success('Üretim kaydı eklendi') }} />}
      </div>
    </div>
  )
}

function NewIEModal({ operations, orders, recipes, onClose, onSaved }: {
  operations: { id: string; kod: string; ad: string; bolum?: string }[]
  orders: { id: string; siparisNo: string }[]
  recipes: { id: string; rcKod: string; ad: string; mamulKod: string; mamulAd: string; satirlar: { id: string; kirno: string; malkod: string; malad: string; tip: string; miktar: number; birim: string; opId: string; istId: string; hazirlikSure: number; islemSure: number }[] }[]
  onClose: () => void; onSaved: () => void
}) {
  const { materials, stations } = useStore()
  const [rcId, setRcId] = useState('')
  const [malkod, setMalkod] = useState('')
  const [malad, setMalad] = useState('')
  const [hedef, setHedef] = useState('')
  const [opId, setOpId] = useState('')
  const [istId, setIstId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [not_, setNot] = useState('')
  const [rcSearch, setRcSearch] = useState('')

  // Reçete seçilince auto-fill
  function selectRecipe(id: string) {
    setRcId(id)
    const rc = recipes.find(r => r.id === id)
    if (!rc) return
    setMalkod(rc.mamulKod || '')
    setMalad(rc.mamulAd || '')
    // İlk operasyon satırını al
    const firstOp = rc.satirlar?.find(s => s.opId)
    if (firstOp) {
      setOpId(firstOp.opId)
      if (firstOp.istId) setIstId(firstOp.istId)
    }
  }

  // Reçete listesi (filtrelenmiş)
  const filteredRecipes = useMemo(() => {
    if (!rcSearch) return recipes.slice(0, 30)
    const q = rcSearch.toLowerCase()
    return recipes.filter(r =>
      (r.rcKod || '').toLowerCase().includes(q) ||
      (r.ad || '').toLowerCase().includes(q) ||
      (r.mamulKod || '').toLowerCase().includes(q) ||
      (r.mamulAd || '').toLowerCase().includes(q)
    ).slice(0, 30)
  }, [recipes, rcSearch])

  // Malzeme seçenekleri (SearchSelect için)
  const malOptions = useMemo(() =>
    materials.map(m => ({ value: m.kod, label: `${m.kod} — ${m.ad}`, sub: m.tip || '' }))
  , [materials])

  // İstasyon listesi (seçili operasyona göre filtrelenmiş)
  const uygunIstasyonlar = useMemo(() => {
    if (!opId) return stations
    return stations.filter(s => (s.opIds || []).includes(opId))
  }, [stations, opId])

  // Seçili reçetenin HM satırları
  const selectedRc = recipes.find(r => r.id === rcId)
  const hmSatirlar = selectedRc?.satirlar?.filter(s => s.tip === 'Hammadde' || s.tip === 'hammadde' || s.tip === 'YarıMamul') || []

  async function save() {
    if (!malad.trim() || !hedef) { toast.error('Malzeme adı ve hedef zorunlu'); return }
    const op = operations.find(o => o.id === opId)
    const ist = stations.find(s => s.id === istId)
    // HM dizisini reçeteden al
    const hm = hmSatirlar.map(s => ({
      malkod: s.malkod, malad: s.malad,
      miktarTotal: s.miktar * (parseInt(hedef) || 1)
    }))
    await supabase.from('uys_work_orders').insert({
      id: uid(), order_id: orderId || null, rc_id: rcId || null,
      sira: 1, kirno: '1',
      op_id: opId || null, op_kod: op?.kod || '', op_ad: op?.ad || '',
      ist_id: istId || null, ist_kod: ist?.kod || '', ist_ad: ist?.ad || '',
      malkod: malkod.trim(), malad: malad.trim(),
      hedef: parseInt(hedef) || 0, mpm: 1,
      hm: hm.length ? hm : [],
      ie_no: `IE-MANUAL-${Date.now().toString(36).toUpperCase()}`,
      durum: 'bekliyor', bagimsiz: !orderId, siparis_disi: !orderId,
      mamul_kod: malkod.trim(), mamul_ad: malad.trim(),
      not_: not_, olusturma: today()
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Yeni İş Emri</h2>
        <div className="space-y-3">

          {/* Reçete seçimi */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Reçete (opsiyonel)</label>
            <div className="relative">
              <input
                value={rcId ? (selectedRc ? `${selectedRc.rcKod} — ${selectedRc.mamulAd}` : rcId) : rcSearch}
                onChange={e => { setRcSearch(e.target.value); if (rcId) { setRcId(''); setRcSearch(e.target.value) } }}
                onFocus={() => { if (rcId) { setRcId(''); setRcSearch('') } }}
                placeholder="Reçete ara... (kod veya ürün adı)"
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent"
              />
              {rcId && <button onClick={() => { setRcId(''); setRcSearch('') }} className="absolute right-2 top-2 text-zinc-500 hover:text-white text-sm">✕</button>}
            </div>
            {!rcId && rcSearch && filteredRecipes.length > 0 && (
              <div className="mt-1 bg-bg-1 border border-border rounded-lg shadow-xl max-h-40 overflow-y-auto">
                {filteredRecipes.map(r => (
                  <button key={r.id} onClick={() => { selectRecipe(r.id); setRcSearch('') }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-bg-3 text-zinc-300">
                    <span className="font-mono text-accent">{r.rcKod}</span> — {r.mamulAd || r.ad}
                    {r.satirlar?.length > 0 && <span className="text-zinc-600 ml-1">({r.satirlar.length} satır)</span>}
                  </button>
                ))}
              </div>
            )}
            {!rcId && !rcSearch && (
              <div className="text-[10px] text-zinc-600 mt-1">Reçetesiz de İE oluşturulabilir — aşağıdan manuel doldurun</div>
            )}
          </div>

          {/* Malzeme — Aranabilir */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Malzeme / Ürün *</label>
            <SearchSelect
              options={malOptions}
              value={malkod}
              onChange={(val, lbl) => {
                setMalkod(val)
                const m = materials.find(mm => mm.kod === val)
                setMalad(m ? m.ad : lbl.includes(' — ') ? lbl.split(' — ').slice(1).join(' — ') : lbl)
              }}
              placeholder="Malzeme ara... (kod veya ad)"
              allowNew={false}
            />
            {malkod && <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">{malkod}</div>}
          </div>

          {/* Malzeme Adı (düzenlenebilir) */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Adı *</label>
            <input value={malad} onChange={e => setMalad(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Hedef Adet *</label>
              <input type="number" value={hedef} onChange={e => setHedef(e.target.value)} min={1}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Operasyon</label>
              <select value={opId} onChange={e => setOpId(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
                <option value="">— Seçin —</option>
                {operations.map(o => <option key={o.id} value={o.id}>{o.ad}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">İstasyon</label>
              <select value={istId} onChange={e => setIstId(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
                <option value="">— Seçin —</option>
                {uygunIstasyonlar.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Sipariş Bağla</label>
              <select value={orderId} onChange={e => setOrderId(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
                <option value="">— Bağımsız İE —</option>
                {orders.map(o => <option key={o.id} value={o.id}>{o.siparisNo}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
            <input value={not_} onChange={e => setNot(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>

          {/* Seçili reçetenin HM bilgisi */}
          {hmSatirlar.length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-500 mb-1">Reçeteden gelen hammaddeler ({hmSatirlar.length})</div>
              <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead><tr className="border-b border-border text-zinc-600"><th className="text-left px-2 py-1">Malzeme</th><th className="text-right px-2 py-1">Birim Miktar</th><th className="text-right px-2 py-1">Toplam</th></tr></thead>
                  <tbody>{hmSatirlar.map((s, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="px-2 py-1 text-zinc-300" title={s.malkod}>{s.malad || s.malkod}</td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-400">{s.miktar} {s.birim}</td>
                      <td className="px-2 py-1 text-right font-mono text-accent">{Math.round(s.miktar * (parseInt(hedef) || 1) * 100) / 100}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Oluştur</button>
        </div>
      </div>
    </div>
  )
}
