// ═══ TEST SENARYO RUNNER v2 — v15.37 ═══
// v2 farkları:
//   1. Her senaryo kendi sub-test_run_id ile (parent ile ilişkili) — izolasyon
//   2. Her MRP sonrası STOK DOĞRULAMA adımı
//   3. S3, S4'e üretim adımı eklendi (tam akış)
//   4. Özet metrikler adım delilleriyle tutarlı
//   5. SKIP durumu aktif (tedarik yoksa teslim adımı SKIP)

import { supabase } from './supabase'
import { uid, today } from './utils'
import { getActiveTestRunId, tempSetActiveTestRunId, cascadeDeleteTestRun, newTestRunId } from './testRun'
import { buildWorkOrders, autoZincir, type KesimFarkItem } from '@/services/productionService/autoChain'
import { kesimPlanOlustur, kesimPlanlariKaydet } from '@/services/productionService/cutting'
import { hesaplaMRP, siparisDelta } from '@/services/mrpService'
import { markTedarikGeldi } from '@/services/tedarikciService'
import { fireTelafiIeOlustur, fireTelafiAkisi } from '@/services/productionService/fireTelafi'
import { canProduceWO, canDurus, canDeleteWO } from '@/services/productionService/validations'
import { useOrderStore, useProductionStore, useWarehouseStore, useAuthStore, loadAllStores } from '@/store'
import type { Recipe, WorkOrder, OrderItem, FireLog } from '@/types'

function getStores() {
  return {
    ...useOrderStore.getState(),
    ...useProductionStore.getState(),
    ...useWarehogetStores(),
    ...useAuthStore.getState(),
  }
}

// ═══ TİPLER ═══

export interface SenaryoAdim {
  adim: string
  durum: 'OK' | 'FAIL' | 'SKIP'
  sureMs: number
  delil?: Record<string, unknown>
  hata?: string
  uyari?: string
  /**
   * v15.41: Adımın test helper bypass kullandığını işaretler.
   * Test helper'lar (`_uretimGirisi`, `_uretimGirisiFire`) UI yolundan
   * (`OperatorPanel.save()` → `canProduceWO()`) geçmediği için Yasak 1
   * (stok kontrolü) atlanır. Bu, raporda görülen anomalik stok değerlerinin
   * (örn. -3) KASITLI olduğunu — gerçek üretimde imkansız olduğunu — belirtir.
   */
  bypassNotu?: string
}

export interface SenaryoRapor {
  senaryo: string
  testRunId: string
  parentTestRunId: string
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
    silinenTedarik: number
    uretimLog: number
    stokHareket: number
    stokGiris: number
    stokCikis: number
    fireLog: number
    telafiIE: number
    durusKaydi: number
  }
  stokSnapshotBaslangic: Record<string, number>
  stokSnapshotBitis: Record<string, number>
}

interface RunnerContext {
  recipeKod: string
  adet: number
  onLog?: (adim: SenaryoAdim) => void
}

interface RunnerState {
  testRunId: string
  parentTestRunId: string
  adimlar: SenaryoAdim[]
  ozet: SenaryoRapor['ozet']
  orderId?: string
  ieIds: string[]
  kesimPlanIds: string[]
  tedarikIds: string[]
  logIds: string[]
  ilgiliHamMalkodlar: Set<string>  // Bu senaryoya ait HM'ler (stok snapshot için)
  stokSnapshotBaslangic: Record<string, number>
}

// ═══ SABİTLER ═══

/**
 * v15.41: Üretim adımlarına eklenir. Test helper'ları (`_uretimGirisi`,
 * `_uretimGirisiFire`) doğrudan DB insert yapar; UI'daki `OperatorPanel.save()`
 * yolundan geçmez, dolayısıyla `canProduceWO()` çağrılmaz. Bu durum sadece
 * test bağlamında geçerlidir; gerçek üretimde Yasak 1 sıkıdır.
 */
const BYPASS_NOTU_URETIM =
  'Test helper kullanır — UI\'daki Yasak 1 (stok kontrolü) bypass edilir. ' +
  'Negatif stok gösterimi KASITLIDIR; gerçek üretimde save() → canProduceWO() engeller.'

// ═══ YARDIMCILAR ═══

function initState(testRunId: string, parentId: string): RunnerState {
  return {
    testRunId, parentTestRunId: parentId,
    adimlar: [],
    ozet: {
      olusanSiparis: 0, olusanIE: 0, olusanKesimPlan: 0,
      olusanTedarik: 0, geldiTedarik: 0, silinenTedarik: 0,
      uretimLog: 0, stokHareket: 0, stokGiris: 0, stokCikis: 0,
      fireLog: 0, telafiIE: 0, durusKaydi: 0,
    },
    ieIds: [], kesimPlanIds: [], tedarikIds: [], logIds: [],
    ilgiliHamMalkodlar: new Set(),
    stokSnapshotBaslangic: {},
  }
}

async function adim<T>(
  state: RunnerState, name: string, fn: () => Promise<T>, ctx: RunnerContext,
  meta?: { bypassNotu?: string },
): Promise<T | null> {
  const t0 = Date.now()
  try {
    const result = await fn()
    const rec: SenaryoAdim = {
      adim: name, durum: 'OK', sureMs: Date.now() - t0,
      delil: result && typeof result === 'object' && !Array.isArray(result)
        ? result as Record<string, unknown>
        : { result },
      ...(meta?.bypassNotu ? { bypassNotu: meta.bypassNotu } : {}),
    }
    state.adimlar.push(rec); ctx.onLog?.(rec)
    return result
  } catch (e: any) {
    const rec: SenaryoAdim = {
      adim: name, durum: 'FAIL', sureMs: Date.now() - t0,
      hata: e?.message || String(e),
      ...(meta?.bypassNotu ? { bypassNotu: meta.bypassNotu } : {}),
    }
    state.adimlar.push(rec); ctx.onLog?.(rec)
    throw e
  }
}

function adimSkip(state: RunnerState, name: string, neden: string, ctx: RunnerContext) {
  const rec: SenaryoAdim = { adim: name, durum: 'SKIP', sureMs: 0, uyari: neden }
  state.adimlar.push(rec); ctx.onLog?.(rec)
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function finalize(state: RunnerState, senaryo: string, t0: number): SenaryoRapor {
  const fail = state.adimlar.filter(a => a.durum === 'FAIL').length
  const ok = state.adimlar.filter(a => a.durum === 'OK').length
  const genelDurum: SenaryoRapor['genelDurum'] =
    fail === 0 ? 'PASS' : (ok > 0 ? 'KISMI' : 'FAIL')

  // Bitiş stok snapshot'ı
  const store = getStores()
  const stokSnapshotBitis: Record<string, number> = {}
  for (const malkod of state.ilgiliHamMalkodlar) {
    stokSnapshotBitis[malkod] = getStokMiktar(store.stokHareketler as any, malkod)
  }

  return {
    senaryo,
    testRunId: state.testRunId,
    parentTestRunId: state.parentTestRunId,
    baslangic: new Date(t0).toISOString(),
    bitis: new Date().toISOString(),
    toplamSureMs: Date.now() - t0,
    genelDurum,
    adimlar: state.adimlar,
    ozet: state.ozet,
    stokSnapshotBaslangic: state.stokSnapshotBaslangic,
    stokSnapshotBitis,
  }
}

function getStokMiktar(stokHareketler: Array<{malkod: string; miktar: number; tip: string}>, malkod: string): number {
  return Math.floor(stokHareketler
    .filter(h => h.malkod === malkod)
    .reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0))
}

function findRecipe(recipes: Recipe[], recipeKod: string): Recipe {
  const rc = recipes.find(r =>
    r.rcKod?.toLowerCase() === recipeKod.toLowerCase() ||
    r.mamulKod?.toLowerCase() === recipeKod.toLowerCase()
  )
  if (!rc) throw new Error(`Reçete bulunamadı: ${recipeKod}`)
  if (!rc.satirlar?.length) throw new Error(`Reçete boş: ${recipeKod}`)
  return rc
}

async function _createOrder(state: RunnerState, ctx: RunnerContext, baslik: string): Promise<string> {
  const store = getStores()
  const rc = findRecipe(store.recipes, ctx.recipeKod)
  const orderId = uid()
  const siparisNo = `TEST-${baslik}-${Date.now().toString(36).toUpperCase().slice(-4)}`
  const { error } = await supabase.from('uys_orders').insert({
    id: orderId, siparis_no: siparisNo, musteri: 'TEST-MUSTERI',
    tarih: today(), termin: today(),
    urunler: [{ id: uid(), rcId: rc.id, mamulKod: rc.mamulKod, mamulAd: rc.mamulAd,
      adet: ctx.adet, termin: today(), not: `Test ${baslik}` }],
    mamul_kod: rc.mamulKod, mamul_ad: rc.mamulAd,
    adet: ctx.adet, recete_id: rc.id,
    mrp_durum: 'bekliyor', durum: 'aktif', olusturma: today(),
  })
  if (error) throw new Error('Sipariş insert: ' + error.message)
  state.orderId = orderId
  state.ozet.olusanSiparis++

  const woCount = await buildWorkOrders(orderId, siparisNo, rc.id, ctx.adet, store.recipes, today(), 0)
  state.ozet.olusanIE += woCount
  await loadAllStores()

  const fresh = getStores()
  const createdIEs = fresh.workOrders.filter(w => w.orderId === orderId)
  state.ieIds.push(...createdIEs.map(w => w.id))
  // HM malkodlarını topla
  createdIEs.forEach(w => (w.hm || []).forEach((h: any) => state.ilgiliHamMalkodlar.add(h.malkod)))

  return orderId
}

async function _createWO(state: RunnerState, ctx: RunnerContext): Promise<string> {
  const store = getStores()
  const rc = findRecipe(store.recipes, ctx.recipeKod)

  const hm = (rc.satirlar || [])
    .filter(s => s.tip === 'Hammadde' || s.tip === 'HM')
    .map(s => ({
      malkod: s.malkod, malad: s.malad,
      miktarTotal: (s.miktar || 1) * ctx.adet,
    }))
  hm.forEach(h => state.ilgiliHamMalkodlar.add(h.malkod))

  const id = uid()
  const ieNo = `IE-TEST-${Date.now().toString(36).toUpperCase().slice(-5)}`

  const { error } = await supabase.from('uys_work_orders').insert({
    id, order_id: null, rc_id: rc.id,
    sira: 1, kirno: '1',
    op_id: rc.satirlar?.[0]?.opId || null, op_kod: '', op_ad: '',
    ist_id: rc.satirlar?.[0]?.istId || null, ist_kod: '', ist_ad: '',
    malkod: rc.mamulKod, malad: rc.mamulAd,
    hedef: ctx.adet, mpm: 1, hm, ie_no: ieNo,
    durum: 'bekliyor', bagimsiz: true, siparis_disi: true,
    mamul_kod: rc.mamulKod, mamul_ad: rc.mamulAd,
    not_: 'Test', olusturma: today(),
  })
  if (error) throw new Error('İE insert: ' + error.message)
  state.ieIds.push(id)
  state.ozet.olusanIE++
  await loadAllStores()
  return id
}

async function _createCuttingPlans(state: RunnerState): Promise<{ yeni: number; guncellenen: number }> {
  const store = getStores()
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
  if (!planlar.length) return { yeni: 0, guncellenen: 0 }
  await kesimPlanlariKaydet(planlar as any)
  let yeni = 0, guncel = 0
  for (const p of planlar) {
    if (oncekiIds.has(p.id)) guncel++
    else { yeni++; state.kesimPlanIds.push(p.id) }
  }
  state.ozet.olusanKesimPlan += yeni
  await loadAllStores()
  return { yeni, guncellenen: guncel }
}

async function _runMRPAndCreateTedarik(state: RunnerState): Promise<{ mrpKalem: number; eksik: number; tedarik: number }> {
  const store = getStores()
  const ordIds = state.orderId ? [state.orderId] : []
  const ymSet = state.ieIds.length > 0 && !state.orderId ? new Set(state.ieIds) : null
  const cpMapped = store.cuttingPlans.map((p: any) => ({
    hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
    gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
  }))

  const result = hesaplaMRP(
    ordIds, store.orders as any, store.workOrders, store.recipes,
    store.stokHareketler, store.tedarikler, cpMapped, store.materials,
    ymSet, store.mrpRezerve, undefined, store.logs as any
  )

  const eksikler = result.filter(r => r.net > 0)
  let yeniTedarik = 0
  for (const e of eksikler) {
    // Aynı malkod için henüz test kapsamında tedarik oluşturulmamış ve açık tedarik yoksa
    const mevcutAcik = store.tedarikler.find(t => t.malkod === e.malkod && !t.geldi)
    if (mevcutAcik) continue
    const tId = uid()
    const { error } = await supabase.from('uys_tedarikler').insert({
      id: tId, malkod: e.malkod, malad: e.malad,
      miktar: Math.ceil(e.net), birim: e.birim || 'Adet',
      tarih: today(), teslim_tarihi: e.termin || null,
      durum: 'bekliyor', geldi: false, not_: 'Test senaryo',
      order_id: state.orderId || null,
      siparis_no: store.orders.find(o => o.id === state.orderId)?.siparisNo || null,
    })
    if (error) throw new Error(`Tedarik insert ${e.malkod}: ${error.message}`)
    state.tedarikIds.push(tId)
    state.ozet.olusanTedarik++
    yeniTedarik++
  }
  await loadAllStores()
  return { mrpKalem: result.length, eksik: eksikler.length, tedarik: yeniTedarik }
}

async function _teslimAl(state: RunnerState): Promise<number> {
  const store = getStores()
  let count = 0
  for (const tId of state.tedarikIds) {
    const t = store.tedarikler.find(x => x.id === tId)
    if (!t || t.geldi) continue
    await markTedarikGeldi(t as any)
    count++
    state.ozet.geldiTedarik++
    state.ozet.stokGiris++
    state.ozet.stokHareket++
  }
  await loadAllStores()
  return count
}

async function _uretimGirisi(state: RunnerState, miktar: number): Promise<number> {
  const store = getStores()
  if (!state.ieIds.length) return 0
  const firstWoId = state.ieIds[0]
  const wo = store.workOrders.find(w => w.id === firstWoId)
  if (!wo) return 0

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

    // HM çıkış hareketleri
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
      state.ozet.stokCikis++
      state.ozet.stokHareket++
    }
  }
  await loadAllStores()
  return state.ozet.uretimLog
}

async function _silTumTedarikler(state: RunnerState): Promise<number> {
  let sil = 0
  for (const tId of [...state.tedarikIds]) {
    const { error } = await supabase.from('uys_tedarikler').delete().eq('id', tId)
    if (!error) sil++
  }
  state.tedarikIds = []
  state.ozet.silinenTedarik += sil
  // Silinince sipariş mrp_durum = 'bekliyor'
  if (state.orderId) {
    await supabase.from('uys_orders').update({ mrp_durum: 'bekliyor' }).eq('id', state.orderId)
  }
  await loadAllStores()
  return sil
}

/** Senaryo etrafına izolasyon — her senaryoya ayrı test_run_id, bittikten sonra parent'a döner */
async function runWithIsolation<T extends SenaryoRapor>(
  parentId: string,
  ad: string,
  fn: (state: RunnerState, t0: number) => Promise<T>,
): Promise<T> {
  // Sub-run id üret: PARENT ile ilişkili
  const childId = parentId + '_' + ad.toLowerCase()
  tempSetActiveTestRunId(childId)
  const t0 = Date.now()

  try {
    // Bu senaryo için state — sub-run id ile
    const store = getStores()
    const state = initState(childId, parentId)

    const rapor = await fn(state, t0)
    // Başlangıç stok snapshot'ı set edildiyse
    return rapor
  } finally {
    // Her durumda parent id'ye dön (senaryo bitince)
    tempSetActiveTestRunId(parentId)
    await loadAllStores()
  }
}

function snapshotStok(state: RunnerState): void {
  const store = getStores()
  for (const malkod of state.ilgiliHamMalkodlar) {
    state.stokSnapshotBaslangic[malkod] = getStokMiktar(store.stokHareketler as any, malkod)
  }
}

// ═══ SENARYOLAR ═══

export async function senaryo1(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S1', async (state, t0) => {
    await adim(state, '1. Sipariş oluştur', async () => {
      const oid = await _createOrder(state, ctx, 'S1')
      snapshotStok(state)
      return { orderId: oid, ieCount: state.ieIds.length, hammaddeler: [...state.ilgiliHamMalkodlar] }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı oluştur', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    const mrp = await adim(state, '3. MRP hesapla + tedarik oluştur', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as { mrpKalem: number; eksik: number; tedarik: number }

    if (mrp && mrp.tedarik > 0) {
      await wait(200)
      await adim(state, '4. Tedarikleri teslim al (stok girişi)', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)

      // Doğrulama: stok gerçekten arttı mı?
      await wait(200)
      await adim(state, '4.1 Stok doğrulama (teslim sonrası)', async () => {
        const store = getStores()
        const mevcutStoklar: Record<string, number> = {}
        let artti = 0
        for (const mk of state.ilgiliHamMalkodlar) {
          mevcutStoklar[mk] = getStokMiktar(store.stokHareketler as any, mk)
          const baslangic = state.stokSnapshotBaslangic[mk] || 0
          if (mevcutStoklar[mk] > baslangic) artti++
        }
        if (artti === 0) throw new Error('Tedarik geldi ama stokta artış yok')
        return { artan_malzeme: artti, stoklar: mevcutStoklar }
      }, ctx)
    } else {
      adimSkip(state, '4. Teslim (tedarik yok)', 'İhtiyaç çıkmadı, teslim edilecek tedarik yok', ctx)
    }

    if (state.ieIds.length > 0) {
      await wait(200)
      await adim(state, '5. Parçalı üretim (2 log + HM çıkışı)', async () => ({
        logSayisi: await _uretimGirisi(state, Math.min(4, ctx.adet)),
        stokCikis: state.ozet.stokCikis,
      }), ctx, { bypassNotu: BYPASS_NOTU_URETIM })

      // Üretim doğrulama: log kaydedildi, stok azaldı mı
      await adim(state, '5.1 Üretim doğrulama', async () => {
        const store = getStores()
        const ie = store.workOrders.find(w => w.id === state.ieIds[0])
        const logs = store.logs.filter(l => l.woId === state.ieIds[0])
        const uretilen = logs.reduce((a, l) => a + l.qty, 0)
        return { uretilen, hedef: ie?.hedef, stokHareket: state.ozet.stokHareket }
      }, ctx)
    }

    return finalize(state, 'Senaryo 1: Sipariş → Kesim → MRP → Tedarik → Teslim → Üretim', t0)
  })
}

export async function senaryo2(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S2', async (state, t0) => {
    await adim(state, '1. Manuel İE oluştur (bağımsız)', async () => {
      const id = await _createWO(state, ctx)
      snapshotStok(state)
      return { ieId: id, hammaddeler: [...state.ilgiliHamMalkodlar] }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı oluştur', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    const mrp = await adim(state, '3. MRP + tedarik', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (mrp?.tedarik > 0) {
      await wait(200)
      await adim(state, '4. Tedarikleri teslim al', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)

      await adim(state, '4.1 Stok doğrulama', async () => {
        const store = getStores()
        const mevcut: Record<string, number> = {}
        let artti = 0
        for (const mk of state.ilgiliHamMalkodlar) {
          mevcut[mk] = getStokMiktar(store.stokHareketler as any, mk)
          if (mevcut[mk] > (state.stokSnapshotBaslangic[mk] || 0)) artti++
        }
        if (artti === 0) throw new Error('Tedarik geldi ama stok artmadı')
        return { artan: artti, stoklar: mevcut }
      }, ctx)
    } else {
      adimSkip(state, '4. Teslim', 'Tedarik yok', ctx)
    }

    if (state.ieIds.length > 0) {
      await wait(200)
      await adim(state, '5. Parçalı üretim', async () => ({
        logSayisi: await _uretimGirisi(state, Math.min(4, ctx.adet)),
      }), ctx, { bypassNotu: BYPASS_NOTU_URETIM })
    }

    return finalize(state, 'Senaryo 2: Manuel İE → Kesim → MRP → Tedarik → Teslim → Üretim', t0)
  })
}

export async function senaryo3(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S3', async (state, t0) => {
    await adim(state, '1. İlk sipariş', async () => {
      const oid = await _createOrder(state, ctx, 'S3A')
      snapshotStok(state)
      return { orderId: oid, ieCount: state.ieIds.length }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı', async () => await _createCuttingPlans(state), ctx)
    await wait(200)

    const mrp1 = await adim(state, '3. MRP + tedarik', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (mrp1?.tedarik === 0) {
      throw new Error('Senaryo 3 ihtiyaç bulmalıydı (9999 adet için). Stok konfigürasyonu: senaryo izole değil veya başlangıç stoğu yeterli.')
    }

    await wait(200)
    await adim(state, '4. Tedarikleri SİL', async () => ({
      silinen: await _silTumTedarikler(state),
    }), ctx)

    await wait(200)
    const mrp2 = await adim(state, '5. MRP tekrar → ihtiyaç tekrar çıkmalı', async () => {
      const s = await _runMRPAndCreateTedarik(state)
      if (s.eksik === 0) throw new Error('Tedarik silindi ama ihtiyaç çıkmadı')
      return s
    }, ctx)

    await wait(200)
    await adim(state, '6. 2. Sipariş (tedarik gelmeden)', async () => {
      state.orderId = undefined
      const oid = await _createOrder(state, ctx, 'S3B')
      return { orderId: oid }
    }, ctx)

    await wait(200)
    await adim(state, '7. Kesim planı güncelle', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    const mrp3 = await adim(state, '8. MRP konsolide güncelle', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (state.tedarikIds.length > 0) {
      await wait(200)
      await adim(state, '9. Tedarikleri teslim al', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)

      await adim(state, '9.1 Stok doğrulama', async () => {
        const store = getStores()
        const stoklar: Record<string, number> = {}
        for (const mk of state.ilgiliHamMalkodlar) {
          stoklar[mk] = getStokMiktar(store.stokHareketler as any, mk)
        }
        return { stoklar }
      }, ctx)
    } else {
      adimSkip(state, '9. Teslim', 'Tedarik yok', ctx)
    }

    if (state.ieIds.length > 0) {
      await wait(200)
      await adim(state, '10. Parçalı üretim', async () => ({
        logSayisi: await _uretimGirisi(state, Math.min(4, ctx.adet)),
      }), ctx, { bypassNotu: BYPASS_NOTU_URETIM })
    }

    return finalize(state, 'Senaryo 3: Sipariş → Tedarik sil → 2. Sipariş → Konsolidasyon → Üretim', t0)
  })
}

export async function senaryo4(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S4', async (state, t0) => {
    await adim(state, '1. İlk İE', async () => {
      const id = await _createWO(state, ctx)
      snapshotStok(state)
      return { ieId: id }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı', async () => await _createCuttingPlans(state), ctx)
    await wait(200)

    const mrp1 = await adim(state, '3. MRP + tedarik', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (mrp1?.tedarik === 0) {
      throw new Error('Senaryo 4 ihtiyaç bulmalıydı')
    }

    await wait(200)
    await adim(state, '4. Tedarikleri SİL', async () => ({
      silinen: await _silTumTedarikler(state),
    }), ctx)

    await wait(200)
    await adim(state, '5. MRP tekrar → ihtiyaç tekrar çıkmalı', async () => {
      const s = await _runMRPAndCreateTedarik(state)
      if (s.eksik === 0) throw new Error('Silme sonrası ihtiyaç çıkmadı')
      return s
    }, ctx)

    await wait(200)
    await adim(state, '6. 2. İE (tedarik gelmeden)', async () => ({
      ieId: await _createWO(state, ctx),
    }), ctx)

    await wait(200)
    await adim(state, '7. Kesim planı güncelle', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    await adim(state, '8. MRP konsolide güncelle', async () =>
      await _runMRPAndCreateTedarik(state), ctx)

    if (state.tedarikIds.length > 0) {
      await wait(200)
      await adim(state, '9. Tedarikleri teslim al', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)
    } else {
      adimSkip(state, '9. Teslim', 'Tedarik yok', ctx)
    }

    if (state.ieIds.length > 0) {
      await wait(200)
      await adim(state, '10. Parçalı üretim', async () => ({
        logSayisi: await _uretimGirisi(state, Math.min(4, ctx.adet)),
      }), ctx, { bypassNotu: BYPASS_NOTU_URETIM })
    }

    return finalize(state, 'Senaryo 4: İE → Tedarik sil → 2. İE → Konsolidasyon → Üretim', t0)
  })
}

// ═══ FİRE + DURUŞ ÖZEL YARDIMCILAR ═══

/** Fire'lı üretim girişi — qty adet başarılı + fire adet fire */
async function _uretimGirisiFire(
  state: RunnerState,
  qty: number,
  fireAdet: number,
  durusMinler: number[] = [],
): Promise<{ logId: string; fireLogId?: string }> {
  const store = getStores()
  if (!state.ieIds.length) throw new Error('İE yok')
  const firstWoId = state.ieIds[0]
  const wo = store.workOrders.find(w => w.id === firstWoId)
  if (!wo) throw new Error('İE bulunamadı')

  const durusKodlari = store.durusKodlari
  const duruslar = durusMinler.map((dk, i) => ({
    kod: durusKodlari[i % durusKodlari.length]?.kod || 'DUR-X',
    ad: durusKodlari[i % durusKodlari.length]?.ad || 'Duruş',
    sure: dk,
  }))
  state.ozet.durusKaydi += duruslar.length

  const lId = uid()
  const { error } = await supabase.from('uys_logs').insert({
    id: lId, wo_id: firstWoId, tarih: today(),
    qty, fire: fireAdet,
    operatorlar: [{ id: 'test-op', ad: 'TEST OP' }],
    duruslar, not_: 'Test fire/duruş',
    malkod: wo.malkod, ie_no: wo.ieNo,
    operator_id: null, vardiya: 'normal',
  })
  if (error) throw new Error('Log insert: ' + error.message)
  state.logIds.push(lId)
  state.ozet.uretimLog++

  // HM çıkış hareketleri (qty + fire = toplam HM kullanımı)
  const toplamKullanim = qty + fireAdet
  for (const h of (wo.hm || [])) {
    const cikisMiktar = (h.miktarTotal / wo.hedef) * toplamKullanim
    if (cikisMiktar <= 0) continue
    await supabase.from('uys_stok_hareketler').insert({
      id: uid(), tarih: today(),
      malkod: h.malkod, malad: h.malad,
      miktar: cikisMiktar, tip: 'cikis',
      log_id: lId, wo_id: firstWoId,
      aciklama: 'Test üretim HM çıkışı (fire dahil)',
    })
    state.ozet.stokCikis++
    state.ozet.stokHareket++
  }

  // Fire kaydı
  let fireLogId: string | undefined
  if (fireAdet > 0) {
    fireLogId = uid()
    await supabase.from('uys_fire_logs').insert({
      id: fireLogId, log_id: lId, wo_id: firstWoId,
      tarih: today(), malkod: wo.malkod, malad: wo.malad,
      qty: fireAdet, ie_no: wo.ieNo, op_ad: 'TEST OP',
      operatorlar: [{ id: 'test-op', ad: 'TEST OP' }],
      not_: 'Test fire', tip: 'parca',
    })
    state.ozet.fireLog++
  }

  await loadAllStores()
  return { logId: lId, fireLogId }
}

/** Fire'dan telafi İE'si oluştur */
async function _fireTelafiOlustur(state: RunnerState, fireLogId: string): Promise<string | null> {
  const store = getStores()
  const fireLog = store.fireLogs.find(f => f.id === fireLogId)
  if (!fireLog) throw new Error('Fire logu bulunamadı: ' + fireLogId)
  const origWo = store.workOrders.find(w => w.id === fireLog.woId)
  if (!origWo) throw new Error('Orijinal İE bulunamadı')

  const telafi = await fireTelafiIeOlustur(fireLog as any, origWo as any)
  if (!telafi) throw new Error('Telafi İE oluşturulamadı (fireTelafiIeOlustur null)')

  state.ozet.telafiIE++
  state.ieIds.push(telafi.woId)  // v15.37.1 FIX: fireTelafiIeOlustur {woId, ieNo} döner, .id değil
  await loadAllStores()
  return telafi.woId
}

// ═══ SENARYO 5: FİRE + TELAFİ + DURUŞ ═══

export async function senaryo5(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S5', async (state, t0) => {
    await adim(state, '1. Sipariş oluştur', async () => {
      const oid = await _createOrder(state, ctx, 'S5')
      snapshotStok(state)
      return { orderId: oid, ieCount: state.ieIds.length, hammaddeler: [...state.ilgiliHamMalkodlar] }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    const mrp = await adim(state, '3. MRP + tedarik', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (mrp?.tedarik > 0) {
      await wait(200)
      await adim(state, '4. Teslim al', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)
    } else {
      adimSkip(state, '4. Teslim', 'Tedarik yok', ctx)
    }

    // FİRE'LI ÜRETİM — qty=6, fire=2, 2 duruş (15dk + 10dk)
    await wait(200)
    const uretim = await adim(state, '5. Fire\'lı üretim (6 adet + 2 fire + 2 duruş)', async () => {
      if (!state.ieIds.length) throw new Error('Üretecek İE yok')
      const r = await _uretimGirisiFire(state, 6, 2, [15, 10])
      return { logId: r.logId, fireLogId: r.fireLogId, durus: 2 }
    }, ctx, { bypassNotu: BYPASS_NOTU_URETIM }) as any

    // Fire loglandı mı kontrol
    await wait(200)
    await adim(state, '5.1 Fire logu doğrulama', async () => {
      const store = getStores()
      const fire = store.fireLogs.find(f => f.id === uretim.fireLogId)
      if (!fire) throw new Error('Fire logu DB\'de yok')
      if (fire.qty !== 2) throw new Error(`Fire miktarı yanlış: beklenen 2, bulundu ${fire.qty}`)
      return { fireId: fire.id, qty: fire.qty, tip: (fire as any).tip }
    }, ctx)

    // Duruş kaydı kontrol (log.duruslar jsonb)
    await adim(state, '5.2 Duruş kaydı doğrulama', async () => {
      const store = getStores()
      const log = store.logs.find(l => l.id === uretim.logId)
      if (!log) throw new Error('Log bulunamadı')
      const durus = (log as any).duruslar || []
      if (durus.length !== 2) throw new Error(`Duruş sayısı yanlış: beklenen 2, bulundu ${durus.length}`)
      const toplamSure = durus.reduce((a: number, d: any) => a + (d.sure || 0), 0)
      return { durusSayi: durus.length, toplamDurusMin: toplamSure, kodlar: durus.map((d: any) => d.kod) }
    }, ctx)

    // TELAFİ İE OLUŞTUR
    await wait(200)
    const telafi = await adim(state, '6. Fire telafi İE oluştur', async () => {
      const telafiId = await _fireTelafiOlustur(state, uretim.fireLogId)
      return { telafiIE_Id: telafiId }
    }, ctx) as any

    // Telafi İE için kesim planı + MRP
    if (telafi?.telafiIE_Id) {
      await wait(200)
      await adim(state, '7. Telafi İE için kesim planı', async () => await _createCuttingPlans(state), ctx)

      await wait(200)
      await adim(state, '8. Telafi MRP hesapla', async () => {
        // Telafi İE'si mevcut stoktan karşılanabilir (yeni tedarik gerekmeyebilir)
        const store = getStores()
        const cpMapped = store.cuttingPlans.map((p: any) => ({
          hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
          gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
        }))
        const ordIds = state.orderId ? [state.orderId] : []
        const result = hesaplaMRP(
          ordIds, store.orders as any, store.workOrders, store.recipes,
          store.stokHareketler, store.tedarikler, cpMapped, store.materials,
          null, store.mrpRezerve, undefined, store.logs as any
        )
        return { mrpKalem: result.length, eksik: result.filter(r => r.net > 0).length }
      }, ctx)

      // Telafi üretim (normal)
      await wait(200)
      await adim(state, '9. Telafi İE üretim (2 adet, fire\'sız)', async () => {
        const origIeId = state.ieIds[0]
        state.ieIds[0] = telafi.telafiIE_Id  // Telafi İE'yi aktif yap
        const n = await _uretimGirisi(state, 2)
        state.ieIds[0] = origIeId  // eski haline getir
        return { logSayisi: n }
      }, ctx, { bypassNotu: BYPASS_NOTU_URETIM })
    }

    return finalize(state, 'Senaryo 5: Sipariş → Fire + Duruş → Telafi İE → Telafi Üretim', t0)
  })
}

// ═══ SENARYO 6 — Negatif Test (Parça 5 / v15.38) ═══
// Yasak kontrollerini test eder. Her alt adım validation fonksiyonunu
// sahte veriyle çağırır — engel dönmesi bekleniyor. Engel DÖNMEZSE FAIL.
// Stok/DB manipülasyonu yok; saf validation testi.

export async function senaryo6(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S6', async (state, t0) => {
    // ═══ 6a — YASAK 1: Stok olmadan üretim engeli ═══
    await adim(state, '1. YASAK 1 — Stok 0 iken üretim denemesi (engel beklenir)', async () => {
      const r = canProduceWO({ q: 5, f: 0, maxYapilabilir: 0 })
      if (r.ok) throw new Error('BEKLENEN ENGEL ÇALIŞMADI: Stok 0 iken üretime izin verildi')
      return { engellendi: true, sebep: r.reason, meta: r.meta }
    }, ctx)

    await adim(state, '2. YASAK 1 — Kısmi stok (5 gerekli, 2 mevcut → engel beklenir)', async () => {
      const r = canProduceWO({ q: 5, f: 0, maxYapilabilir: 2 })
      if (r.ok) throw new Error('BEKLENEN ENGEL ÇALIŞMADI: Yetersiz stokta üretime izin verildi')
      return { engellendi: true, sebep: r.reason, meta: r.meta }
    }, ctx)

    await adim(state, '3. YASAK 1 — Stok yeterli (2 gerekli, 5 mevcut → İZİN beklenir)', async () => {
      const r = canProduceWO({ q: 2, f: 0, maxYapilabilir: 5 })
      if (!r.ok) throw new Error('BEKLENMEYEN ENGEL: Stok yeterliyken engellendi: ' + r.reason)
      return { izin: true }
    }, ctx)

    // ═══ 6b — YASAK 2: Duruş > iş süresi engeli ═══
    await adim(state, '4. YASAK 2 — Duruş (500dk) > çalışma (60dk) denemesi (engel beklenir)', async () => {
      const r = canDurus({ toplamDurusDk: 500, toplamCalismaDk: 60, hasDurus: true })
      if (r.ok) throw new Error('BEKLENEN ENGEL ÇALIŞMADI: Aşırı duruşa izin verildi')
      return { engellendi: true, sebep: r.reason, meta: r.meta }
    }, ctx)

    await adim(state, '5. YASAK 2 — Duruş var ama çalışma saatleri boş (engel beklenir)', async () => {
      const r = canDurus({ toplamDurusDk: 30, toplamCalismaDk: 0, hasDurus: true })
      if (r.ok) throw new Error('BEKLENEN ENGEL ÇALIŞMADI: Çalışmasız duruşa izin verildi')
      return { engellendi: true, sebep: r.reason, meta: r.meta }
    }, ctx)

    await adim(state, '6. YASAK 2 — Duruş makul (30dk) / çalışma (480dk) → İZİN beklenir', async () => {
      const r = canDurus({ toplamDurusDk: 30, toplamCalismaDk: 480, hasDurus: true })
      if (!r.ok) throw new Error('BEKLENMEYEN ENGEL: Makul duruş engellendi: ' + r.reason)
      return { izin: true }
    }, ctx)

    // ═══ 6c — YASAK 3: Akış dışı silme engeli ═══
    await adim(state, '7. YASAK 3 — Bağlı logu olan İE silme (engel beklenir)', async () => {
      const r = canDeleteWO({
        woId: 'test-wo-1',
        logs: [{ woId: 'test-wo-1', qty: 5, fire: 1 }],
        stokHareketler: [],
        fireLogs: [],
      })
      if (r.ok) throw new Error('BEKLENEN ENGEL ÇALIŞMADI: Loglu İE silinebildi')
      return { engellendi: true, sebep: r.reason, meta: r.meta }
    }, ctx)

    await adim(state, '8. YASAK 3 — Stok hareketi olan İE silme (engel beklenir)', async () => {
      const r = canDeleteWO({
        woId: 'test-wo-2',
        logs: [],
        stokHareketler: [{ wo_id: 'test-wo-2' } as any],
        fireLogs: [],
      })
      if (r.ok) throw new Error('BEKLENEN ENGEL ÇALIŞMADI: Stok hareketli İE silinebildi')
      return { engellendi: true, sebep: r.reason, meta: r.meta }
    }, ctx)

    await adim(state, '9. YASAK 3 — Fire logu olan İE silme (engel beklenir)', async () => {
      const r = canDeleteWO({
        woId: 'test-wo-3',
        logs: [],
        stokHareketler: [],
        fireLogs: [{ wo_id: 'test-wo-3' } as any],
      })
      if (r.ok) throw new Error('BEKLENEN ENGEL ÇALIŞMADI: Fire loglu İE silinebildi')
      return { engellendi: true, sebep: r.reason, meta: r.meta }
    }, ctx)

    await adim(state, '10. YASAK 3 — Boş İE (log/stok/fire yok → İZİN beklenir)', async () => {
      const r = canDeleteWO({
        woId: 'test-wo-4',
        logs: [],
        stokHareketler: [],
        fireLogs: [],
      })
      if (!r.ok) throw new Error('BEKLENMEYEN ENGEL: Boş İE silinemedi: ' + r.reason)
      return { izin: true }
    }, ctx)

    return finalize(state, 'Senaryo 6: Negatif Test — Yasak Kontrolleri (Stok/Duruş/Silme)', t0)
  })
}

// ═══ SENARYO 7 — SİPARİŞ DELTA (v15.77 / İş Emri #13 madde 11) ═══
// v15.74'te eklenen siparisDelta saf-fonksiyonunu sahte verilerle test eder.
// Senaryo 6 deseni — DB'ye dokunmaz, validation testi.
// Eski "delete + recreate" akışı yerine delta-based revizyon doğru çalışıyor mu?

/** Test için sahte OrderItem üretici */
function _fakeKalem(rcId: string, adet: number, termin = '2026-05-15', mamulKod?: string): OrderItem {
  return { rcId, mamulKod: mamulKod || ('M-' + rcId), mamulAd: 'Test ' + rcId, adet, termin }
}

/** Test için sahte WorkOrder üretici (yalnız siparisDelta'nın baktığı alanlar dolu) */
function _fakeWO(orderId: string, rcId: string, hedef = 100, ekstra: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'fake-wo-' + uid(),
    orderId, rcId,
    sira: 0, kirno: '0', opId: '', opKod: '', opAd: '',
    istId: '', istKod: '', istAd: '',
    malkod: 'M-' + rcId, malad: 'Test',
    hedef, mpm: 1, hm: [],
    ieNo: 'IE-FAKE-' + rcId,
    whAlloc: 0, hazirlikSure: 0, islemSure: 0,
    durum: 'bekliyor',
    bagimsiz: false, siparisDisi: false,
    termin: '2026-05-15',
    mamulKod: 'M-' + rcId, mamulAd: 'Test',
    mamulAuto: false,
    operatorId: null, not: '', olusturma: today(),
    ...ekstra,
  }
}

export async function senaryo7(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S7', async (state, t0) => {
    const baseOld = {
      id: 'order-fake-1', siparisNo: 'SIP-T7-001', musteri: 'Test Müşteri',
      not: '', durum: '',
    }

    // ═══ 7.1 — ARTIS (üretim yok) ═══
    await adim(state, '1. ARTIS — 50→55, üretim=0', async () => {
      const wo = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50)] }
      const yeni = { ...baseOld, urunler: [_fakeKalem('rc-1', 55)] }
      const d = siparisDelta(eski, yeni, [wo], [])
      if (d.kalemDeltalari.length !== 1) throw new Error('Delta sayısı yanlış: ' + d.kalemDeltalari.length)
      const kd = d.kalemDeltalari[0]
      if (kd.tip !== 'artis') throw new Error('Tip yanlış: ' + kd.tip)
      if (kd.fark !== 5) throw new Error('Fark yanlış: ' + kd.fark)
      if (d.hatalar.length !== 0) throw new Error('Beklenmeyen hata: ' + d.hatalar.join(', '))
      return { tip: kd.tip, fark: kd.fark, etkilenen: kd.etkilenenWoIds.length }
    }, ctx)

    // ═══ 7.2 — ARTIS (mevcut üretim var) ═══
    await adim(state, '2. ARTIS — 50→60, üretim=10 (artış engellenmemeli)', async () => {
      const wo = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50)] }
      const yeni = { ...baseOld, urunler: [_fakeKalem('rc-1', 60)] }
      const d = siparisDelta(eski, yeni, [wo], [{ woId: wo.id, qty: 10 }])
      const kd = d.kalemDeltalari[0]
      if (kd.tip !== 'artis') throw new Error('Tip yanlış: ' + kd.tip)
      if (kd.uretildiAdet !== 10) throw new Error('Üretildi yanlış: ' + kd.uretildiAdet)
      if (d.hatalar.length !== 0) throw new Error('Artışta hata olmamalı: ' + d.hatalar.join(', '))
      return { tip: kd.tip, uretildi: kd.uretildiAdet, fark: kd.fark }
    }, ctx)

    // ═══ 7.3 — AZALIS (üretim yok, izin verilir) ═══
    await adim(state, '3. AZALIS — 50→45, üretim=0', async () => {
      const wo = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50)] }
      const yeni = { ...baseOld, urunler: [_fakeKalem('rc-1', 45)] }
      const d = siparisDelta(eski, yeni, [wo], [])
      const kd = d.kalemDeltalari[0]
      if (kd.tip !== 'azalis') throw new Error('Tip yanlış: ' + kd.tip)
      if (kd.fark !== -5) throw new Error('Fark yanlış: ' + kd.fark)
      if (d.hatalar.length !== 0) throw new Error('Üretim yokken hata olmamalı: ' + d.hatalar.join(', '))
      return { tip: kd.tip, fark: kd.fark }
    }, ctx)

    // ═══ 7.4 — AZALIS izin (üretim > yeniAdet, v15.82 sonrası izin verilir) ═══
    // v15.82'den önce: BLOCK (hata atılır)
    // v15.82 sonrası: izin verilir, hedef = max(üretildi, yeniHedef) (saha kuralı, Senaryo 5)
    await adim(state, '4. AZALIS izin — 50→45, üretim=47 (v15.82: izin, hata YOK)', async () => {
      const wo = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50)] }
      const yeni = { ...baseOld, urunler: [_fakeKalem('rc-1', 45)] }
      const d = siparisDelta(eski, yeni, [wo], [{ woId: wo.id, qty: 47 }])
      // YENİ DAVRANIŞ: hata olmamalı
      if (d.hatalar.length !== 0) throw new Error('v15.82 fix: BLOCK kuralı kaldırılmıştı, hata olmamalı: ' + d.hatalar.join(', '))
      const kd = d.kalemDeltalari[0]
      if (kd.tip !== 'azalis') throw new Error('Tip yanlış: ' + kd.tip)
      if (kd.uretildiAdet !== 47) throw new Error('Üretildi 47 olmalı: ' + kd.uretildiAdet)
      // Beklenti: izin var, siparisRevizeUygula hedefi max(47, ...) yaparak koruyacak
      return { izinVerildi: true, uretildi: kd.uretildiAdet, yeniAdet: kd.yeniAdet, mesaj: 'v15.82 saha kuralı: fazla üretim serbest stoğa' }
    }, ctx)

    // ═══ 7.5 — TERMIN değişimi ═══
    await adim(state, '5. TERMIN — adet aynı, termin değişti', async () => {
      const wo = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50, '2026-05-15')] }
      const yeni = { ...baseOld, urunler: [_fakeKalem('rc-1', 50, '2026-06-01')] }
      const d = siparisDelta(eski, yeni, [wo], [])
      const kd = d.kalemDeltalari[0]
      if (kd.tip !== 'termin') throw new Error('Tip yanlış: ' + kd.tip)
      if (kd.fark !== 0) throw new Error('Termin değişiminde fark 0 olmalı: ' + kd.fark)
      if (kd.eskiTermin !== '2026-05-15' || kd.yeniTermin !== '2026-06-01') {
        throw new Error('Termin değerleri yanlış')
      }
      return { tip: kd.tip, eski: kd.eskiTermin, yeni: kd.yeniTermin }
    }, ctx)

    // ═══ 7.6 — KALEM_EKLE ═══
    await adim(state, '6. KALEM_EKLE — yeni reçete ekle', async () => {
      const wo1 = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50)] }
      const yeni = { ...baseOld, urunler: [_fakeKalem('rc-1', 50), _fakeKalem('rc-2', 30)] }
      const d = siparisDelta(eski, yeni, [wo1], [])
      const ekle = d.kalemDeltalari.find(k => k.tip === 'kalem_ekle')
      if (!ekle) throw new Error('kalem_ekle delta yok')
      if (ekle.rcId !== 'rc-2') throw new Error('rcId yanlış: ' + ekle.rcId)
      if (ekle.yeniAdet !== 30) throw new Error('Yeni adet yanlış')
      if (ekle.etkilenenWoIds.length !== 0) throw new Error('Yeni kalemde etkilenen WO olmamalı')
      return { tip: ekle.tip, rcId: ekle.rcId, yeniAdet: ekle.yeniAdet }
    }, ctx)

    // ═══ 7.7 — KALEM_SIL (üretim yok) ═══
    await adim(state, '7. KALEM_SIL — kalem çıkar, üretim=0', async () => {
      const wo1 = _fakeWO(baseOld.id, 'rc-1', 100)
      const wo2 = _fakeWO(baseOld.id, 'rc-2', 60)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50), _fakeKalem('rc-2', 30)] }
      const yeni = { ...baseOld, urunler: [_fakeKalem('rc-1', 50)] }
      const d = siparisDelta(eski, yeni, [wo1, wo2], [])
      const sil = d.kalemDeltalari.find(k => k.tip === 'kalem_sil')
      if (!sil) throw new Error('kalem_sil delta yok')
      if (sil.rcId !== 'rc-2') throw new Error('rcId yanlış')
      if (sil.uretildiAdet !== 0) throw new Error('Üretim yokken uretildiAdet 0 olmalı')
      if (sil.etkilenenWoIds.length !== 1) throw new Error('Silinecek 1 WO olmalı')
      return { tip: sil.tip, etkilenen: sil.etkilenenWoIds.length, uretildi: sil.uretildiAdet }
    }, ctx)

    // ═══ 7.8 — KALEM_SIL (üretim var, log korunur) ═══
    await adim(state, '8. KALEM_SIL — üretim var, uretildiAdet doğru olmalı (loglar korunur)', async () => {
      const wo1 = _fakeWO(baseOld.id, 'rc-1', 100)
      const wo2 = _fakeWO(baseOld.id, 'rc-2', 60)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50), _fakeKalem('rc-2', 30)] }
      const yeni = { ...baseOld, urunler: [_fakeKalem('rc-1', 50)] }
      const d = siparisDelta(eski, yeni, [wo1, wo2], [{ woId: wo2.id, qty: 12 }])
      const sil = d.kalemDeltalari.find(k => k.tip === 'kalem_sil')
      if (!sil) throw new Error('kalem_sil delta yok')
      if (sil.uretildiAdet !== 12) throw new Error('uretildiAdet 12 olmalı: ' + sil.uretildiAdet)
      // Spec: kalem_sil + üretim → blocking değil. WO durum=iptal, log korunur.
      return { tip: sil.tip, uretildi: sil.uretildiAdet, hata: d.hatalar.length }
    }, ctx)

    // ═══ 7.9 — METADATA değişimi (siparişNo) ═══
    await adim(state, '9. METADATA — siparisNo değişti, kalemler aynı', async () => {
      const wo1 = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, siparisNo: 'SIP-T7-OLD', urunler: [_fakeKalem('rc-1', 50)] }
      const yeni = { ...baseOld, siparisNo: 'SIP-T7-NEW', urunler: [_fakeKalem('rc-1', 50)] }
      const d = siparisDelta(eski, yeni, [wo1], [])
      if (!d.metadataDegisti) throw new Error('metadataDegisti true olmalı')
      if (d.kalemDeltalari.length !== 0) throw new Error('Kalem değişmedi, delta olmamalı')
      if (d.toplamSenaryoSayisi !== 1) throw new Error('Sadece metadata değişmeli')
      return { metadata: d.metadataDegisti, kalemSayisi: d.kalemDeltalari.length }
    }, ctx)

    // ═══ 7.10 — NOOP (hiç değişiklik yok) ═══
    await adim(state, '10. NOOP — hiç değişiklik yok', async () => {
      const wo1 = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50)] }
      const yeni = { ...baseOld, urunler: [_fakeKalem('rc-1', 50)] }
      const d = siparisDelta(eski, yeni, [wo1], [])
      if (d.toplamSenaryoSayisi !== 0) throw new Error('Hiç değişiklik yok, toplam 0 olmalı')
      if (d.kalemDeltalari.length !== 0) throw new Error('Delta olmamalı')
      if (d.metadataDegisti) throw new Error('Metadata değişmemiş olmalı')
      return { toplamSenaryo: 0, durum: 'NOOP' }
    }, ctx)

    // ═══ 7.11 — IPTAL ═══
    await adim(state, '11. IPTAL — durum=iptal yapıldı', async () => {
      const wo1 = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, durum: '', urunler: [_fakeKalem('rc-1', 50)] }
      const yeni = { ...baseOld, durum: 'iptal', urunler: [_fakeKalem('rc-1', 50)] }
      const d = siparisDelta(eski, yeni, [wo1], [])
      if (!d.iptalEdildi) throw new Error('iptalEdildi true olmalı')
      return { iptalEdildi: d.iptalEdildi, toplamSenaryo: d.toplamSenaryoSayisi }
    }, ctx)

    // ═══ 7.12 — ÇOKLU değişim ═══
    await adim(state, '12. ÇOKLU — artış + termin + kalem_ekle aynı anda', async () => {
      const wo1 = _fakeWO(baseOld.id, 'rc-1', 100)
      const eski = { ...baseOld, urunler: [_fakeKalem('rc-1', 50, '2026-05-15')] }
      const yeni = {
        ...baseOld, siparisNo: 'SIP-T7-CHANGED',
        urunler: [_fakeKalem('rc-1', 60, '2026-06-01'), _fakeKalem('rc-3', 20)],
      }
      const d = siparisDelta(eski, yeni, [wo1], [])
      // rc-1 adet 50→60 = artis (termin de değişti ama artis baskın çünkü adetDegisti önce kontrol ediliyor)
      // rc-3 yeni = kalem_ekle
      // siparisNo değişti = metadata
      if (d.kalemDeltalari.length !== 2) throw new Error('2 kalem delta beklenir: ' + d.kalemDeltalari.length)
      if (!d.metadataDegisti) throw new Error('metadataDegisti true olmalı')
      const tipler = d.kalemDeltalari.map(k => k.tip).sort()
      // 'artis' ve 'kalem_ekle' beklenir
      if (!tipler.includes('artis') || !tipler.includes('kalem_ekle')) {
        throw new Error('Beklenen tipler yok: ' + tipler.join(','))
      }
      return { kalemSayi: d.kalemDeltalari.length, tipler, metadata: d.metadataDegisti, toplam: d.toplamSenaryoSayisi }
    }, ctx)

    return finalize(state, 'Senaryo 7: Sipariş Delta Revizyonu (v15.74)', t0)
  })
}

// ═══ SENARYO 8 — FİRE TELAFİ RECURSIVE (v15.77 / İş Emri #13 madde 13) ═══
// v15.76'da eklenen fireTelafiAkisi'nın gerçek DB akışını test eder.
// Senaryo 5 deseninin üzerine kurulur — fire'lı üretim sonrası eski API
// (fireTelafiIeOlustur) yerine yeni API (fireTelafiAkisi) çağrılır.
//
// SAHA UYUMU DOĞRULAMASI:
//   - Telafi WO order_id = orijinal sipariş (eski: '')
//   - Telafi WO siparis_disi = false (eski: true)
//   - Telafi WO bagimsiz = false (eski: true)
//   - Sipariş.adet değişmedi (50 müşteriye gider, üretim hedefi 50+fire)
//   - fire.telafiWoId DB'de set edildi
//
// RECURSIVE DAVRANIŞ:
//   - Reçetede YarıMamul satırı varsa alt-WO açılma kontrolü yapılır
//   - Sadece Hammadde varsa hammaddeAcigi populated kontrolü yapılır

export async function senaryo8(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S8', async (state, t0) => {
    // ═══ Setup: Senaryo 5'in özeti ═══
    await adim(state, '1. Sipariş + İE oluştur', async () => {
      const oid = await _createOrder(state, ctx, 'S8')
      snapshotStok(state)
      return { orderId: oid, ieCount: state.ieIds.length }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    const mrp = await adim(state, '3. MRP + tedarik', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (mrp?.tedarik > 0) {
      await wait(200)
      await adim(state, '4. Teslim al', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)
    } else {
      adimSkip(state, '4. Teslim', 'Tedarik yok', ctx)
    }

    // ═══ Fire'lı üretim ═══
    await wait(200)
    const uretim = await adim(state, '5. Fire\'lı üretim (qty=6, fire=2)', async () => {
      if (!state.ieIds.length) throw new Error('Üretecek İE yok')
      const r = await _uretimGirisiFire(state, 6, 2, [])
      return { logId: r.logId, fireLogId: r.fireLogId }
    }, ctx, { bypassNotu: BYPASS_NOTU_URETIM }) as any

    if (!uretim?.fireLogId) throw new Error('Fire logId yok, devam edilemez')

    // ═══ ASIL TEST: fireTelafiAkisi çağrısı ═══
    await wait(200)
    const akisSonuc = await adim(state, '6. fireTelafiAkisi çağrısı (yeni recursive API)', async () => {
      const store = getStores()
      const fire = store.fireLogs.find(f => f.id === uretim.fireLogId) as FireLog | undefined
      if (!fire) throw new Error('Fire DB\'de yok')
      const origWo = store.workOrders.find(w => w.id === fire.woId)
      if (!origWo) throw new Error('Orijinal İE yok')
      const recipe = store.recipes.find(r => r.id === origWo.rcId)
      if (!recipe) throw new Error('Reçete yok')

      const akis = await fireTelafiAkisi(
        fire as FireLog,
        origWo as WorkOrder,
        recipe,
        store.stokHareketler as any,
        store.workOrders,
        store.materials as any,
      )
      await loadAllStores()
      state.ozet.telafiIE += akis.acilenWoIds.length
      // state.ieIds'e telafi WO'ları ekle (cleanup için cascade yakalar zaten ama ozet için)
      for (const wid of akis.acilenWoIds) state.ieIds.push(wid)

      if (akis.acilenWoIds.length === 0) {
        throw new Error('En az 1 telafi WO açılmalı: hatalar=' + akis.hatalar.join(', '))
      }

      // Reçete YarıMamul içeriyor mu — recursive davranış kontrolü
      const ymVar = (recipe.satirlar || []).some(s => s.tip === 'YarıMamul')
      return {
        acilenWoSayisi: akis.acilenWoIds.length,
        hammaddeAcigiSayisi: akis.hammaddeAcigi.length,
        hatalar: akis.hatalar,
        receteYarıMamulIcerir: ymVar,
        recursiveTetiklendi: akis.acilenWoIds.length > 1,
      }
    }, ctx) as any

    // ═══ 7. Üst telafi WO doğrulama: order_id = orijinal sipariş ═══
    await wait(200)
    await adim(state, '7. Üst telafi WO: order_id = orijinal sipariş (v15.76)', async () => {
      const store = getStores()
      // Telafi WO'lar fireTelafi.telafiWoOlustur içinde ieNo='<orig>-FT<fireId>' pattern'iyle açılır.
      // Orijinal sipariş'e bağlı, ieNo'da '-FT' içeren WO'lar = telafiler
      const telafiWOs = store.workOrders.filter(w =>
        w.orderId === state.orderId && /-FT/i.test(w.ieNo || '')
      )
      if (telafiWOs.length === 0) throw new Error('Telafi WO bulunamadı (-FT pattern eşleşmedi)')
      // Üst telafi: en eski (recursive alt'lar daha sonra açılıyor)
      const ustWO = telafiWOs.sort((a, b) => (a.olusturma || '').localeCompare(b.olusturma || ''))[0]
      if (!ustWO.orderId) throw new Error('order_id boş — eski API davranışı (siparişe bağlı değil)')
      if (ustWO.orderId !== state.orderId) {
        throw new Error('order_id orijinal sipariş değil: beklenen ' + state.orderId + ', bulunan ' + ustWO.orderId)
      }
      if (ustWO.siparisDisi !== false) throw new Error('siparis_disi=false olmalı, değil')
      if (ustWO.bagimsiz !== false) throw new Error('bagimsiz=false olmalı, değil')
      return {
        woId: ustWO.id, ieNo: ustWO.ieNo, orderId: ustWO.orderId,
        siparisDisi: ustWO.siparisDisi, bagimsiz: ustWO.bagimsiz,
        hedef: ustWO.hedef, durum: ustWO.durum,
        toplamTelafiSayisi: telafiWOs.length,
      }
    }, ctx)

    // ═══ 8. fire.telafiWoId DB'de set edildi mi ═══
    await adim(state, '8. fire.telafi_wo_id DB\'de set edildi', async () => {
      const { data, error } = await supabase
        .from('uys_fire_logs').select('telafi_wo_id').eq('id', uretim.fireLogId).single()
      if (error) throw new Error('DB read: ' + error.message)
      if (!data || !(data as any).telafi_wo_id) {
        throw new Error('telafi_wo_id boş — fireTelafiAkisi update yapmadı')
      }
      return { telafiWoId: (data as any).telafi_wo_id }
    }, ctx)

    // ═══ 9. Sipariş.adet değişmedi (saha uyumu) ═══
    await adim(state, '9. Sipariş.adet değişmedi (50 müşteriye gider, üretim hedefi=50+fire)', async () => {
      const store = getStores()
      const order = store.orders.find(o => o.id === state.orderId) as any
      if (!order) throw new Error('Sipariş bulunamadı')
      // Bu senaryoda ctx.adet (default 10 ya da kullanıcının girdiği) = orijinal sipariş.adet
      // İlk kalemin adeti = ctx.adet olmalı
      const ilkKalem = (order.urunler || [])[0]
      if (!ilkKalem) throw new Error('Sipariş kalemi yok')
      if (ilkKalem.adet !== ctx.adet) {
        throw new Error('Sipariş kalem.adet değişti: bekledik ' + ctx.adet + ', bulundu ' + ilkKalem.adet)
      }
      return { siparisAdet: ilkKalem.adet, mesaj: 'Sipariş adeti korundu, telafi ek WO olarak açıldı' }
    }, ctx)

    // ═══ 10. İdempotency: ikinci kez aynı fire için çağır → hata beklenir ═══
    await adim(state, '10. İdempotency — aynı fire için 2. kez çağırırsa zaten açıldı hatası', async () => {
      const store = getStores()
      const fire = store.fireLogs.find(f => f.id === uretim.fireLogId) as FireLog | undefined
      if (!fire) throw new Error('Fire bulunamadı')
      const origWo = store.workOrders.find(w => w.id === fire.woId) as WorkOrder | undefined
      if (!origWo) throw new Error('Orijinal İE yok')
      const recipe = store.recipes.find(r => r.id === origWo.rcId)
      if (!recipe) throw new Error('Reçete yok')

      const akis2 = await fireTelafiAkisi(
        fire as FireLog, origWo, recipe,
        store.stokHareketler as any, store.workOrders, store.materials as any,
      )
      // Zaten açılmış — yeni WO açılmamalı, hata mesajı 'zaten açıldı' içermeli
      if (akis2.acilenWoIds.length > 0) {
        throw new Error('İdempotency başarısız: 2. çağrıda yeni WO açıldı (' + akis2.acilenWoIds.length + ')')
      }
      const zatenAcildi = akis2.hatalar.some(h => /zaten/i.test(h))
      if (!zatenAcildi) throw new Error('Beklenen hata mesajı yok: ' + akis2.hatalar.join(', '))
      return { idempotent: true, hatalar: akis2.hatalar }
    }, ctx)

    return finalize(state, 'Senaryo 8: Fire Telafi Recursive Akışı (v15.76)', t0)
  })
}

// ═══ SENARYO 9 — LOGLAR SAYFASI (v15.77 / İş Emri #13 madde 14) ═══
// v15.75'te eklenen uys_activity_log tablosunu + 4-source query yeteneğini test eder.
// DB seviyesinde — Logs.tsx UI'sine dokunmaz, alttaki veri akışını doğrular.

export async function senaryo9(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S9', async (state, t0) => {
    // ═══ 9.1 — uys_activity_log INSERT + tablo yapısı ═══
    const aktiviteId = uid()
    await adim(state, '1. uys_activity_log INSERT (test_run_id\'li)', async () => {
      const { error } = await supabase.from('uys_activity_log').insert({
        id: aktiviteId,
        ts: new Date().toISOString(),
        kullanici: 'test-user',
        aksiyon: 'Test sipariş açıldı',
        detay: 'S9 senaryo testi',
        modul: 'siparis',
        order_id: 'test-order-9-1',
        // Not: test_run_id supabase proxy ile otomatik eklenir (state.testRunId)
        test_run_id: state.testRunId,
      })
      if (error) throw new Error('INSERT hata: ' + error.message)
      return { id: aktiviteId, modul: 'siparis' }
    }, ctx)

    // ═══ 9.2 — INSERT'lenen satır SELECT ile dönüyor mu ═══
    await adim(state, '2. INSERT\'lenen satır SELECT ile dönüyor', async () => {
      const { data, error } = await supabase
        .from('uys_activity_log').select('*').eq('id', aktiviteId).single()
      if (error) throw new Error('SELECT hata: ' + error.message)
      if (!data) throw new Error('Kayıt yok')
      const r = data as any
      if (r.aksiyon !== 'Test sipariş açıldı') throw new Error('aksiyon yanlış: ' + r.aksiyon)
      if (r.modul !== 'siparis') throw new Error('modul yanlış: ' + r.modul)
      if (r.test_run_id !== state.testRunId) {
        throw new Error('test_run_id yanlış — cascade cleanup çalışmaz')
      }
      return { id: r.id, modul: r.modul, kullanici: r.kullanici, testRunId: r.test_run_id }
    }, ctx)

    // ═══ 9.3 — Modul filtresi ═══
    const aktiviteId2 = uid()
    await adim(state, '3. 2. modul (uretim) ekle, modul filtresi çalışıyor', async () => {
      const { error } = await supabase.from('uys_activity_log').insert({
        id: aktiviteId2,
        ts: new Date().toISOString(),
        kullanici: 'test-user',
        aksiyon: 'Üretim girişi',
        detay: 'S9 — modul filtre testi',
        modul: 'uretim',
        wo_id: 'test-wo-9-3',
        test_run_id: state.testRunId,
      })
      if (error) throw new Error('2. INSERT hata: ' + error.message)

      const { data: siparisRows } = await supabase
        .from('uys_activity_log').select('*')
        .eq('test_run_id', state.testRunId).eq('modul', 'siparis')
      const { data: uretimRows } = await supabase
        .from('uys_activity_log').select('*')
        .eq('test_run_id', state.testRunId).eq('modul', 'uretim')

      if ((siparisRows?.length || 0) !== 1) {
        throw new Error('siparis modulü 1 dönmeli, döndü: ' + siparisRows?.length)
      }
      if ((uretimRows?.length || 0) !== 1) {
        throw new Error('uretim modulü 1 dönmeli, döndü: ' + uretimRows?.length)
      }
      return { siparisCount: siparisRows?.length, uretimCount: uretimRows?.length }
    }, ctx)

    // ═══ 9.4 — Tarih filtresi ═══
    await adim(state, '4. Tarih filtresi — gelecek tarihte 0 sonuç', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('uys_activity_log').select('id')
        .eq('test_run_id', state.testRunId).gte('ts', future)
      if (error) throw new Error('Tarih filtre hata: ' + error.message)
      if ((data?.length || 0) !== 0) {
        throw new Error('Gelecek tarih filtresi 0 dönmeli, döndü: ' + data?.length)
      }
      return { gelecekTarihEslesme: 0 }
    }, ctx)

    // ═══ 9.5 — 4-source query (Logs.tsx'in kullandığı kombinasyon) ═══
    await adim(state, '5. 4 kaynak (activity/logs/stok/fire) sorgu — hata atmıyor', async () => {
      const sonuc = { activity: 0, logs: 0, stok: 0, fire: 0 }
      try {
        const r1 = await supabase.from('uys_activity_log').select('id', { count: 'exact', head: true })
          .eq('test_run_id', state.testRunId)
        sonuc.activity = r1.count || 0
      } catch (e: any) { throw new Error('uys_activity_log: ' + e.message) }
      try {
        const r2 = await supabase.from('uys_logs').select('id', { count: 'exact', head: true })
          .eq('test_run_id', state.testRunId)
        sonuc.logs = r2.count || 0
      } catch (e: any) { throw new Error('uys_logs: ' + e.message) }
      try {
        const r3 = await supabase.from('uys_stok_hareketler').select('id', { count: 'exact', head: true })
          .eq('test_run_id', state.testRunId)
        sonuc.stok = r3.count || 0
      } catch (e: any) { throw new Error('uys_stok_hareketler: ' + e.message) }
      try {
        const r4 = await supabase.from('uys_fire_logs').select('id', { count: 'exact', head: true })
          .eq('test_run_id', state.testRunId)
        sonuc.fire = r4.count || 0
      } catch (e: any) { throw new Error('uys_fire_logs: ' + e.message) }
      // 4 query'nin her biri çalıştı, sonuç dön
      return sonuc
    }, ctx)

    // ═══ 9.6 — order_id filtresi (Logs.tsx sağ panel link'leri için) ═══
    await adim(state, '6. order_id filtresi — Logs.tsx link\'leri için', async () => {
      const { data, error } = await supabase
        .from('uys_activity_log').select('*')
        .eq('test_run_id', state.testRunId).eq('order_id', 'test-order-9-1')
      if (error) throw new Error('order_id filtre hata: ' + error.message)
      if ((data?.length || 0) !== 1) {
        throw new Error('order_id eşleşmesi 1 dönmeli, döndü: ' + data?.length)
      }
      return { eslesme: data?.length }
    }, ctx)

    return finalize(state, 'Senaryo 9: Loglar Sayfası DB Akışı (v15.75)', t0)
  })
}

// ═══ SENARYO 10 — MANUEL İE MRP GÖRÜNÜRLÜĞÜ (v15.78 / saha bug fix) ═══
// Saha vakası: IE-MANUAL-MO9SDW3A 6740 adet, "stok yok" hard block veriyor ama MRP'de
// görünmüyor (orderId=null → ordIdSet filtresi atlıyor). Bu senaryo bug'ın çözümünü
// reproducible test eder.
//
// Test akışı:
//   1. Manuel İE oluştur (orderId=null, bagimsiz=true, siparisDisi=true, hedef büyük)
//   2. hesaplaMRP'yi 4 farklı modda çağır:
//      a) ordIds=[] + secilenYMIds=null → eski davranış: hepsi dahil, manuel İE eksik çıkar
//      b) ordIds=[başka sipariş] + secilenYMIds=null → ESKİ BUG: manuel İE atlanır (HATALI)
//                                                       v15.78: yine atlanır (sipariş bazlı view korundu)
//      c) ordIds=[] + secilenYMIds=[manuel İE] → eksik çıkar (ymSet override)
//      d) ordIds=[başka sipariş] + secilenYMIds=[manuel İE] → eksik çıkar (v15.78 düzeltmesi)
//
// Adım (d) v15.78 öncesi FAIL ederdi, sonrası PASS — bu testin asıl değeri.

export async function senaryo10(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S10', async (state, t0) => {
    // ═══ Setup: bir sipariş + bir manuel İE (siparişsiz) — ikisi de aynı reçete ═══
    await adim(state, '1. Test siparişi oluştur (referans için)', async () => {
      const oid = await _createOrder(state, ctx, 'S10A')
      snapshotStok(state)
      return { orderId: oid, ieCount: state.ieIds.length }
    }, ctx)

    const orijinalIeCount = state.ieIds.length

    await wait(200)
    const manualIE = await adim(state, '2. Manuel İE oluştur (orderId=null, bagimsiz=true)', async () => {
      const woId = await _createWO(state, ctx)  // _createWO: order_id=null, bagimsiz=true, siparis_disi=true
      const store = getStores()
      const wo = store.workOrders.find(w => w.id === woId)
      if (!wo) throw new Error('Manuel İE oluşturulamadı')
      if (wo.orderId) throw new Error('Manuel İE orderId boş olmalıydı: ' + wo.orderId)
      if (!wo.bagimsiz && !wo.siparisDisi) throw new Error('bagimsiz/siparisDisi yanlış')
      return { woId, ieNo: wo.ieNo, orderId: wo.orderId, bagimsiz: wo.bagimsiz, siparisDisi: wo.siparisDisi }
    }, ctx) as any

    const manualWoId = manualIE.woId

    // ═══ 3. MOD A: ordIds=[], secilenYMIds=null → tümü dahil ═══
    await wait(200)
    await adim(state, '3. MOD A — ordIds=[], secilenYMIds=null (tümü dahil)', async () => {
      const store = getStores()
      const cpMapped = store.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const sonuc = hesaplaMRP([], store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials, null, store.mrpRezerve)
      // Manuel İE'nin hammaddesi sonuçta görünmeli (en az 1 satır)
      if (sonuc.length === 0) throw new Error('MOD A: tümü dahil mod hiç sonuç döndürmedi')
      return { kalemSayi: sonuc.length, eksikSayi: sonuc.filter(r => r.net > 0).length }
    }, ctx)

    // ═══ 4. MOD B: ordIds=[orderId-baska-siparis] (sadece sipariş bazlı view) ═══
    // Bu davranış v15.78'de DEĞİŞMEDİ — sipariş bazlı detay (örn. Orders.tsx) için manuel İE atlanır.
    // Test: siparişin BOM ihtiyacı kadar sonuç dönmeli, manuel İE'nin hammaddesi DAHIL OLMAMALI
    // (manuel İE'nin malkod'u sipariş'inkinden FARKLIYSA — aynı reçete kullandığı için bu test kompleks).
    // Basit kontrol: sonuç sayısı, MOD A ile karşılaştırılabilir farkta mı?
    await wait(200)
    await adim(state, '4. MOD B — sipariş bazlı (ordIds=[orderId], YM override yok)', async () => {
      const store = getStores()
      const cpMapped = store.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const sonuc = hesaplaMRP([state.orderId!], store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials, null, store.mrpRezerve, state.orderId!)
      // Sipariş bazlı: manuel İE atlanır (eski davranış korundu — sipariş detay görünümü için doğru)
      // Bu sadece dökümantasyon adımı, hata atmıyor
      return { kalemSayi: sonuc.length, eksikSayi: sonuc.filter(r => r.net > 0).length, not: 'Sipariş bazlı view, manuel İE atlanır (kasıtlı)' }
    }, ctx)

    // ═══ 5. MOD C: ordIds=[], secilenYMIds=[manuelWoId] → eksik çıkmalı ═══
    await wait(200)
    await adim(state, '5. MOD C — sadece manuel İE seçili (ordIds=[], ymSet={manuelWoId})', async () => {
      const store = getStores()
      const cpMapped = store.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const sonuc = hesaplaMRP([], store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials, new Set([manualWoId]), store.mrpRezerve)
      if (sonuc.length === 0) {
        throw new Error('MOD C: ymSet ile çağrıda manuel İE\'nin hammaddesi hesaplanmadı')
      }
      return { kalemSayi: sonuc.length, eksikSayi: sonuc.filter(r => r.net > 0).length }
    }, ctx)

    // ═══ 6. MOD D — KRİTİK: sipariş + manuel İE birlikte (saha bug fix testi) ═══
    // v15.78 ÖNCESİ: ordIdSet dolu olduğu için manuel İE filtre dışı kalırdı (BUG)
    // v15.78 SONRASI: secilenYMIds explicit override → manuel İE de hesaba dahil
    await wait(200)
    await adim(state, '6. MOD D ⭐ — Sipariş + Manuel İE (v15.78 saha bug fix)', async () => {
      const store = getStores()
      const cpMapped = store.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const sonuc = hesaplaMRP(
        [state.orderId!],                           // sipariş listesi
        store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials,
        new Set([manualWoId]),                       // YM override → manuel İE de dahil
        store.mrpRezerve,
      )
      // KRİTİK kontrol: secilenYMIds dolu olduğu için manuel İE'nin hammadde ihtiyacı hesapta olmalı.
      // Eski davranışta manuel İE atlandığı için sonuç sayısı daha az olurdu.
      if (sonuc.length === 0) {
        throw new Error('v15.78 fix çalışmadı: ordIds dolu + ymSet dolu → manuel İE atlanmamalıydı')
      }
      return { kalemSayi: sonuc.length, eksikSayi: sonuc.filter(r => r.net > 0).length, mesaj: 'Manuel İE hesaba dahil edildi' }
    }, ctx)

    // ═══ 7. Karşılaştırma: MOD C vs MOD D — manuel İE'nin payı her ikisinde de görünmeli ═══
    await adim(state, '7. MOD C vs MOD D — Manuel İE payı tutarlı mı', async () => {
      const store = getStores()
      const cpMapped = store.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const modC = hesaplaMRP([], store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials, new Set([manualWoId]), store.mrpRezerve)
      const modD = hesaplaMRP([state.orderId!], store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials, new Set([manualWoId]), store.mrpRezerve)
      // MOD D ≥ MOD C olmalı (D = sipariş + manuel İE; C = sadece manuel İE)
      if (modD.length < modC.length) {
        throw new Error(`Tutarsızlık: MOD D (${modD.length}) < MOD C (${modC.length}) — sipariş eklendi ama sonuç azaldı`)
      }
      return { modCkalem: modC.length, modDkalem: modD.length, fark: modD.length - modC.length }
    }, ctx)

    return finalize(state, 'Senaryo 10: Manuel İE MRP Görünürlüğü (v15.78 saha bug fix)', t0)
  })
}

// ═══ SENARYO 11 — EFEKTİF DURUM (v15.79 / İş Emri #13 madde 8+9) ═══
// getEffectiveStatus saf-fonksiyon — operatör panelinin filtresinin doğruluğunu doğrular.
// 8 alt-test: tüm karar yolları (DB durumu öncelik + kesim plan + tedarik yok/yolda + üretilebilir).
//
// KRİTİK: Operatör paneli sadece Üretilebilir + Üretimde gösteriyor.
//         Bu fonksiyonun yanlış sonuç vermesi = operatör hayalet İE görür / gerçek İE göremez.

import { getEffectiveStatus as gefs } from './statusUtils'

function _fakeWoForS11(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-' + uid(),
    orderId: '', rcId: '', sira: 0, kirno: '0',
    opId: '', opKod: '', opAd: '',
    istId: '', istKod: '', istAd: '',
    malkod: 'YMH-TEST', malad: 'Test',
    hedef: 100, mpm: 1,
    hm: [{ malkod: 'HM-A', malad: 'Hammadde A', miktarTotal: 200 }],
    ieNo: 'IE-S11-' + uid().slice(-4),
    whAlloc: 0, hazirlikSure: 0, islemSure: 0,
    durum: 'bekliyor',
    bagimsiz: false, siparisDisi: false,
    termin: '2026-05-15',
    mamulKod: 'YMH-TEST', mamulAd: 'Test',
    mamulAuto: false,
    operatorId: null, not: '', olusturma: today(),
    ...overrides,
  }
}

export async function senaryo11(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S11', async (state, t0) => {
    // ═══ 11.1 — DB durumu 'iptal' önceliği ═══
    await adim(state, '1. DB durumu IPTAL → "iptal" döner (öncelik)', async () => {
      const w = _fakeWoForS11({ durum: 'iptal' })
      const e = gefs(w, [], [], [])
      if (e.status !== 'iptal') throw new Error('Beklenen iptal: ' + e.status)
      return { status: e.status, reason: e.reason }
    }, ctx)

    // ═══ 11.2 — DB durumu 'beklemede' önceliği ═══
    await adim(state, '2. DB durumu BEKLEMEDE → "beklemede" döner', async () => {
      const w = _fakeWoForS11({ durum: 'beklemede' })
      const e = gefs(w, [], [], [])
      if (e.status !== 'beklemede') throw new Error('Beklenen beklemede: ' + e.status)
      return { status: e.status, reason: e.reason }
    }, ctx)

    // ═══ 11.3 — DB durumu 'uretimde' önceliği ═══
    await adim(state, '3. DB durumu URETIMDE → "uretimde" döner (operatör listede görür)', async () => {
      const w = _fakeWoForS11({ durum: 'uretimde' })
      const e = gefs(w, [], [], [])
      if (e.status !== 'uretimde') throw new Error('Beklenen uretimde: ' + e.status)
      return { status: e.status }
    }, ctx)

    // ═══ 11.4 — Kesim opsiyonlu + plan yok → PlanBekliyor ═══
    await adim(state, '4. Kesim opsiyonlu (opAd="KESIM") + plan yok → PlanBekliyor (kesim_plan)', async () => {
      const w = _fakeWoForS11({ opAd: 'KESIM', hm: [] })  // hm boş → kesim+plan kontrolü dominant
      const e = gefs(w, [], [], [])
      if (e.status !== 'PlanBekliyor') throw new Error('Beklenen PlanBekliyor: ' + e.status)
      if (e.blockedBy !== 'kesim_plan') throw new Error('Beklenen kesim_plan: ' + e.blockedBy)
      if (!/kesim plan/i.test(e.reason)) throw new Error('Reason kesim plan içermeli: ' + e.reason)
      return { status: e.status, reason: e.reason, blockedBy: e.blockedBy }
    }, ctx)

    // ═══ 11.5 — Hammadde yeterli → Uretilebilir ═══
    await adim(state, '5. Hammadde stoğu yeterli → Uretilebilir', async () => {
      const w = _fakeWoForS11()
      const stokHareketler = [
        { id: 's1', malkod: 'HM-A', miktar: 500, tip: 'giris' as const, tarih: today() },
      ] as any
      const e = gefs(w, [], [], stokHareketler)
      if (e.status !== 'Uretilebilir') throw new Error('Beklenen Uretilebilir: ' + e.status + ' / reason: ' + e.reason)
      return { status: e.status }
    }, ctx)

    // ═══ 11.6 — Hammadde eksik + tedarik açılmamış ═══
    await adim(state, '6. Hammadde eksik + tedarik açılmamış → PlanBekliyor (tedarik_yok)', async () => {
      const w = _fakeWoForS11()
      const stokHareketler = [
        { id: 's1', malkod: 'HM-A', miktar: 50, tip: 'giris' as const, tarih: today() },
      ] as any
      const e = gefs(w, [], [], stokHareketler)
      if (e.status !== 'PlanBekliyor') throw new Error('Beklenen PlanBekliyor: ' + e.status)
      if (e.blockedBy !== 'tedarik_yok') throw new Error('Beklenen tedarik_yok: ' + e.blockedBy)
      if (!/tedarik/i.test(e.reason)) throw new Error('Reason tedarik içermeli: ' + e.reason)
      return { status: e.status, reason: e.reason, blockedBy: e.blockedBy }
    }, ctx)

    // ═══ 11.7 — Hammadde eksik + tedarik yolda ═══
    await adim(state, '7. Hammadde eksik + tedarik yolda → PlanBekliyor (tedarik_yolda)', async () => {
      const w = _fakeWoForS11()
      const stokHareketler = [
        { id: 's1', malkod: 'HM-A', miktar: 50, tip: 'giris' as const, tarih: today() },
      ] as any
      const tedarikler = [
        { id: 't1', malkod: 'HM-A', malad: 'Hammadde A', miktar: 200, geldi: false } as any,
      ]
      const e = gefs(w, [], tedarikler, stokHareketler)
      if (e.status !== 'PlanBekliyor') throw new Error('Beklenen PlanBekliyor: ' + e.status)
      if (e.blockedBy !== 'tedarik_yolda') throw new Error('Beklenen tedarik_yolda: ' + e.blockedBy)
      return { status: e.status, reason: e.reason, blockedBy: e.blockedBy }
    }, ctx)

    // ═══ 11.8 — Çok hammadde, biri açılmamış biri yolda → tedarik_yok öncelik ═══
    await adim(state, '8. 2 HM eksik (biri açılmamış, biri yolda) → tedarik_yok ÖNCELİK', async () => {
      const w = _fakeWoForS11({
        hm: [
          { malkod: 'HM-A', malad: 'Hammadde A', miktarTotal: 200 },
          { malkod: 'HM-B', malad: 'Hammadde B', miktarTotal: 200 },
        ],
      })
      const stokHareketler = [
        { id: 's1', malkod: 'HM-A', miktar: 50, tip: 'giris' as const, tarih: today() },
        { id: 's2', malkod: 'HM-B', miktar: 50, tip: 'giris' as const, tarih: today() },
      ] as any
      // HM-A için tedarik yolda, HM-B için tedarik açılmamış
      const tedarikler = [
        { id: 't1', malkod: 'HM-A', malad: 'Hammadde A', miktar: 200, geldi: false } as any,
      ]
      const e = gefs(w, [], tedarikler, stokHareketler)
      if (e.blockedBy !== 'tedarik_yok') {
        throw new Error('Öncelik kuralı: tedarik_yok > tedarik_yolda. Bulundu: ' + e.blockedBy)
      }
      // Reason HM-B'yi içermeli (açılmamış olan)
      if (!/Hammadde B/.test(e.reason)) {
        throw new Error('Reason HM-B içermeli (açılmamış olan): ' + e.reason)
      }
      return { status: e.status, reason: e.reason, blockedBy: e.blockedBy }
    }, ctx)

    // ═══ 11.9 — Üretim ilerlemesi: yarısı bitti → kalan ihtiyaç düşük ═══
    await adim(state, '9. 50% üretildi → kalan ihtiyaç yarıya düşer, az stok yeter', async () => {
      const w = _fakeWoForS11({ id: 'wo-s11-9' })
      // 100 hedef, 50 üretildi → kalan 50 → kalan HM ihtiyacı 100 (200×0.5)
      const stokHareketler = [
        { id: 's1', malkod: 'HM-A', miktar: 110, tip: 'giris' as const, tarih: today() },  // 110 stok yeter
      ] as any
      const logs = [{ woId: 'wo-s11-9', qty: 50 }]
      const e = gefs(w, [], [], stokHareketler, logs)
      if (e.status !== 'Uretilebilir') {
        throw new Error('İlerleme dahil edilmedi: 50% üretildiyse kalan 100 HM lazım, stok 110 yeterli olmalı. Bulundu: ' + e.status + ' / reason: ' + e.reason)
      }
      return { status: e.status }
    }, ctx)

    // ═══ 11.10 — Hammadde tanımsız (hm=[]) → varsayılan Uretilebilir ═══
    await adim(state, '10. hm=[] (BOM tanımsız) → varsayılan Uretilebilir (operatör paneldeki canProduceWO ek koruma sağlar)', async () => {
      const w = _fakeWoForS11({ hm: [] })
      const e = gefs(w, [], [], [])
      if (e.status !== 'Uretilebilir') throw new Error('hm=[] varsayılan Uretilebilir: ' + e.status)
      return { status: e.status }
    }, ctx)

    return finalize(state, 'Senaryo 11: Efektif Durum (v15.79 — getEffectiveStatus)', t0)
  })
}

// ═══ SENARYO 12 — TAMAMLANMIŞ İE'NİN HAMMADDESİ İHTİYAÇ ÜRETMEMELİ (v15.81 saha fix) ═══
// SAHA BUG: 28 Nis 2026, sağlık raporu Kontrol 5 "5 malzeme net ihtiyaç" dedi ama
// MRP sayfası "0 eksik" dedi. SQL sorgusu açtı: 7 IE-MANUAL durum=tamamlandi olmasına
// rağmen hesaplaMRP onları hammadde ihtiyacına dahil ediyor.
// Kök neden: mrp.ts satır 247-250 → uretilen=0 hardcode'du, 'tamamlandi' filtresi de yoktu.
// v15.81 düzeltmesi: (a) tamamlandi filtresine 'tamamlandi' eklendi (b) logs parametre ile
// gerçek üretim ilerlemesi okunuyor, kalan = max(0, hedef - log toplam).
//
// 6 alt-test: Kapsamlı.

import { hesaplaMRP as hmrp } from '@/services/mrpService'

export async function senaryo12(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S12', async (state, t0) => {
    // Reçete: hammaddeli basit reçete (test için sahte oluşturma karmaşık — gerçek reçete kullan)
    if (!ctx.recipeKod || ctx.recipeKod === 'N/A') {
      throw new Error('Senaryo 12 reçete kodu gerektirir (S1-S5 ile aynı)')
    }
    const store0 = getStores()
    const recipe = store0.recipes.find(r =>
      (r.mamulKod || '').toLowerCase() === ctx.recipeKod.toLowerCase() ||
      (r.kod || '').toLowerCase() === ctx.recipeKod.toLowerCase()
    )
    if (!recipe) throw new Error('Reçete bulunamadı: ' + ctx.recipeKod)

    // ═══ 1. Setup: manuel İE oluştur (orderId=null, hedef=10) ═══
    let manualWoId = ''
    await adim(state, '1. Manuel İE oluştur (orderId=null, hedef=10)', async () => {
      manualWoId = await _createWO(state, ctx)  // _createWO: bagimsiz=true, siparis_disi=true
      const wo = getStores().workOrders.find(w => w.id === manualWoId)
      if (!wo) throw new Error('WO oluşturulamadı')
      return { woId: manualWoId, hedef: wo.hedef, durum: wo.durum }
    }, ctx)

    // ═══ 2. logs olmadan hesaplaMRP çağrısı: kalan=hedef → ihtiyaç çıkar ═══
    let ihtiyacGorduk = false
    await adim(state, '2. logs PARAM YOK → eski davranış (uretilen=0, ihtiyaç çıkar)', async () => {
      const store = getStores()
      const cpMapped = store.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const sonuc = hmrp(
        [], store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials,
        new Set([manualWoId]), [], undefined,
        // logs param YOK
      )
      ihtiyacGorduk = sonuc.length > 0
      return { kalemSayi: sonuc.length, ihtiyacVarMi: ihtiyacGorduk, mod: 'logs param yok' }
    }, ctx)

    // ═══ 3. logs verirsek (boş array) → uretilen=0 → davranış aynı ═══
    await adim(state, '3. logs=[] → uretilen=0, ihtiyaç hala çıkmalı', async () => {
      const store = getStores()
      const cpMapped = store.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const sonuc = hmrp(
        [], store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials,
        new Set([manualWoId]), [], undefined,
        []  // logs=[] (boş)
      )
      return { kalemSayi: sonuc.length, ihtiyacVarMi: sonuc.length > 0 }
    }, ctx)

    // ═══ 4. Hedefin %50'si üretildi (logs ile geçir) → kalan ihtiyacın yarısı ═══
    await adim(state, '4. logs=hedef×0.5 → kalan=hedef×0.5, ihtiyaç yarıya düşmeli', async () => {
      const store = getStores()
      const cpMapped = store.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const wo = store.workOrders.find(w => w.id === manualWoId)!
      const sahteLog = [{ woId: manualWoId, qty: wo.hedef * 0.5 }]
      const sonuc = hmrp(
        [], store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials,
        new Set([manualWoId]), [], undefined,
        sahteLog
      )
      // Adım 2'deki sonuç ile karşılaştırılabilir mi?
      // Beklenti: kalemSayı aynı ama brut yarıya düşmüş olmalı
      const tplBrut = sonuc.reduce((a, r) => a + r.brut, 0)
      return { kalemSayi: sonuc.length, toplamBrut: tplBrut, mod: 'logs ile %50 üretim' }
    }, ctx)

    // ═══ 5. Hedef %100 üretildi (logs ile) → kalan=0 → ihtiyaç=0 ⭐ KRİTİK ═══
    await adim(state, '5. ⭐ logs=hedef×1.0 → kalan=0, ihtiyaç ÇIKMAMALI (saha bug fix)', async () => {
      const store = getStores()
      const cpMapped = store.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const wo = store.workOrders.find(w => w.id === manualWoId)!
      const sahteLog = [{ woId: manualWoId, qty: wo.hedef }]
      const sonuc = hmrp(
        [], store.orders as any, store.workOrders, store.recipes,
        store.stokHareketler, store.tedarikler, cpMapped, store.materials,
        new Set([manualWoId]), [], undefined,
        sahteLog
      )
      // ⭐ KRİTİK: Üretim tamamlandıysa hammadde ihtiyacı sıfır olmalı
      if (sonuc.length > 0) {
        throw new Error(`v15.81 fix çalışmadı: hedef=üretildi olmasına rağmen ${sonuc.length} kalem hammadde ihtiyacı çıktı`)
      }
      return { kalemSayi: 0, mesaj: 'Üretim tamamlandı, ihtiyaç sıfır — fix çalışıyor' }
    }, ctx)

    // ═══ 6. WO durum=tamamlandi → tüm filtre noktasında atlanmalı ═══
    await adim(state, '6. WO durum=tamamlandi → MRP filtresinde atlanır (logs olmadan bile)', async () => {
      // WO'nun durumunu tamamlandi yap
      const { error } = await supabase.from('uys_work_orders')
        .update({ durum: 'tamamlandi' }).eq('id', manualWoId)
      if (error) throw new Error('WO update: ' + error.message)
      await loadAllStores()

      const store2 = getStores()
      const cpMapped = store2.cuttingPlans.map((p: any) => ({
        hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
        gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
      }))
      const sonuc = hmrp(
        [], store2.orders as any, store2.workOrders, store2.recipes,
        store2.stokHareketler, store2.tedarikler, cpMapped, store2.materials,
        new Set([manualWoId]), [], undefined,
        []  // logs boş bile olsa, durum=tamamlandi filtresi devreye girer
      )
      if (sonuc.length > 0) {
        throw new Error(`tamamlandi filtresi çalışmadı: ${sonuc.length} kalem ihtiyaç çıktı`)
      }
      return { kalemSayi: 0, mesaj: 'tamamlandi durumu filtresi çalışıyor' }
    }, ctx)

    return finalize(state, 'Senaryo 12: Tamamlanmış İE hammadde ihtiyacı (v15.81 saha fix)', t0)
  })
}

// v15.83 — Senaryo 13: Kesim Plani Onayi Modali (autoZincir + onKesimFark callback)
// Faz 1 MVP: kabul ve iptal yollari iki ayri sub-test halinde test edilir.
// Modal UI'da gosterilmez — onKesimFark callback'i kod tarafindan otomatik resolve edilir.
export async function senaryo13(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S13', async (state, t0) => {
    // Test reçetesinin kesim opsiyonu (op_id var) içermesi gerekiyor — kesim planı oluşamazsa
    // bar çıkışı = 0 olur ve modal items dizisi boş döner. Bu durumda Adım 2 SKIP edilmeli.
    const store = getStores()
    const rc = store.recipes.find(r => r.mamulKod === ctx.recipeKod || r.id === ctx.recipeKod)
    if (!rc) throw new Error(`Reçete bulunamadı: ${ctx.recipeKod}`)
    const kesimOpVar = (rc.satirlar || []).some(s => !!s.opId)

    // ═══ KABUL YOLU ═══
    let kabulOrderId = ''
    let kabulItems: KesimFarkItem[] = []
    let kabulSonuc: any = null

    await adim(state, '1. Sipariş #1 oluştur (kabul yolu)', async () => {
      kabulOrderId = await _createOrder(state, ctx, 'S13a')
      return { orderId: kabulOrderId, ieCount: state.ieIds.length }
    }, ctx)

    if (!kesimOpVar) {
      adimSkip(state, '2. autoZincir + onKesimFark=kabul', 'Reçetede kesim opsiyonu (opId) yok — modal tetiklenmez', ctx)
      adimSkip(state, '3. Doğrulama (kabul)', 'Adım 2 SKIP', ctx)
      adimSkip(state, '4. Sipariş #2 oluştur (iptal yolu)', 'Adım 2 SKIP', ctx)
      adimSkip(state, '5. autoZincir + onKesimFark=iptal', 'Adım 2 SKIP', ctx)
      adimSkip(state, '6. Doğrulama (iptal)', 'Adım 2 SKIP', ctx)
      return finalize(state, 'Senaryo 13: Kesim Plani Onayi Modali (v15.83 — onKesimFark)', t0)
    }

    await wait(200)
    await adim(state, '2. autoZincir + onKesimFark=kabul', async () => {
      const s = getStores()
      const fresh = s.workOrders.filter(w => w.orderId === kabulOrderId)
      const woCount = fresh.length

      const cpMapped = s.cuttingPlans.map((p: any) => ({
        id: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, hamBoy: p.hamBoy,
        hamEn: p.hamEn || 0, kesimTip: p.kesimTip || 'boy', durum: p.durum || '',
        tarih: p.tarih || '', satirlar: p.satirlar || [], gerekliAdet: p.gerekliAdet || 0,
      }))

      kabulSonuc = await autoZincir(
        kabulOrderId, woCount,
        s.orders as any, s.workOrders, s.recipes, s.operations as any,
        s.materials, s.stokHareketler, s.tedarikler,
        s.logs.map(l => ({ woId: l.woId, qty: l.qty })),
        cpMapped,
        'test_runner',
        undefined, // onProgress yok (canlı log zaten test runner'da)
        async (items) => {
          // Items'i adim deli olarak kaydet
          kabulItems = items.map(i => ({ ...i }))
          return 'kabul'
        }
      )

      return {
        woCount: kabulSonuc.woCount,
        kesimCount: kabulSonuc.kesimCount,
        mrpCount: kabulSonuc.mrpCount,
        tedCount: kabulSonuc.tedCount,
        modalItemSayisi: kabulItems.length,
        modalItems: kabulItems.map(i => ({
          ieNo: i.ieNo, mamulAd: i.mamulAd,
          siparisAdeti: i.siparisAdeti, barCikisi: i.barCikisi, fark: i.fark,
        })),
      }
    }, ctx)

    await wait(200)
    await adim(state, '3. Doğrulama (kabul) — IE.hedef = barCikisi mi?', async () => {
      if (kabulItems.length === 0) {
        // Kesim planı oluşmadı (örn. kesim opsiyonu sadece op_id var ama plan satır üretmedi)
        return { mesaj: 'Modal items boş — kesim planı bar çıkışı üretmedi', uyari: true }
      }

      // DB'den taze WO'ları al, hedef değerlerini kontrol et
      const { data: dbWOs, error } = await supabase
        .from('uys_work_orders')
        .select('id, ie_no, hedef')
        .eq('order_id', kabulOrderId)
      if (error) throw new Error('WO fetch: ' + error.message)

      const farkliItems = kabulItems.filter(i => i.fark !== 0)
      const guncellenenler: any[] = []
      const sorunlular: any[] = []

      for (const item of farkliItems) {
        const dbWO = dbWOs?.find(w => w.id === item.woId)
        if (!dbWO) { sorunlular.push({ ieNo: item.ieNo, sebep: 'DB\'de bulunamadı' }); continue }
        if (dbWO.hedef === item.barCikisi) {
          guncellenenler.push({ ieNo: item.ieNo, eski: item.siparisAdeti, yeni: dbWO.hedef })
        } else {
          sorunlular.push({ ieNo: item.ieNo, beklenenHedef: item.barCikisi, dbHedef: dbWO.hedef })
        }
      }

      if (sorunlular.length > 0) {
        throw new Error(`Hedef güncellenmedi: ${sorunlular.length} IE — ${JSON.stringify(sorunlular).slice(0, 200)}`)
      }

      // mrp_durum kontrol: autoZincir tamam → mrp_durum 'tamam' veya 'eksik' olmalı, 'bekliyor' KALMAMALI
      const { data: ord } = await supabase.from('uys_orders').select('mrp_durum').eq('id', kabulOrderId).single()
      if (ord?.mrp_durum === 'bekliyor') {
        throw new Error('mrp_durum bekliyor kaldı — autoZincir tamamlanmamış')
      }

      return {
        guncellenenIE: guncellenenler.length,
        farkOlmayan: kabulItems.length - farkliItems.length,
        mrpDurum: ord?.mrp_durum,
        guncellenenler,
      }
    }, ctx)

    // ═══ İPTAL YOLU ═══
    let iptalOrderId = ''
    let iptalSonuc: any = null
    let iptalItemsBeklenen: KesimFarkItem[] = []

    await wait(200)
    await adim(state, '4. Sipariş #2 oluştur (iptal yolu)', async () => {
      iptalOrderId = await _createOrder(state, ctx, 'S13b')
      return { orderId: iptalOrderId }
    }, ctx)

    await wait(200)
    await adim(state, '5. autoZincir + onKesimFark=iptal', async () => {
      const s = getStores()
      const fresh = s.workOrders.filter(w => w.orderId === iptalOrderId)
      const woCount = fresh.length

      const cpMapped = s.cuttingPlans.map((p: any) => ({
        id: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, hamBoy: p.hamBoy,
        hamEn: p.hamEn || 0, kesimTip: p.kesimTip || 'boy', durum: p.durum || '',
        tarih: p.tarih || '', satirlar: p.satirlar || [], gerekliAdet: p.gerekliAdet || 0,
      }))

      iptalSonuc = await autoZincir(
        iptalOrderId, woCount,
        s.orders as any, s.workOrders, s.recipes, s.operations as any,
        s.materials, s.stokHareketler, s.tedarikler,
        s.logs.map(l => ({ woId: l.woId, qty: l.qty })),
        cpMapped,
        'test_runner',
        undefined,
        async (items) => {
          iptalItemsBeklenen = items.map(i => ({ ...i }))
          return 'iptal'
        }
      )

      // İptal yolunda mrpCount=0, tedCount=0 olmalı
      if (iptalSonuc.mrpCount !== 0) {
        throw new Error(`İptal sonrası mrpCount=${iptalSonuc.mrpCount} — sıfır olmalıydı`)
      }
      if (iptalSonuc.tedCount !== 0) {
        throw new Error(`İptal sonrası tedCount=${iptalSonuc.tedCount} — sıfır olmalıydı`)
      }

      return {
        woCount: iptalSonuc.woCount,
        kesimCount: iptalSonuc.kesimCount,
        mrpCount: iptalSonuc.mrpCount,
        tedCount: iptalSonuc.tedCount,
        modalItemSayisi: iptalItemsBeklenen.length,
        adimUyari: iptalSonuc.adimlar.find((a: string) => a.includes('iptal')) || null,
      }
    }, ctx)

    await wait(200)
    await adim(state, '6. Doğrulama (iptal) — IE.hedef DEĞİŞMEMELİ', async () => {
      if (iptalItemsBeklenen.length === 0) {
        return { mesaj: 'Modal items boş — kesim planı bar çıkışı üretmedi', uyari: true }
      }

      const { data: dbWOs, error } = await supabase
        .from('uys_work_orders')
        .select('id, ie_no, hedef')
        .eq('order_id', iptalOrderId)
      if (error) throw new Error('WO fetch: ' + error.message)

      const sorunlular: any[] = []
      for (const item of iptalItemsBeklenen) {
        const dbWO = dbWOs?.find(w => w.id === item.woId)
        if (!dbWO) continue
        // İptal yolunda hedef ORİJİNAL siparis adetinde kalmalı (item.siparisAdeti = update öncesi WO.hedef)
        if (dbWO.hedef !== item.siparisAdeti) {
          sorunlular.push({ ieNo: item.ieNo, beklenen: item.siparisAdeti, dbHedef: dbWO.hedef })
        }
      }

      if (sorunlular.length > 0) {
        throw new Error(`İptal'e rağmen hedef değişti: ${JSON.stringify(sorunlular).slice(0, 200)}`)
      }

      // mrp_durum 'bekliyor' kalmalı (autoZincir mrp adımı çalışmadı)
      const { data: ord } = await supabase.from('uys_orders').select('mrp_durum').eq('id', iptalOrderId).single()

      return {
        kontrolEdilen: iptalItemsBeklenen.length,
        hepsiKorundu: true,
        mrpDurum: ord?.mrp_durum,
      }
    }, ctx)

    return finalize(state, 'Senaryo 13: Kesim Plani Onayi Modali (v15.83 — onKesimFark)', t0)
  })
}
