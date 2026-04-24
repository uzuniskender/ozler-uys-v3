// ═══ TEST SENARYO RUNNER — v15.37 ═══
// Buket'in 4 senaryosunu otomatik çalıştırır. Her adımda:
// - Supabase'e yazma (test_run_id etiketi otomatik — supabase proxy)
// - Adım log'u tutar (başarı/hata + ölçümler)
// - Sonunda JSON rapor üretir
//
// Önemli: Test modu AKTİF olmalı; aksi halde kalıntı oluşur.

import { supabase } from './supabase'
import { uid, today } from './utils'
import { getActiveTestRunId } from './testRun'
import { buildWorkOrders } from '@/features/production/autoChain'
import { kesimPlanOlustur, kesimPlanlariKaydet } from '@/features/production/cutting'
import { hesaplaMRP, rezerveYaz } from '@/features/production/mrp'
import { markTedarikGeldi } from './tedarikHelpers'
import { useStore } from '@/store'
import type { Recipe, WorkOrder, Material, Operation, Order } from '@/types'

// ═══ TİPLER ═══

export interface SenaryoAdim {
  adim: string
  durum: 'OK' | 'FAIL' | 'SKIP'
  sureMs: number
  delil?: Record<string, unknown>
  hata?: string
  uyari?: string
}

export interface SenaryoRapor {
  senaryo: string
  testRunId: string
  baslangic: string
  bitis: string
  toplamSureMs: number
  genelDurum: 'PASS' | 'FAIL' | 'KISMI'
  adimlar: SenaryoAdim[]
  ozet: {
    olusanSiparis: number
    olusanIE: number
    olusanKesimPlan: number
    olusanTedarik: number
    geldiTedarik: number
    uretimLog: number
    stokHareket: number
  }
}

interface RunnerContext {
  recipeKod: string
  adet: number
  onLog?: (adim: SenaryoAdim) => void
}

interface RunnerState {
  testRunId: string
  adimlar: SenaryoAdim[]
  ozet: SenaryoRapor['ozet']
  orderId?: string
  ieIds: string[]
  kesimPlanIds: string[]
  tedarikIds: string[]
  logIds: string[]
}

// ═══ YARDIMCILAR ═══

function initState(testRunId: string): RunnerState {
  return {
    testRunId,
    adimlar: [],
    ozet: {
      olusanSiparis: 0, olusanIE: 0, olusanKesimPlan: 0,
      olusanTedarik: 0, geldiTedarik: 0, uretimLog: 0, stokHareket: 0,
    },
    ieIds: [], kesimPlanIds: [], tedarikIds: [], logIds: [],
  }
}

async function adim<T>(
  state: RunnerState,
  name: string,
  fn: () => Promise<T>,
  ctx: RunnerContext,
): Promise<T | null> {
  const t0 = Date.now()
  try {
    const result = await fn()
    const rec: SenaryoAdim = {
      adim: name,
      durum: 'OK',
      sureMs: Date.now() - t0,
      delil: result && typeof result === 'object' && !Array.isArray(result)
        ? result as Record<string, unknown>
        : { result },
    }
    state.adimlar.push(rec)
    ctx.onLog?.(rec)
    return result
  } catch (e: any) {
    const rec: SenaryoAdim = {
      adim: name,
      durum: 'FAIL',
      sureMs: Date.now() - t0,
      hata: e?.message || String(e),
    }
    state.adimlar.push(rec)
    ctx.onLog?.(rec)
    throw e
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function loadAll(): Promise<void> {
  await useStore.getState().loadAll()
}

function finalize(state: RunnerState, senaryo: string, t0: number): SenaryoRapor {
  const fail = state.adimlar.filter(a => a.durum === 'FAIL').length
  const ok = state.adimlar.filter(a => a.durum === 'OK').length
  const genelDurum: SenaryoRapor['genelDurum'] =
    fail === 0 ? 'PASS' : (ok > 0 ? 'KISMI' : 'FAIL')
  return {
    senaryo,
    testRunId: state.testRunId,
    baslangic: new Date(t0).toISOString(),
    bitis: new Date().toISOString(),
    toplamSureMs: Date.now() - t0,
    genelDurum,
    adimlar: state.adimlar,
    ozet: state.ozet,
  }
}

// ═══ SENARYO ORTAK PARÇALARI ═══

/** Reçete bul (rcKod veya mamulKod ile). Hata atar. */
function findRecipe(recipes: Recipe[], recipeKod: string): Recipe {
  const rc = recipes.find(r =>
    r.rcKod?.toLowerCase() === recipeKod.toLowerCase() ||
    r.mamulKod?.toLowerCase() === recipeKod.toLowerCase()
  )
  if (!rc) throw new Error(`Reçete bulunamadı: ${recipeKod}`)
  if (!rc.satirlar?.length) throw new Error(`Reçete boş: ${recipeKod}`)
  return rc
}

/** Sipariş oluştur (akış: Orders sayfası save gibi) */
async function _createOrder(state: RunnerState, ctx: RunnerContext, baslik: string): Promise<string> {
  const store = useStore.getState()
  const rc = findRecipe(store.recipes, ctx.recipeKod)
  const orderId = uid()
  const siparisNo = `TEST-${baslik}-${Date.now().toString(36).toUpperCase().slice(-4)}`
  const { error } = await supabase.from('uys_orders').insert({
    id: orderId,
    siparis_no: siparisNo,
    musteri: 'TEST-MUSTERI',
    tarih: today(),
    termin: today(),
    urunler: [{
      id: uid(), rcId: rc.id, mamulKod: rc.mamulKod, mamulAd: rc.mamulAd,
      adet: ctx.adet, termin: today(), not: `Test ${baslik}`,
    }],
    mamul_kod: rc.mamulKod, mamul_ad: rc.mamulAd,
    adet: ctx.adet, recete_id: rc.id,
    mrp_durum: 'bekliyor', durum: 'aktif',
    olusturma: today(),
  })
  if (error) throw new Error('Sipariş insert: ' + error.message)
  state.orderId = orderId
  state.ozet.olusanSiparis++

  // İE oluştur
  const woCount = await buildWorkOrders(orderId, siparisNo, rc.id, ctx.adet, store.recipes, today(), 0)
  state.ozet.olusanIE += woCount

  await loadAll()

  // Oluşan İE'leri bul
  const freshStore = useStore.getState()
  const createdIEs = freshStore.workOrders.filter(w => w.orderId === orderId)
  state.ieIds = createdIEs.map(w => w.id)

  return orderId
}

/** İE oluştur (bağımsız/siparis_disi) */
async function _createWO(state: RunnerState, ctx: RunnerContext): Promise<string> {
  const store = useStore.getState()
  const rc = findRecipe(store.recipes, ctx.recipeKod)

  // HM listesi reçeteden
  const hm = (rc.satirlar || [])
    .filter(s => s.tip === 'Hammadde' || s.tip === 'HM')
    .map(s => ({
      malkod: s.malkod, malad: s.malad,
      miktarTotal: (s.miktar || 1) * ctx.adet,
    }))

  const id = uid()
  const ieNo = `IE-TEST-${Date.now().toString(36).toUpperCase().slice(-5)}`

  const { error } = await supabase.from('uys_work_orders').insert({
    id,
    order_id: null,
    rc_id: rc.id,
    sira: 1, kirno: '1',
    op_id: rc.satirlar?.[0]?.opId || null,
    op_kod: '', op_ad: '',
    ist_id: rc.satirlar?.[0]?.istId || null,
    ist_kod: '', ist_ad: '',
    malkod: rc.mamulKod, malad: rc.mamulAd,
    hedef: ctx.adet, mpm: 1,
    hm, ie_no: ieNo,
    durum: 'bekliyor',
    bagimsiz: true, siparis_disi: true,
    mamul_kod: rc.mamulKod, mamul_ad: rc.mamulAd,
    not_: 'Test', olusturma: today(),
  })
  if (error) throw new Error('İE insert: ' + error.message)
  state.ieIds.push(id)
  state.ozet.olusanIE++

  await loadAll()
  return id
}

/** Kesim planı oluştur (mevcut plan varsa günceller) */
async function _createCuttingPlans(state: RunnerState): Promise<number> {
  const store = useStore.getState()
  const logsSimple = store.logs.map(l => ({ woId: l.woId, qty: l.qty }))
  const cpMapped = store.cuttingPlans.map((p: any) => ({
    id: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, hamBoy: p.hamBoy,
    hamEn: p.hamEn || 0, kesimTip: p.kesimTip || 'boy', durum: p.durum || '',
    tarih: p.tarih || '', satirlar: p.satirlar || [], gerekliAdet: p.gerekliAdet || 0,
  }))
  const oncekiIds = new Set(store.cuttingPlans.map(p => p.id))
  const planlar = kesimPlanOlustur(
    store.workOrders, store.operations as any, store.recipes,
    store.materials, logsSimple, cpMapped as any
  )
  if (!planlar.length) return 0
  await kesimPlanlariKaydet(planlar as any)
  // Yeni oluşanları state'e ekle
  for (const p of planlar) {
    if (!oncekiIds.has(p.id)) {
      state.kesimPlanIds.push(p.id)
      state.ozet.olusanKesimPlan++
    }
  }
  await loadAll()
  return planlar.length
}

/** MRP hesapla ve eksikler için tedarik oluştur */
async function _runMRPAndCreateTedarik(state: RunnerState): Promise<{ mrp: number; eksik: number; tedarik: number }> {
  const store = useStore.getState()
  if (!state.orderId && state.ieIds.length === 0) {
    throw new Error('MRP çalışacak sipariş veya İE yok')
  }

  const ordIds = state.orderId ? [state.orderId] : []
  const ymSet = state.ieIds.length > 0 && !state.orderId ? new Set(state.ieIds) : null
  const cpMapped = store.cuttingPlans.map((p: any) => ({
    hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
    gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
  }))

  const result = hesaplaMRP(
    ordIds, store.orders as any, store.workOrders, store.recipes,
    store.stokHareketler, store.tedarikler, cpMapped, store.materials,
    ymSet, store.mrpRezerve
  )

  // Rezerve yaz (sipariş varsa)
  if (state.orderId) await rezerveYaz(state.orderId, result)

  // Eksikler için tedarik oluştur (proxy test_run_id otomatik ekleyecek)
  const eksikler = result.filter(r => r.net > 0)
  for (const e of eksikler) {
    const mevcut = store.tedarikler.find(t => t.malkod === e.malkod && !t.geldi)
    if (mevcut) continue  // zaten açık
    const tId = uid()
    const { error } = await supabase.from('uys_tedarikler').insert({
      id: tId,
      malkod: e.malkod, malad: e.malad,
      miktar: Math.ceil(e.net), birim: e.birim || 'Adet',
      tarih: today(), teslim_tarihi: e.termin || null,
      durum: 'bekliyor', geldi: false, not_: 'Test senaryo',
      order_id: state.orderId || null,
      siparis_no: store.orders.find(o => o.id === state.orderId)?.siparisNo || null,
    })
    if (error) throw new Error(`Tedarik insert ${e.malkod}: ${error.message}`)
    state.tedarikIds.push(tId)
    state.ozet.olusanTedarik++
  }

  await loadAll()
  return { mrp: result.length, eksik: eksikler.length, tedarik: eksikler.length }
}

/** Tedariklerin hepsini "geldi" işaretle (stok girişi oluşur) */
async function _teslimAl(state: RunnerState): Promise<number> {
  const store = useStore.getState()
  let count = 0
  for (const tId of state.tedarikIds) {
    const t = store.tedarikler.find(x => x.id === tId)
    if (!t || t.geldi) continue
    await markTedarikGeldi(t as any)
    count++
    state.ozet.geldiTedarik++
  }
  await loadAll()
  return count
}

/** İlk İE'ye test üretim girişi (parçalı). Başarılı kesim varsa miktar girer. */
async function _uretimGirisi(state: RunnerState, miktar: number): Promise<number> {
  const store = useStore.getState()
  if (!state.ieIds.length) return 0
  const firstWoId = state.ieIds[0]
  const wo = store.workOrders.find(w => w.id === firstWoId)
  if (!wo) return 0

  // Parçalı — 2 ayrı log
  const halfA = Math.floor(miktar / 2)
  const halfB = miktar - halfA
  for (const qty of [halfA, halfB]) {
    if (qty <= 0) continue
    const lId = uid()
    const { error } = await supabase.from('uys_logs').insert({
      id: lId, wo_id: firstWoId, tarih: today(),
      qty, fire: 0,
      operatorlar: [{ id: 'test-op', ad: 'TEST OP' }],
      duruslar: [], not_: 'Test üretim',
      malkod: wo.malkod, ie_no: wo.ieNo,
      operator_id: null, vardiya: 'normal',
    })
    if (error) throw new Error('Log insert: ' + error.message)
    state.logIds.push(lId)
    state.ozet.uretimLog++

    // HM stok çıkışı yaz (reçete oranlı)
    for (const h of (wo.hm || [])) {
      const cikisMiktar = (h.miktarTotal / wo.hedef) * qty
      if (cikisMiktar <= 0) continue
      const shId = uid()
      await supabase.from('uys_stok_hareketler').insert({
        id: shId, tarih: today(),
        malkod: h.malkod, malad: h.malad,
        miktar: cikisMiktar, tip: 'cikis',
        log_id: lId, wo_id: firstWoId,
        aciklama: 'Test üretim HM çıkışı',
      })
      state.ozet.stokHareket++
    }
  }
  await loadAll()
  return state.ozet.uretimLog
}

// ═══ SENARYOLAR ═══

/** SENARYO 1: Sipariş → tam akış */
export async function senaryo1(ctx: RunnerContext): Promise<SenaryoRapor> {
  const t0 = Date.now()
  const testRunId = getActiveTestRunId() || ''
  if (!testRunId) throw new Error('Test modu aktif değil — önce "Test Başlat" tıkla')

  const state = initState(testRunId)

  await adim(state, '1. Sipariş oluştur', async () => {
    const oid = await _createOrder(state, ctx, 'S1')
    return { orderId: oid, ieCount: state.ieIds.length }
  }, ctx)

  await wait(300)

  await adim(state, '2. Kesim planı oluştur', async () => {
    const n = await _createCuttingPlans(state)
    return { yeniPlanSayisi: n }
  }, ctx)

  await wait(300)

  const mrpSonuc = await adim(state, '3. MRP + tedarik oluştur', async () => {
    return await _runMRPAndCreateTedarik(state)
  }, ctx) as { mrp: number; eksik: number; tedarik: number } | null

  if (mrpSonuc && mrpSonuc.tedarik > 0) {
    await wait(300)
    await adim(state, '4. Tedarikleri teslim al (stok girişi)', async () => {
      const n = await _teslimAl(state)
      return { geldiSayisi: n }
    }, ctx)
  }

  if (state.ieIds.length > 0) {
    await wait(300)
    await adim(state, '5. Parçalı üretim girişi (2 log)', async () => {
      const n = await _uretimGirisi(state, Math.min(4, ctx.adet))
      return { logSayisi: n }
    }, ctx)
  }

  return finalize(state, 'Senaryo 1: Sipariş → Kesim → MRP → Tedarik → Teslim → Üretim', t0)
}

/** SENARYO 2: Manuel İE → aynı akış */
export async function senaryo2(ctx: RunnerContext): Promise<SenaryoRapor> {
  const t0 = Date.now()
  const testRunId = getActiveTestRunId() || ''
  if (!testRunId) throw new Error('Test modu aktif değil — önce "Test Başlat" tıkla')

  const state = initState(testRunId)

  await adim(state, '1. Manuel İE oluştur (bağımsız/siparisDisi)', async () => {
    const id = await _createWO(state, ctx)
    return { ieId: id }
  }, ctx)

  await wait(300)

  await adim(state, '2. Kesim planı oluştur', async () => {
    const n = await _createCuttingPlans(state)
    return { yeniPlanSayisi: n }
  }, ctx)

  await wait(300)

  const mrpSonuc = await adim(state, '3. MRP + tedarik oluştur', async () => {
    return await _runMRPAndCreateTedarik(state)
  }, ctx) as { mrp: number; eksik: number; tedarik: number } | null

  if (mrpSonuc && mrpSonuc.tedarik > 0) {
    await wait(300)
    await adim(state, '4. Tedarikleri teslim al', async () => {
      const n = await _teslimAl(state)
      return { geldiSayisi: n }
    }, ctx)
  }

  if (state.ieIds.length > 0) {
    await wait(300)
    await adim(state, '5. Parçalı üretim girişi', async () => {
      const n = await _uretimGirisi(state, Math.min(4, ctx.adet))
      return { logSayisi: n }
    }, ctx)
  }

  return finalize(state, 'Senaryo 2: Manuel İE → Kesim → MRP → Tedarik → Teslim → Üretim', t0)
}

/** SENARYO 3: Sipariş → tedarik sil → tekrar ihtiyaç → 2. sipariş → konsolidasyon */
export async function senaryo3(ctx: RunnerContext): Promise<SenaryoRapor> {
  const t0 = Date.now()
  const testRunId = getActiveTestRunId() || ''
  if (!testRunId) throw new Error('Test modu aktif değil')

  const state = initState(testRunId)

  await adim(state, '1. İlk sipariş oluştur', async () => {
    const oid = await _createOrder(state, ctx, 'S3A')
    return { orderId: oid, ieCount: state.ieIds.length }
  }, ctx)

  await wait(300)
  await adim(state, '2. Kesim planı oluştur', async () => ({ n: await _createCuttingPlans(state) }), ctx)
  await wait(300)
  const mrp1 = await adim(state, '3. MRP + tedarik oluştur', async () => await _runMRPAndCreateTedarik(state), ctx) as any

  // Tedariği sil
  await wait(300)
  await adim(state, '4. Oluşturulan tedarikleri SİL', async () => {
    let sil = 0
    for (const tId of [...state.tedarikIds]) {
      const { error } = await supabase.from('uys_tedarikler').delete().eq('id', tId)
      if (!error) sil++
    }
    state.tedarikIds = []
    state.ozet.olusanTedarik -= sil
    // Sipariş mrp_durum bekliyor yap
    if (state.orderId) await supabase.from('uys_orders').update({ mrp_durum: 'bekliyor' }).eq('id', state.orderId)
    await loadAll()
    return { silinen: sil }
  }, ctx)

  // MRP tekrar hesapla — ihtiyaç yine çıkmalı
  await wait(300)
  const mrp2 = await adim(state, '5. MRP tekrar: ihtiyaç yine çıkıyor mu?', async () => {
    const sonuc = await _runMRPAndCreateTedarik(state)
    if (sonuc.eksik === 0) throw new Error('Tedarik silinmesine rağmen MRP ihtiyaç bulmadı')
    return sonuc
  }, ctx) as any

  // 2. sipariş (farklı reçeteyse daha iyi ama aynı reçeteyle konsolidasyon test edelim)
  await wait(300)
  const ilkOrderId = state.orderId
  await adim(state, '6. 2. Sipariş (tedarik gelmeden)', async () => {
    state.orderId = undefined  // _createOrder overwrite ediyor
    const oid = await _createOrder(state, ctx, 'S3B')
    return { orderId: oid }
  }, ctx)

  await wait(300)
  await adim(state, '7. Kesim planı güncelle', async () => ({ n: await _createCuttingPlans(state) }), ctx)
  await wait(300)
  await adim(state, '8. MRP güncelle (konsolide)', async () => await _runMRPAndCreateTedarik(state), ctx)

  if (state.tedarikIds.length > 0) {
    await wait(300)
    await adim(state, '9. Tedarikleri teslim al', async () => ({ n: await _teslimAl(state) }), ctx)
  }

  return finalize(state, 'Senaryo 3: Sipariş → Tedarik sil → 2. Sipariş → Konsolidasyon', t0)
}

/** SENARYO 4: İE versiyonu Senaryo 3 */
export async function senaryo4(ctx: RunnerContext): Promise<SenaryoRapor> {
  const t0 = Date.now()
  const testRunId = getActiveTestRunId() || ''
  if (!testRunId) throw new Error('Test modu aktif değil')

  const state = initState(testRunId)

  await adim(state, '1. İlk İE oluştur', async () => ({ ieId: await _createWO(state, ctx) }), ctx)
  await wait(300)
  await adim(state, '2. Kesim planı oluştur', async () => ({ n: await _createCuttingPlans(state) }), ctx)
  await wait(300)
  await adim(state, '3. MRP + tedarik oluştur', async () => await _runMRPAndCreateTedarik(state), ctx)

  await wait(300)
  await adim(state, '4. Tedarikleri SİL', async () => {
    let sil = 0
    for (const tId of [...state.tedarikIds]) {
      const { error } = await supabase.from('uys_tedarikler').delete().eq('id', tId)
      if (!error) sil++
    }
    state.tedarikIds = []; state.ozet.olusanTedarik -= sil
    await loadAll()
    return { silinen: sil }
  }, ctx)

  await wait(300)
  await adim(state, '5. MRP tekrar: ihtiyaç yine çıkıyor mu?', async () => {
    const sonuc = await _runMRPAndCreateTedarik(state)
    if (sonuc.eksik === 0) throw new Error('Tedarik silinmesine rağmen MRP ihtiyaç bulmadı')
    return sonuc
  }, ctx)

  await wait(300)
  await adim(state, '6. 2. İE (tedarik gelmeden)', async () => ({ ieId: await _createWO(state, ctx) }), ctx)
  await wait(300)
  await adim(state, '7. Kesim planı güncelle', async () => ({ n: await _createCuttingPlans(state) }), ctx)
  await wait(300)
  await adim(state, '8. MRP güncelle', async () => await _runMRPAndCreateTedarik(state), ctx)

  if (state.tedarikIds.length > 0) {
    await wait(300)
    await adim(state, '9. Tedarikleri teslim al', async () => ({ n: await _teslimAl(state) }), ctx)
  }

  return finalize(state, 'Senaryo 4: İE → Tedarik sil → 2. İE → Konsolidasyon', t0)
}
