import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Download, ArrowRight } from 'lucide-react'
import { hesaplaMRP, rezerveYaz, rezerveleriSenkronla, mrpTedarikOlustur, type MRPRow } from '@/features/production/mrp'
// v15.95 — Madde 15 P3: Hammadde tahsis FIFO
import { hesaplaHammaddeTahsisi, siparisTahsisOzeti } from '@/features/production/hammaddeTahsis'
import { isOrderArchived } from '@/lib/statusUtils'
import { advanceFlow, completeFlow } from '@/lib/pendingFlow'
import { FlowProgress } from '@/components/FlowProgress'

export function MRP() {
  const { orders, workOrders, logs, recipes, stokHareketler, tedarikler, cuttingPlans, materials, mrpRezerve, loadAll } = useStore()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeFlowId = searchParams.get('flow') || ''  // v15.36 — flow akışı
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [sonuc, setSonuc] = useState<MRPRow[]>([])
  const [hesaplandi, setHesaplandi] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [flowAutoDone, setFlowAutoDone] = useState(false)  // v15.36

  const [showTamamlanan, setShowTamamlanan] = useState(false)
  // v15.71 — selectedYMs, showYMTamamlanan, mrpDoneYMs, ymIEs, ymTamamSayisi, toggleYM kaldırıldı (madde 18)
  // v15.50a.3 — Default 'tum': hesap sonrasi tum satirlar gorunur (eksik+yeterli).
  // Kullanici "X eksik" rozetine tiklayarak filtreleyebilir. Eski default 'eksik'
  // 0 eksik durumda bos tablo gosteriyordu, kullanici "MRP yapildi mi?" karisikliga dusuyordu.
  const [viewFilter, setViewFilter] = useState<'eksik' | 'yeterli' | 'tum'>('tum')

  // v15.71 — mrpDoneYMs useMemo kaldırıldı (madde 18)

  // v15.50a.5 — TEK KURAL:
  // Sipariş MRP listesinde görünür ⇔ kilit açık VE hesaplaMRP sonucunda net > 0 var.
  // mrp_durum, açık tedarik listesi → filter'da kullanılmaz, sadece bilgi rozeti.
  // hesaplaMRP zaten stok + açık tedarik düşümü yapıyor → net > 0 yoksa stok yeterli demektir.
  // v15.50b — Inline ARCHIVED_STATES set'i statusUtils.isOrderArchived helper'ına geçirildi.
  // Helper '.toLowerCase().trim()' yapıyor → büyük/küçük harf varyantlarına dirençli.

  // Cutting plans için map (hesaplaMRP imzası gerektiriyor)
  const cpMappedAll = useMemo(() => cuttingPlans.map((p: any) => ({
    hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
    gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
  })), [cuttingPlans])

  // Her sipariş için net>0 var mı? Tek seferde tüm aktif siparişler için map'le.
  const orderHasEksik = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const o of orders) {
      // Kilitli ise atla — zaten gizlenecek
      if (isOrderArchived(o)) { map[o.id] = false; continue }
      try {
        const sonuc = hesaplaMRP([o.id], orders as any, workOrders, recipes, stokHareketler, tedarikler, cpMappedAll, materials, null, mrpRezerve, o.id, logs)
        map[o.id] = sonuc.some(r => r.net > 0)
      } catch {
        map[o.id] = false
      }
    }
    return map
  }, [orders, workOrders, recipes, stokHareketler, tedarikler, cpMappedAll, materials, mrpRezerve])

  const aktifOrders = useMemo(() => {
    return orders.filter(o => {
      // Kilitli → arşiv
      if (isOrderArchived(o)) return showTamamlanan
      // v15.88 — "Bekliyor" durumundaki siparis MRP henuz hesaplanmamis demek;
      // ihtiyac belli olmadigi icin EKSIK gibi (aktif) gosterilmeli ki kullanici
      // Hesapla butonuna basabilsin. Eski kod sadece eksikVar bakiyordu, yeni
      // siparis acilip MRP hesaplanmamissa "0 aktif siparis" goruntusu cikiyordu.
      const eksikVar = orderHasEksik[o.id] ?? false
      const henuzHesaplanmadi = (o.mrpDurum || 'bekliyor') === 'bekliyor'
      // v16.01 — DB'de mrp_durum='eksik' ise zorla aktif say. Sebep: hesaplaMRP cutting plan
      // override mantığı bazı durumlarda (yüzey kesim, 1D bin-packing) gerçek ihtiyacın
      // altında plan adedi yazıyor → eksikVar=false dönüyor ama mrp_durum='eksik' kalıyor.
      // Topbar (mrp_durum sayar) ile liste (eksikVar bakar) çelişiyordu. v16.02'de kök fix
      // (cutting.ts kesimTip='yuzey' override koruması) gelene kadar saha-açıcı band-aid.
      const dbEksik = (o.mrpDurum || '') === 'eksik'
      const aktifMi = eksikVar || henuzHesaplanmadi || dbEksik
      return showTamamlanan ? !aktifMi : aktifMi
    }).sort((a, b) => (a.termin || '').localeCompare(b.termin || ''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, orderHasEksik, showTamamlanan])

  // v15.95 — Madde 15 P3: Hammadde FIFO termin tahsisi
  // Tum aktif siparişler arasinda hammadde paylastirmasi (request-time).
  // Buradan donen tahsis -> her siparis kartinda rozet (yesil/sari/kirmizi).
  const hammaddeTahsis = useMemo(() => {
    try {
      return hesaplaHammaddeTahsisi(
        aktifOrders as any,
        workOrders,
        recipes,
        stokHareketler,
        tedarikler,
        cpMappedAll,
        materials,
        logs.map(l => ({ woId: l.woId, qty: l.qty })),
      )
    } catch (e) {
      console.error('[v15.95] hammaddeTahsis hesabi hata:', e)
      return {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktifOrders, workOrders, recipes, stokHareketler, tedarikler, cpMappedAll, materials, logs])

  // Her siparis icin tahsis ozet rozet rengi (yesil/sari/kirmizi/yok)
  const orderTahsisOzeti = useMemo(() => {
    const map: Record<string, { durum: 'yesil' | 'sari' | 'kirmizi' | 'yok'; eksikSayi: number; toplamMalzeme: number }> = {}
    for (const o of aktifOrders) {
      map[o.id] = siparisTahsisOzeti(o.id, hammaddeTahsis)
    }
    return map
  }, [aktifOrders, hammaddeTahsis])

  // v15.78 — Manuel İE'ler (siparişe bağlı değil) sipariş kartlarıyla aynı listede.
  // Saha vakası: IE-MANUAL-MO9SDW3A 6740 adet, "stok yok" hard block veriyor ama MRP'de
  // görünmüyordu (orderId=null + ordIdSet filtresi). v15.59'da kaldırılan UI bölümü
  // burada §13 madde 18 felsefesine uygun şekilde geri geldi: ayrı kart değil, tek liste.
  const aktifManualIesAll = useMemo(() => workOrders.filter(w =>
    (w.bagimsiz || w.siparisDisi) &&
    !w.orderId &&
    w.durum !== 'iptal' &&
    w.durum !== 'tamamlandi'
  ), [workOrders])

  // Her manuel İE için "eksik var mı?" — explicit seçimle çağırırsak ordIdSet bypass.
  const manualIeHasEksik = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const w of aktifManualIesAll) {
      try {
        const sonuc = hesaplaMRP([], orders as any, workOrders, recipes, stokHareketler, tedarikler, cpMappedAll, materials, new Set([w.id]), mrpRezerve, undefined, logs)
        map[w.id] = sonuc.some(r => r.net > 0)
      } catch {
        map[w.id] = false
      }
    }
    return map
  }, [aktifManualIesAll, orders, workOrders, recipes, stokHareketler, tedarikler, cpMappedAll, materials, mrpRezerve])

  const aktifManualIes = useMemo(() => {
    return aktifManualIesAll.filter(w => {
      const eksikVar = manualIeHasEksik[w.id] ?? false
      return showTamamlanan ? !eksikVar : eksikVar
    }).sort((a, b) => (a.termin || '').localeCompare(b.termin || ''))
  }, [aktifManualIesAll, manualIeHasEksik, showTamamlanan])

  const arsivManualIes = useMemo(() =>
    aktifManualIesAll.filter(w => !(manualIeHasEksik[w.id] ?? false)).length
  , [aktifManualIesAll, manualIeHasEksik])

  const arsivSayisi = useMemo(() =>
    orders.filter(o => {
      if (isOrderArchived(o)) return true
      return !(orderHasEksik[o.id] ?? false)
    }).length + arsivManualIes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [orders, orderHasEksik, arsivManualIes])

  // v15.71 — ymIEs + ymTamamSayisi useMemo kaldırıldı (madde 18)

  function toggleOrder(id: string) { setSelectedOrders(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function selectAll() {
    // v15.78 — sipariş ID'leri + manuel İE WO ID'leri birlikte
    const ids = [...aktifOrders.map(o => o.id), ...aktifManualIes.map(w => w.id)]
    setSelectedOrders(new Set(ids))
  }
  function selectNone() { setSelectedOrders(new Set()) }

  // v15.78 — selectedOrders set'i hem order_id hem manuel WO_id taşıyabilir.
  // Hesapla() çağrısında ayrıştırılır.
  function splitSelected(sel: Set<string>): { ordIds: string[]; ymIds: string[] } {
    const ordIds: string[] = []
    const ymIds: string[] = []
    for (const id of sel) {
      if (orders.some(o => o.id === id)) ordIds.push(id)
      else if (workOrders.some(w => w.id === id)) ymIds.push(id)
    }
    return { ordIds, ymIds }
  }

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

  async function senkronla() {
    if (!await showConfirm('Tüm aktif siparişlerin rezerveleri termin-FIFO ile yeniden hesaplanacak. Eski rezerve kayıtları silinip doğru değerlerle yeniden yazılacak. Devam?')) return
    const cpMapped = cuttingPlans.map((p: any) => ({
      hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
      gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
    }))
    try {
      const { siparisSayisi, rezerveSayisi } = await rezerveleriSenkronla(
        orders as any, workOrders, recipes, stokHareketler, tedarikler, cpMapped, materials
      )
      loadAll()
      toast.success(`${siparisSayisi} sipariş · ${rezerveSayisi} rezerve kaydı yazıldı`)
    } catch (e: any) {
      toast.error('Senkronizasyon hatası: ' + (e?.message || 'bilinmeyen'))
      console.error(e)
    }
  }

  async function hesapla(overrideOrderIds?: string[], overrideYMs?: Set<string>) {
    // v15.36: override parametreleri auto-run için (state async olduğundan state'e güvenilemez)
    // v15.78: selectedOrders set'i sipariş + manuel İE id'leri içerebilir → splitSelected ile ayır
    const useOverride = overrideOrderIds !== undefined
    let ordIds: string[]
    let ymSet: Set<string> | null
    if (useOverride) {
      ordIds = overrideOrderIds
      ymSet = (overrideYMs && overrideYMs.size > 0) ? overrideYMs : null
    } else {
      const split = splitSelected(selectedOrders)
      ordIds = split.ordIds
      ymSet = split.ymIds.length > 0 ? new Set(split.ymIds) : null
    }

    if (!ordIds.length && !(ymSet && ymSet.size)) { toast.error('Sipariş veya iş emri seçin'); return }

    const cpMapped = cuttingPlans.map((p: any) => ({
      hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
      gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
    }))
    const result = hesaplaMRP(ordIds, orders as any, workOrders, recipes, stokHareketler, tedarikler, cpMapped, materials, ymSet, mrpRezerve, undefined, logs)
    setSonuc(result)
    setHesaplandi(true)

    // Her siparişin kendi durumunu ayrı ayrı hesapla ve yaz (manuel İE'lerde mrp_durum kolonu yok, atla)
    for (const oid of ordIds) {
      const tekResult = hesaplaMRP([oid], orders as any, workOrders, recipes, stokHareketler, tedarikler, cpMapped, materials, null, mrpRezerve, oid, logs)
      const yeniDurum = tekResult.some(r => r.net > 0) ? 'eksik' : 'tamam'

      // v16.04 — #23 sentinel: UPDATE DB'ye yansidi mi dogrula. Saha vakasi (30 Nis):
      // Hesapla basildi, ekranda eksik gorundu, ama DB'de updated_at degismedi.
      // RLS / network / async yutma olabilir. Sentinel: hata sessiz kalmasin.
      const o = orders.find((x: any) => x.id === oid)
      const { error: updErr, data: updData } = await supabase
        .from('uys_orders')
        .update({ mrp_durum: yeniDurum })
        .eq('id', oid)
        .select('id, mrp_durum, updated_at')
      if (updErr) {
        console.error('[v16.04 #23 sentinel] UPDATE error:', updErr, 'oid:', oid)
        toast.error(`MRP UPDATE hatasi (sip ${o?.siparisNo || oid}): ${updErr.message}`)
      } else if (!updData || updData.length === 0) {
        // RLS row-level filtre nedeniyle satira ulasilamadi
        console.error('[v16.04 #23 sentinel] UPDATE silently rejected (0 rows):', oid)
        toast.error(`MRP UPDATE atilmadi (sip ${o?.siparisNo || oid}): RLS engelliyor olabilir`)
      }

      // Rezerve kayıtları yaz (eskileri silip yenilerini oluştur)
      await rezerveYaz(oid, tekResult)
    }
    // Seçili YM İE'leri MRP tamamlandı olarak işaretle
    if (ymSet && ymSet.size > 0) {
      const prev = new Set(JSON.parse(localStorage.getItem('uys_mrp_done_ym') || '[]') as string[])
      ymSet.forEach(id => prev.add(id))
      localStorage.setItem('uys_mrp_done_ym', JSON.stringify([...prev]))
    }
    if (ordIds.length) loadAll()

    const eksikSayi = result.filter(r => r.durum === 'eksik').length
    toast.success(result.length + ' kalem hesaplandı · ' + eksikSayi + ' eksik')

    // v15.96 — Madde 15 P4: Bildirim üreticisi
    // Her eksiği olan sipariş için sarı bildirim oluştur (idempotent: aynı kategori+ref_id varsa atla)
    if (eksikSayi > 0) {
      try {
        for (const oid of ordIds) {
          const tekResult = hesaplaMRP([oid], orders as any, workOrders, recipes, stokHareketler, tedarikler, cpMapped, materials, null, mrpRezerve, oid, logs)
          const eksikler = tekResult.filter(r => r.net > 0)
          if (eksikler.length === 0) continue
          const ord = orders.find(o => o.id === oid)
          if (!ord) continue
          // Aynı sipariş için açık (okunmamış) "mrp_eksik" bildirimi var mı?
          const { data: mevcut } = await supabase
            .from('uys_bildirimler')
            .select('id')
            .eq('kategori', 'mrp_eksik')
            .eq('ref_id', oid)
            .eq('okundu', false)
            .limit(1)
          if (mevcut && mevcut.length > 0) continue
          await supabase.from('uys_bildirimler').insert({
            id: uid(),
            tip: 'sari',
            kategori: 'mrp_eksik',
            baslik: `MRP eksik — ${ord.siparisNo}`,
            mesaj: `${ord.musteri || ''} · ${eksikler.length} malzeme eksik (toplam net: ${eksikler.reduce((a, r) => a + r.net, 0)})`,
            ref_id: oid,
            ref_tip: 'order',
            olusturan: 'sistem',
          })
        }
      } catch (e) {
        console.warn('[v15.96] Bildirim olustururken hata:', e)
      }
    }

    // v15.36 — Flow akışında MRP'den tedarik adımına ilerle
    if (activeFlowId) {
      const eksikRows = result.filter(r => r.net > 0).map(r => ({ malkod: r.malkod, net: r.net }))
      await advanceFlow(activeFlowId, 'tedarik', { mrpSonuc: eksikRows })
      if (!eksikSayi) {
        // Eksik yok — akış tamamlandı
        await completeFlow(activeFlowId)
        await loadAll()  // pendingFlows güncellensin, banner kaybolsun
        toast.success('Hiç eksik yok — akış tamamlandı', { duration: 4000 })
      } else {
        await loadAll()  // step güncellensin
      }
    }
  }

  // v15.36 — Flow auto-run: ?flow=xxx ile gelindi, sayfa açılışında otomatik hesapla
  // v15.36.1 — Flow olmasa da sayfa ilk açılışında otomatik seç+hesapla (boş ekran önlenir)
  // v15.78 — Manuel İE'ler de auto-select'e dahil
  useEffect(() => {
    if (flowAutoDone || hesaplandi) return
    if (!orders.length || !workOrders.length) return  // Store hazır olana kadar bekle
    const ordIds = aktifOrders.map(o => o.id)
    const ymIds = aktifManualIes.map(w => w.id)
    if (!ordIds.length && !ymIds.length) return  // Seçilecek bir şey yoksa dokunma
    setSelectedOrders(new Set([...ordIds, ...ymIds]))
    setFlowAutoDone(true)
    // Doğrudan override ile hesapla — state async, closure bug önlenir
    hesapla(ordIds, ymIds.length > 0 ? new Set(ymIds) : undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length, workOrders.length])

  const eksikler = sonuc.filter(s => s.net > 0)
  const yeterliler = sonuc.filter(s => s.net <= 0)

  async function topluTedarikOlustur(overrideMalkods?: string[]) {
    // v15.36: overrideMalkods ile "Tümünü Tedarik Et" butonu (state closure bug'ı önler)
    const secili = overrideMalkods
      ? sonuc.filter(s => overrideMalkods.includes(s.malkod) && s.net > 0)
      : sonuc.filter(s => selectedRows.has(s.malkod) && s.net > 0)
    if (!secili.length) { toast.error('Tedarik oluşturulacak malzeme seçin'); return }
    if (!overrideMalkods) {
      if (!await showConfirm(`${secili.length} malzeme için tedarik oluşturulacak. Devam?`)) return
    }

    // v15.78: selectedOrders set'inde manuel İE id'leri olabilir → mrpTedarikOlustur'a sadece gerçek sipariş id'leri ver
    const { ordIds, ymIds } = splitSelected(selectedOrders)

    // v15.62 — F-21 idempotent kontrolünü kullan: mrpTedarikOlustur'a delege.
    let toplam = 0
    for (const oid of ordIds) {
      const o = orders.find(x => x.id === oid)
      if (!o) continue
      const count = await mrpTedarikOlustur(oid, o.siparisNo, secili, { auto: false })
      toplam += count
      // Bu sipariş için mrp_durum tamam (bekleyen tedarik yetiyor veya yeni açıldı)
      await supabase.from('uys_orders').update({ mrp_durum: 'tamam' }).eq('id', oid)
    }

    // v15.78: Manuel İE seçiliyse, order_id=null tedarik aç (ie_no not'a yazılır).
    // Basit idempotency: aynı malkod + geldi=false varsa atla.
    // (mrpTedarikOlustur ie_id desteklemiyor, manuel İE için ayrı yol — ileride şema genişletilebilir.)
    if (ymIds.length > 0) {
      const ilkYmId = ymIds[0]
      const ilkWO = workOrders.find(w => w.id === ilkYmId)
      const ieNot = ymIds.length === 1
        ? 'MRP — Manuel İE: ' + (ilkWO?.ieNo || ilkYmId)
        : 'MRP — Manuel İE x' + ymIds.length + ' (ilki: ' + (ilkWO?.ieNo || ilkYmId) + ')'
      for (const s of secili) {
        const mevcut = tedarikler.find(t => t.malkod === s.malkod && !t.geldi)
        if (mevcut) continue
        // Eğer aynı malkod sipariş ordIds'inde de eklendiyse (mrpTedarikOlustur tarafından), tekrar açma
        // (mrpTedarikOlustur F-21 ile yeni tedarik açtıysa, secili'deki net düşmedi ama supabase'de var)
        const yeniMevcut = (await supabase.from('uys_tedarikler')
          .select('id').eq('malkod', s.malkod).eq('geldi', false).limit(1)).data
        if (yeniMevcut && yeniMevcut.length > 0) continue
        await supabase.from('uys_tedarikler').insert({
          id: uid(), malkod: s.malkod, malad: s.malad, miktar: Math.ceil(s.net),
          birim: s.birim || 'Adet', tarih: today(), teslim_tarihi: s.termin || null,
          durum: 'bekliyor', geldi: false, not_: ieNot,
          order_id: null, siparis_no: null,
        })
        toplam++
      }
    }

    loadAll(); setSelectedRows(new Set())
    if (toplam > 0) toast.success(toplam + ' tedarik oluşturuldu')
    else toast.info('İhtiyaçlar mevcut bekleyen tedariklerle karşılanıyor — yeni tedarik açılmadı')

    // v15.36 — Flow sonlandır (tedarik oluşturuldu) + Procurement sayfasına git
    if (activeFlowId) {
      await completeFlow(activeFlowId)
      await loadAll()  // pendingFlows store güncellensin ki banner kaybolsun
      toast.success('Akış tamamlandı — tedarik listesine yönlendiriliyor', { duration: 3000 })
      setTimeout(() => { navigate('/procurement') }, 1200)
    }
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
      {/* v15.36 — Flow progress bar */}
      {activeFlowId && (
        <FlowProgress
          flowId={activeFlowId}
          current={hesaplandi && eksikler.length > 0 ? 'tedarik' : 'mrp'}
          actions={
            hesaplandi && eksikler.length > 0 ? (
              <button
                onClick={async () => {
                  if (!await showConfirm(`Tüm ${eksikler.length} eksik malzeme için tedarik oluşturulsun mu?`)) return
                  await topluTedarikOlustur(eksikler.map(e => e.malkod))
                }}
                className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white rounded text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
              >
                ⚡ Tümünü Tedarik Et <ArrowRight size={12} />
              </button>
            ) : undefined
          }
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">📊 MRP — Malzeme İhtiyaç Planlaması</h1>
          <p className="text-xs text-zinc-500">{aktifOrders.length} aktif sipariş{aktifManualIes.length > 0 ? ` · ${aktifManualIes.length} manuel İE` : ''}</p></div>
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
          <div className="text-xs font-semibold text-zinc-500 uppercase">
            Siparişler
            {/* v15.95 — Madde 15 P3: Tahsis ozet sayaclari */}
            {(() => {
              let g = 0, s = 0, r = 0
              for (const o of aktifOrders) {
                const oz = orderTahsisOzeti[o.id]
                if (!oz) continue
                if (oz.durum === 'yesil') g++
                else if (oz.durum === 'sari') s++
                else if (oz.durum === 'kirmizi') r++
              }
              if (g + s + r === 0) return null
              return (
                <span className="ml-2 font-normal normal-case">
                  {g > 0 && <span className="text-green">🟢 {g}</span>}
                  {s > 0 && <span className="text-amber ml-1">🟡 {s}</span>}
                  {r > 0 && <span className="text-red ml-1">🔴 {r}</span>}
                </span>
              )
            })()}
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-zinc-500">Termin ≤</label>
              <input type="date" onChange={e => filterByDate(e.target.value)} className="px-2 py-1 bg-bg-3 border border-border rounded text-[10px] text-zinc-300 focus:outline-none focus:border-accent" />
            </div>
            <button onClick={selectAll} className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">Tümünü Seç</button>
            <button onClick={selectNone} className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">Hiçbirini</button>
            {arsivSayisi > 0 && (
              <button onClick={() => setShowTamamlanan(!showTamamlanan)}
                className={`px-2 py-1 rounded text-[10px] ${showTamamlanan ? 'bg-amber/10 text-amber border border-amber/20' : 'bg-bg-3 text-zinc-500 hover:text-white'}`}>
                {showTamamlanan ? `🔒 Arşiv (${arsivSayisi})` : `+ Arşiv (${arsivSayisi})`}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto">
          {aktifOrders.map(o => {
            const sel = selectedOrders.has(o.id); const pct = orderPct(o.id)
            const mrpDone = o.mrpDurum === 'tamam' || o.mrpDurum === 'tamamlandi'
            // v15.95 — Madde 15 P3: tahsis ozet rozet
            const tahsisOzet = orderTahsisOzeti[o.id]
            return (
              <button key={o.id} onClick={() => toggleOrder(o.id)}
                className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${sel ? 'bg-accent/10 border border-accent/30' : mrpDone ? 'bg-green/5 border border-green/15' : 'bg-bg-3 border border-border'}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={sel} readOnly className="accent-accent" />
                  <span className="font-mono font-medium">{o.siparisNo}</span>
                  {mrpDone && <span className="px-1 py-0.5 bg-green/10 text-green rounded text-[9px]">MRP ✓</span>}
                  {/* v15.95 — Hammadde tahsis durumu (FIFO termin) */}
                  {tahsisOzet && tahsisOzet.durum !== 'yok' && (
                    <span
                      className={`px-1 py-0.5 rounded text-[9px] font-semibold ${
                        tahsisOzet.durum === 'yesil' ? 'bg-green/15 text-green' :
                        tahsisOzet.durum === 'sari' ? 'bg-amber/15 text-amber' :
                        'bg-red/15 text-red'
                      }`}
                      title={
                        tahsisOzet.durum === 'yesil' ? `Tum hammadde stokta (${tahsisOzet.toplamMalzeme} malzeme)` :
                        tahsisOzet.durum === 'sari' ? `Stok yetersiz, tedarik yolda (${tahsisOzet.toplamMalzeme} malzemenin bir kismi)` :
                        `${tahsisOzet.eksikSayi}/${tahsisOzet.toplamMalzeme} malzeme eksik (yeni tedarik gerek)`
                      }
                    >
                      {tahsisOzet.durum === 'yesil' && '🟢'}
                      {tahsisOzet.durum === 'sari' && '🟡'}
                      {tahsisOzet.durum === 'kirmizi' && `🔴 ${tahsisOzet.eksikSayi}`}
                    </span>
                  )}
                  <span className="text-zinc-500 ml-auto">{pct}%</span>
                </div>
                <div className="text-zinc-500 truncate mt-0.5">{o.musteri} · {o.mamulAd || ''}</div>
              </button>
            )
          })}
          {/* v15.78 — Manuel İE'ler aynı görselde, "STOK" rozetiyle.
              Saha vakası IE-MANUAL-MO9SDW3A bug'ı bu sayede MRP'de görünür hale gelir. */}
          {aktifManualIes.map(w => {
            const sel = selectedOrders.has(w.id)
            const uretildi = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
            const pct = w.hedef > 0 ? Math.min(100, Math.round(uretildi / w.hedef * 100)) : 0
            return (
              <button key={w.id} onClick={() => toggleOrder(w.id)}
                className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${sel ? 'bg-accent/10 border border-accent/30' : 'bg-bg-3 border border-amber/20'}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={sel} readOnly className="accent-accent" />
                  <span className="font-mono font-medium">{w.ieNo}</span>
                  <span className="px-1 py-0.5 bg-amber/15 text-amber rounded text-[9px]" title="Siparişe bağlı değil — stok için açılmış manuel İE">STOK</span>
                  <span className="text-zinc-500 ml-auto">{pct}%</span>
                </div>
                <div className="text-zinc-500 truncate mt-0.5">{w.malad || w.malkod}</div>
              </button>
            )
          })}
        </div>
        {aktifOrders.length === 0 && aktifManualIes.length === 0 && !showTamamlanan && (
          <div className="p-3 text-center text-xs text-green">
            ✓ Aktif sipariş veya manuel İE yok.{arsivSayisi > 0 ? ` Arşivdeki ${arsivSayisi} kapalı kaydı görmek için "+ Arşiv" butonuna tıklayın.` : ''}
          </div>
        )}

        {/* v15.78 (saha bug'ı düzeltmesi): "Bağımsız YM İş Emirleri" bölümü #13 madde 18
            felsefesine uygun şekilde geri eklendi — ayrı kart değil, sipariş kartlarıyla
            aynı listede "STOK" rozetiyle. v15.59 öncesinden farkı: tek liste, tek "Hesapla".
            Saha vakası: IE-MANUAL-MO9SDW3A 6740 adet, hammadde yetersiz, hard block veriyordu
            ama MRP'de görünmüyordu (orderId=null + ordIdSet filtresi). Şimdi UI explicit
            seçim → mrp.ts secilenYMIds override → ihtiyaç çıkar.
        */}

        <div className="flex items-center gap-3 mt-3">
          <button onClick={() => hesapla()} disabled={!can('mrp_calc') || !selectedOrders.size}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
            Hesapla →
          </button>
          <span className="text-xs text-zinc-500">{selectedOrders.size} kayıt seçili</span>
          <span className="flex-1" />
          <button onClick={senkronla} disabled={!can('mrp_calc')}
            title="Tüm aktif siparişlerin rezervelerini termin-FIFO ile yeniden hesaplar"
            className="px-3 py-2 bg-amber/10 hover:bg-amber/20 border border-amber/25 disabled:opacity-40 text-amber rounded-lg text-xs font-semibold">
            🔄 Rezerveleri Senkronla
          </button>
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
              <button onClick={() => topluTedarikOlustur()} className="px-3 py-1.5 bg-accent text-white rounded-lg text-[10px] font-semibold">
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
                            order_id: [...selectedOrders][0] || null, siparis_no: orders.find(o => o.id === [...selectedOrders][0])?.siparisNo || null,
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
            {/* v15.50a.3 — Filtre sebebiyle bos tablo durumunda kullaniciyi yonlendir */}
            {sonuc.length > 0 && sonuc.filter(s => viewFilter === 'tum' ? true : viewFilter === 'eksik' ? s.net > 0 : s.net <= 0).length === 0 && (
              <div className="p-4 text-center text-xs text-zinc-500">
                {viewFilter === 'eksik' && eksikler.length === 0 && (
                  <>✓ Hiç eksik yok. <button onClick={() => setViewFilter('tum')} className="text-accent hover:underline">Tüm satırları göster</button> veya <button onClick={() => setViewFilter('yeterli')} className="text-green hover:underline">{yeterliler.length} yeterli kalemi</button> görüntüle.</>
                )}
                {viewFilter === 'yeterli' && yeterliler.length === 0 && (
                  <>Yeterli kalem yok. <button onClick={() => setViewFilter('tum')} className="text-accent hover:underline">Tüm satırları göster</button>.</>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
