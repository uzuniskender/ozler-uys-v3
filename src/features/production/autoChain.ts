import { supabase, fetchAll } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import type { Recipe, RecipeRow, WorkOrder, Material, StokHareket, Tedarik } from '@/types'
import { kesimPlanOlustur, kesimPlanlariKaydet } from './cutting'
import { hesaplaMRP, hesaplaMRPCached, mrpTedarikOlustur, type MRPRow } from './mrp'
// v15.85 — test_run_id propagation: autoZincir snapshot kayitlarinin
// canli veriye karismasini onler. Etiketsiz kayit cleanup'a takilmazdi.
import { withTestRunId } from '@/lib/testRun'

// ═══ İE OLUŞTUR — reçeteden iş emirleri ═══
// v15.87 — Idempotency koruması:
// `buildWorkOrders` ayni `orderId` icin 2 kez cagrildiginda (autoZincir tekrari,
// kaydet butonu cifti, 2 kalem ayni recete + caller stale woTotal vs.) DB'deki
// mevcut en buyuk sira'yi okur ve ondan sonra devam eder. Bu sayede sira numaralari
// asla duplicate olmaz. Caller'in `siraBaslangic` parametresini kullanmak zorunda
// degil -- her durumda dogru sonuc.
export async function buildWorkOrders(
  orderId: string, siparisNo: string, recipeId: string, adet: number, recipes: Recipe[], termin?: string, siraBaslangic?: number
): Promise<number> {
  const rc = recipes.find(r => r.id === recipeId)
  if (!rc || !rc.satirlar?.length) return 0

  const satirlar = rc.satirlar
  const opRows = satirlar.filter(s => s.opId).sort((a, b) => {
    const dA = (a.kirno || '').split('.').length
    const dB = (b.kirno || '').split('.').length
    return dB - dA || (a.kirno || '').localeCompare(b.kirno || '')
  })

  const mamulSatir = satirlar.find(s => !s.kirno?.includes('.'))
  if (mamulSatir && !mamulSatir.opId) {
    opRows.push({ ...mamulSatir, opId: '', tip: 'Mamul' } as RecipeRow)
  }

  const kirnoMap: Record<string, RecipeRow> = {}
  // kirno null/boş olan satirlar '' anahtarına çakışır; sadece gerçek kirno'lu satirlar eklenir.
  satirlar.forEach(s => { if (s.kirno) kirnoMap[s.kirno] = s })

  // v15.87 — siraBaslangic safety: caller verdiyse kullan, AMA DB'de daha buyuk
  // sira varsa onu tercih et. Boylece caller stale state ile gelse bile (realtime
  // yetismemis, modal cifti, autoZincir tekrari, vb) duplicate sira olmaz.
  const { data: existingWOs } = await supabase
    .from('uys_work_orders')
    .select('sira')
    .eq('order_id', orderId)
    .order('sira', { ascending: false })
    .limit(1)
  const dbMaxSira = (existingWOs && existingWOs[0]?.sira) || 0
  const callerSira = siraBaslangic || 0
  let woIdx = Math.max(callerSira, dbMaxSira)

  const workOrders: Record<string, unknown>[] = []

  for (const s of opRows) {
    const parcalar = (s.kirno || '1').split('.')
    let zincirCarpan = 1
    for (let i = 1; i < parcalar.length - 1; i++) {
      const ebKirno = parcalar.slice(0, i + 1).join('.')
      const eb = kirnoMap[ebKirno]
      if (eb) zincirCarpan *= (eb.miktar || 1)
    }
    const hedef = Math.max(1, Math.ceil(adet * zincirCarpan * (s.miktar || 1)))
    const depth = (s.kirno || '').split('.').length
    const hm = satirlar
      .filter(r => r.tip === 'Hammadde' && r.kirno?.startsWith(s.kirno + '.') && r.kirno.split('.').length === depth + 1)
      .map(h => {
        const m = Number(h.miktar || 0)
        const t = Number(adet || 0)
        return {
          malkod: h.malkod,
          malad: h.malad,
          miktarTotal: m > 0 ? Math.max(1, Math.ceil(t * m)) : 0,
        }
      })

    woIdx++
    const isMamulAuto = !s.opId && s.tip === 'Mamul'
    workOrders.push({
      id: uid(), order_id: orderId, rc_id: recipeId,
      mamul_kod: rc.mamulKod, mamul_ad: rc.mamulAd,
      sira: woIdx, kirno: s.kirno || '1',
      op_id: s.opId || null, op_kod: isMamulAuto ? 'MAMUL' : '', op_ad: isMamulAuto ? 'MAMUL TAMAMLAMA' : '',
      ist_id: s.istId || null, malkod: s.malkod || '', malad: s.malad || '',
      hedef, mpm: s.miktar || 1, hm,
      ie_no: `IE-${siparisNo}-${String(woIdx).padStart(2, '0')}`,
      wh_alloc: 0, hazirlik_sure: s.hazirlikSure || 0, islem_sure: s.islemSure || 0,
      durum: 'bekliyor', bagimsiz: false, siparis_disi: false, termin: termin || null,
      mamul_auto: isMamulAuto, operator_id: null, olusturma: today(),
    })
  }

  if (workOrders.length) {
    for (let i = 0; i < workOrders.length; i += 50) {
      const { error } = await supabase.from('uys_work_orders').upsert(workOrders.slice(i, i + 50), { onConflict: 'id' })
      if (error) throw error
    }
    // Op adlarını doldur
    const opIds = [...new Set(workOrders.map(w => w.op_id as string).filter(Boolean))]
    if (opIds.length) {
      const { data: ops } = await supabase.from('uys_operations').select('id, kod, ad').in('id', opIds)
      if (ops) {
        for (const wo of workOrders) {
          if (wo.op_id && !wo.op_ad) {
            const op = ops.find(o => o.id === wo.op_id)
            if (op) await supabase.from('uys_work_orders').update({ op_kod: op.kod, op_ad: op.ad }).eq('id', wo.id as string)
          }
        }
      }
    }
  }
  return workOrders.length
}

// ═══ TAM ZİNCİR: İE → Kesim → MRP → Tedarik ═══
export interface ZincirSonuc {
  woCount: number; kesimCount: number; mrpCount: number; tedCount: number
  eksikler: { malkod: string; malad: string; brut: number; stok: number; net: number }[]
  adimlar: string[]
  // v15.51 — Faz 4 hizalama: snapshot insert sonucunda oluşan calc id (raporlama/audit için)
  mrpCalculationId?: string | null
}

// v15.51 — Faz 4 hizalama: Faz 3 (MRP modal v15.50b) standardına geçiş
//   1) MRP run sonrası `uys_mrp_calculations` snapshot insert (Tip C, §18.2 uyumlu)
//   2) `uys_orders.mrp_durum` güncellenir (eksik/tamam) — manuel akışla aynı davranış
//   3) Tedarik insert artık `mrpTedarikOlustur(opts)` ile yapılır (auto=true + mrp_calculation_id FK)
//   4) `hesaplayan` parametresi eklendi (Orders.tsx'ten useAuth().user üzerinden geçer)
// v15.83 — Senaryo 1 modali (kesim plani sonrasi onay) icin callback tipi.
//   - autoZincir kesim planini olusturduktan sonra her IE icin "bar cikisi"
//     hesabi yapar ve `onKesimFark` callback'ini cagirir.
//   - 'kabul'  : IE.hedef bar cikisina guncellenir, MRP + tedarik devam eder.
//   - 'iptal'  : zincir ADIM 3'ten once durur, IE'ler taslak durumda kalir.
//   - Callback verilmezse (eski cagri yerleri) modal akisi atlanir,
//     hedef guncellenmez, MRP siparis adeti uzerinden calisir (geriye uyum).
export interface KesimFarkItem {
  woId: string
  ieNo: string
  mamulAd: string
  siparisAdeti: number
  barCikisi: number
  fark: number
}

export async function autoZincir(
  orderId: string,
  woCount: number,
  orders: any[], workOrders: WorkOrder[], recipes: Recipe[],
  operations: { id: string; ad: string; kod: string }[],
  materials: Material[], stokHareketler: StokHareket[], tedarikler: Tedarik[],
  logs: { woId: string; qty: number }[],
  cuttingPlans: any[],
  hesaplayan: string,
  onProgress?: (adimlar: string[]) => void,
  onKesimFark?: (items: KesimFarkItem[]) => Promise<'kabul' | 'iptal'>
): Promise<ZincirSonuc> {
  const adimlar: string[] = []
  adimlar.push(`✅ ${woCount} iş emri oluşturuldu`)
  onProgress?.(adimlar)

  // Re-fetch work orders (just created) — fetchAll: 1000 satır cap'i aşabilir
  const { data: freshWOs } = await fetchAll<any>('uys_work_orders')
  const allWOs: WorkOrder[] = freshWOs?.map((r: any) => ({
    id: r.id, orderId: r.order_id, rcId: r.rc_id, sira: r.sira || 0, kirno: r.kirno,
    opId: r.op_id, opKod: r.op_kod, opAd: r.op_ad, istId: r.ist_id, istKod: r.ist_kod, istAd: r.ist_ad,
    malkod: r.malkod, malad: r.malad, hedef: r.hedef || 0, mpm: r.mpm || 1, hm: r.hm || [],
    ieNo: r.ie_no, whAlloc: r.wh_alloc || 0, hazirlikSure: r.hazirlik_sure || 0, islemSure: r.islem_sure || 0,
    durum: r.durum, bagimsiz: !!r.bagimsiz, siparisDisi: !!r.siparis_disi,
    mamulKod: r.mamul_kod, mamulAd: r.mamul_ad, mamulAuto: !!r.mamul_auto,
    operatorId: r.operator_id, not: r.not_, olusturma: r.olusturma, termin: r.termin || '',
  })) || workOrders

  // ADIM 2: Kesim Planı
  let kesimCount = 0
  try {
    const yeniPlanlar = kesimPlanOlustur(allWOs, operations, recipes, materials, logs, cuttingPlans)
    if (yeniPlanlar.length) {
      kesimCount = await kesimPlanlariKaydet(yeniPlanlar)
      adimlar.push(`✅ ${kesimCount} kesim planı oluşturuldu`)
    } else {
      adimlar.push('ℹ️ Kesim operasyonlu İE bulunamadı')
    }
  } catch (e: any) {
    adimlar.push('⚠️ Kesim planı hatası: ' + e.message)
  }
  onProgress?.(adimlar)

  // Re-fetch cutting plans
  const { data: freshCP } = await supabase.from('uys_kesim_planlari').select('*')
  const allCP = freshCP?.map((r: any) => ({
    hamMalkod: r.ham_malkod, hamMalad: r.ham_malad, durum: r.durum,
    gerekliAdet: r.gerekli_adet, satirlar: r.satirlar || [],
  })) || cuttingPlans

  // v15.83 — Senaryo 1 modali (Faz 1 MVP): Kesim plani olusturuldu,
  // her WO icin bar cikisi hesabi yapilir; siparis adetiyle farkli (veya esit) olsa bile
  // kullaniciya gosterilir. 'iptal' donerse zincir burada durur (MRP/tedarik calismaz),
  // 'kabul' donerse fark olan WO'larin hedef'i bar cikisina cekilir ve MRP yeni hedeflerle calisir.
  if (onKesimFark) {
    const items: KesimFarkItem[] = []
    const orderWOs = allWOs.filter(w => w.orderId === orderId)
    for (const wo of orderWOs) {
      let barCikisi = 0
      for (const plan of allCP) {
        for (const satir of (plan.satirlar || [])) {
          const hamAdet = Number(satir.hamAdet || 0)
          if (hamAdet <= 0) continue
          for (const k of (satir.kesimler || [])) {
            if (k.woId === wo.id) {
              barCikisi += hamAdet * Number(k.adet || 0)
            }
          }
        }
      }
      // Sadece kesim planinda yer alan WO'lar icin sor (kesim opsiyonu olmayanlari atlama)
      if (barCikisi > 0) {
        items.push({
          woId: wo.id,
          ieNo: wo.ieNo,
          mamulAd: wo.malad || wo.mamulAd || '',
          siparisAdeti: wo.hedef,
          barCikisi,
          fark: barCikisi - wo.hedef,
        })
      }
    }

    if (items.length) {
      const sonuc = await onKesimFark(items)
      if (sonuc === 'iptal') {
        adimlar.push('⚠️ Kullanici zinciri iptal etti (kesim onayi)')
        onProgress?.(adimlar)
        return { woCount, kesimCount, mrpCount: 0, tedCount: 0, eksikler: [], adimlar, mrpCalculationId: null }
      }
      // Kabul: fark olan WO'lar icin DB UPDATE + bellek senkronu (MRP yeni hedef gorsun diye)
      const farkliItems = items.filter(i => i.fark !== 0)
      if (farkliItems.length) {
        for (const item of farkliItems) {
          await supabase.from('uys_work_orders').update({ hedef: item.barCikisi }).eq('id', item.woId)
          const wo = allWOs.find(w => w.id === item.woId)
          if (wo) wo.hedef = item.barCikisi
        }
        adimlar.push(`✅ Kesim onayi alindi · ${farkliItems.length} IE hedefi guncellendi`)
      } else {
        adimlar.push('✅ Kesim onayi alindi (fark yok)')
      }
      onProgress?.(adimlar)
    }
  }

  // ADIM 3: MRP + Snapshot + mrp_durum
  let mrpSonuc: MRPRow[] = []
  let calcId: string | null = null
  try {
    // v16.82 — Stale store fix: MRP öncesi tedarikler DB'den taze çekiliyor.
    // Aynı oturumda art arda 2 sipariş açılırsa 2. sipariş için acikTedPool
    // 1. siparişin yeni tedarikini görür ve net=0 → çift tedarik önlenir.
    let freshTedarikler: Tedarik[] = tedarikler
    try {
      const { data: freshTed } = await supabase.from('uys_tedarikler').select('*').eq('geldi', false)
      if (freshTed && freshTed.length >= 0) {
        freshTedarikler = freshTed.map((r: any): Tedarik => ({
          id: r.id, malkod: r.malkod || '', malad: r.malad || '', miktar: r.miktar || 0,
          birim: r.birim || 'Adet', orderId: r.order_id || '', siparisNo: r.siparis_no || '',
          durum: r.durum || '', geldi: !!r.geldi, teslimTarihi: r.teslim_tarihi || '',
          tarih: r.tarih || '', not: r.not_ || '', autoOlusturuldu: !!r.auto_olusturuldu,
        }))
      }
    } catch { /* stale fallback */ }
    // v16.32 IE #14 Faz A Slice 3 — cache wrap. Cache HIT/MISS otomatik.
    mrpSonuc = await hesaplaMRPCached(
      { orderId },
      () => hesaplaMRP([orderId], orders, allWOs, recipes, stokHareketler, freshTedarikler, allCP, materials, null, [], orderId, logs)
    )
    const eksikSay = mrpSonuc.filter(x => x.durum === 'eksik').length
    adimlar.push(`✅ MRP: ${mrpSonuc.length} kalem${eksikSay ? ' · ' + eksikSay + ' eksik' : ''}`)

    // v15.51 — Snapshot insert (Faz 3 modal pattern'i ile birebir aynı: Tip C, §18.2 uyumlu).
    // JSONB formatı: {malkod: miktar}. Aynı malkod farklı termin satırlarında olabilir → toplam alınır.
    const newCalcId = uid()
    const brut: Record<string, number> = {}
    const stok: Record<string, number> = {}
    const acik: Record<string, number> = {}
    const net:  Record<string, number> = {}
    for (const r of mrpSonuc) {
      brut[r.malkod] = (brut[r.malkod] || 0) + r.brut
      stok[r.malkod] = r.stok
      acik[r.malkod] = r.acikTedarik
      net[r.malkod]  = (net[r.malkod]  || 0) + r.net
    }
    try {
      // v15.85 — withTestRunId ile sar: test moduyken kayit etiketlenir,
      // canli kullanimda hicbir degisiklik (LS_KEY yokken row degismeden gecer).
      await supabase.from('uys_mrp_calculations').insert(withTestRunId({
        id: newCalcId,
        order_id: orderId,
        hesaplayan,
        brut_ihtiyac: brut,
        stok_durumu: stok,
        acik_tedarik: acik,
        net_ihtiyac: net,
        durum: 'tamamlandi',
      }))
      calcId = newCalcId
    } catch (e) {
      // Snapshot insert sessiz başarısız olursa zincir akışı bozulmamalı
      console.warn('[v15.51] uys_mrp_calculations insert (autoZincir) failed:', e)
    }

    // mrp_durum güncellemesi
    const yeniDurum = mrpSonuc.some(r => r.net > 0) ? 'eksik' : 'tamam'
    await supabase.from('uys_orders').update({ mrp_durum: yeniDurum }).eq('id', orderId)
  } catch (e: any) {
    adimlar.push('⚠️ MRP hatası: ' + e.message)
    try { await supabase.from('uys_orders').update({ mrp_durum: 'hata' }).eq('id', orderId) } catch {}
  }
  onProgress?.(adimlar)

  // ADIM 4: Tedarik Otomatik Oluştur
  let tedCount = 0
  try {
    const ord = orders.find((o: any) => o.id === orderId)
    // Termin-bazlı duplicate filter (autoZincir'e özgü — mrpTedarikOlustur bunu yapmıyor):
    // Aynı malkod + aynı orderId + aynı teslim tarihi + henüz gelmemiş bir tedarik varsa atla.
    // Bu, autoZincir'in iki kez tetiklenmesi durumunda duplicate insert'i engeller.
    const filteredRows = mrpSonuc.filter(r => {
      if (r.net <= 0) return false
      const xTermin = r.termin || ''
      const mevcutTed = freshTedarikler.find(t =>
        t.malkod === r.malkod
        && t.orderId === orderId
        && (t.teslimTarihi || '') === xTermin
        && !t.geldi
      )
      return !mevcutTed
    })
    // v15.51 — Tedarik insert artık mrpTedarikOlustur(opts) ile (Faz 3 standardı):
    //   - auto_olusturuldu: true (otomatik akış)
    //   - mrp_calculation_id: snapshot ID (audit için MRP run ile bağ)
    tedCount = await mrpTedarikOlustur(orderId, ord?.siparisNo || '', filteredRows, {
      mrpCalculationId: calcId || undefined,
      auto: true,
    })
    adimlar.push(tedCount > 0 ? `✅ ${tedCount} tedarik oluşturuldu` : '✅ Tüm malzemeler yeterli')
  } catch (e: any) {
    adimlar.push('⚠️ Tedarik hatası: ' + e.message)
  }
  onProgress?.(adimlar)

  const eksikler = mrpSonuc.filter(x => x.durum === 'eksik').map(x => ({
    malkod: x.malkod, malad: x.malad, brut: x.brut, stok: x.stok, net: x.net,
  }))

  // State güncelleme: plan_bekliyor → uretilebilir (kesim planları oluşturuldu + MRP tamam)
  try {
    const { data: orderRow } = await supabase.from('uys_orders').select('state,mrp_durum').eq('id', orderId).single()
    if (orderRow?.state === 'plan_bekliyor' && (orderRow?.mrp_durum === 'tamam' || eksikler.length === 0)) {
      // Kesim WO'larının tümü planlı mı kontrol et
      const { data: kesimWOs } = await supabase.from('uys_work_orders')
        .select('id,ie_no').eq('order_id', orderId).not('durum', 'in', '(iptal,tamamlandi)').ilike('op_ad', '%KES%')
      const { data: planRows } = await supabase.from('uys_kesim_planlari').select('satirlar').not('durum', 'eq', 'iptal')
      const planliIds = new Set<string>()
      planRows?.forEach((p: any) => (p.satirlar || []).forEach((s: any) =>
        (s.kesimler || []).forEach((k: any) => { if (k.woId) planliIds.add(k.woId); if (k.ieNo) planliIds.add(k.ieNo) })
      ))
      const allPlanned = !kesimWOs?.length || kesimWOs.every(w => planliIds.has(w.id) || planliIds.has(w.ie_no))
      if (allPlanned) {
        await supabase.from('uys_orders').update({ state: 'uretilebilir' }).eq('id', orderId)
      }
    }
  } catch (e) { console.warn('[autoZincir] state güncelleme hatası:', e) }

  return { woCount, kesimCount, mrpCount: mrpSonuc.length, tedCount, eksikler, adimlar, mrpCalculationId: calcId }
}
